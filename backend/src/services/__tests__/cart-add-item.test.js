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
  };
  Object.defineProperty(doc, "productId", {
    enumerable: false,
    value: data.productId,
  });
  return doc;
}

async function run() {
  const productId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Test Tee",
    status: "APPROVED",
    isActive: true,
    price: 499,
    discountPrice: 399,
    stock: 10,
    reservedStock: 0,
    images: [{ url: "https://example.com/tee.jpg", isPrimary: true }],
    variants: [],
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
          err.errors = {
            "items.0.productId": { message: "Path 'productId' is required" },
          };
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
    await cartService.addItem(userId, { productId, quantity: 1 });
    assert.equal(cart.items.length, 1, "first add should create one cart item");
    assert.ok(cart.items[0].productId, "first item should keep productId");

    cart.items[0] = createMongooseLikeSubdoc({
      productId,
      quantity: cart.items[0].quantity,
      price: cart.items[0].price,
      image: cart.items[0].image,
      variantId: "",
      variantSku: "",
      variantTitle: "",
      variantAttributes: {},
    });

    const result = await cartService.addItem(userId, { productId, quantity: 1 });
    assert.equal(cart.items.length, 1, "second add should merge into existing item");
    assert.equal(cart.items[0].quantity, 2, "quantity should increment");
    assert.ok(cart.items[0].productId, "productId must survive duplicate add");
    assert.equal(result.addedItem.quantity, 2, "addedItem should reflect merged quantity");
    console.log("cart-add-item.test.js passed");
  } finally {
    productRepo.findById = originalFindById;
    cartRepo.upsertEmpty = originalUpsertEmpty;
    cartRepo.save = originalSave;
    cartRepo.findByUserId = originalFindByUserId;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
