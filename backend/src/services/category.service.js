const { Category } = require("../models/Category");
const { AppError } = require("../utils/AppError");
const { generateSlug } = require("../utils/slug");

function sanitizeCategoryPayload(payload = {}) {
  const name = String(payload.name || "").trim();
  const slug = generateSlug(payload.slug || name);
  const code = String(payload.code || "").trim().toUpperCase() || name.charAt(0).toUpperCase();
  const icon = typeof payload.icon === "string" ? payload.icon.trim() : "";
  const logo = typeof payload.logo === "string" ? payload.logo.trim() : "";
  const color = typeof payload.color === "string" ? payload.color.trim() : "";
  const order = Number.isFinite(Number(payload.order)) ? Number(payload.order) : 0;

  return {
    name,
    code,
    slug,
    icon,
    logo,
    color,
    order,
    isActive: payload.isActive !== false,
  };
}

async function ensureUniqueSlug(slug, excludeId) {
  const existing = await Category.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .lean();

  if (existing) {
    throw new AppError("Category slug already exists", 409, "CONFLICT");
  }
}

async function listActiveCategories() {
  return await Category.find({ isActive: true })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();
}

async function listAllCategories() {
  return await Category.find({})
    .sort({ order: 1, name: 1, createdAt: 1 })
    .lean();
}

async function createCategory(payload) {
  const category = sanitizeCategoryPayload(payload);
  if (!category.name) {
    throw new AppError("Category name is required", 400, "VALIDATION_ERROR");
  }
  if (!category.slug) {
    throw new AppError("Category slug is required", 400, "VALIDATION_ERROR");
  }

  await ensureUniqueSlug(category.slug);
  return await Category.create(category);
}

async function updateCategory(categoryId, payload) {
  const existing = await Category.findById(categoryId);
  if (!existing) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  const nextValues = {
    ...sanitizeCategoryPayload({
      ...existing.toObject(),
      ...payload,
      isActive: payload.isActive ?? existing.isActive,
    }),
  };

  if (!nextValues.name) {
    throw new AppError("Category name is required", 400, "VALIDATION_ERROR");
  }

  await ensureUniqueSlug(nextValues.slug, existing._id);

  existing.name = nextValues.name;
  existing.code = nextValues.code;
  existing.slug = nextValues.slug;
  existing.icon = nextValues.icon;
  existing.logo = nextValues.logo;
  existing.color = nextValues.color;
  existing.order = nextValues.order;
  existing.isActive = nextValues.isActive;

  await existing.save();
  return existing;
}

async function toggleCategory(categoryId, isActive) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  category.isActive = Boolean(isActive);
  await category.save();
  return category;
}

module.exports = {
  listActiveCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  toggleCategory,
};
