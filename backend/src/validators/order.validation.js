const Joi = require("joi");

const addressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(160).required(),
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/).required(),
  line1: Joi.string().trim().min(3).max(300).required(),
  line2: Joi.string().trim().max(300).allow("", null),
  city: Joi.string().trim().min(2).max(120).required(),
  state: Joi.string().trim().min(2).max(120).required(),
  postalCode: Joi.string().trim().pattern(/^[0-9]{6}$/).required(),
  country: Joi.string().trim().min(2).max(120).required(),
}).required();

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
}).required();

const deliveryDetailsSchema = Joi.object({
  trackingId: Joi.string().trim().max(120).allow("", null),
  partner: Joi.string().trim().max(120).allow("", null),
  courierName: Joi.string().trim().max(120).allow("", null),
  trackingUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(500).allow("", null),
});

const shippingModeSchema = Joi.string().valid("SELF", "PLATFORM");

const createAdminOrderSchema = Joi.object({
  userId: Joi.string().required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  paymentMethod: Joi.string().valid("ONLINE", "COD").required(),
  paymentStatus: Joi.string().valid("PENDING", "PAID", "FAILED", "Pending", "Paid", "Failed").default("PENDING"),
  orderStatus: Joi.string()
    .valid(
      "PLACED",
      "PACKED",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
      "Placed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Returned"
    )
    .default("PLACED"),
  shippingMode: shippingModeSchema,
  address: addressSchema,
  deliveryDetails: deliveryDetailsSchema,
}).required();

const updateAdminOrderSchema = Joi.object({
  orderStatus: Joi.string().valid(
    "PLACED",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
    "Placed",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "Returned"
  ),
  shippingMode: shippingModeSchema,
  deliveryDetails: deliveryDetailsSchema,
}).min(1);

const shipOrderSchema = Joi.object({
  courierName: Joi.string().trim().min(1).max(120).required(),
  trackingNumber: Joi.string().trim().min(1).max(120).required(),
  trackingId: Joi.string().trim().min(1).max(120),
  trackingUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(500).required(),
  shippingDate: Joi.date().iso().optional(),
  expectedDeliveryDate: Joi.date().iso().optional(),
  shippingNotes: Joi.string().trim().max(1000).allow("", null),
}).required();

module.exports = {
  createAdminOrderSchema,
  updateAdminOrderSchema,
  shipOrderSchema,
};

