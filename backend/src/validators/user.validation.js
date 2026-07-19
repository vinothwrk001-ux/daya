const Joi = require("joi");
const phonePattern = /^[0-9]{10}$/;

const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  email: Joi.string().trim().email().allow("", null),
  phone: Joi.string().trim().pattern(phonePattern),
  notificationPreferences: Joi.object({
    orderUpdates: Joi.boolean(),
    deliveryAlerts: Joi.boolean(),
    paymentAlerts: Joi.boolean(),
    promotions: Joi.boolean(),
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).max(128).required(),
  newPassword: Joi.string().min(6).max(128).required(),
});

const addressSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  phone: Joi.string().trim().pattern(phonePattern).required(),
  addressLine: Joi.string().trim().min(5).max(300).required(),
  city: Joi.string().trim().min(2).max(120).required(),
  state: Joi.string().trim().min(2).max(120).required(),
  pincode: Joi.string().trim().pattern(/^[0-9]{6}$/).required(),
  country: Joi.string().trim().min(2).max(120).required(),
  isDefault: Joi.boolean().default(false),
});

const addressUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  phone: Joi.string().trim().pattern(phonePattern),
  addressLine: Joi.string().trim().min(5).max(300),
  city: Joi.string().trim().min(2).max(120),
  state: Joi.string().trim().min(2).max(120),
  pincode: Joi.string().trim().pattern(/^[0-9]{6}$/),
  country: Joi.string().trim().min(2).max(120),
  isDefault: Joi.boolean(),
}).min(1);

const returnRequestSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(1000).required(),
});

const reviewSchema = Joi.object({
  productId: Joi.string().required(),
  orderId: Joi.string().allow("", null),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(160).allow("", null),
  comment: Joi.string().trim().max(2000).allow("", null),
});

const reviewUpdateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  title: Joi.string().trim().max(160).allow("", null),
  comment: Joi.string().trim().max(2000).allow("", null),
}).min(1);

const supportTicketSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(160).required(),
  category: Joi.string().trim().max(80).allow("", null),
  priority: Joi.string().valid("low", "medium", "high").default("medium"),
  message: Joi.string().trim().min(5).max(2000).required(),
});

const supportReplySchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = {
  profileSchema,
  changePasswordSchema,
  addressSchema,
  addressUpdateSchema,
  returnRequestSchema,
  reviewSchema,
  reviewUpdateSchema,
  supportTicketSchema,
  supportReplySchema,
};
