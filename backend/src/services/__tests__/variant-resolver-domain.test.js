const assert = require("assert");
const { resolveNextAvailableVariant } = require("../variantResolver.service");

async function run() {
  const product = {
    _id: "prod_1",
    stock: 3,
    reservedStock: 0,
    variants: [
      { variantId: "S", title: "S", stock: 1, reservedStock: 0, isActive: true, sortOrder: 1 },
      { variantId: "M", title: "M", stock: 2, reservedStock: 0, isActive: true, sortOrder: 2 },
      { variantId: "XL", title: "XL", stock: 0, reservedStock: 0, isActive: true, sortOrder: 3 },
    ],
  };

  let result = resolveNextAvailableVariant(product, []);
  assert.equal(result.variant?.variantId, "S", "First click should select S");
  assert.equal(result.availableStock, 1, "S should expose one available unit");

  result = resolveNextAvailableVariant(product, [{ productId: "prod_1", variantId: "S", quantity: 1 }]);
  assert.equal(result.variant?.variantId, "M", "Second click should select M");
  assert.equal(result.availableStock, 2, "M should expose two available units before any M in cart");

  result = resolveNextAvailableVariant(product, [
    { productId: "prod_1", variantId: "S", quantity: 1 },
    { productId: "prod_1", variantId: "M", quantity: 1 },
  ]);
  assert.equal(result.variant?.variantId, "M", "Third click should still select M until exhausted");
  assert.equal(result.availableStock, 1, "One M should remain available after one M already in cart");

  result = resolveNextAvailableVariant(product, [
    { productId: "prod_1", variantId: "S", quantity: 1 },
    { productId: "prod_1", variantId: "M", quantity: 2 },
  ]);
  assert.equal(result.variant, null, "Fourth click should show no variant available when all stock exhausted");
  assert.equal(result.availableStock, 0, "Available stock should be zero when exhausted");

  const legacyProduct = {
    _id: "prod_2",
    stock: 2,
    reservedStock: 0,
    variants: [],
  };
  result = resolveNextAvailableVariant(legacyProduct, [{ productId: "prod_2", variantId: "", quantity: 1 }]);
  assert.equal(result.variant, null, "Legacy product should not return a variant id");
  assert.equal(result.availableStock, 1, "Legacy product stock should decrement by cart quantity");

  console.log("Variant resolver domain checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
