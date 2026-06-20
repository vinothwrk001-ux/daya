const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const cartMergeService = require("../cartMerge.service");
const guestCartService = require("../guestCart.service");
const cartRepo = require("../../repositories/cart.repository");
const productRepo = require("../../repositories/product.repository");

test("mergeGuestCartIntoUserCart caps merged quantity to sellable stock", async () => {
  const productId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Demo 4",
    status: "APPROVED",
    isActive: true,
    price: 499,
    stock: 2,
    reservedStock: 0,
    images: [{ url: "https://example.com/demo4.jpg", isPrimary: true }],
    variants: [
      {
        variantId: "red",
        title: "Red",
        isActive: true,
        stock: 2,
        reservedStock: 0,
        price: 499,
        sku: "DEMO4-RED",
        attributes: { color: "Red" },
        images: [{ url: "https://example.com/red.jpg", isPrimary: true }],
      },
    ],
  };

  const cart = {
    userId,
    items: [
      {
        productId,
        quantity: 1,
        price: 499,
        image: "",
        variantId: "red",
        variantSku: "DEMO4-RED",
        variantTitle: "Red",
        variantAttributes: {},
      },
    ],
    totalAmount: 499,
    async save() {
      return this;
    },
  };

  const originalFindById = productRepo.findById;
  const originalUpsertEmpty = cartRepo.upsertEmpty;
  const originalSave = cartRepo.save;
  const originalFindByUserId = cartRepo.findByUserId;

  productRepo.findById = async () => product;
  cartRepo.upsertEmpty = async () => cart;
  cartRepo.save = async (doc) => doc.save();
  cartRepo.findByUserId = async () => cart;

  try {
    const mergeResult = await cartMergeService.mergeGuestCartIntoUserCart(userId, [
      {
        productId,
        quantity: 2,
        price: 499,
        image: "",
        variantId: "red",
        variantSku: "DEMO4-RED",
        variantTitle: "Red",
        variantAttributes: {},
      },
    ]);

    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 2, "guest 2 + user 1 should cap to sellable 2");
    assert.equal(mergeResult.adjusted, true);
    assert.match(mergeResult.conflicts[0].reason, /adjusted due to stock availability/);
  } finally {
    productRepo.findById = originalFindById;
    cartRepo.upsertEmpty = originalUpsertEmpty;
    cartRepo.save = originalSave;
    cartRepo.findByUserId = originalFindByUserId;
  }
});

test("guest validateAndEnrichItem validates total quantity per variant", async () => {
  const productId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Demo 4",
    status: "APPROVED",
    isActive: true,
    price: 499,
    stock: 2,
    reservedStock: 0,
    images: [{ url: "https://example.com/demo4.jpg", isPrimary: true }],
    variants: [
      {
        variantId: "red",
        title: "Red",
        isActive: true,
        stock: 2,
        reservedStock: 0,
        price: 499,
        sku: "DEMO4-RED",
        attributes: { color: "Red" },
        images: [{ url: "https://example.com/red.jpg", isPrimary: true }],
      },
    ],
  };

  const originalFindById = productRepo.findById;
  productRepo.findById = async () => product;

  try {
    const first = await guestCartService.validateAndEnrichItem(productId, 1, "red");
    assert.equal(first.quantity, 1);

    const second = await guestCartService.validateAndEnrichItem(productId, 2, "red");
    assert.equal(second.quantity, 2);

    await assert.rejects(
      () => guestCartService.validateAndEnrichItem(productId, 3, "red"),
      (error) => error.statusCode === 409 && error.code === "INSUFFICIENT_STOCK"
    );
  } finally {
    productRepo.findById = originalFindById;
  }
});
