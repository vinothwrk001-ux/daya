const Joi = require("joi");

const moduleFieldType = Joi.string().valid("text", "textarea", "number", "select", "multi-select", "boolean", "date");

const moduleFieldSchema = Joi.object({
  name: Joi.string().trim().max(120).required(),
  key: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(120).required(),
  type: moduleFieldType.required(),
  required: Joi.boolean().default(false),
  options: Joi.array().items(Joi.string().trim().max(120)).max(200).default([]),
  helpText: Joi.string().trim().max(255).allow(""),
  order: Joi.number().integer().min(0).default(0),
});

const createProductModuleSchema = Joi.object({
  name: Joi.string().trim().max(120).required(),
  key: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(120).required(),
  fields: Joi.array().items(moduleFieldSchema).default([]),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

const updateProductModuleSchema = Joi.object({
  name: Joi.string().trim().max(120),
  key: Joi.string().trim().lowercase().pattern(/^[a-z][a-z0-9_]*$/).max(120),
  fields: Joi.array().items(moduleFieldSchema),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  createProductModuleSchema,
  updateProductModuleSchema,
};
