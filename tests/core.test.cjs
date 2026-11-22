const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeGtin, isValidGtin, sameGtin } = require("../.test-build/lib/barcodes.js");
const { scoreNutrition } = require("../.test-build/lib/scoring.js");
const { mapOff, inspectIngredients, demos } = require("../.test-build/lib/products.js");

test("validates supported GTIN lengths and check digits", () => {
  for (const code of ["96385074", "036000291452", "4006381333931", "10012345000017"]) {
    assert.equal(isValidGtin(code), true, `${code} should be valid`);
    assert.equal(normalizeGtin(code), code);
  }
  assert.equal(isValidGtin("4006381333932"), false, "wrong check digit must fail");
  assert.equal(isValidGtin("123456789"), false, "unsupported length must fail");
  assert.equal(isValidGtin("03600029145x"), false, "non-digit must fail");
});

test("recognises UPC-A and its zero-prefixed EAN-13 representation as the same GTIN", () => {
  assert.equal(sameGtin("036000291452", "0036000291452"), true);
  assert.equal(sameGtin("036000291452", "4006381333931"), false);
});

test("withholds the numeric concern score when fewer than three factors exist", () => {
  const empty = scoreNutrition({});
  assert.equal(empty.score, null);
  assert.equal(empty.band, "Insufficient data");
  assert.equal(empty.confidence, "Insufficient");
  const twoFactors = scoreNutrition({ sugar: 12, salt: 1 });
  assert.equal(twoFactors.score, null);
  assert.match(twoFactors.summary, /withheld/i);
});

test("calculates an experimental score only when at least three factors are present", () => {
  const result = scoreNutrition({ sugar: 12, salt: 1, energy: 450 });
  assert.equal(typeof result.score, "number");
  assert.equal(result.confidence, "Limited");
  assert.equal(result.factors.filter(factor => factor.available).length, 3);
});

test("maps only explicit per-100 g values and converts kJ and sodium correctly", () => {
  const product = mapOff({
    code: "4006381333931", product_name: "Example crisps", brands: "Example brand",
    ingredients_text: "Potatoes, wheat flour, vegetable oil",
    allergens_tags: ["en:gluten", "en:milk"], additives_tags: ["en:e621"],
    nutriments: { "energy_100g": 2092, "sodium_100g": 0.4, "sugars_100g": 12, "saturated-fat_100g": 4, "fiber_100g": 3, "proteins_100g": "not-a-number" }
  });
  assert.ok(Math.abs(product.nutrients.energy - 500) < 0.01);
  assert.equal(product.nutrients.salt, 1);
  assert.equal(product.nutrients.sugar, 12);
  assert.equal(product.nutrients.protein, undefined);
  assert.equal(product.barcode, "4006381333931");
  assert.equal(product.sourceUrl, "https://world.openfoodfacts.org/product/4006381333931");
  assert.deepEqual(product.additives, ["e621"]);
});

test("rejects implausible macro values instead of treating them as reliable label data", () => {
  const product = mapOff({ nutriments: { "sugars_100g": 120, "energy-kcal_100g": 2500 } });
  assert.equal(product.nutrients.sugar, undefined);
  assert.equal(product.nutrients.energy, undefined);
});

test("ingredient inspection uses declared allergen and additive sources", () => {
  const product = mapOff({ product_name: "Seasoned snack", ingredients_text: "Potato, vegetable oil, salt", allergens: "en:milk, en:soybeans", additives_tags: ["en:e621"] });
  const findings = inspectIngredients(product);
  assert.ok(findings.some(item => item.category === "allergen" && item.source === "allergen declaration"));
  assert.ok(findings.some(item => item.category === "additive" && item.source === "additive database tags"));
});

test("demo products remain explicitly identified as illustrative", () => {
  assert.ok(demos.every(product => product.source === "Demo"));
  assert.ok(demos.every(product => product.quantity.includes("Illustrative example")));
});
