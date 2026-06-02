const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const PricingConfig = require("../models/PricingConfig");
const PricingRule = require("../models/PricingRule");
const pricingCategoryService = require("../services/pricing-category.service");
const pricingService = require("../services/pricing.service");
const { isValidObjectId } = require("mongoose");

function normalizeCategoryIdInput(value) {
  if (value == null || value === "") return undefined;
  if (typeof value === "object") {
    const nested = value._id || value.id;
    return nested ? String(nested) : undefined;
  }
  return String(value);
}

function assertOptionalObjectId(value, fieldName) {
  if (value === undefined) return;
  if (!isValidObjectId(value)) {
    throw new AppError(`${fieldName} must be a valid ObjectId string`, 400, "VALIDATION_ERROR");
  }
}

// ==================== LEGACY PRICING CONFIG ENDPOINTS ====================

/**
 * GET /api/pricing
 * Get current pricing configuration (public)
 */
const getPricingConfig = asyncHandler(async (req, res) => {
  if (req.query?.subtotal !== undefined) {
    const parsedSubtotal = parseFloat(req.query.subtotal);
    const parsedItemCount = parseInt(req.query.itemCount || "1", 10);

    if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
      throw new AppError("subtotal must be a valid non-negative number", 400);
    }

    const result = await pricingService.calculateOrderTotal(parsedSubtotal, parsedItemCount);
    return ok(res, result, "Pricing calculation retrieved");
  }

  const config = await PricingConfig.findOne({ isActive: true });

  if (!config) {
    return ok(
      res,
      {
        deliveryFee: 0,
        deliveryFreeAbove: 0,
        platformFeePercentage: 0,
        platformFeeCapped: 0,
        taxPercentage: 0,
        taxableBasis: "subtotal",
        handlingFee: 0,
        bulkDiscountThreshold: 0,
        bulkDiscountPercentage: 0,
        maxDiscountPercentage: 0,
        returnWindow: 0,
        refundProcessingDays: 0,
        shippingModes: {
          selfShipping: true,
          platformShipping: true,
        },
        isActive: false,
        isFallback: true,
      },
      "Pricing configuration fallback returned"
    );
  }

  return ok(res, config, "Pricing configuration retrieved");
});

/**
 * GET /api/admin/pricing
 * Get current pricing configuration (admin)
 */
const getAdminPricingConfig = asyncHandler(async (req, res) => {
  const config = await PricingConfig.findOne({ isActive: true }).select("+_id");

  if (!config) {
    return ok(
      res,
      {
        _id: null,
        deliveryFee: 0,
        deliveryFreeAbove: 0,
        platformFeePercentage: 0,
        platformFeeCapped: 0,
        taxPercentage: 0,
        taxableBasis: "subtotal",
        handlingFee: 0,
        bulkDiscountThreshold: 0,
        bulkDiscountPercentage: 0,
        maxDiscountPercentage: 0,
        returnWindow: 0,
        refundProcessingDays: 0,
        shippingModes: {
          selfShipping: true,
          platformShipping: true,
        },
        isActive: false,
        isFallback: true,
      },
      "Pricing configuration fallback returned"
    );
  }

  return ok(res, config, "Pricing configuration retrieved");
});

/**
 * PUT /api/admin/pricing/:id
 * Update pricing configuration (admin only)
 */
const updatePricingConfig = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    deliveryFee,
    deliveryFreeAbove,
    platformFeePercentage,
    platformFeeCapped,
    taxPercentage,
    taxableBasis,
    handlingFee,
    bulkDiscountThreshold,
    bulkDiscountPercentage,
    maxDiscountPercentage,
    returnWindow,
    refundProcessingDays,
    shippingModes,
    notes,
  } = req.body;

  // Validation
  const errors = [];

  if (deliveryFee !== undefined && (typeof deliveryFee !== "number" || deliveryFee < 0)) {
    errors.push("Delivery fee must be a non-negative number");
  }
  if (deliveryFreeAbove !== undefined && (typeof deliveryFreeAbove !== "number" || deliveryFreeAbove < 0)) {
    errors.push("Delivery free above must be a non-negative number");
  }
  if (platformFeePercentage !== undefined && (typeof platformFeePercentage !== "number" || platformFeePercentage < 0 || platformFeePercentage > 100)) {
    errors.push("Platform fee percentage must be between 0 and 100");
  }
  if (platformFeeCapped !== undefined && (typeof platformFeeCapped !== "number" || platformFeeCapped < 0)) {
    errors.push("Platform fee capped must be a non-negative number");
  }
  if (taxPercentage !== undefined && (typeof taxPercentage !== "number" || taxPercentage < 0 || taxPercentage > 100)) {
    errors.push("Tax percentage must be between 0 and 100");
  }
  if (taxableBasis !== undefined && !["subtotal", "subtotalWithoutDiscount", "subtotalWithFees"].includes(taxableBasis)) {
    errors.push("Invalid taxable basis");
  }
  if (handlingFee !== undefined && (typeof handlingFee !== "number" || handlingFee < 0)) {
    errors.push("Handling fee must be a non-negative number");
  }
  if (bulkDiscountPercentage !== undefined && (typeof bulkDiscountPercentage !== "number" || bulkDiscountPercentage < 0 || bulkDiscountPercentage > 100)) {
    errors.push("Bulk discount percentage must be between 0 and 100");
  }
  if (maxDiscountPercentage !== undefined && (typeof maxDiscountPercentage !== "number" || maxDiscountPercentage < 0 || maxDiscountPercentage > 100)) {
    errors.push("Max discount percentage must be between 0 and 100");
  }

  if (errors.length > 0) {
    throw new AppError(errors.join("; "), 400);
  }

  const updateData = {};

  if (deliveryFee !== undefined) updateData.deliveryFee = deliveryFee;
  if (deliveryFreeAbove !== undefined) updateData.deliveryFreeAbove = deliveryFreeAbove;
  if (platformFeePercentage !== undefined) updateData.platformFeePercentage = platformFeePercentage;
  if (platformFeeCapped !== undefined) updateData.platformFeeCapped = platformFeeCapped;
  if (taxPercentage !== undefined) updateData.taxPercentage = taxPercentage;
  if (taxableBasis !== undefined) updateData.taxableBasis = taxableBasis;
  if (handlingFee !== undefined) updateData.handlingFee = handlingFee;
  if (bulkDiscountThreshold !== undefined) updateData.bulkDiscountThreshold = bulkDiscountThreshold;
  if (bulkDiscountPercentage !== undefined) updateData.bulkDiscountPercentage = bulkDiscountPercentage;
  if (maxDiscountPercentage !== undefined) updateData.maxDiscountPercentage = maxDiscountPercentage;
  if (returnWindow !== undefined) updateData.returnWindow = returnWindow;
  if (refundProcessingDays !== undefined) updateData.refundProcessingDays = refundProcessingDays;
  if (shippingModes !== undefined) updateData.shippingModes = shippingModes;
  if (notes !== undefined) updateData.notes = notes;

  updateData.updatedBy = req.user.sub;

  const config = await PricingConfig.findByIdAndUpdate(id, updateData, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!config) {
    throw new AppError("Pricing configuration not found", 404);
  }

  return ok(res, config, "Pricing configuration updated");
});

/**
 * POST /api/admin/pricing/initialize
 * Initialize default pricing configuration (admin only)
 */
const initializePricingConfig = asyncHandler(async (req, res) => {
  // Check if config already exists
  const existing = await PricingConfig.findOne({});

  if (existing) {
    throw new AppError("Pricing configuration already exists", 400);
  }

  const defaultConfig = new PricingConfig({
    deliveryFee: 50,
    deliveryFreeAbove: 500,
    platformFeePercentage: 5,
    platformFeeCapped: 0,
    taxPercentage: 18,
    taxableBasis: "subtotal",
    handlingFee: 0,
    bulkDiscountThreshold: 3,
    bulkDiscountPercentage: 5,
    maxDiscountPercentage: 50,
    returnWindow: 7,
    refundProcessingDays: 3,
    shippingModes: {
      selfShipping: true,
      platformShipping: true,
    },
    isActive: true,
    updatedBy: req.user?.sub || null,
    notes: "Initial pricing configuration",
  });

  await defaultConfig.save();

  return ok(res, defaultConfig, "Pricing configuration initialized");
});

// ==================== DYNAMIC PRICING RULES ====================

/**
 * GET /api/admin/pricing-rules
 * Get all pricing rules (admin only)
 */
const getAllPricingRules = asyncHandler(async (req, res) => {
  const { active, category, categoryId, sortBy = "sortOrder" } = req.query;

  const query = { isArchived: false };

  if (active === "true") {
    query.isActive = true;
  } else if (active === "false") {
    query.isActive = false;
  }

  if (category) {
    query.category = category;
  }
  if (categoryId) {
    assertOptionalObjectId(String(categoryId), "categoryId");
    query.categoryId = String(categoryId);
  }

  const rules = await PricingRule.find(query)
    .populate("categoryId", "name key description isActive isSystem sortOrder")
    .sort(sortBy === "name" ? { displayName: 1 } : { [sortBy]: 1 })
    .lean();

  return ok(res, rules.map((rule) => pricingService.decorateRule(rule)), "Pricing rules retrieved");
});

/**
 * GET /api/pricing-rules
 * Get all active pricing rules (public for checkout)
 */
const getActivePricingRules = asyncHandler(async (req, res) => {
  const rules = await pricingService.getActiveRules(req.query?.paymentMethod);
  return ok(res, rules, "Active pricing rules retrieved");
});

/**
 * GET /api/admin/pricing-rules/:id
 * Get a specific pricing rule (admin only)
 */
const getPricingRule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rule = await PricingRule.findById(id).populate("categoryId", "name key description isActive isSystem sortOrder");

  if (!rule || rule.isArchived) {
    throw new AppError("Pricing rule not found", 404);
  }

  return ok(res, rule, "Pricing rule retrieved");
});

/**
 * POST /api/admin/pricing-rules
 * Create a new pricing rule (admin only)
 */
const createPricingRule = asyncHandler(async (req, res) => {
  const { key, displayName, type, value, category, appliesTo, paymentMethod, sortOrder, maxCap, minOrderValue, freeAboveValue, description, notes, isActive } = req.body;
  const categoryId = normalizeCategoryIdInput(req.body?.categoryId);
  assertOptionalObjectId(categoryId, "categoryId");

  // Validate input
  const validationErrors = pricingService.validateRule({
    key,
    displayName,
    type,
    value,
    category,
    categoryId,
    appliesTo,
    paymentMethod,
    maxCap,
    minOrderValue,
    freeAboveValue,
  });

  if (validationErrors.length > 0) {
    throw new AppError(validationErrors.join("; "), 400);
  }

  // Check if key already exists
  const existing = await PricingRule.findOne({ key: key.toLowerCase() });
  if (existing) {
    throw new AppError(`Pricing rule with key "${key}" already exists`, 400);
  }

  const resolvedCategory = await pricingCategoryService.resolveCategory({
    categoryId,
    categoryKey: category,
    fallbackKey: "OTHER",
  });

  const newRule = new PricingRule({
    key: key.toLowerCase(),
    displayName,
    type,
    value,
    category: resolvedCategory.key,
    categoryId: resolvedCategory._id,
    appliesTo: appliesTo || "ORDER",
    paymentMethod: pricingService.normalizePaymentMethod(paymentMethod),
    sortOrder: sortOrder || 0,
    maxCap: maxCap || 0,
    minOrderValue: minOrderValue || 0,
    freeAboveValue: freeAboveValue || 0,
    description,
    notes,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    lastModifiedBy: req.user.sub,
  });

  if (newRule.isActive) {
    await pricingService.assertCategoryCanEnableRules(String(resolvedCategory._id));
  }

  await newRule.save();
  await newRule.populate("categoryId", "name key description isActive isSystem sortOrder");

  return ok(res, pricingService.decorateRule(newRule.toObject()), "Pricing rule created", 201);
});

/**
 * PUT /api/admin/pricing-rules/:id
 * Update a pricing rule (admin only)
 */
const updatePricingRule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { key, displayName, type, value, category, appliesTo, paymentMethod, sortOrder, maxCap, minOrderValue, freeAboveValue, description, notes, isActive } = req.body;
  const categoryId = normalizeCategoryIdInput(req.body?.categoryId);
  assertOptionalObjectId(categoryId, "categoryId");

  const rule = await PricingRule.findById(id);

  if (!rule || rule.isArchived) {
    throw new AppError("Pricing rule not found", 404);
  }

  // Prepare update data
  const updateData = {};

  if (key && key !== rule.key) {
    // Check if new key already exists
    const existing = await PricingRule.findOne({ key: key.toLowerCase(), _id: { $ne: id } });
    if (existing) {
      throw new AppError(`Pricing rule with key "${key}" already exists`, 400);
    }
    updateData.key = key.toLowerCase();
  }

  if (displayName !== undefined) updateData.displayName = displayName;
  if (type !== undefined) updateData.type = type;
  if (value !== undefined) updateData.value = value;
  if (category !== undefined || categoryId !== undefined) {
    const resolvedCategory = await pricingCategoryService.resolveCategory({
      categoryId,
      categoryKey: category !== undefined ? category : rule.category,
      fallbackKey: rule.category || "OTHER",
    });
    updateData.category = resolvedCategory.key;
    updateData.categoryId = resolvedCategory._id;
    if (!resolvedCategory.isActive) {
      updateData.isActive = false;
    }
  }
  if (appliesTo !== undefined) updateData.appliesTo = appliesTo;
  if (paymentMethod !== undefined) updateData.paymentMethod = pricingService.normalizePaymentMethod(paymentMethod);
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (maxCap !== undefined) updateData.maxCap = maxCap;
  if (minOrderValue !== undefined) updateData.minOrderValue = minOrderValue;
  if (freeAboveValue !== undefined) updateData.freeAboveValue = freeAboveValue;
  if (description !== undefined) updateData.description = description;
  if (notes !== undefined) updateData.notes = notes;
  if (isActive !== undefined) updateData.isActive = isActive;

  updateData.lastModifiedBy = req.user.sub;

  // Validate the entire rule after update
  const validationData = { ...rule.toObject(), ...updateData };
  const validationErrors = pricingService.validateRule(validationData);

  if (validationErrors.length > 0) {
    throw new AppError(validationErrors.join("; "), 400);
  }

  if (updateData.isActive === true) {
    const targetCategoryId = updateData.categoryId || rule.categoryId;
    await pricingService.assertCategoryCanEnableRules(String(targetCategoryId));
  }

  const updated = await PricingRule.findByIdAndUpdate(id, updateData, {
    returnDocument: "after",
    runValidators: true,
  }).populate("categoryId", "name key description isActive isSystem sortOrder");

  return ok(res, pricingService.decorateRule(updated.toObject()), "Pricing rule updated");
});

/**
 * DELETE /api/admin/pricing-rules/:id
 * Delete a pricing rule (soft delete - archive)
 */
const deletePricingRule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rule = await PricingRule.findById(id);

  if (!rule || rule.isArchived) {
    throw new AppError("Pricing rule not found", 404);
  }

  // Soft delete (archive)
  await PricingRule.findByIdAndUpdate(id, { isArchived: true, lastModifiedBy: req.user.sub });

  return ok(res, { id }, "Pricing rule archived");
});

const getPricingCategories = asyncHandler(async (req, res) => {
  const categories = await pricingCategoryService.listPricingCategories({ includeInactive: true });
  return ok(res, categories, "Pricing categories retrieved");
});

const createPricingCategory = asyncHandler(async (req, res) => {
  const category = await pricingCategoryService.createPricingCategory(req.body || {});
  return ok(res, category, "Pricing category created", 201);
});

const updatePricingCategory = asyncHandler(async (req, res) => {
  const category = await pricingCategoryService.updatePricingCategory(req.params.id, req.body || {});
  return ok(res, category, "Pricing category updated");
});

const deletePricingCategory = asyncHandler(async (req, res) => {
  const category = await pricingCategoryService.deletePricingCategory(req.params.id);
  const fallbackCategory = await pricingCategoryService.resolveCategory({ categoryKey: "OTHER" });

  await PricingRule.updateMany(
    { categoryId: category._id },
    { category: fallbackCategory.key, categoryId: fallbackCategory._id }
  );

  return ok(res, { id: req.params.id }, "Pricing category deleted");
});

/**
 * POST /api/admin/pricing-rules/batch/toggle-active
 * Bulk toggle active status for multiple rules
 */
const toggleMultipleRulesActive = asyncHandler(async (req, res) => {
  const { ruleIds, isActive } = req.body;

  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    throw new AppError("ruleIds must be a non-empty array", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const normalizedRuleIds = ruleIds.map((id) => String(id));

  if (isActive === true) {
    const rules = await PricingRule.find({ _id: { $in: normalizedRuleIds }, isArchived: false })
      .populate("categoryId", "isActive")
      .lean();

    const blockedRule = rules.find((rule) => rule.categoryId && rule.categoryId.isActive === false);
    if (blockedRule) {
      throw new AppError("Cannot activate rules whose category is inactive", 400, "CATEGORY_INACTIVE");
    }
  }

  const result = await PricingRule.updateMany(
    { _id: { $in: normalizedRuleIds }, isArchived: false },
    { $set: { isActive, lastModifiedBy: req.user.sub } }
  );

  return ok(res, result, "Pricing rules updated");
});

const togglePricingRuleActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body || {};

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400, "VALIDATION_ERROR");
  }

  const rule = await PricingRule.findById(id);
  if (!rule || rule.isArchived) {
    throw new AppError("Pricing rule not found", 404);
  }

  if (isActive === true) {
    await pricingService.assertCategoryCanEnableRules(String(rule.categoryId));
  }

  const updated = await PricingRule.findByIdAndUpdate(
    id,
    { $set: { isActive, lastModifiedBy: req.user.sub } },
    { returnDocument: "after", runValidators: true }
  ).populate("categoryId", "name key description isActive isSystem sortOrder");

  return ok(res, pricingService.decorateRule(updated.toObject()), "Pricing rule active state updated");
});

/**
 * GET /api/pricing/calculate
 * Calculate order total with current pricing rules (public for checkout)
 */
const calculateOrderTotal = asyncHandler(async (req, res) => {
  const { subtotal, itemCount = 1, paymentMethod } = req.query;

  const parsedSubtotal = parseFloat(subtotal);
  const parsedItemCount = parseInt(itemCount);

  if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
    throw new AppError("subtotal must be a valid non-negative number", 400);
  }

  const result = await pricingService.calculateOrderTotal(parsedSubtotal, parsedItemCount, paymentMethod);

  return ok(res, result, "Order total calculated");
});

/**
 * GET /api/pricing/summary
 * Get pricing summary (public)
 */
const getPricingSummary = asyncHandler(async (req, res) => {
  const summary = await pricingService.getPricingSummary(req.query?.paymentMethod);
  return ok(res, summary, "Pricing summary retrieved");
});

/**
 * POST /api/pricing/preview-rule
 * Preview the impact of a specific rule (public for preview)
 */
const previewRuleImpact = asyncHandler(async (req, res) => {
  const { ruleId, subtotal } = req.body;

  if (!ruleId) {
    throw new AppError("ruleId is required", 400);
  }

  const parsedSubtotal = parseFloat(subtotal);
  if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
    throw new AppError("subtotal must be a valid non-negative number", 400);
  }

  const preview = await pricingService.previewRuleImpact(ruleId, parsedSubtotal);

  return ok(res, preview, "Rule impact previewed");
});

module.exports = {
  // Legacy endpoints (kept for backward compatibility)
  getPricingConfig,
  getAdminPricingConfig,
  updatePricingConfig,
  initializePricingConfig,

  // New dynamic pricing rules endpoints
  getAllPricingRules,
  getActivePricingRules,
  getPricingRule,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  getPricingCategories,
  createPricingCategory,
  updatePricingCategory,
  deletePricingCategory,
  toggleMultipleRulesActive,
  togglePricingRuleActive,
  calculateOrderTotal,
  getPricingSummary,
  previewRuleImpact,
};
