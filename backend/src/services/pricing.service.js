const { AppError } = require("../utils/AppError");
const PricingRule = require("../models/PricingRule");
const pricingCategoryService = require("./pricing-category.service");
const { isValidObjectId } = require("mongoose");

/**
 * Pricing Calculation Service
 * 
 * Dynamically calculates order totals based on active pricing rules.
 * Supports FIXED and PERCENTAGE-based charges.
 * Handles conditional application based on order value.
 */
class PricingService {
  normalizePaymentMethod(paymentMethod) {
    const normalized = String(paymentMethod || "ALL").toUpperCase();
    return ["ALL", "ONLINE", "COD"].includes(normalized) ? normalized : "ALL";
  }

  normalizeCategoryId(value) {
    if (value == null || value === "") return null;
    if (typeof value === "object") {
      const nestedId = value._id || value.id || null;
      return nestedId ? String(nestedId) : null;
    }
    return String(value);
  }

  async assertCategoryCanEnableRules(categoryId) {
    if (!categoryId) return null;
    const category = await pricingCategoryService.getCategoryById(categoryId);
    if (!category.isActive) {
      throw new AppError("Cannot activate a pricing rule while its category is inactive", 400, "CATEGORY_INACTIVE");
    }
    return category;
  }

  decorateRule(rule) {
    const categoryDoc = rule.categoryId && typeof rule.categoryId === "object" ? rule.categoryId : null;
    const categoryIsActive = categoryDoc ? Boolean(categoryDoc.isActive) : true;
    const inheritedInactive = !categoryIsActive;
    const effectiveIsActive = Boolean(rule.isActive) && !inheritedInactive;

    return {
      ...rule,
      categoryId: categoryDoc || rule.categoryId,
      effectiveIsActive,
      inheritedInactive,
    };
  }

  /**
   * Get all active pricing rules
   * @returns {Promise<Array>} Array of active pricing rules sorted by sortOrder
   */
  buildActiveRuleQuery(paymentMethod = "ALL", extraQuery = {}) {
    const normalizedPaymentMethod = this.normalizePaymentMethod(paymentMethod);
    const query = {
      isActive: true,
      isArchived: false,
      ...extraQuery,
    };

    if (normalizedPaymentMethod === "ALL") {
      query.$or = [
        { paymentMethod: { $exists: false } },
        { paymentMethod: "ALL" },
      ];
      return query;
    }

    query.$or = [
      { paymentMethod: { $exists: false } },
      { paymentMethod: "ALL" },
      { paymentMethod: normalizedPaymentMethod },
    ];
    return query;
  }

  async getActiveRules(paymentMethod = "ALL") {
    await pricingCategoryService.ensureDefaultPricingCategoriesIfNeeded();
    const rules = await PricingRule.find(this.buildActiveRuleQuery(paymentMethod))
      .populate("categoryId", "name key description isActive isSystem sortOrder")
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    return rules
      .map((rule) => this.decorateRule(rule))
      .filter((rule) => rule.effectiveIsActive);
  }

  /**
   * Get rules by category
   * @param {string} category - Rule category (DELIVERY, PLATFORM_FEE, TAX, etc.)
   * @returns {Promise<Array>} Active rules in the specified category
   */
  async getRulesByCategory(category, paymentMethod = "ALL") {
    await pricingCategoryService.ensureDefaultPricingCategoriesIfNeeded();
    const rules = await PricingRule.find(this.buildActiveRuleQuery(paymentMethod, { category }))
      .populate("categoryId", "name key description isActive isSystem sortOrder")
      .sort({ sortOrder: 1 })
      .lean();
    return rules
      .map((rule) => this.decorateRule(rule))
      .filter((rule) => rule.effectiveIsActive);
  }

  /**
   * Calculate the amount a single rule should charge
   * @param {Object} rule - Pricing rule object
   * @param {number} baseAmount - Base amount (subtotal for percentage calc)
   * @param {number} itemCount - Number of items in order (for ITEM-based rules)
   * @returns {number} Amount to charge
   */
  calculateRuleAmount(rule, baseAmount, itemCount = 1) {
    if (!rule.isActive) return 0;

    // Check minimum order value condition
    if (rule.minOrderValue > 0 && baseAmount < rule.minOrderValue) {
      return 0;
    }

    // Check free above condition
    if (rule.freeAboveValue > 0 && baseAmount >= rule.freeAboveValue) {
      return 0;
    }

    let amount = 0;

    if (rule.type === "FIXED") {
      amount = rule.value;
    } else if (rule.type === "PERCENTAGE") {
      amount = (baseAmount * rule.value) / 100;
    }

    // Apply cap if set
    if (rule.maxCap > 0 && amount > rule.maxCap) {
      amount = rule.maxCap;
    }

    // For ITEM-based rules, multiply by item count
    if (rule.appliesTo === "ITEM") {
      amount *= itemCount;
    }

    return Math.round(amount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculate order total with all charges
   * 
   * @param {number} subtotal - Order subtotal (before any fees/taxes)
   * @param {number} itemCount - Total items in order (for ITEM-based rules)
   * @returns {Promise<Object>} Breakdown with subtotal, charges, and total
   * 
   * @example
   * const result = await pricingService.calculateOrderTotal(1000, 5);
   * // Returns:
   * // {
   * //   subtotal: 1000,
   * //   charges: [
   * //     { id: "...", key: "delivery_fee", name: "Delivery Fee", amount: 50 },
   * //     { id: "...", key: "platform_fee", name: "Platform Fee", amount: 20 },
   * //     { id: "...", key: "gst", name: "GST", amount: 180 }
   * //   ],
   * //   total: 1250,
   * //   calculatedAt: "2024-01-15T10:30:00Z"
   * // }
   */
  async calculateOrderTotal(subtotal, itemCount = 1, paymentMethod = "ALL") {
    if (typeof subtotal !== "number" || subtotal < 0) {
      throw new AppError("Subtotal must be a non-negative number", 400);
    }

    if (typeof itemCount !== "number" || itemCount < 1) {
      itemCount = 1;
    }

    try {
      const normalizedPaymentMethod = this.normalizePaymentMethod(paymentMethod);
      const rules = await this.getActiveRules(normalizedPaymentMethod);
      if (!rules.length) {
        return {
          subtotal: Math.round(subtotal * 100) / 100,
          charges: [],
          chargesTotal: 0,
          total: Math.round(subtotal * 100) / 100,
          itemCount,
          paymentMethod: normalizedPaymentMethod,
          calculatedAt: new Date().toISOString(),
        };
      }

      const charges = [];
      let totalCharges = 0;

      for (const rule of rules) {
        const amount = this.calculateRuleAmount(rule, subtotal, itemCount);

        if (amount > 0) {
          charges.push({
            id: rule._id.toString(),
            key: rule.key,
            displayName: rule.displayName,
            category: rule.category,
            categoryId: rule.categoryId?._id ? String(rule.categoryId._id) : rule.categoryId ? String(rule.categoryId) : null,
            categoryMeta:
              rule.categoryId && rule.categoryId.key
                ? {
                    id: String(rule.categoryId._id),
                    key: rule.categoryId.key,
                    name: rule.categoryId.name,
                    description: rule.categoryId.description || "",
                    isActive: Boolean(rule.categoryId.isActive),
                    isSystem: Boolean(rule.categoryId.isSystem),
                    sortOrder: Number(rule.categoryId.sortOrder || 0),
                  }
                : null,
            amount,
            type: rule.type,
            paymentMethod: rule.paymentMethod || "ALL",
            sortOrder: rule.sortOrder,
          });
          totalCharges += amount;
        }
      }

      // Sort charges by sortOrder
      charges.sort((a, b) => a.sortOrder - b.sortOrder);

      const total = Math.round((subtotal + totalCharges) * 100) / 100;

      return {
        subtotal: Math.round(subtotal * 100) / 100,
        charges,
        chargesTotal: Math.round(totalCharges * 100) / 100,
        total,
        itemCount,
        paymentMethod: normalizedPaymentMethod,
        calculatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Error calculating order total: ${error.message}`, 500);
    }
  }

  /**
   * Calculate grouped breakdown for orders that need separate subtotal buckets
   * 
   * @param {Array} groups - Array of {groupId, subtotal} objects
   * @param {number} totalItemCount - Total items across all groups
   * @returns {Promise<Object>} Breakdown with grouped charges
   */
  async calculateGroupBreakdown(groups, totalItemCount = 0, paymentMethod = "ALL") {
    if (!Array.isArray(groups) || groups.length === 0) {
      throw new AppError("Groups array is required and must not be empty", 400);
    }

    const normalizedPaymentMethod = this.normalizePaymentMethod(paymentMethod);
    const rules = await this.getActiveRules(normalizedPaymentMethod);
    const groupBreakdowns = [];
    const globalCharges = [];
    let totalAmount = 0;

    // Calculate for each subtotal group separately.
    for (const group of groups) {
      const groupSubtotal = group.subtotal || 0;
      const groupCharges = [];
      let groupChargesTotal = 0;

      // Rules with appliesTo: "ORDER" are applied to each group.
      // Rules with appliesTo: "ITEM" are calculated on total items
      for (const rule of rules) {
        if (rule.appliesTo === "ITEM") {
          continue; // Handle global items later
        }

        const amount = this.calculateRuleAmount(rule, groupSubtotal, 1);
        if (amount > 0) {
          groupCharges.push({
            id: rule._id.toString(),
            key: rule.key,
            displayName: rule.displayName,
            category: rule.category,
            amount,
            type: rule.type,
            appliesTo: rule.appliesTo,
            paymentMethod: rule.paymentMethod || "ALL",
          });
          groupChargesTotal += amount;
        }
      }

      groupBreakdowns.push({
        groupId: group.groupId,
        subtotal: groupSubtotal,
        charges: groupCharges,
        chargesTotal: Math.round(groupChargesTotal * 100) / 100,
        total: Math.round((groupSubtotal + groupChargesTotal) * 100) / 100,
      });

      totalAmount += groupSubtotal + groupChargesTotal;
    }

    // Calculate global (ITEM-based) charges once
    if (totalItemCount > 0) {
      for (const rule of rules) {
        if (rule.appliesTo !== "ITEM") {
          continue;
        }

        const totalSubtotal = groups.reduce((sum, item) => sum + item.subtotal, 0);
        const amount = this.calculateRuleAmount(rule, totalSubtotal, totalItemCount);

        if (amount > 0) {
          globalCharges.push({
            id: rule._id.toString(),
            key: rule.key,
            displayName: rule.displayName,
            category: rule.category,
            amount,
            type: rule.type,
            appliesTo: rule.appliesTo,
            paymentMethod: rule.paymentMethod || "ALL",
          });
          totalAmount += amount;
        }
      }
    }

    return {
      groupBreakdowns,
      globalCharges,
      grandTotal: Math.round(totalAmount * 100) / 100,
      paymentMethod: normalizedPaymentMethod,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Validate a pricing rule before saving
   * @param {Object} ruleData - Rule data to validate
   * @returns {Array} Array of validation errors (empty if valid)
   */
  validateRule(ruleData) {
    const errors = [];

    // Key validation
    if (!ruleData.key || typeof ruleData.key !== "string") {
      errors.push("Key is required and must be a string");
    } else if (!/^[a-z0-9_]+$/.test(ruleData.key)) {
      errors.push("Key must contain only lowercase letters, numbers, and underscores");
    }

    // Display name validation
    if (!ruleData.displayName || typeof ruleData.displayName !== "string") {
      errors.push("Display name is required and must be a string");
    }

    // Type validation
    if (!["FIXED", "PERCENTAGE"].includes(ruleData.type)) {
      errors.push("Type must be either FIXED or PERCENTAGE");
    }

    // Value validation
    if (typeof ruleData.value !== "number" || ruleData.value < 0) {
      errors.push("Value must be a non-negative number");
    }

    // Percentage-specific validation
    if (ruleData.type === "PERCENTAGE" && ruleData.value > 100) {
      errors.push("Percentage value cannot exceed 100");
    }

    // AppliesTo validation
    if (ruleData.appliesTo && !["ORDER", "ITEM"].includes(ruleData.appliesTo)) {
      errors.push("AppliesTo must be either ORDER or ITEM");
    }

    if (
      ruleData.paymentMethod !== undefined &&
      !["ALL", "ONLINE", "COD"].includes(String(ruleData.paymentMethod).toUpperCase())
    ) {
      errors.push("paymentMethod must be ALL, ONLINE, or COD");
    }

    // Category validation
    if (ruleData.category !== undefined && typeof ruleData.category !== "string") {
      errors.push("Category must be a string");
    }
    const normalizedCategoryId = this.normalizeCategoryId(ruleData.categoryId);
    if (ruleData.categoryId !== undefined && ruleData.categoryId !== null) {
      if (typeof normalizedCategoryId !== "string") {
        errors.push("categoryId must be a string");
      } else if (!isValidObjectId(normalizedCategoryId)) {
        errors.push("categoryId must be a valid ObjectId string");
      }
    }

    // Min/Max order value validation
    if (ruleData.minOrderValue < 0) {
      errors.push("minOrderValue cannot be negative");
    }
    if (ruleData.freeAboveValue < 0) {
      errors.push("freeAboveValue cannot be negative");
    }
    if (ruleData.minOrderValue > 0 && ruleData.freeAboveValue > 0 && ruleData.minOrderValue >= ruleData.freeAboveValue) {
      errors.push("minOrderValue must be less than freeAboveValue");
    }

    // MaxCap validation
    if (ruleData.maxCap < 0) {
      errors.push("maxCap cannot be negative");
    }

    return errors;
  }

  /**
   * Get pricing summary for display
   * @returns {Promise<Object>} Summary of all active rules by category
   */
  async getPricingSummary(paymentMethod = "ALL") {
    const normalizedPaymentMethod = this.normalizePaymentMethod(paymentMethod);
    const rules = await this.getActiveRules(normalizedPaymentMethod);

    const summary = {
      totalRules: rules.length,
      byCategory: {},
      rules: [],
    };

    for (const rule of rules) {
      if (!summary.byCategory[rule.category]) {
        summary.byCategory[rule.category] = [];
      }
      summary.byCategory[rule.category].push({
        key: rule.key,
        displayName: rule.displayName,
        type: rule.type,
        value: rule.value,
        paymentMethod: rule.paymentMethod || "ALL",
      });

      summary.rules.push({
        id: rule._id.toString(),
        key: rule.key,
        displayName: rule.displayName,
        type: rule.type,
        value: rule.value,
        category: rule.category,
        categoryId: rule.categoryId?._id ? String(rule.categoryId._id) : rule.categoryId ? String(rule.categoryId) : null,
        appliesTo: rule.appliesTo,
        paymentMethod: rule.paymentMethod || "ALL",
        sortOrder: rule.sortOrder,
      });
    }

    return {
      ...summary,
      paymentMethod: normalizedPaymentMethod,
    };
  }

  /**
   * Calculate the impact of a single rule on a given amount
   * Useful for previewing what a rule will charge
   * @param {string} ruleId - Rule ID or key
   * @param {number} subtotal - Amount to apply rule to
   * @returns {Promise<Object>} Rule details and calculated amount
   */
  async previewRuleImpact(ruleId, subtotal) {
    let rule;

    if (ruleId.length === 24) {
      // Likely an ObjectId
      rule = await PricingRule.findById(ruleId).lean();
    } else {
      // Likely a key
      rule = await PricingRule.findOne({ key: ruleId }).lean();
    }

    if (!rule) {
      throw new AppError("Pricing rule not found", 404);
    }

    const amount = this.calculateRuleAmount(rule, subtotal);

    return {
      rule: {
        id: rule._id.toString(),
        key: rule.key,
        displayName: rule.displayName,
        type: rule.type,
        value: rule.value,
        category: rule.category,
        paymentMethod: rule.paymentMethod || "ALL",
      },
      baseAmount: subtotal,
      calculatedAmount: amount,
      preview: `${rule.displayName}: ₹${amount.toFixed(2)}`,
    };
  }

  /**
   * Calculate order total with all charges INCLUDING SHIPPING
   * 
   * @param {number} subtotal - Order subtotal
   * @param {Array} cartItems - Cart items (needed for weight calculation)
   * @param {Object} shippingAddress - Shipping address for zone determination
   * @param {number} itemCount - Total items
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Breakdown with subtotal, charges (including shipping), and total
   */
  async calculateOrderTotalWithShipping(subtotal, cartItems, shippingAddress, itemCount = 1, options = {}) {
    try {
      // Get regular pricing charges (excluding shipping-related items)
      const pricingBreakdown = await this.calculateOrderTotal(
        subtotal,
        itemCount,
        options.paymentMethod || "ALL"
      );

      // Calculate shipping cost
      const shippingPricingService = require("./shipping-pricing.service");
      const shippingResult = await shippingPricingService.calculateShippingCost({
        cartItems,
        shippingAddress,
        state: options.state || "Tamil Nadu",
        fallbackCost: options.fallbackShippingCost || 0,
        orderTotal: subtotal,
      });

      // Always include shipping as an explicit charge for checkout transparency.
      const charges = [...pricingBreakdown.charges];
      let totalCharges = pricingBreakdown.chargesTotal;

      charges.push({
        id: shippingResult.rule?.id || "shipping_fallback",
        key: "shipping_cost",
        displayName: "Shipping Fee",
        category: "SHIPPING",
        categoryId: null,
        categoryMeta: null,
        amount: shippingResult.cost,
        type: "FIXED",
        paymentMethod: "ALL",
        sortOrder: 10,
        metadata: {
          weight: shippingResult.weight,
          zone: shippingResult.zone,
          ruleApplied: shippingResult.ruleApplied,
          fallbackApplied: shippingResult.fallbackApplied,
          matchType: shippingResult.matchType || "unknown",
          matchedOn: shippingResult.matchedOn || "unknown",
          state: shippingResult.state || options.state || "Tamil Nadu",
          costBreakdown: shippingResult.costBreakdown || null,
        },
      });
      if (shippingResult.cost > 0) {
        totalCharges += shippingResult.cost;
      }

      // Re-sort charges by sortOrder
      charges.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      const total = Math.round((subtotal + totalCharges) * 100) / 100;

      return {
        subtotal: Math.round(subtotal * 100) / 100,
        charges,
        chargesTotal: Math.round(totalCharges * 100) / 100,
        total,
        itemCount,
        paymentMethod: pricingBreakdown.paymentMethod,
        shipping: {
          weight: shippingResult.weight,
          zone: shippingResult.zone,
          cost: shippingResult.cost,
          ruleApplied: shippingResult.ruleApplied,
        },
        calculatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Error calculating order total with shipping: ${error.message}`, 500);
    }
  }

  /**
   * Calculate grouped breakdown with shipping
   * 
   * @param {Array} groups - Array of grouped pricing data
   * @param {Array} cartItems - Cart items for shipping calculation
   * @param {Object} shippingAddress - Shipping address
   * @param {number} totalItemCount - Total items
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Breakdown with shipping included
   */
  async calculateGroupBreakdownWithShipping(groups, cartItems, shippingAddress, totalItemCount = 0, options = {}) {
    try {
      const breakdown = await this.calculateGroupBreakdown(
        groups,
        totalItemCount,
        options.paymentMethod || "ALL"
      );

      // Calculate shipping for the entire order
      const shippingPricingService = require("./shipping-pricing.service");
      const shippingResult = await shippingPricingService.calculateShippingCost({
        cartItems,
        shippingAddress,
        state: options.state || "Tamil Nadu",
        fallbackCost: options.fallbackShippingCost || 0,
        orderTotal: groups.reduce((sum, group) => sum + Number(group.subtotal || 0), 0),
      });

      // Always surface shipping in global charges, even when free.
      breakdown.globalCharges.push({
        id: shippingResult.rule?.id || "shipping_fallback",
        key: "shipping_cost",
        displayName: "Shipping Fee",
        category: "SHIPPING",
        amount: shippingResult.cost,
        type: "FIXED",
        appliesTo: "ORDER",
        paymentMethod: "ALL",
        metadata: {
          weight: shippingResult.weight,
          zone: shippingResult.zone,
          ruleApplied: shippingResult.ruleApplied,
          fallbackApplied: shippingResult.fallbackApplied,
          matchType: shippingResult.matchType || "unknown",
          matchedOn: shippingResult.matchedOn || "unknown",
          state: shippingResult.state || options.state || "Tamil Nadu",
          costBreakdown: shippingResult.costBreakdown || null,
        },
      });

      if (shippingResult.cost > 0) {
        breakdown.grandTotal = Math.round((breakdown.grandTotal + shippingResult.cost) * 100) / 100;
      }

      breakdown.shipping = {
        weight: shippingResult.weight,
        zone: shippingResult.zone,
        cost: shippingResult.cost,
        ruleApplied: shippingResult.ruleApplied,
      };

      return breakdown;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Error calculating grouped breakdown with shipping: ${error.message}`,
        500
      );
    }
  }
}

module.exports = new PricingService();
