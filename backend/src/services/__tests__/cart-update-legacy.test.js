const assert = require("assert");
const mongoose = require("mongoose");
const cartService = require("../cart.service");
const cartRepo = require("../../repositories/cart.repository");
const productRepo = require("../../repositories/product.repository");

async function run() {
  const productId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: "Legacy Hoodie",
    status: "APPROVED",
    isActive: true,
    price: 1299,
    discountPrice: 999,
    stock: 8,
    reservedStock: 0,
    images: [{ url: "https://example.com/hoodie.jpg", isPrimary: true }],
    variants: [],
  };

  const cart = {
    userId,
    items: [
      {
        productId,
        quantity: 2,
        price: 999,
        image: "https://example.com/hoodie.jpg",
        variantId: "",
        variantSku: "",
        variantTitle: "",
        variantAttributes: {},
      },
    ],
    totalAmount: 1998,
    currency: "INR",
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
    const updated = await cartService.updateItem(userId, { productId, quantity: 1, variantId: "" });
    assert.equal(updated.items[0].quantity, 1, "legacy product quantity should decrement without variant errors");
    console.log("cart-update-legacy.test.js passed");
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
