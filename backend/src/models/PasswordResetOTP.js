const mongoose = require("mongoose");

/**
 * Password Reset OTP Schema
 * Stores temporary OTP codes for password reset flow
 * 
 * Features:
 * - Secure OTP hashing (never store plain OTP)
 * - 10-minute expiration
 * - Attempt tracking for brute-force protection
 * - Support for email and phone verification
 * - Automatic cleanup of expired documents
 */

const passwordResetOTPSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false, // Don't include in queries by default
    },
    otpType: {
      type: String,
      enum: ["email", "phone", "both"],
      default: "email",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: Date,
    resendCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxResends: {
      type: Number,
      default: 5,
    },
    lastResendAt: Date,
    ipAddress: String,
    userAgent: String,
    // Audit trail
    createdByIp: String,
    createdByUserAgent: String,
  },
  { timestamps: true }
);

// Automatically delete expired OTPs after 11 minutes
passwordResetOTPSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Compound index for efficient lookups
passwordResetOTPSchema.index({ userId: 1, otpType: 1 });

module.exports = {
  PasswordResetOTP: mongoose.model("PasswordResetOTP", passwordResetOTPSchema),
};
