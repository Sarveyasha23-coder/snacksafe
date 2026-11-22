import { Nutrients } from "./scoring";

export type IngredientFinding = {
  ingredient: string;
  category: "allergen" | "additive" | "ingredient";
  note: string;
  context: string;
  source: "ingredients list" | "allergen declaration" | "additive database tags";
};

export type SnackProduct = {
  id: string;
  name: string;
  brand: string;
  image?: string;
  category?: string;
  quantity?: string;
  ingredients?: string;
  nutrients: Nutrients;
  source: "Open Food Facts" | "Demo";
  sourceUrl?: string;
  barcode?: string;
  allergens?: string;
  additives?: string[];
  nutriScoreGrade?: string;
  dataCompleteness?: "more-complete" | "partial" | "limited";
};

// These are deliberately marked as demo data. They are not manufacturer label values.
export const demos: SnackProduct[] = [
  { id:"demo-chips", name:"Classic salted potato chips", brand:"SnackSafe demo", category:"Potato snacks", quantity:"Illustrative example · not a real product label", source:"Demo", ingredients:"Potatoes, edible vegetable oil, salt", nutrients:{energy:536,sugar:2.1,saturatedFat:3.2,salt:1.3,transFat:0,fiber:4.2,protein:6.5} },
  { id:"demo-makhana", name:"Roasted makhana", brand:"SnackSafe demo", category:"Roasted snacks", quantity:"Illustrative example · not a real product label", source:"Demo", ingredients:"Fox nuts, small amount of oil, seasoning", nutrients:{energy:360,sugar:1.2,saturatedFat:1.1,salt:0.5,transFat:0,fiber:7,protein:9} },
  { id:"demo-biscuits", name:"Cream biscuits", brand:"SnackSafe demo", category:"Biscuits", quantity:"Illustrative example · not a real product label", source:"Demo", ingredients:"Wheat flour, sugar, vegetable fat", nutrients:{energy:480,sugar:28,saturatedFat:8,salt:0.6,transFat:0,fiber:2,protein:5} }
];

function finite(value: unknown, maximum = 100): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 && n <= maximum ? n : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map(tag => tag.replace(/^\w{2,3}:/, "").replace(/-/g, " ").trim())
    .filter(Boolean)
    .slice(0, 100);
}

/** Convert only explicitly per-100 g OFF fields. Missing/implausible values stay missing. */
export function mapOff(p: Record<string, any>): SnackProduct {
  const x = p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {};
  const energyKcal = finite(x["energy-kcal_100g"], 1000);
  const energyKj = finite(x["energy_100g"], 4184);
  const salt = finite(x["salt_100g"]);
  const sodium = finite(x["sodium_100g"], 40);
  const saltFromSodium = sodium === undefined ? undefined : sodium * 2.5;
  const ingredients = cleanText(p.ingredients_text);
  const additives = cleanTags(p.additives_tags);
  const allergenTags = cleanTags(p.allergens_tags);
  const allergens = cleanText(p.allergens) ?? (allergenTags.length ? allergenTags.join(", ") : undefined);
  const nutrients: Nutrients = {
    energy: energyKcal ?? (energyKj === undefined ? undefined : energyKj / 4.184),
    sugar: finite(x["sugars_100g"]),
    saturatedFat: finite(x["saturated-fat_100g"]),
    salt: salt ?? (saltFromSodium !== undefined && saltFromSodium <= 100 ? saltFromSodium : undefined),
    transFat: finite(x["trans-fat_100g"]),
    fiber: finite(x["fiber_100g"]),
    protein: finite(x["proteins_100g"])
  };
  const present = Object.values(nutrients).filter(v => v !== undefined).length;
  const barcode = typeof (p.code ?? p._id) === "string" ? String(p.code ?? p._id) : "";
  const productName = cleanText(p.product_name) ?? cleanText(p.product_name_en) ?? "Unnamed product";
  const sourceUrl = /^\d{8,14}$/.test(barcode) ? `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}` : undefined;

  return {
    id: barcode || `off-${productName.slice(0, 24)}`,
    barcode: barcode || undefined,
    name: productName,
    brand: cleanText(p.brands) ?? "Brand not listed",
    image: cleanText(p.image_front_small_url) ?? cleanText(p.image_url),
    category: cleanText(p.categories),
    ingredients,
    quantity: cleanText(p.quantity),
    allergens,
    additives,
    nutriScoreGrade: typeof p.nutriscore_grade === "string" && /^[a-e]$/i.test(p.nutriscore_grade) ? p.nutriscore_grade.toUpperCase() : undefined,
    dataCompleteness: present >= 5 && ingredients ? "more-complete" : present >= 3 ? "partial" : "limited",
    source: "Open Food Facts",
    sourceUrl,
    nutrients
  };
}

type IngredientRule = {
  pattern: RegExp;
  category: IngredientFinding["category"];
  note: string;
  context: string;
  preferredSource: IngredientFinding["source"];
};

const ingredientNotes: IngredientRule[] = [
  { pattern: /\b(sugar|glucose syrup|corn syrup|fructose|dextrose|maltose)\b/i, category: "ingredient", note: "Sugar-containing ingredient listed", context: "Frequent high intake of free sugars can contribute to excess calorie intake and dental caries. Check the sugars value in the nutrition panel.", preferredSource: "ingredients list" },
  { pattern: /\b(palm oil|palmolein|coconut oil|hydrogenated|partially hydrogenated)\b/i, category: "ingredient", note: "Oil or fat ingredient listed", context: "The ingredient name alone does not establish the amount or health impact. Check saturated-fat and trans-fat values on the nutrition panel.", preferredSource: "ingredients list" },
  { pattern: /\b(monosodium glutamate|msg|e[\s-]?621)\b/i, category: "additive", note: "Flavour enhancer listed", context: "MSG is an authorised flavour enhancer in many food systems. Its presence alone does not mean a product is unsafe; individual sensitivity and total diet may matter.", preferredSource: "additive database tags" },
  { pattern: /\b(sodium nitrite|e[\s-]?250|sodium nitrate|e[\s-]?251)\b/i, category: "additive", note: "Preservative listed", context: "These preservatives are used in some processed foods under regulated conditions. Presence is not a stand-alone danger rating; product type and permitted use matter.", preferredSource: "additive database tags" },
  { pattern: /\b(artificial colour|tartrazine|sunset yellow|e[\s-]?102|e[\s-]?110)\b/i, category: "additive", note: "Colour additive listed", context: "A colour additive is declared. Regulatory permissions and applicable warning labels depend on the exact additive and jurisdiction.", preferredSource: "additive database tags" },
  { pattern: /\b(aspartame|e[\s-]?951|sucralose|e[\s-]?955|acesulfame|e[\s-]?950)\b/i, category: "additive", note: "High-intensity sweetener listed", context: "A sweetener is listed. This is not by itself evidence that the product is harmful; check the applicable label and your individual needs.", preferredSource: "additive database tags" },
  { pattern: /\b(wheat|gluten|barley|rye)\b/i, category: "allergen", note: "Gluten-containing grain indicated", context: "Relevant to people with coeliac disease or gluten-related disorders. Check the package's allergen declaration and cross-contact statement.", preferredSource: "allergen declaration" },
  { pattern: /\b(milk|whey|casein|lactose)\b/i, category: "allergen", note: "Milk-derived ingredient indicated", context: "Relevant to people with milk allergy; lactose intolerance is different. Check the package allergen declaration.", preferredSource: "allergen declaration" },
  { pattern: /\b(peanuts?|groundnuts?)\b/i, category: "allergen", note: "Peanut ingredient indicated", context: "Peanuts are a major allergen. Avoid if allergic and check cross-contact warnings on the physical pack.", preferredSource: "allergen declaration" },
  { pattern: /\b(soy|soya|soybeans?)\b/i, category: "allergen", note: "Soy ingredient indicated", context: "Relevant to people with soy allergy. Check the package allergen declaration and cross-contact statement.", preferredSource: "allergen declaration" },
  { pattern: /\b(sesame|til)\b/i, category: "allergen", note: "Sesame ingredient indicated", context: "Sesame can trigger serious allergic reactions. Check the package allergen declaration and cross-contact statement.", preferredSource: "allergen declaration" }
];

export function inspectIngredients(product: SnackProduct): IngredientFinding[] {
  const sources: Array<{ source: IngredientFinding["source"]; text: string }> = [
    { source: "ingredients list", text: product.ingredients ?? "" },
    { source: "allergen declaration", text: product.allergens ?? "" },
    { source: "additive database tags", text: (product.additives ?? []).join(", ") }
  ];

  return ingredientNotes.flatMap(rule => {
    const ordered = [rule.preferredSource, ...sources.map(source => source.source).filter(source => source !== rule.preferredSource)];
    for (const sourceName of ordered) {
      const source = sources.find(candidate => candidate.source === sourceName);
      const match = source?.text.match(rule.pattern);
      if (match) {
        return [{ ingredient: match[0], category: rule.category, note: rule.note, context: rule.context, source: sourceName }];
      }
    }
    return [];
  });
}
