const mongoose = require("mongoose");

const USER_ROLES = ["user", "vendor", "influencer", "admin", "super_admin", "support_admin", "finance_admin"];
const USER_STATUS = ["active", "disabled"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
      unique: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: "user", index: true },
    roles: {
      type: [{ type: String, enum: USER_ROLES }],
      default: function defaultRoles() {
        return [this.role || "user"];
      },
      index: true,
    },
    status: { type: String, enum: USER_STATUS, default: "active", index: true },
    avatarUrl: { type: String, trim: true },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light",
      },
      notificationPreferences: {
        orderUpdates: { type: Boolean, default: true },
        deliveryAlerts: { type: Boolean, default: true },
        paymentAlerts: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false },
        orders: { type: Boolean, default: true },
        commissions: { type: Boolean, default: true },
        campaigns: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        followers: { type: Boolean, default: true },
        storefront: { type: Boolean, default: true },
        products: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true },
        channels: {
          email: { type: Boolean, default: true },
          sms: { type: Boolean, default: false },
          push: { type: Boolean, default: true },
          inApp: { type: Boolean, default: true },
        },
        digestFrequency: {
          type: String,
          enum: ["instant", "hourly", "daily", "weekly"],
          default: "instant",
        },
      },
      language: { type: String, trim: true, default: "en" },
      timezone: { type: String, trim: true, default: "Asia/Kolkata" },
      currency: { type: String, trim: true, default: "INR" },
      dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" },
      displayMode: { type: String, enum: ["compact", "expanded"], default: "expanded" },
    },
    wallet: {
      balance: { type: Number, min: 0, default: 0 },
      totalCredited: { type: Number, min: 0, default: 0 },
      totalDebited: { type: Number, min: 0, default: 0 },
      lastUpdatedAt: { type: Date },
      transactions: {
        type: [
          {
            type: {
              type: String,
              enum: ["CREDIT", "DEBIT"],
              required: true,
            },
            amount: { type: Number, min: 0, required: true },
            source: { type: String, trim: true, default: "SYSTEM" },
            referenceId: { type: String, trim: true, default: "" },
            note: { type: String, trim: true, default: "" },
            createdAt: { type: Date, default: Date.now },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model("User", userSchema),
  USER_ROLES,
  USER_STATUS,
};
