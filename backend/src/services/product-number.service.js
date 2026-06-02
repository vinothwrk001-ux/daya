const { isValidObjectId } = require("mongoose");
const { Category } = require("../models/Category");
const { Subcategory } = require("../models/Subcategory");
const { Product } = require("../models/Product");
const { ProductNumberCounter } = require("../models/ProductNumberCounter");
const { AppError } = require("../utils/AppError");

function buildCounterKey(categoryCode, subcategoryCode) {
  return `${String(categoryCode || "").toUpperCase()}${String(subcategoryCode || "").toUpperCase()}`;
}

function formatProductNumber(counterKey, sequence) {
  const suffix = String(sequence).padStart(2, "0");
  return `${counterKey}${suffix}`;
}

async function getCategoryAndSubcategory(categoryId, subCategoryId) {
  if (!isValidObjectId(categoryId) || !isValidObjectId(subCategoryId)) {
    throw new AppError("Category or subcategory is invalid", 400, "VALIDATION_ERROR");
  }

  const [category, subcategory] = await Promise.all([
    Category.findById(categoryId).select("_id name code isActive").lean(),
    Subcategory.findById(subCategoryId).select("_id name code categoryId status").lean(),
  ]);

  if (!category) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }
  if (!subcategory) {
    throw new AppError("Subcategory not found", 404, "NOT_FOUND");
  }
  if (String(subcategory.categoryId) !== String(category._id)) {
    throw new AppError("Subcategory does not belong to selected category", 400, "VALIDATION_ERROR");
  }
  if (subcategory.status !== "active") {
    throw new AppError("Subcategory is disabled", 400, "VALIDATION_ERROR");
  }

  const categoryCode = String(category.code || category.name?.charAt(0) || "").trim().toUpperCase();
  const subcategoryCode = String(subcategory.code || subcategory.name?.charAt(0) || "").trim().toUpperCase();
  if (!categoryCode || !subcategoryCode) {
    throw new AppError("Category or subcategory code is missing", 400, "VALIDATION_ERROR");
  }

  return { category, subcategory, categoryCode, subcategoryCode };
}

async function generateNextProductNumber({ categoryId, subCategoryId }) {
  const { categoryCode, subcategoryCode } = await getCategoryAndSubcategory(categoryId, subCategoryId);
  const key = buildCounterKey(categoryCode, subcategoryCode);

  // Atomic increment guarantees concurrency-safe sequencing per key.
  const counter = await ProductNumberCounter.findOneAndUpdate(
    { key },
    { $inc: { sequence: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return formatProductNumber(key, counter.sequence);
}

async function previewNextProductNumber({ categoryId, subCategoryId }) {
  const { categoryCode, subcategoryCode } = await getCategoryAndSubcategory(categoryId, subCategoryId);
  const key = buildCounterKey(categoryCode, subcategoryCode);
  const current = await ProductNumberCounter.findOne({ key }).select("sequence").lean();
  const nextSequence = (current?.sequence || 0) + 1;
  return formatProductNumber(key, nextSequence);
}

async function assertUniqueProductNumber(productNumber) {
  const existing = await Product.findOne({ productNumber }).select("_id").lean();
  if (existing) {
    throw new AppError("Failed to generate unique product number", 409, "CONFLICT");
  }
}

module.exports = {
  generateNextProductNumber,
  previewNextProductNumber,
  getCategoryAndSubcategory,
  assertUniqueProductNumber,
};
