const Joi = require("joi");
const { shippingAddressSchema, shippingAddressSchemaOptional } = require("./checkout.validation");

const buyNowSessionCreateSchema = Joi.object({
  productId: Joi.string().trim().required(),
  quantity: Joi.number().integer().min(1).default(1),
  variantId: Joi.string().trim().allow("").default(""),
  guestToken: Joi.string().trim().allow("").optional(),
});

const buyNowSessionUpdateSchema = Joi.object({
  quantity: Joi.number().integer().min(0).required(),
  guestToken: Joi.string().trim().allow("").optional(),
});

const buyNowSessionPrepareSchema = Joi.object({
  shippingAddress: shippingAddressSchemaOptional.optional(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").optional(),
  currency: Joi.string().valid("USD", "EUR", "INR", "GBP").optional(),
  guestToken: Joi.string().trim().allow("").optional(),
});

const buyNowSessionCreateOrderSchema = Joi.object({
  shippingAddress: shippingAddressSchema.required(),
  paymentMethod: Joi.string().valid("COD").default("COD"),
  idempotencyKey: Joi.string().trim().max(128).optional(),
});

const buyNowAttachUserSchema = Joi.object({
  guestToken: Joi.string().trim().allow("").optional(),
});

module.exports = {
  buyNowSessionCreateSchema,
  buyNowSessionUpdateSchema,
  buyNowSessionPrepareSchema,
  buyNowSessionCreateOrderSchema,
  buyNowAttachUserSchema,
};
