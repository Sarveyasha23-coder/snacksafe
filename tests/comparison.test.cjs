const test = require("node:test");
const assert = require("node:assert/strict");
const { buildComparisonRows, isStoredSnackProduct } = require("../.test-build/lib/comparison.js");
const { demos, mapOff } = require("../.test-build/lib/products.js");

function product(id, nutrients) {
  return { id, name: id, brand: "Test", source: "Open Food Facts", nutrients };
}

test("compares per-100 g nutrients and highlights the metric leader", () => {
  const rows = buildComparisonRows([
    product("salty", { salt: 1.8, sugar: 4, fiber: 2 }),
    product("less-salt", { salt: 0.6, sugar: 7, fiber: 5 })
  ]);
  const salt = rows.find(row => row.key === "salt");
  const sugar = rows.find(row => row.key === "sugar");
  assert.deepEqual(salt.leadingProductIds, ["less-salt"]);
  assert.deepEqual(sugar.leadingProductIds, ["salty"]);
  assert.equal(salt.complete, true);
});

test("does not declare a metric leader when any selected product has missing data", () => {
  const rows = buildComparisonRows([product("known", { salt: 0.5 }), product("unknown", {})]);
  const salt = rows.find(row => row.key === "salt");
  assert.equal(salt.complete, false);
  assert.deepEqual(salt.leadingProductIds, []);
  assert.deepEqual(salt.values, [0.5, undefined]);
});

test("keeps ties as multiple metric leaders", () => {
  const rows = buildComparisonRows([product("a", { fiber: 4 }), product("b", { fiber: 4 })]);
  const fiber = rows.find(row => row.key === "fiber");
  assert.deepEqual(fiber.leadingProductIds, ["a", "b"]);
});

test("accepts valid saved products and rejects malformed or negative nutrient values", () => {
  const valid = mapOff({ product_name: "Verified shape", code: "4006381333931", nutriments: { "salt_100g": 1 } });
  assert.equal(isStoredSnackProduct(valid), true);
  assert.equal(isStoredSnackProduct({ ...valid, nutrients: { salt: -1 } }), false);
  assert.equal(isStoredSnackProduct({ ...valid, sourceUrl: "javascript:alert(1)" }), false);
  assert.equal(isStoredSnackProduct({ ...valid, nutrients: { energy: 1200 } }), false);
  assert.equal(isStoredSnackProduct({ name: "missing fields" }), false);
});

test("demo products remain identifiable after comparison mapping", () => {
  assert.ok(demos.every(item => item.source === "Demo"));
  assert.ok(buildComparisonRows(demos.slice(0, 2)).every(row => row.values.length === 2));
});
