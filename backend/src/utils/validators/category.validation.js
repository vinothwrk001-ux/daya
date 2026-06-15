const Joi = require("joi");
const { CATEGORY_STATUS, CATEGORY_VISIBILITY } = require("../../models/Category");

const categoryPayload = {
  name: Joi.string().trim().max(120),
  code: Joi.string().trim().max(10).allow(""),
  slug: Joi.string().trim().max(120).allow(""),
  description: Joi.string().trim().max(2000).allow(""),
  icon: Joi.string().trim().max(500).allow(""),
  logo: Joi.string().trim().allow(""),
  thumbnailUrl: Joi.string().trim().allow(""),
  bannerUrl: Joi.string().trim().allow(""),
  cloudinaryPublicId: Joi.string().trim().allow(""),
  color: Joi.string().trim().max(120).allow(""),
  parentCategoryId: Joi.string().allow(null, ""),
  status: Joi.string().valid(...CATEGORY_STATUS),
  visibility: Joi.string().valid(...CATEGORY_VISIBILITY),
  showOnHomepage: Joi.boolean(),
  showInHeroBanner: Joi.boolean(),
  heroHeading: Joi.string().trim().max(160).allow(""),
  heroSubheading: Joi.string().trim().max(320).allow(""),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0),
  seoTitle: Joi.string().trim().max(160).allow(""),
  seoDescription: Joi.string().trim().max(320).allow(""),
};

const createCategorySchema = Joi.object({
  name: categoryPayload.name.required().messages({
    "any.required": "Category name is required",
    "string.empty": "Category name is required",
  }),
  slug: categoryPayload.slug,
  code: categoryPayload.code,
  description: categoryPayload.description,
  icon: categoryPayload.icon,
  logo: categoryPayload.logo,
  thumbnailUrl: categoryPayload.thumbnailUrl,
  bannerUrl: categoryPayload.bannerUrl,
  color: categoryPayload.color,
  parentCategoryId: categoryPayload.parentCategoryId,
  status: categoryPayload.status,
  visibility: categoryPayload.visibility,
  showOnHomepage: categoryPayload.showOnHomepage,
  showInHeroBanner: categoryPayload.showInHeroBanner,
  heroHeading: categoryPayload.heroHeading,
  heroSubheading: categoryPayload.heroSubheading,
  isActive: categoryPayload.isActive,
  order: categoryPayload.order,
  seoTitle: categoryPayload.seoTitle,
  seoDescription: categoryPayload.seoDescription,
});

const updateCategorySchema = Joi.object(categoryPayload).min(1);

const toggleCategorySchema = Joi.object({
  isActive: Joi.boolean().required(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  toggleCategorySchema,
};
