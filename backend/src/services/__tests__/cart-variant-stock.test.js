const assert = require("assert");
const mongoose = require("mongoose");
const cartService = require("../cart.service");
const cartRepo = require("../../repositories/cart.repository");
const productRepo = require("../../repositories/product.repository");

function createMongooseLikeSubdoc(data) {
  const doc = {
    quantity: data.quantity,
    price: data.price,
    image: data.image,
    variantId: data.variantId,
    variantSku: data.variantSku,
    variantTitle: data.variantTitle,
    variantAttributes: data.variantAttributes,
    maxQuantity: data.maxQuantity,
    availableStock: data.availableStock,
  };
  Object.defineProperty(doc, "productId", {
    enumerable: false,
    value: data.productId,
  });
  return doc;
}

async function runVariantStockScenario() {
  const productId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Demo 4",
    status: "APPROVED",
    isActive: true,
    price: 499,
    discountPrice: 399,
    stock: 6,
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
      {
        variantId: "yellow",
        title: "Yellow",
        isActive: true,
        stock: 2,
        reservedStock: 0,
        price: 499,
        sku: "DEMO4-YEL",
        attributes: { color: "Yellow" },
        images: [{ url: "https://example.com/yellow.jpg", isPrimary: true }],
      },
    ],
  };

  const cart = {
    userId,
    items: [],
    totalAmount: 0,
    currency: "INR",
    async save() {
      for (const item of this.items) {
        if (!item.productId) {
          const err = new Error("Validation failed");
          err.name = "ValidationError";
          throw err;
        }
      }
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
  cartRepo.findByUserId = async () => ({
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      productId: { _id: item.productId, name: product.name },
    })),
  });

  try {
    await cartService.addItem(userId, { productId, quantity: 1, variantId: "red" });
    assert.equal(cart.items.length, 1, "first red add should create one line");
    assert.equal(cart.items[0].quantity, 1, "first red add should set qty=1");

    cart.items[0] = createMongooseLikeSubdoc({
      productId,
      quantity: cart.items[0].quantity,
      price: cart.items[0].price,
      image: cart.items[0].image,
      variantId: "red",
      variantSku: "DEMO4-RED",
      variantTitle: "Red",
      variantAttributes: { color: "Red" },
      maxQuantity: 2,
      availableStock: 1,
    });

    await cartService.addItem(userId, { productId, quantity: 1, variantId: "red" });
    assert.equal(cart.items.length, 1, "second red add should merge into same line");
    assert.equal(cart.items[0].quantity, 2, "second red add should set qty=2");

    cart.items[0] = createMongooseLikeSubdoc({
      productId,
      quantity: cart.items[0].quantity,
      price: cart.items[0].price,
      image: cart.items[0].image,
      variantId: "red",
      variantSku: "DEMO4-RED",
      variantTitle: "Red",
      variantAttributes: { color: "Red" },
      maxQuantity: 2,
      availableStock: 0,
    });

    let thirdAddFailed = false;
    try {
      await cartService.addItem(userId, { productId, quantity: 1, variantId: "red" });
    } catch (error) {
      thirdAddFailed = true;
      assert.equal(error.statusCode, 409, "third red add should return 409");
      assert.equal(error.code, "OUT_OF_STOCK", "third red add should be out of stock");
      assert.match(error.message, /Red variant is out of stock/);
    }
    assert.equal(thirdAddFailed, true, "third red add must fail");
    assert.equal(cart.items[0].quantity, 2, "qty should remain 2 after rejected add");

    await cartService.addItem(userId, { productId, quantity: 1, variantId: "yellow" });
    assert.equal(cart.items.length, 2, "yellow variant should create a separate line");
    assert.equal(cart.items[1].variantId, "yellow");
    assert.equal(cart.items[1].quantity, 1);

    console.log("cart-variant-stock.test.js passed");
  } finally {
    productRepo.findById = originalFindById;
    cartRepo.upsertEmpty = originalUpsertEmpty;
    cartRepo.save = originalSave;
    cartRepo.findByUserId = originalFindByUserId;
  }
}

runVariantStockScenario().catch((error) => {
  console.error(error);
  process.exit(1);
});
