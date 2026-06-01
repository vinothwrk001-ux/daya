const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { AppError } = require("../../utils/AppError");

function getTrackingSecret() {
  return process.env.TRACKING_JWT_SECRET || process.env.JWT_ACCESS_SECRET || "tracking-secret";
}

function signTrackingToken(payload, expiresInHours = 720) {
  const trackingTokenId = crypto.randomBytes(12).toString("hex");
  const token = jwt.sign(
    {
      ...payload,
      ttid: trackingTokenId,
      typ: "tracking",
    },
    getTrackingSecret(),
    { expiresIn: `${Number(expiresInHours || 720)}h` }
  );
  return {
    token,
    trackingTokenId,
  };
}

function verifyTrackingToken(token) {
  try {
    return jwt.verify(token, getTrackingSecret());
  } catch (error) {
    throw new AppError("Invalid or expired tracking token", 400, "INVALID_TRACKING_TOKEN");
  }
}

module.exports = {
  signTrackingToken,
  verifyTrackingToken,
};
