const Joi = require("joi");

const shippingAddressSchema = Joi.object({
  fullName: Joi.string().trim().required().max(120),
  phone: Joi.string().trim().required().max(20),
  line1: Joi.string().trim().required().max(300),
  line2: Joi.string().trim().allow("").max(300),
  city: Joi.string().trim().required().max(100),
  state: Joi.string().trim().required().max(100),
  postalCode: Joi.string().trim().required().max(20),
  country: Joi.string().trim().required().max(100).default("India"),
});

const checkoutPrepareSchema = Joi.object({
  currency: Joi.string().valid("USD", "EUR", "INR", "GBP").default("INR"),
  shippingAddress: shippingAddressSchema.optional(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").optional(),
  trackingToken: Joi.string().allow("", null),
});

const checkoutCreateSchema = Joi.object({
  shippingAddress: shippingAddressSchema.required(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").default("ONLINE"),
  trackingToken: Joi.string().allow("", null),
});

module.exports = {
  shippingAddressSchema,
  checkoutPrepareSchema,
  checkoutCreateSchema,
};
