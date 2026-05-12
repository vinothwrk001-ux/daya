const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const wishlistService = require("../services/wishlist.service");

const list = asyncHandler(async (req, res) => {
  const data = await wishlistService.listWishlist(req.user.sub);
  return ok(res, data, "Wishlist retrieved");
});

const add = asyncHandler(async (req, res) => {
  const { variantId, selectedAttributes } = req.body || {};
  const data = await wishlistService.addToWishlist(req.user.sub, req.params.productId, variantId, selectedAttributes);
  return ok(res, data, "Added to wishlist");
});

const remove = asyncHandler(async (req, res) => {
  const data = await wishlistService.removeFromWishlist(req.user.sub, req.params.productId);
  return ok(res, data, "Removed from wishlist");
});

const status = asyncHandler(async (req, res) => {
  const data = await wishlistService.getWishlistStatus(req.user.sub, req.params.productId);
  return ok(res, data, "Wishlist status retrieved");
});

module.exports = {
  list,
  add,
  remove,
  status,
};
