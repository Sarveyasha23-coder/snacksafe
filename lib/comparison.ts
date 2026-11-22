import type { SnackProduct } from "./products";
import { scoreNutrition, type Nutrients } from "./scoring";

export type ComparisonMetricKey = keyof Nutrients;
export type ComparisonRow = {
  key: ComparisonMetricKey;
  label: string;
  unit: string;
  direction: "lower" | "higher";
  note: string;
  values: Array<number | undefined>;
  leadingProductIds: string[];
  complete: boolean;
};

const metricDefinitions: Array<{
  key: ComparisonMetricKey;
  label: string;
  unit: string;
  direction: "lower" | "higher";
  note: string;
}> = [
  { key: "energy", label: "Energy", unit: "kcal/100 g", direction: "lower", note: "Lower energy per 100 g; portion size and overall diet still matter." },
  { key: "sugar", label: "Total sugars", unit: "g/100 g", direction: "lower", note: "Lower total sugars per 100 g. The label does not distinguish all naturally occurring and added sugars." },
  { key: "salt", label: "Salt", unit: "g/100 g", direction: "lower", note: "Lower salt per 100 g is generally preferable for limiting sodium intake." },
  { key: "saturatedFat", label: "Saturated fat", unit: "g/100 g", direction: "lower", note: "Lower saturated fat per 100 g is generally preferable." },
  { key: "transFat", label: "Trans fat", unit: "g/100 g", direction: "lower", note: "Lower declared trans fat is preferable. A reported zero may reflect rounding or label rules." },
  { key: "fiber", label: "Fibre", unit: "g/100 g", direction: "higher", note: "More fibre per 100 g; this metric alone does not establish overall product quality." },
  { key: "protein", label: "Protein", unit: "g/100 g", direction: "higher", note: "More protein per 100 g; protein content alone does not establish overall product quality." }
];

/**
 * Compares only explicit per-100 g values. A metric leader is shown only when
 * every selected product has a valid value, preventing missing data from
 * silently changing the comparison.
 */
export function buildComparisonRows(products: SnackProduct[]): ComparisonRow[] {
  return metricDefinitions.map(definition => {
    const values = products.map(product => {
      const value = product.nutrients[definition.key];
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
    });
    const complete = products.length >= 2 && values.every(value => value !== undefined);
    let leadingProductIds: string[] = [];

    if (complete) {
      const numericValues = values as number[];
      const target = definition.direction === "lower"
        ? Math.min(...numericValues)
        : Math.max(...numericValues);
      leadingProductIds = products
        .filter((_, index) => numericValues[index] === target)
        .map(product => product.id);
    }

    return { ...definition, values, leadingProductIds, complete };
  });
}

export function comparisonScore(product: SnackProduct): number | null {
  return scoreNutrition(product.nutrients).score;
}

/** Basic shape check for data restored from browser storage. */
export function isStoredSnackProduct(value: unknown): value is SnackProduct {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SnackProduct>;
  if (typeof candidate.id !== "string" || candidate.id.length > 180) return false;
  if (typeof candidate.name !== "string" || candidate.name.length > 240) return false;
  if (typeof candidate.brand !== "string" || candidate.brand.length > 160) return false;
  if (candidate.source !== "Demo" && candidate.source !== "Open Food Facts") return false;
  if (!candidate.nutrients || typeof candidate.nutrients !== "object") return false;
  if (candidate.sourceUrl !== undefined && (typeof candidate.sourceUrl !== "string" || !/^https:\/\/world\.openfoodfacts\.org\/product\/\d{8,14}$/.test(candidate.sourceUrl))) return false;
  if (candidate.image !== undefined && (typeof candidate.image !== "string" || !candidate.image.startsWith("https://") || candidate.image.length > 2048)) return false;
  const nutrientLimits: Record<ComparisonMetricKey, number> = {
    energy: 1000, sugar: 100, salt: 100, saturatedFat: 100, transFat: 100, fiber: 100, protein: 100
  };
  const nutrientKeys = Object.keys(nutrientLimits) as ComparisonMetricKey[];
  return nutrientKeys.every(key => {
    const nutrient = (candidate.nutrients as Nutrients)[key];
    return nutrient === undefined || (typeof nutrient === "number" && Number.isFinite(nutrient) && nutrient >= 0 && nutrient <= nutrientLimits[key]);
  });
}
