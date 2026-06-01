const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const paymentService = require("../services/payment.service");

const getPaymentHealth = asyncHandler(async (req, res) => {
  const result = await paymentService.getRazorpayHealth({
    deepCreateOrder: String(req.query.deep || "").toLowerCase() === "true",
  });
  const statusCode = result.status === "Unhealthy" ? 503 : 200;
  return ok(res, result, `Payment system ${result.status}`, statusCode);
});

module.exports = {
  getPaymentHealth,
};
