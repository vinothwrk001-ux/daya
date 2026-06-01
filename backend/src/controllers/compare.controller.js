const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const compareService = require("../services/compare.service");

function requireUser(req) {
  if (!req.user?.sub) {
    throw new AppError("Login required to manage compare list", 401, "AUTH_REQUIRED");
  }
  return req.user.sub;
}

const list = asyncHandler(async (req, res) => {
  const data = await compareService.listCompareItems(requireUser(req));
  return ok(res, data, "Compare list retrieved");
});

const add = asyncHandler(async (req, res) => {
  const data = await compareService.addCompareItem(requireUser(req), req.params.productId);
  return ok(res, data, "Product added to compare");
});

const remove = asyncHandler(async (req, res) => {
  const data = await compareService.removeCompareItem(requireUser(req), req.params.productId);
  return ok(res, data, "Product removed from compare");
});

const status = asyncHandler(async (req, res) => {
  const data = await compareService.getCompareStatus(requireUser(req), req.params.productId);
  return ok(res, data, "Compare status retrieved");
});

const merge = asyncHandler(async (req, res) => {
  const data = await compareService.mergeGuestCompareItems(requireUser(req), req.body?.guestCompareItems || []);
  return ok(res, data, "Guest compare list merged");
});

module.exports = {
  list,
  add,
  remove,
  status,
  merge,
};
