const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const passwordResetService = require("../services/passwordReset.service");

/**
 * POST /api/auth/forgot-password/request
 * Request password reset via email or phone
 */
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { identifier, otpType = "email" } = req.body;

  if (!identifier) {
    throw new AppError("Email or phone number required", 400, "INVALID_INPUT");
  }

  const result = await passwordResetService.requestPasswordReset(identifier, otpType, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return ok(res, result, "Password reset OTP sent successfully");
});

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verify OTP code
 */
const verifyOTP = asyncHandler(async (req, res) => {
  const { resetOtpId, otp } = req.body;

  if (!resetOtpId || !otp) {
    throw new AppError("OTP and reset ID required", 400, "INVALID_INPUT");
  }

  const result = await passwordResetService.verifyOTP(resetOtpId, otp, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return ok(res, result, "OTP verified successfully");
});

/**
 * POST /api/auth/forgot-password/resend-otp
 * Resend OTP with cooldown protection
 */
const resendOTP = asyncHandler(async (req, res) => {
  const { resetOtpId } = req.body;

  if (!resetOtpId) {
    throw new AppError("Reset ID required", 400, "INVALID_INPUT");
  }

  const result = await passwordResetService.resendOTP(resetOtpId, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return ok(res, result, "OTP resent successfully");
});

/**
 * POST /api/auth/forgot-password/reset
 * Reset password after OTP verification
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { resetOtpId, newPassword, confirmPassword } = req.body;

  if (!resetOtpId || !newPassword || !confirmPassword) {
    throw new AppError("Reset ID, new password, and confirmation required", 400, "INVALID_INPUT");
  }

  if (newPassword !== confirmPassword) {
    throw new AppError("Passwords do not match", 400, "PASSWORD_MISMATCH");
  }

  const result = await passwordResetService.resetPassword(resetOtpId, newPassword, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return ok(res, result, "Password reset successfully");
});

module.exports = {
  requestPasswordReset,
  verifyOTP,
  resendOTP,
  resetPassword,
};
