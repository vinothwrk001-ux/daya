const assert = require("assert");
const mongoose = require("mongoose");
const {
  resolveReelProductLinks,
  resolveReelProductIds,
  isProductLinkedToReel,
  normalizeLinkedProductsInput,
  buildLinkedFromProductIds,
  getStockStatus,
  serializeFeedProduct,
} = require("../reelProductHelpers");
const { AppError } = require("../../../utils/AppError");

async function run() {
  const productA = new mongoose.Types.ObjectId();
  const productB = new mongoose.Types.ObjectId();
  const productC = new mongoose.Types.ObjectId();

  const legacyReel = {
    associatedProducts: [productA, productB],
    linkedProducts: [],
  };

  const links = resolveReelProductLinks(legacyReel);
  assert.equal(links.length, 2, "legacy associatedProducts should resolve");
  assert.equal(String(links[0].productId), String(productA));
  assert.equal(links[0].featured, true, "first legacy product should be featured");

  const linkedReel = {
    associatedProducts: [productC],
    linkedProducts: [
      { productId: productB, sortOrder: 1, featured: false, active: true },
      { productId: productA, sortOrder: 0, featured: true, active: true },
    ],
  };

  const ordered = resolveReelProductLinks(linkedReel);
  assert.equal(String(ordered[0].productId), String(productA), "linkedProducts should sort by sortOrder");
  assert.equal(String(ordered[1].productId), String(productB));

  const ids = resolveReelProductIds(linkedReel);
  assert.deepEqual(ids, [String(productA), String(productB)]);

  assert.equal(isProductLinkedToReel(linkedReel, productA), true);
  assert.equal(isProductLinkedToReel(linkedReel, productC), false);

  const normalized = normalizeLinkedProductsInput([
    { productId: productA, sortOrder: 2, featured: true },
    { productId: productB, sortOrder: 0, featured: false },
    { productId: productB, sortOrder: 5, featured: false },
  ]);
  assert.equal(normalized.length, 2, "duplicate productIds should be deduped");

  const built = buildLinkedFromProductIds([productA, productB]);
  assert.equal(built.length, 2);
  assert.equal(built[0].featured, true);

  assert.equal(getStockStatus({ stock: 0 }), "out_of_stock");
  assert.equal(getStockStatus({ stock: 3 }), "low_stock");
  assert.equal(getStockStatus({ stock: 20 }), "in_stock");

  const serialized = serializeFeedProduct(
    {
      _id: productA,
      name: "Black T-Shirt",
      slug: "black-t-shirt",
      price: 999,
      salePrice: 799,
      images: [{ url: "https://example.com/shirt.jpg" }],
      stock: 12,
      category: { name: "Fashion" },
      variants: [],
    },
    { sortOrder: 0, featured: true }
  );
  assert.equal(serialized.name, "Black T-Shirt");
  assert.equal(serialized.stockStatus, "in_stock");
  assert.equal(serialized.category, "Fashion");

  let threw = false;
  try {
    normalizeLinkedProductsInput([{ productId: "invalid-id" }]);
  } catch (error) {
    threw = error instanceof AppError;
  }
  assert.equal(threw, true, "invalid productId should throw AppError");

  console.log("reel-product-links.test.js: all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
