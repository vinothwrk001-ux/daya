const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const createSubcategorySchema = Joi.object({
  name: Joi.string().trim().max(120).required().messages({
    "string.empty": "Subcategory name is required",
    "any.required": "Subcategory name is required",
  }),
  code: Joi.string().trim().max(10).allow(""),
  categoryId: objectId.required().messages({
    "string.length": "Category is invalid",
    "any.required": "Category is required",
  }),
  status: Joi.string().valid("active", "disabled"),
});

const updateSubcategorySchema = Joi.object({
  name: Joi.string().trim().max(120),
  code: Joi.string().trim().max(10).allow(""),
  categoryId: objectId,
  status: Joi.string().valid("active", "disabled"),
}).min(1);

const updateSubcategoryStatusSchema = Joi.object({
  status: Joi.string().valid("active", "disabled").required(),
});

module.exports = {
  createSubcategorySchema,
  updateSubcategorySchema,
  updateSubcategoryStatusSchema,
};
