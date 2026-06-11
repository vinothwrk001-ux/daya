const mongoose = require("mongoose");

/**
 * Pricing Configuration Model
 * 
 * Stores platform-wide pricing rules and fees:
 * - Delivery fees (fixed, variable, free threshold)
 * - Platform fees (percentage)
 * - Tax configurations
 * - Discount rules
 */
const pricingConfigSchema = new mongoose.Schema(
  {
    // Delivery Fee Configuration
    deliveryFee: {
      type: Number,
      min: 0,
      default: 50,
      description: "Fixed delivery fee in base currency (INR)",
    },
    deliveryFreeAbove: {
      type: Number,
      min: 0,
      default: 500,
      description: "Orders above this amount get free delivery",
    },

    // Platform Fee Configuration
    platformFeePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 5,
      description: "Platform fee as percentage of product price",
    },
    platformFeeCapped: {
      type: Number,
      min: 0,
      default: 0,
      description: "Maximum platform fee per order (0 = no cap)",
    },

    // Tax Configuration
    taxPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 18,
      description: "GST/Tax percentage on taxable amount",
    },
    taxableBasis: {
      type: String,
      enum: ["subtotal", "subtotalWithoutDiscount", "subtotalWithFees"],
      default: "subtotal",
      description: "What amount to calculate tax on",
    },

    // Handling/Packaging Fee
    handlingFee: {
      type: Number,
      min: 0,
      default: 0,
      description: "Fixed handling/packaging fee per order",
    },

    // Discount Rules (simple rules, can be extended)
    bulkDiscountThreshold: {
      type: Number,
      min: 0,
      default: 3,
      description: "Quantity threshold for bulk discount",
    },
    bulkDiscountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 5,
      description: "Bulk discount percentage if quantity >= threshold",
    },

    // Coupon/Promo Configuration
    maxDiscountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
      description: "Maximum discount allowed per coupon",
    },

    // Return/Refund Policy
    returnWindow: {
      type: Number,
      min: 0,
      default: 7,
      description: "Days within which returns are allowed",
    },
    refundProcessingDays: {
      type: Number,
      min: 0,
      default: 3,
      description: "Days to process refund after return initiated",
    },

    // Shipping Modes
    shippingModes: {
      selfShipping: {
        type: Boolean,
        default: true,
        description: "Whether self-managed shipping is available",
      },
      platformShipping: {
        type: Boolean,
        default: true,
        description: "Whether platform shipping is available",
      },
    },

    // Status & Metadata
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      description: "Admin who last updated this config",
    },
    notes: {
      type: String,
      trim: true,
      description: "Internal notes about price changes",
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

// Ensure only one active pricing config (optional singleton pattern)
pricingConfigSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("PricingConfig", pricingConfigSchema);
