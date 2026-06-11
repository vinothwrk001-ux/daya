const Joi = require("joi");
const { shippingAddressSchema } = require("./checkout.validation");

const createRazorpayOrderSchema = Joi.object({
  cartId: Joi.alternatives().try(Joi.string().trim(), Joi.valid(null)).optional(),
  shippingAddress: shippingAddressSchema.required(),
});

const verifyRazorpayPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().trim().pattern(/^order_[A-Za-z0-9]+$/).required().max(120),
  razorpay_payment_id: Joi.string().trim().pattern(/^pay_[A-Za-z0-9]+$/).required().max(120),
  razorpay_signature: Joi.string().trim().pattern(/^[a-f0-9]{64}$/i).required().max(256),
});

const checkoutFailureSchema = Joi.object({
  razorpay_order_id: Joi.string().trim().pattern(/^order_[A-Za-z0-9]+$/).required().max(120),
  paymentSessionId: Joi.string().trim().allow("", null).optional(),
  key_id: Joi.string().trim().pattern(/^rzp_(test|live)_[A-Za-z0-9]+$/).allow("", null).optional(),
  gatewayMode: Joi.string().valid("test", "live", "unknown").allow("", null).optional(),
  amount: Joi.number().integer().positive().optional(),
  currency: Joi.string().trim().uppercase().length(3).optional(),
  error: Joi.object({
    code: Joi.string().trim().allow("").max(120).optional(),
    description: Joi.string().trim().allow("").max(500).optional(),
    source: Joi.string().trim().allow("").max(120).optional(),
    step: Joi.string().trim().allow("").max(120).optional(),
    reason: Joi.string().trim().allow("").max(120).optional(),
    metadata: Joi.object().unknown(true).optional(),
  }).unknown(true).default({}),
});

const checkoutOpenedSchema = Joi.object({
  razorpay_order_id: Joi.string().trim().pattern(/^order_[A-Za-z0-9]+$/).required().max(120),
  paymentSessionId: Joi.string().trim().allow("", null).optional(),
  key_id: Joi.string().trim().pattern(/^rzp_(test|live)_[A-Za-z0-9]+$/).required(),
  gatewayMode: Joi.string().valid("test", "live", "unknown").allow("", null).optional(),
  amount: Joi.number().integer().positive().required(),
  currency: Joi.string().trim().uppercase().length(3).required(),
});

const refundPaymentSchema = Joi.object({
  orderId: Joi.string().trim().optional(),
  paymentId: Joi.string().trim().optional(),
  amount: Joi.number().positive().precision(2).optional(),
  reason: Joi.string().trim().max(500).required(),
  notes: Joi.string().trim().allow("").max(500).optional(),
}).or("orderId", "paymentId");

const razorpaySettingsSchema = Joi.object({
  isEnabled: Joi.boolean().optional(),
  gatewayFeePercentage: Joi.number().min(0).max(100).optional(),
  gatewayFeeFixed: Joi.number().min(0).optional(),
  prepaidDiscountPercentage: Joi.number().min(0).max(100).optional(),
  prepaidDiscountFixed: Joi.number().min(0).optional(),
  sessionTimeoutMinutes: Joi.number().integer().min(5).max(120).optional(),
  webhookUrl: Joi.string().trim().allow("").max(500).optional(),
  notes: Joi.string().trim().allow("").max(500).optional(),
});

module.exports = {
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
  checkoutFailureSchema,
  checkoutOpenedSchema,
  refundPaymentSchema,
  razorpaySettingsSchema,
};
