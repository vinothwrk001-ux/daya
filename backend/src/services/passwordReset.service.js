const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const userRepo = require("../repositories/user.repository");
const passwordResetOTPRepo = require("../repositories/passwordResetOTP.repository");
const sessionRepo = require("../repositories/session.repository");
const auditService = require("./audit.service");
const { sendEmail, sendSMS } = require("../utils/emailSMS.util");
const { logger } = require("../utils/logger");

/**
 * Password Reset Service
 * Handles password reset requests, OTP generation, verification, and password updates
 * 
 * Features:
 * - Generate cryptographically secure 6-digit OTPs
 * - Send OTPs via email or SMS
 * - Verify OTP with rate limiting
 * - Reset password with session invalidation
 * - Comprehensive audit logging
 * - Account enumeration protection
 */

/**
 * Request password reset via email or phone
 * Step 1 of the forgot password flow
 */
async function requestPasswordReset(identifier, otpType = "email", meta = {}) {
  if (!identifier) {
    throw new AppError("Email or phone number required", 400, "INVALID_INPUT");
  }

  const isEmail = String(identifier).includes("@");

  // Find user by email or phone
  let user;
  if (isEmail) {
    user = await userRepo.findByEmail(String(identifier).toLowerCase());
  } else {
    user = await userRepo.findByPhone(String(identifier).trim());
  }

  if (!user) {
    // Don't reveal whether account exists - rate limit and return generic message
    await auditService.log({
      action: "password_reset.request_failed",
      entityType: "User",
      metadata: { reason: "USER_NOT_FOUND", identifier: isEmail ? "email" : "phone" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw new AppError("If an account exists, you'll receive password reset instructions", 404, "NOT_FOUND");
  }

  // Invalidate any previous OTPs for this user
  await passwordResetOTPRepo.invalidateOTPsForUser(user._id);

  // Create new OTP
  const { otp, resetOTP } = await passwordResetOTPRepo.createOTP(
    user._id,
    isEmail ? user.email : null,
    !isEmail ? user.phone : null,
    isEmail ? "email" : "phone",
    meta
  );

  // Send OTP via email or SMS
  try {
    if (isEmail) {
      await sendPasswordResetEmail(user, otp);
    } else {
      await sendPasswordResetSMS(user, otp);
    }
  } catch (error) {
    // Log but don't fail - user will retry if they don't receive it
    logger.error("Failed to send password reset OTP", { error: error.message });
  }

  // Audit log
  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "password_reset.requested",
    entityType: "User",
    entityId: user._id,
    metadata: {
      channel: isEmail ? "email" : "sms",
      recipient: isEmail ? user.email : user.phone,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    resetOtpId: resetOTP._id.toString(),
    channel: isEmail ? "email" : "sms",
    recipient: isEmail ? maskEmail(user.email) : maskPhone(user.phone),
    expiresIn: 600, // 10 minutes in seconds
    resendCooldown: 60,
    ...(isOtpDevMode() ? { devOtp: otp } : {}),
  };
}

/**
 * Verify OTP and mark as verified
 * Step 2 of the forgot password flow
 */
async function verifyOTP(resetOTPId, otp, meta = {}) {
  if (!resetOTPId || !otp) {
    throw new AppError("OTP and reset ID required", 400, "INVALID_INPUT");
  }

  let resetOTP = await passwordResetOTPRepo.findById(resetOTPId);
  if (!resetOTP) {
    throw new AppError("Invalid or expired reset request", 404, "NOT_FOUND");
  }

  const user = await userRepo.findById(resetOTP.userId);
  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  // Verify OTP
  const verification = await passwordResetOTPRepo.verifyOTP(resetOTPId, otp);

  if (!verification.valid) {
    await auditService.log({
      actor: { _id: user._id, role: user.role },
      action: "password_reset.otp_failed",
      entityType: "PasswordResetOTP",
      entityId: resetOTPId,
      metadata: { reason: verification.reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (verification.reason === "EXPIRED") {
      throw new AppError("OTP has expired. Request a new one.", 410, "OTP_EXPIRED");
    } else if (verification.reason === "MAX_ATTEMPTS_EXCEEDED") {
      throw new AppError("Too many incorrect OTP attempts. Request a new OTP.", 429, "TOO_MANY_ATTEMPTS");
    } else {
      throw new AppError("Invalid OTP. Please try again.", 400, "INVALID_OTP");
    }
  }

  // Mark as verified
  resetOTP = await passwordResetOTPRepo.markAsVerified(resetOTPId);

  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "password_reset.otp_verified",
    entityType: "PasswordResetOTP",
    entityId: resetOTPId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    verified: true,
    resetOtpId: resetOTPId,
    expiresIn: 600, // 10 minutes to complete password reset
  };
}

/**
 * Resend OTP with cooldown and max resend limits
 */
async function resendOTP(resetOTPId, meta = {}) {
  if (!resetOTPId) {
    throw new AppError("Reset ID required", 400, "INVALID_INPUT");
  }

  let resetOTP = await passwordResetOTPRepo.findById(resetOTPId);
  if (!resetOTP) {
    throw new AppError("Invalid or expired reset request", 404, "NOT_FOUND");
  }

  const user = await userRepo.findById(resetOTP.userId);
  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  // Check if expired
  if (resetOTP.expiresAt < new Date()) {
    throw new AppError("Reset request has expired", 410, "RESET_EXPIRED");
  }

  // Check resend limit
  if (resetOTP.resendCount >= resetOTP.maxResends) {
    throw new AppError("Maximum resend limit exceeded. Please request a new reset.", 429, "RESEND_LIMIT_EXCEEDED");
  }

  // Check cooldown (60 seconds between resends)
  if (resetOTP.lastResendAt) {
    const secondsSinceLastResend = (Date.now() - resetOTP.lastResendAt.getTime()) / 1000;
    if (secondsSinceLastResend < 60) {
      throw new AppError(
        `Please wait ${Math.ceil(60 - secondsSinceLastResend)} seconds before requesting a new OTP`,
        429,
        "RESEND_COOLDOWN"
      );
    }
  }

  // Regenerate OTP on the SAME reset document (so the same resetOtpId stays valid)
  const { otp } = await passwordResetOTPRepo.regenerateOTP(resetOTPId);

  // Send new OTP
  try {
    if (resetOTP.otpType === "email" && resetOTP.email) {
      await sendPasswordResetEmail(user, otp);
    } else if (resetOTP.otpType === "phone" && resetOTP.phone) {
      await sendPasswordResetSMS(user, otp);
    }
  } catch (error) {
    logger.error("Failed to resend OTP", { error: error.message });
  }

  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "password_reset.otp_resent",
    entityType: "PasswordResetOTP",
    entityId: resetOTPId,
    metadata: { channel: resetOTP.otpType },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    resent: true,
    resetOtpId: resetOTPId,
    channel: resetOTP.otpType,
    expiresIn: 600,
    resendCooldown: 60,
    ...(isOtpDevMode() ? { devOtp: otp } : {}),
  };
}

/**
 * Reset password after OTP verification
 * Step 3 of the forgot password flow
 */
async function resetPassword(resetOTPId, newPassword, meta = {}) {
  if (!resetOTPId || !newPassword) {
    throw new AppError("Reset ID and new password required", 400, "INVALID_INPUT");
  }

  const resetOTP = await passwordResetOTPRepo.findById(resetOTPId);
  if (!resetOTP) {
    throw new AppError("Invalid or expired reset request", 404, "NOT_FOUND");
  }

  if (!resetOTP.isVerified) {
    throw new AppError("OTP must be verified first", 400, "OTP_NOT_VERIFIED");
  }

  if (resetOTP.isUsed) {
    throw new AppError("This reset request has already been used", 410, "RESET_ALREADY_USED");
  }

  if (resetOTP.expiresAt < new Date()) {
    throw new AppError("Reset request has expired", 410, "RESET_EXPIRED");
  }

  const user = await userRepo.findById(resetOTP.userId, { includePassword: true });
  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  // Validate password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new AppError(passwordValidation.message, 400, "WEAK_PASSWORD");
  }

  // Ensure new password is different from old password
  const isSameAsOld = await bcrypt.compare(newPassword, user.password);
  if (isSameAsOld) {
    throw new AppError("New password cannot be the same as your current password", 400, "SAME_PASSWORD");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  const updatedUser = await userRepo.updateById(user._id, {
    password: hashedPassword,
    passwordChangedAt: new Date(),
  });

  // Mark OTP as used
  await passwordResetOTPRepo.markAsUsed(resetOTPId);

  // Invalidate all existing sessions (force re-login on all devices)
  await sessionRepo.revokeAllForUser(user._id);

  // Audit log
  await auditService.log({
    actor: { _id: user._id, role: user.role },
    action: "password_reset.completed",
    entityType: "User",
    entityId: user._id,
    metadata: {
      sessionsRevoked: true,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    success: true,
    message: "Password updated successfully. Please login with your new password.",
  };
}

/**
 * Send password reset OTP via email
 */
async function sendPasswordResetEmail(user, otp) {
  if (!user.email) {
    throw new AppError("User email not found", 400, "NO_EMAIL");
  }

  await sendEmail({
    to: user.email,
    subject: "Password Reset OTP",
    template: "passwordResetOTP",
    data: {
      name: user.name,
      otp,
      expiryMinutes: 10,
      supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
    },
  });
}

/**
 * Send password reset OTP via SMS
 */
async function sendPasswordResetSMS(user, otp) {
  if (!user.phone) {
    throw new AppError("User phone not found", 400, "NO_PHONE");
  }

  await sendSMS({
    to: user.phone,
    template: "passwordResetOTP",
    data: {
      otp,
    },
  });
}

/**
 * Whether to expose the OTP in API responses (dev/testing only).
 * Never enable in production.
 */
function isOtpDevMode() {
  return process.env.OTP_DEV_MODE === "true" && process.env.NODE_ENV !== "production";
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }

  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain lowercase letter" };
  }

  if (!/\d/.test(password)) {
    return { valid: false, message: "Password must contain a number" };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain a special character" };
  }

  return { valid: true };
}

/**
 * Mask email for display (e.g., u***@example.com)
 */
function maskEmail(email) {
  if (!email) return "***";
  const [local, domain] = email.split("@");
  return `${local.substring(0, 1)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/**
 * Mask phone for display (e.g., ****1234)
 */
function maskPhone(phone) {
  if (!phone) return "***";
  return `****${phone.slice(-4)}`;
}

module.exports = {
  requestPasswordReset,
  verifyOTP,
  resendOTP,
  resetPassword,
  validatePassword,
};
