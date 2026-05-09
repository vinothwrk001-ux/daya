import { api } from "./api";
import { adminHttp } from "./adminHttp";

/**
 * PUBLIC APIs - No authentication required
 */

/**
 * Get current pricing configuration for checkout calculations
 */
export async function getPricingConfig() {
  const { data } = await api.get("/api/pricing");
  return data;
}

/**
 * Get all active pricing rules (for checkout display)
 */
export async function getActivePricingRules(paymentMethod) {
  const { data } = await api.get("/api/pricing-rules", {
    params: paymentMethod ? { paymentMethod } : {},
  });
  return data;
}

/**
 * Get pricing summary (breakdown by category)
 */
export async function getPricingSummary(paymentMethod) {
  const { data } = await api.get("/api/pricing/summary", {
    params: paymentMethod ? { paymentMethod } : {},
  });
  return data;
}

/**
 * Calculate order total with current pricing rules
 * @param {number} subtotal - Order subtotal
 * @param {number} itemCount - Total items in order
 * @returns {Object} Pricing breakdown with charges
 */
export async function calculateOrderTotal(subtotal, itemCount = 1, paymentMethod) {
  const { data } = await api.get("/api/pricing/calculate", {
    params: { subtotal, itemCount, ...(paymentMethod ? { paymentMethod } : {}) },
  });
  return data;
}

/**
 * Preview the impact of a specific pricing rule
 * @param {string} ruleId - Rule ID or key
 * @param {number} subtotal - Amount to calculate on
 * @returns {Object} Rule details and calculated impact
 */
export async function previewRuleImpact(ruleId, subtotal) {
  const { data } = await api.post("/api/pricing/preview-rule", {
    ruleId,
    subtotal,
  });
  return data;
}

/**
 * ADMIN APIs - Admin authentication required
 */

/**
 * Get pricing configuration (admin view)
 */
export async function getAdminPricingConfig() {
  const { data } = await adminHttp.get("/api/admin/pricing");
  return data;
}

/**
 * Update pricing configuration
 */
export async function updatePricingConfig(id, updates) {
  const { data } = await adminHttp.put(`/api/admin/pricing/${id}`, updates);
  return data;
}

/**
 * Initialize default pricing configuration (one-time setup)
 */
export async function initializePricingConfig() {
  const { data } = await adminHttp.post("/api/admin/pricing/initialize");
  return data;
}

// ============ Dynamic Pricing Rules APIs ============

/**
 * Get all pricing rules (admin)
 * @param {Object} options - Query options
 * @param {boolean} options.active - Filter by active status
 * @param {string} options.category - Filter by category
 * @returns {Array} Pricing rules
 */
export async function getAllPricingRules(options = {}) {
  const params = {};
  if (options.active !== undefined) params.active = options.active;
  if (options.category) params.category = options.category;
  if (options.categoryId) params.categoryId = options.categoryId;

  const { data } = await adminHttp.get("/api/admin/pricing-rules", { params });
  return data;
}

/**
 * Get a specific pricing rule (admin)
 * @param {string} ruleId - Rule ID
 * @returns {Object} Pricing rule
 */
export async function getPricingRule(ruleId) {
  const { data } = await adminHttp.get(`/api/admin/pricing-rules/${ruleId}`);
  return data;
}

/**
 * Create a new pricing rule (admin)
 * @param {Object} ruleData - Rule data
 * @returns {Object} Created pricing rule
 */
export async function createPricingRule(ruleData) {
  const { data } = await adminHttp.post("/api/admin/pricing-rules", ruleData);
  return data;
}

/**
 * Update a pricing rule (admin)
 * @param {string} ruleId - Rule ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated pricing rule
 */
export async function updatePricingRule(ruleId, updates) {
  const { data } = await adminHttp.put(
    `/api/admin/pricing-rules/${ruleId}`,
    updates
  );
  return data;
}

export async function togglePricingRuleActive(ruleId, isActive) {
  const { data } = await adminHttp.patch(`/api/admin/pricing-rules/${ruleId}/active`, {
    isActive,
  });
  return data;
}

/**
 * Delete/archive a pricing rule (admin)
 * @param {string} ruleId - Rule ID
 * @returns {Object} Result
 */
export async function deletePricingRule(ruleId) {
  const { data } = await adminHttp.delete(`/api/admin/pricing-rules/${ruleId}`);
  return data;
}

/**
 * Toggle active status for multiple rules (admin)
 * @param {Array} ruleIds - Array of rule IDs
 * @param {boolean} isActive - New active status
 * @returns {Object} Result
 */
export async function toggleMultipleRulesActive(ruleIds, isActive) {
  const { data } = await adminHttp.patch(
    "/api/admin/pricing-rules/batch/toggle-active",
    { ruleIds, isActive }
  );
  return data;
}

export async function getPricingCategories() {
  const { data } = await adminHttp.get("/api/admin/pricing-categories");
  return data;
}

export async function createPricingCategory(categoryData) {
  const { data } = await adminHttp.post("/api/admin/pricing-categories", categoryData);
  return data;
}

export async function updatePricingCategory(categoryId, updates) {
  const { data } = await adminHttp.put(`/api/admin/pricing-categories/${categoryId}`, updates);
  return data;
}

export async function deletePricingCategory(categoryId) {
  const { data } = await adminHttp.delete(`/api/admin/pricing-categories/${categoryId}`);
  return data;
}

/**
 * Calculate price breakdown for checkout
 * 
 * Applies pricing configuration to order items
 * @param {Object} params
 * @param {number} params.subtotal - Subtotal before fees and tax
 * @param {number} params.discount - Applied discount amount
 * @param {Object} params.pricingConfig - Current pricing configuration
 * @returns {Object} Breakdown object
 */
export function calculatePriceBreakdown(params) {
  const {
    subtotal = 0,
    discount = 0,
    itemCount = 1,
    pricingConfig = {},
  } = params;

  // Get config values with defaults
  const deliveryFee = Number(pricingConfig.deliveryFee || 50);
  const deliveryFreeAbove = Number(pricingConfig.deliveryFreeAbove || 500);
  const platformFeePercentage = Number(pricingConfig.platformFeePercentage || 5);
  const handlingFee = Number(pricingConfig.handlingFee || 0);
  const taxPercentage = Number(pricingConfig.taxPercentage || 18);
  const taxableBasis = pricingConfig.taxableBasis || "subtotal";

  // MRP is original price before discount
  const mrp = subtotal + discount;

  // Determine applicable delivery fee
  let appliedDeliveryFee = 0;
  if (mrp < deliveryFreeAbove) {
    appliedDeliveryFee = deliveryFee;
  }

  // Platform fee (usually 5% of product price)
  const platformFee = (subtotal * platformFeePercentage) / 100;

  // Calculate taxable amount based on configuration
  let taxableAmount = 0;
  switch (taxableBasis) {
    case "subtotal":
      taxableAmount = subtotal;
      break;
    case "subtotalWithoutDiscount":
      taxableAmount = mrp;
      break;
    case "subtotalWithFees":
      taxableAmount = subtotal + appliedDeliveryFee + handlingFee;
      break;
    default:
      taxableAmount = subtotal;
  }

  // Calculate tax
  const taxAmount = (taxableAmount * taxPercentage) / 100;

  // Calculate total
  const totalAmount =
    subtotal +
    appliedDeliveryFee +
    platformFee +
    handlingFee +
    taxAmount -
    discount;

  // Total savings
  const totalSavings = discount;

  return {
    mrp: Math.round(mrp * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    deliveryFee: Math.round(appliedDeliveryFee * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    handlingFee: Math.round(handlingFee * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100,
    itemCount,
  };
}
