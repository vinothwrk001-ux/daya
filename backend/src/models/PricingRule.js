const mongoose = require("mongoose");

/**
 * Dynamic Pricing Rule Model
 * 
 * Stores individual pricing components that can be enabled/disabled dynamically.
 * Each rule represents a fee, tax, discount, or other charge applied during checkout.
 * 
 * Examples:
 * - Delivery Fee (FIXED)
 * - Platform Commission (PERCENTAGE)
 * - Tax/GST (PERCENTAGE)
 * - Handling Fee (FIXED)
 * - Packaging Fee (FIXED)
 */
const pricingRuleSchema = new mongoose.Schema(
  {
    // Unique identifier for the rule (e.g., "delivery_fee", "platform_fee", "gst")
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]+$/,
      minlength: 3,
      maxlength: 50,
      index: true,
      description: "Unique identifier (snake_case)",
    },

    // Display name shown to users and admins
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      description: "User-friendly name (e.g., 'Delivery Fee', 'Platform Fee')",
    },

    // Description of what this rule represents
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      description: "Detailed explanation of the rule",
    },

    // Type of calculation: FIXED amount or PERCENTAGE of base
    type: {
      type: String,
      enum: ["FIXED", "PERCENTAGE"],
      required: true,
      description: "FIXED for absolute amounts, PERCENTAGE for % of subtotal",
    },

    // Value to apply (amount or percentage)
    value: {
      type: Number,
      required: true,
      min: 0,
      description: "Amount (for FIXED) or percentage (for PERCENTAGE type)",
    },

    // Whether this rule applies to entire order or per item
    appliesTo: {
      type: String,
      enum: ["ORDER", "ITEM"],
      default: "ORDER",
      description: "ORDER applies once per order, ITEM applies per item in cart",
    },

    // Payment method applicability for checkout pricing
    paymentMethod: {
      type: String,
      enum: ["ALL", "ONLINE", "COD"],
      default: "ALL",
      index: true,
      description: "Controls whether the rule applies to all, online, or COD payments",
    },

    // Is this rule currently active/enabled?
    isActive: {
      type: Boolean,
      default: true,
      index: true,
      description: "Disable temporarily without deleting",
    },

    // Sort order for display (lower numbers appear first)
    sortOrder: {
      type: Number,
      default: 0,
      description: "Controls display order in checkout and admin UI",
    },

    // Optional: Max cap for percentage-based fees
    maxCap: {
      type: Number,
      min: 0,
      default: 0,
      description: "Maximum amount this rule can charge (0 = no cap)",
    },

    // Optional: Minimum order value for this rule to apply
    minOrderValue: {
      type: Number,
      default: 0,
      description: "Rule only applies if order subtotal >= this value",
    },

    // Optional: Free above this order value (useful for delivery fees)
    freeAboveValue: {
      type: Number,
      default: 0,
      description: "Rule doesn't apply if order subtotal >= this value",
    },

    // Legacy category key kept for backward compatibility and display
    category: {
      type: String,
      default: "OTHER",
      trim: true,
      description: "Rule category for organization",
    },

    // Dynamic category reference
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PricingCategory",
      index: true,
      description: "Dynamic pricing category reference",
    },

    // Metadata and internal notes
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      description: "Internal notes about this rule",
    },

    // Admin who last modified this rule
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      description: "Admin user who last updated this rule",
    },

    // Status & tracking
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
      description: "Soft delete - keep historical records",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active rules
pricingRuleSchema.index({ isActive: 1, sortOrder: 1, category: 1 });
pricingRuleSchema.index({ categoryId: 1, isActive: 1, sortOrder: 1 });
pricingRuleSchema.index({ isActive: 1, paymentMethod: 1, sortOrder: 1 });

// Index for finding by key
pricingRuleSchema.index({ key: 1, isActive: 1 });

// Prevent inactive rules from being used
pricingRuleSchema.query.active = function () {
  return this.find({ isActive: true, isArchived: false });
};

// Virtual: Compute max percentage to prevent errors
pricingRuleSchema.virtual("isPercentage").get(function () {
  return this.type === "PERCENTAGE";
});

// Validation middleware
pricingRuleSchema.pre("save", async function () {
  // Validate percentage max value
  if (this.type === "PERCENTAGE" && this.value > 100) {
    throw new Error("Percentage value cannot exceed 100");
  }

  // Validate min/free above
  if (this.minOrderValue > 0 && this.freeAboveValue > 0 && this.minOrderValue >= this.freeAboveValue) {
    throw new Error("minOrderValue must be less than freeAboveValue");
  }
});

module.exports = mongoose.model("PricingRule", pricingRuleSchema);
