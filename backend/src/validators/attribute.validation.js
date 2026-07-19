const Joi = require("joi");

const objectId = Joi.string().hex().length(24);
const attributeType = Joi.string().valid("text", "number", "select", "multi-select", "boolean", "color");
const variantDisplayType = Joi.string().valid("button", "swatch", "image-swatch");

const attributePayload = {
  name: Joi.string().trim().max(120),
  key: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(120),
  type: attributeType,
  required: Joi.boolean(),
  options: Joi.array().items(Joi.string().trim().max(120)).max(200),
  moduleKey: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(120),
  group: Joi.string().trim().max(120).allow(""),
  order: Joi.number().integer().min(0),
  template: Joi.string().trim().max(120).allow(""),
  isVariant: Joi.boolean(),
  useInFilters: Joi.boolean(),
  variantConfig: Joi.object({
    displayType: variantDisplayType,
    affectsImage: Joi.boolean(),
  }),
  isActive: Joi.boolean(),
  appliesTo: Joi.object({
    categoryId: objectId.required(),
    subCategoryId: objectId.allow(null, ""),
  }),
};

const createAttributeSchema = Joi.object({
  name: attributePayload.name.required(),
  key: attributePayload.key.required(),
  type: attributePayload.type.required(),
  required: attributePayload.required,
  options: attributePayload.options,
  moduleKey: attributePayload.moduleKey.required(),
  group: attributePayload.group,
  order: attributePayload.order,
  template: attributePayload.template,
  useInFilters: attributePayload.useInFilters,
  isActive: attributePayload.isActive,
  appliesTo: attributePayload.appliesTo.required(),
});

const updateAttributeSchema = Joi.object(attributePayload).min(1);

module.exports = {
  createAttributeSchema,
  updateAttributeSchema,
};
