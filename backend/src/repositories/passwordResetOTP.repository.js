const crypto = require("crypto");
const { PasswordResetOTP } = require("../models/PasswordResetOTP");

/**
 * Password Reset OTP Repository
 * Handles all database operations for password reset OTPs
 */

async function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function createOTP(userId, email, phone, otpType, meta = {}) {
  const otp = await generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const resetOTP = await PasswordResetOTP.create({
    userId,
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    otpHash,
    otpType,
    expiresAt,
    attemptCount: 0,
    resendCount: 0,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    createdByIp: meta.ipAddress,
    createdByUserAgent: meta.userAgent,
  });

  return { otp, resetOTP };
}

async function findByUserId(userId, otpType = "email") {
  return PasswordResetOTP.findOne({
    userId,
    otpType,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  });
}

async function findById(id) {
  return PasswordResetOTP.findById(id);
}

async function findByIdWithHash(id) {
  return PasswordResetOTP.findById(id).select("+otpHash");
}

async function verifyOTP(resetOTPId, plainOTP) {
  const resetOTP = await findByIdWithHash(resetOTPId);
  
  if (!resetOTP) {
    return { valid: false, reason: "NOT_FOUND" };
  }

  if (resetOTP.isUsed) {
    return { valid: false, reason: "ALREADY_USED" };
  }

  if (resetOTP.expiresAt < new Date()) {
    return { valid: false, reason: "EXPIRED" };
  }

  if (resetOTP.attemptCount >= resetOTP.maxAttempts) {
    return { valid: false, reason: "MAX_ATTEMPTS_EXCEEDED" };
  }

  const otpHash = hashOTP(plainOTP);
  const isValid = resetOTP.otpHash === otpHash;

  if (!isValid) {
    // Increment attempt count
    resetOTP.attemptCount += 1;
    await resetOTP.save();
    return { valid: false, reason: "INVALID_OTP" };
  }

  return { valid: true };
}

async function markAsVerified(resetOTPId) {
  return PasswordResetOTP.findByIdAndUpdate(
    resetOTPId,
    {
      isVerified: true,
      verifiedAt: new Date(),
    },
    { new: true }
  );
}

async function markAsUsed(resetOTPId) {
  return PasswordResetOTP.findByIdAndUpdate(
    resetOTPId,
    {
      isUsed: true,
      usedAt: new Date(),
    },
    { new: true }
  );
}

async function incrementResendCount(resetOTPId) {
  return PasswordResetOTP.findByIdAndUpdate(
    resetOTPId,
    {
      $inc: { resendCount: 1 },
      $set: { lastResendAt: new Date() },
    },
    { new: true }
  );
}

async function regenerateOTP(resetOTPId) {
  const otp = await generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const resetOTP = await PasswordResetOTP.findByIdAndUpdate(
    resetOTPId,
    {
      $set: {
        otpHash,
        expiresAt,
        attemptCount: 0,
        isVerified: false,
        verifiedAt: null,
        lastResendAt: new Date(),
      },
      $inc: { resendCount: 1 },
    },
    { new: true }
  );

  return { otp, resetOTP };
}

async function invalidateOTPsForUser(userId) {
  return PasswordResetOTP.updateMany(
    { userId, isUsed: false },
    { isUsed: true, usedAt: new Date() }
  );
}

async function deleteExpiredOTPs() {
  return PasswordResetOTP.deleteMany({
    expiresAt: { $lt: new Date() },
  });
}

module.exports = {
  createOTP,
  findByUserId,
  findById,
  findByIdWithHash,
  verifyOTP,
  markAsVerified,
  markAsUsed,
  incrementResendCount,
  regenerateOTP,
  invalidateOTPsForUser,
  deleteExpiredOTPs,
  generateOTP,
  hashOTP,
};
