const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  getSellableStock,
  getVariantAvailability,
  assertCanAddQuantity,
  assertCanSetQuantity,
  buildStockErrorMessage,
} = require("../../utils/cartStock");

test("getSellableStock uses physical stock minus reserved stock", () => {
  assert.equal(getSellableStock({ stock: 5, reservedStock: 2 }), 3);
  assert.equal(getSellableStock({ stock: 2, reservedStock: 0 }), 2);
});

test("getVariantAvailability subtracts in-cart quantity per variant", () => {
  const productId = new mongoose.Types.ObjectId();
  const availability = getVariantAvailability({
    productId,
    variant: { variantId: "red", stock: 2, reservedStock: 0 },
    cartItems: [{ productId, variantId: "red", quantity: 1 }],
  });

  assert.equal(availability.sellable, 2);
  assert.equal(availability.inCart, 1);
  assert.equal(availability.available, 1);
});

test("assertCanAddQuantity allows increment while headroom remains", () => {
  const availability = { sellable: 2, inCart: 1, available: 1 };
  assert.doesNotThrow(() => assertCanAddQuantity({ qty: 1, availability, variant: { variantId: "red", title: "Red" } }));
});

test("assertCanAddQuantity rejects when variant is out of stock", () => {
  const availability = { sellable: 2, inCart: 2, available: 0 };
  assert.throws(
    () => assertCanAddQuantity({ qty: 1, availability, variant: { variantId: "red", title: "Red" } }),
    (error) => error.code === "OUT_OF_STOCK" && error.statusCode === 409
  );
});

test("assertCanSetQuantity validates total desired quantity against sellable stock", () => {
  const availability = { sellable: 2, inCart: 0, available: 2 };
  assert.throws(
    () => assertCanSetQuantity({ qty: 3, availability, variant: { variantId: "red", title: "Red" }, currentQty: 2 }),
    (error) => error.code === "INSUFFICIENT_STOCK" && error.statusCode === 409
  );
});

test("buildStockErrorMessage includes variant label", () => {
  const message = buildStockErrorMessage({
    code: "OUT_OF_STOCK",
    variant: { title: "Red" },
    available: 0,
    requested: 1,
  });
  assert.match(message, /Red variant is out of stock/);
});
