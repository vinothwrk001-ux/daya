const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { CompareItem } = require("../models/CompareItem");
const { Product } = require("../models/Product");

const MAX_COMPARE_ITEMS = 4;

function assertObjectId(value, label = "id") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${label}`, 400, "INVALID_ID");
  }
}

async function ensureComparableProduct(productId) {
  assertObjectId(productId, "product id");
  const product = await Product.findById(productId).select("_id name status isActive stock");
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  if (product.status && !["APPROVED", "active"].includes(product.status)) {
    throw new AppError("Product is not available for comparison", 400, "PRODUCT_UNAVAILABLE");
  }
  if (product.isActive === false) {
    throw new AppError("Product is not available for comparison", 400, "PRODUCT_UNAVAILABLE");
  }
  return product;
}

function mapCompareItem(item) {
  return {
    _id: item._id,
    product: item.productId,
    addedAt: item.createdAt,
  };
}

async function listCompareItems(userId) {
  assertObjectId(userId, "user id");
  const items = await CompareItem.find({ userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "productId",
      select: "name category price discountPrice images stock status isActive slug attributes brand ratings",
    });

  return {
    items: items.filter((item) => item.productId).map(mapCompareItem),
    itemCount: items.length,
    maxItems: MAX_COMPARE_ITEMS,
  };
}

async function addCompareItem(userId, productId) {
  assertObjectId(userId, "user id");
  const product = await ensureComparableProduct(productId);
  const existing = await CompareItem.findOne({ userId, productId });
  if (existing) {
    return {
      saved: true,
      productId: product._id,
      itemCount: await CompareItem.countDocuments({ userId }),
      maxItems: MAX_COMPARE_ITEMS,
    };
  }

  const itemCount = await CompareItem.countDocuments({ userId });
  if (itemCount >= MAX_COMPARE_ITEMS) {
    throw new AppError(`You can compare up to ${MAX_COMPARE_ITEMS} products at a time`, 400, "COMPARE_LIMIT_REACHED");
  }

  await CompareItem.create({ userId, productId });
  return {
    saved: true,
    productId: product._id,
    itemCount: itemCount + 1,
    maxItems: MAX_COMPARE_ITEMS,
  };
}

async function removeCompareItem(userId, productId) {
  assertObjectId(userId, "user id");
  assertObjectId(productId, "product id");
  await CompareItem.findOneAndDelete({ userId, productId });
  return {
    saved: false,
    productId,
    itemCount: await CompareItem.countDocuments({ userId }),
    maxItems: MAX_COMPARE_ITEMS,
  };
}

async function getCompareStatus(userId, productId) {
  assertObjectId(userId, "user id");
  assertObjectId(productId, "product id");
  const item = await CompareItem.findOne({ userId, productId }).select("_id");
  return {
    saved: Boolean(item),
    productId,
  };
}

async function mergeGuestCompareItems(userId, guestCompareItems = []) {
  assertObjectId(userId, "user id");
  if (!Array.isArray(guestCompareItems) || !guestCompareItems.length) {
    return listCompareItems(userId);
  }

  const uniqueProductIds = [
    ...new Set(
      guestCompareItems
        .map((item) => item?.productId || item?.product?._id || item?._id)
        .filter(Boolean)
        .map(String)
    ),
  ].slice(0, MAX_COMPARE_ITEMS);

  for (const productId of uniqueProductIds) {
    const count = await CompareItem.countDocuments({ userId });
    if (count >= MAX_COMPARE_ITEMS) break;
    const existing = await CompareItem.findOne({ userId, productId }).select("_id");
    if (existing) continue;
    await ensureComparableProduct(productId);
    await CompareItem.create({ userId, productId });
  }

  return listCompareItems(userId);
}

module.exports = {
  MAX_COMPARE_ITEMS,
  listCompareItems,
  addCompareItem,
  removeCompareItem,
  getCompareStatus,
  mergeGuestCompareItems,
};
