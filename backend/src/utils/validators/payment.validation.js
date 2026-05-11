const Joi = require("joi");
const { shippingAddressSchema } = require("./checkout.validation");

const createRazorpayOrderSchema = Joi.object({
  cartId: Joi.alternatives().try(Joi.string().trim(), Joi.valid(null)).optional(),
  shippingAddress: shippingAddressSchema.required(),
  trackingToken: Joi.string().allow("", null),
});

const verifyRazorpayPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().trim().required().max(120),
  razorpay_payment_id: Joi.string().trim().required().max(120),
  razorpay_signature: Joi.string().trim().required().max(256),
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
  refundPaymentSchema,
  razorpaySettingsSchema,
};
