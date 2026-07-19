const Joi = require("joi");
const { CONTAINER_STATUS } = require("../models/HomepageBannerContainer");

const containerSettingsSchema = Joi.object({
  maxCategoryCards: Joi.number().integer().min(1).max(12),
  autoplay: Joi.boolean(),
  autoplayIntervalMs: Joi.number().integer().min(1000).max(60000),
  transitionEffect: Joi.string().valid("fade", "slide", "zoom"),
  pauseOnHover: Joi.boolean(),
  enableLoop: Joi.boolean(),
  showArrows: Joi.boolean(),
  showDots: Joi.boolean(),
});

const containerPayload = {
  name: Joi.string().trim().max(160),
  slug: Joi.string().trim().max(160).allow(""),
  description: Joi.string().trim().max(500).allow(""),
  status: Joi.string().valid(...CONTAINER_STATUS),
  displayOrder: Joi.number().integer().min(0),
  showOnHomepage: Joi.boolean(),
  overlayOpacity: Joi.number().min(0).max(1),
  textPosition: Joi.string().valid("left", "center", "right"),
  settings: containerSettingsSchema,
};

const createBannerContainerSchema = Joi.object({
  name: containerPayload.name.required(),
  slug: containerPayload.slug,
  description: containerPayload.description,
  status: containerPayload.status,
  displayOrder: containerPayload.displayOrder,
  showOnHomepage: containerPayload.showOnHomepage,
  overlayOpacity: containerPayload.overlayOpacity,
  textPosition: containerPayload.textPosition,
  settings: containerPayload.settings,
});

const updateBannerContainerSchema = Joi.object(containerPayload).min(1);

const reorderBannerContainersSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        displayOrder: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required(),
});

module.exports = {
  createBannerContainerSchema,
  updateBannerContainerSchema,
  reorderBannerContainersSchema,
};
