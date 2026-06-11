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

// For prepare endpoint, allow partial/optional address
const shippingAddressSchemaOptional = Joi.object({
  fullName: Joi.string().trim().max(120),
  phone: Joi.string().trim().max(20),
  line1: Joi.string().trim().max(300),
  line2: Joi.string().trim().allow("").max(300),
  city: Joi.string().trim().max(100),
  state: Joi.string().trim().max(100),
  postalCode: Joi.string().trim().max(20),
  country: Joi.string().trim().max(100).default("India"),
});

const checkoutPrepareSchema = Joi.object({
  currency: Joi.string().valid("USD", "EUR", "INR", "GBP").default("INR"),
  shippingAddress: shippingAddressSchemaOptional.optional(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").optional(),
});

const checkoutCreateSchema = Joi.object({
  shippingAddress: shippingAddressSchema.required(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").default("ONLINE"),
});

module.exports = {
  shippingAddressSchema,
  checkoutPrepareSchema,
  checkoutCreateSchema,
};
