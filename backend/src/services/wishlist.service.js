const { AppError } = require("../utils/AppError");
const { Wishlist } = require("../models/Wishlist");
const { Product } = require("../models/Product");

async function ensureProductExists(productId) {
  const product = await Product.findById(productId).select("_id name status isActive stock");
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  return product;
}

async function listWishlist(userId) {
  const items = await Wishlist.find({ userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "productId",
      select: "name category price discountPrice images stock status isActive slug",
    });

  return items
    .filter((item) => item.productId)
    .map((item) => ({
      _id: item._id,
      product: item.productId,
      addedAt: item.createdAt,
    }));
}

async function addToWishlist(userId, productId, variantId = null, selectedAttributes = {}) {
  const product = await ensureProductExists(productId);

  const existing = await Wishlist.findOne({ userId, productId });
  if (existing) {
    // Update existing wishlist item with new variant info
    if (variantId || Object.keys(selectedAttributes).length > 0) {
      existing.variantId = variantId || existing.variantId;
      existing.selectedAttributes = Object.keys(selectedAttributes).length > 0 ? selectedAttributes : existing.selectedAttributes;
      await existing.save();
    }
    return {
      saved: true,
      productId: product._id,
      variantId: existing.variantId,
      selectedAttributes: existing.selectedAttributes,
    };
  }

  const newItem = await Wishlist.create({ userId, productId, variantId, selectedAttributes });
  return {
    saved: true,
    productId: product._id,
    variantId: newItem.variantId,
    selectedAttributes: newItem.selectedAttributes,
  };
}

async function removeFromWishlist(userId, productId) {
  await Wishlist.findOneAndDelete({ userId, productId });
  return {
    saved: false,
    productId,
  };
}

async function getWishlistStatus(userId, productId) {
  const item = await Wishlist.findOne({ userId, productId }).select("_id");
  return {
    saved: Boolean(item),
    productId,
  };
}

module.exports = {
  listWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistStatus,
};
