const Joi = require("joi");
const objectId = Joi.string().hex().length(24);

const relativeOrAbsoluteUrlSchema = Joi.string()
  .trim()
  .custom((value, helpers) => {
    if (!value) return helpers.error("string.empty");
    if (value.startsWith("/")) return value;

    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return value;
      }
    } catch {
      // fall through
    }

    return helpers.error("string.uri");
  }, "relative or absolute URL validation");

const productImageSchema = Joi.object({
  url: relativeOrAbsoluteUrlSchema.required(),
  altText: Joi.string().trim().max(255).allow(""),
  isPrimary: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0),
});

const productVariantSchema = Joi.object({
  variantId: Joi.string().trim().required(),
  title: Joi.string().trim().allow(""),
  attributes: Joi.object().pattern(Joi.string(), Joi.string().allow("")).default({}),
  options: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).required(),
        name: Joi.string().trim().required(),
        value: Joi.string().trim().required(),
      })
    )
    .default([]),
  price: Joi.number().required().min(0),
  discountPrice: Joi.number().min(0),
  weight: Joi.object({
    value: Joi.number().greater(0).required(),
    unit: Joi.string().valid("kg").default("kg"),
  }),
  stock: Joi.number().required().integer().min(0),
  sku: Joi.string().trim().uppercase().regex(/^[A-Z0-9-]+$/).required(),
  images: Joi.array().items(productImageSchema).max(10).default([]),
  isDefault: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

const weightSchema = Joi.object({
  value: Joi.number().greater(0).required().messages({
    "number.base": "Weight must be a number",
    "number.greater": "Weight must be greater than 0",
    "any.required": "Weight is required",
  }),
  unit: Joi.string().valid("kg").default("kg"),
});

// Schema for creating/updating a product
const productSchema = Joi.object({
  name: Joi.string().required().trim().min(3).max(255).messages({
    "string.empty": "Product name is required",
    "string.min": "Product name must be at least 3 characters",
    "string.max": "Product name cannot exceed 255 characters",
  }),

  description: Joi.string().required().trim().min(10).max(5000).messages({
    "string.empty": "Product description is required",
    "string.min": "Product description must be at least 10 characters",
    "string.max": "Product description cannot exceed 5000 characters",
  }),

  shortDescription: Joi.string().trim().max(500),

  category: Joi.string().required().trim().messages({
    "string.empty": "Category is required",
  }),
  categoryId: objectId.required().messages({
    "string.length": "Category is invalid",
    "any.required": "Category is required",
  }),

  subCategory: Joi.string().trim().allow("", null),
  subCategoryId: objectId.required().messages({
    "string.length": "Subcategory is invalid",
    "any.required": "Subcategory is required",
  }),

  tags: Joi.array().items(Joi.string().trim()).max(10),

  price: Joi.number().required().min(0).messages({
    "number.base": "Price must be a number",
    "number.min": "Price cannot be negative",
  }),

  discountPrice: Joi.number().min(0).messages({
    "number.base": "Discount price must be a number",
    "number.min": "Discount price cannot be negative",
  }),

  currency: Joi.string()
    .valid("USD", "EUR", "INR", "GBP")
    .default("INR"),

  stock: Joi.number().required().integer().min(0).messages({
    "number.base": "Stock must be a number",
    "number.min": "Stock cannot be negative",
  }),

  SKU: Joi.string().trim().uppercase().regex(/^[A-Z0-9-]+$/).allow(""),
  productNumber: Joi.string().trim().uppercase().regex(/^[A-Z0-9]+$/).allow(""),

  lowStockThreshold: Joi.number().integer().min(0).default(10),

  images: Joi.array()
    .items(productImageSchema)
    .min(1)
    .max(10)
    .messages({
      "array.min": "At least one image is required",
      "array.max": "Maximum 10 images allowed",
    }),
  genericImages: Joi.array()
    .items(productImageSchema)
    .min(1)
    .max(10)
    .messages({
      "array.min": "At least one generic image is required",
      "array.max": "Maximum 10 generic images allowed",
    }),

  thumbnail: Joi.string().uri(),

  variantConfig: Joi.array().items(Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/)).default([]),
  variants: Joi.array().items(productVariantSchema).default([]),

  metaDescription: Joi.string().trim().max(160),
  metaKeywords: Joi.array().items(Joi.string().trim()).max(10),

  weight: weightSchema.required(),

  dimensions: Joi.object({
    length: Joi.number().min(0),
    width: Joi.number().min(0),
    height: Joi.number().min(0),
  }),

  returnPolicy: Joi.string().trim().max(1000),
  modulesData: Joi.object().pattern(
    Joi.string(),
    Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string().allow(""), Joi.number(), Joi.boolean(), Joi.array()))
  ).default({}),
  attributes: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())).default({}),
  extraDetails: Joi.object().pattern(
    Joi.string(),
    Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string().allow(""), Joi.number(), Joi.boolean(), Joi.array()))
  ).default({}),
}).unknown(true); // Allow unknown fields but validate known ones

// Schema for creating product (stricter)
const createProductSchema = productSchema.fork(
  ["name", "description", "category", "categoryId", "subCategoryId", "price", "stock", "images"],
  (schema) => schema.required()
);

// Schema for updating product (all optional)
const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(3).max(255),
  description: Joi.string().trim().min(10).max(5000),
  shortDescription: Joi.string().trim().max(500),
  category: Joi.string().trim(),
  categoryId: objectId,
  subCategory: Joi.string().trim().allow("", null),
  subCategoryId: objectId,
  tags: Joi.array().items(Joi.string().trim()).max(10),
  price: Joi.number().min(0),
  discountPrice: Joi.number().min(0),
  currency: Joi.string().valid("USD", "EUR", "INR", "GBP"),
  stock: Joi.number().integer().min(0),
  SKU: Joi.string().trim().uppercase().regex(/^[A-Z0-9-]+$/).allow(""),
  productNumber: Joi.string().trim().uppercase().regex(/^[A-Z0-9]+$/).allow(""),
  lowStockThreshold: Joi.number().integer().min(0),
  images: Joi.array()
    .items(productImageSchema)
    .max(10),
  genericImages: Joi.array()
    .items(productImageSchema)
    .max(10),
  thumbnail: Joi.string().uri(),
  variantConfig: Joi.array().items(Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/)),
  variants: Joi.array().items(productVariantSchema),
  metaDescription: Joi.string().trim().max(160),
  metaKeywords: Joi.array().items(Joi.string().trim()).max(10),
  weight: weightSchema,
  dimensions: Joi.object({
    length: Joi.number().min(0),
    width: Joi.number().min(0),
    height: Joi.number().min(0),
  }),
  returnPolicy: Joi.string().trim().max(1000),
  modulesData: Joi.object().pattern(
    Joi.string(),
    Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string().allow(""), Joi.number(), Joi.boolean(), Joi.array()))
  ),
  attributes: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())),
  extraDetails: Joi.object().pattern(
    Joi.string(),
    Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string().allow(""), Joi.number(), Joi.boolean(), Joi.array()))
  ),
}).unknown(true);

// Schema for admin approval
const approveProductSchema = Joi.object({}).unknown(true);

// Schema for rejecting product
const rejectProductSchema = Joi.object({
  rejectionReason: Joi.string().required().trim().min(10).max(1000).messages({
    "string.empty": "Rejection reason is required",
    "string.min": "Rejection reason must be at least 10 characters",
    "string.max": "Rejection reason cannot exceed 1000 characters",
  }),
});

module.exports = {
  productSchema,
  createProductSchema,
  updateProductSchema,
  approveProductSchema,
  rejectProductSchema,
};
