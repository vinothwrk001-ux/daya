const { AppError } = require("../utils/AppError");
const ShippingConfig = require("../models/ShippingConfig");

function clearShippingCaches() {
  const shippingPricingService = require("./shipping-pricing.service");
  shippingPricingService.clearCache();
}

/**
 * Shipping Configuration Admin Service
 * CRUD operations for managing shipping rules
 */

class ShippingConfigAdminService {
  normalizeValidationError(error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.name === "ValidationError") {
      const messages =
        error?.errors && typeof error.errors === "object"
          ? Object.values(error.errors)
              .map((err) => err.message)
              .filter(Boolean)
          : [];

      throw new AppError(
        messages.length ? messages.join(", ") : error.message || "Validation failed",
        400,
        "VALIDATION_ERROR"
      );
    }

    throw error;
  }

  /**
   * Create a new shipping rule
   * @param {Object} data - Rule data
   * @returns {Promise<Object>} Created rule
   */
  async createRule(data) {
    // Validate required fields
    if (!data.state || !data.zone) {
      throw new AppError(
        "State and zone are required",
        400,
        "VALIDATION_ERROR"
      );
    }

    if (
      data.baseWeight === undefined ||
      data.basePrice === undefined ||
      data.pricePerKg === undefined
    ) {
      throw new AppError(
        "baseWeight, basePrice, and pricePerKg are required",
        400,
        "VALIDATION_ERROR"
      );
    }

    if (data.minWeight === undefined || data.maxWeight === undefined) {
      throw new AppError(
        "minWeight and maxWeight are required",
        400,
        "VALIDATION_ERROR"
      );
    }

    // Check for duplicate rule
    const existing = await ShippingConfig.findOne({
      state: data.state,
      zone: data.zone,
      minWeight: data.minWeight,
      maxWeight: data.maxWeight,
    });

    if (existing) {
      throw new AppError(
        `Shipping rule already exists for this state, zone, and weight range`,
        409,
        "RULE_ALREADY_EXISTS"
      );
    }

    try {
      const rule = new ShippingConfig(data);
      await rule.save();
      clearShippingCaches();
      return rule;
    } catch (error) {
      this.normalizeValidationError(error);
    }
  }

  /**
   * Get all rules with filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of rules
   */
  async getAllRules({ state, zone, activeOnly = false, page = 1, limit = 50 } = {}) {
    const query = {};

    if (state) query.state = state;
    if (zone) query.zone = zone;
    if (activeOnly) query.isActive = true;

    const skip = (page - 1) * limit;

    const [rules, total] = await Promise.all([
      ShippingConfig.find(query)
        .sort({ state: 1, zone: 1, sortOrder: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ShippingConfig.countDocuments(query),
    ]);

    return {
      data: rules,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single rule
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Rule data
   */
  async getRule(ruleId) {
    const rule = await ShippingConfig.findById(ruleId);
    if (!rule) {
      throw new AppError("Shipping rule not found", 404, "NOT_FOUND");
    }
    return rule;
  }

  /**
   * Update a shipping rule
   * @param {string} ruleId - Rule ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated rule
   */
  async updateRule(ruleId, updates) {
    // Prevent certain field updates
    delete updates._id;
    delete updates.createdAt;

    try {
      const rule = await ShippingConfig.findByIdAndUpdate(ruleId, updates, {
        returnDocument: "after",
        runValidators: true,
      });

      if (!rule) {
        throw new AppError("Shipping rule not found", 404, "NOT_FOUND");
      }

      clearShippingCaches();
      return rule;
    } catch (error) {
      this.normalizeValidationError(error);
    }
  }

  /**
   * Delete a shipping rule
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Deleted rule
   */
  async deleteRule(ruleId) {
    const rule = await ShippingConfig.findByIdAndDelete(ruleId);
    if (!rule) {
      throw new AppError("Shipping rule not found", 404, "NOT_FOUND");
    }
    clearShippingCaches();
    return rule;
  }

  /**
   * Bulk update rules (e.g., activate/deactivate multiple)
   * @param {Array} ruleIds - Array of rule IDs
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Result summary
   */
  async bulkUpdateRules(ruleIds, updates) {
    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      throw new AppError("Rule IDs array is required", 400, "VALIDATION_ERROR");
    }

    // Prevent bulk update of sensitive fields
    delete updates._id;
    delete updates.createdAt;

    try {
      const result = await ShippingConfig.updateMany(
        { _id: { $in: ruleIds } },
        updates,
        { runValidators: true }
      );

      clearShippingCaches();

      return {
        modified: result.modifiedCount,
        matched: result.matchedCount,
        acknowledged: result.acknowledged,
      };
    } catch (error) {
      if (error?.name === "ValidationError") {
        throw new AppError(error.message || "Validation failed during bulk update", 400, "VALIDATION_ERROR");
      }
      throw error;
    }
  }

  /**
   * Get rules by state and zone
   * @param {string} state - State name
   * @param {string} zone - Zone name
   * @returns {Promise<Array>} Rules for state and zone
   */
  async getRulesByStateAndZone(state, zone) {
    const rules = await ShippingConfig.find({
      state,
      zone,
      isActive: true,
    }).sort({ sortOrder: 1 });

    return rules;
  }

  /**
   * Calculate shipping preview (for admin testing)
   * @param {Object} options
   * @returns {Promise<Object>} Preview data
   */
  async calculatePreview({ weight, state = "Tamil Nadu", zone } = {}) {
    if (!weight || weight <= 0) {
      throw new AppError("Weight must be greater than 0", 400, "VALIDATION_ERROR");
    }

    const query = { state, isActive: true };
    if (zone) query.zone = zone;

    const rules = await ShippingConfig.find(query).sort({ sortOrder: 1 });

    const applicable = rules.filter(
      (r) => weight >= r.minWeight && weight <= r.maxWeight
    );

    const previews = applicable.map((rule) => ({
      zone: rule.zone,
      weight,
      cost: rule.calculateCost(weight),
      breakdown: {
        baseWeight: rule.baseWeight,
        basePrice: rule.basePrice,
        extraWeight: Math.max(0, weight - rule.baseWeight),
        pricePerKg: rule.pricePerKg,
      },
    }));

    return {
      weight,
      state,
      totalRulesChecked: rules.length,
      applicableRules: applicable.length,
      previews,
    };
  }

  /**
   * Get statistics about shipping configuration
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [totalRules, activeRules, byZone, byState] = await Promise.all([
      ShippingConfig.countDocuments(),
      ShippingConfig.countDocuments({ isActive: true }),
      ShippingConfig.aggregate([
        {
          $group: {
            _id: "$zone",
            count: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
          },
        },
      ]),
      ShippingConfig.aggregate([
        {
          $group: {
            _id: "$state",
            count: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
          },
        },
      ]),
    ]);

    return {
      totalRules,
      activeRules,
      inactiveRules: totalRules - activeRules,
      byZone,
      byState,
      coverage: {
        states: new Set(byState.map((s) => s._id)).size,
        zones: new Set(byZone.map((z) => z._id)).size,
      },
    };
  }

  /**
   * Clone a rule with modifications
   * Useful for creating similar rules for different zones/states
   * @param {string} sourceRuleId - Rule ID to clone
   * @param {Object} overrides - Fields to override
   * @returns {Promise<Object>} New cloned rule
   */
  async cloneRule(sourceRuleId, overrides = {}) {
    const source = await this.getRule(sourceRuleId);

    const newRuleData = {
      state: source.state,
      zone: source.zone,
      baseWeight: source.baseWeight,
      basePrice: source.basePrice,
      pricePerKg: source.pricePerKg,
      minWeight: source.minWeight,
      maxWeight: source.maxWeight,
      freeShippingThreshold: source.freeShippingThreshold,
      minOrderValue: source.minOrderValue,
      isActive: false, // Start as inactive
      notes: `Cloned from: ${source._id}`,
      ...overrides,
    };

    return this.createRule(newRuleData);
  }
}

module.exports = new ShippingConfigAdminService();
