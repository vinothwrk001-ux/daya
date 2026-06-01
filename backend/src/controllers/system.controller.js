const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const paymentService = require("../services/payment.service");
const { signPrivateFile, verifyPrivateFileToken, normalizePrivateFilename } = require("../utils/privateFileAccess");

const getPaymentHealth = asyncHandler(async (req, res) => {
  const result = await paymentService.getRazorpayHealth({
    deepCreateOrder: String(req.query.deep || "").toLowerCase() === "true",
  });
  const statusCode = result.status === "Unhealthy" ? 503 : 200;
  return ok(res, result, `Payment system ${result.status}`, statusCode);
});

const signPrivateFileUrl = asyncHandler(async (req, res) => {
  const filename = normalizePrivateFilename(req.body.filename || req.params.filename || "");
  const signed = signPrivateFile(filename, { actorId: req.user?.sub || req.staff?._id || "system", ttlSeconds: req.body.ttlSeconds });
  return ok(res, { ...signed, url: `/api/system/private-files/access/${signed.token}` }, "Private file URL signed");
});

const accessPrivateFile = asyncHandler(async (req, res) => {
  const file = verifyPrivateFileToken(req.params.token);
  res.setHeader("Cache-Control", "private, no-store");
  return res.sendFile(file.absolutePath);
});

module.exports = {
  getPaymentHealth,
  signPrivateFileUrl,
  accessPrivateFile,
};
