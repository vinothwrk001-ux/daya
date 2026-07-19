const Joi = require("joi");
const { BANNER_STATUS } = require("../models/HomepageBanner");

const bannerCategoryItemSchema = Joi.object({
  categoryId: Joi.string().required(),
  displayOrder: Joi.number().integer().min(0).optional(),
  customTitle: Joi.string().trim().max(160).allow(""),
  customSubtitle: Joi.string().trim().max(320).allow(""),
  cardImage: Joi.string().trim().allow(""),
  ctaUrl: Joi.string().trim().max(500).allow(""),
  showProductCount: Joi.boolean().optional(),
  status: Joi.string().valid("active", "inactive").optional(),
});

const bannerPayload = {
  name: Joi.string().trim().max(160),
  slug: Joi.string().trim().max(160).allow(""),
  title: Joi.string().trim().max(200).allow(""),
  subtitle: Joi.string().trim().max(320).allow(""),
  description: Joi.string().trim().max(2000).allow(""),
  featuredCollectionText: Joi.string().trim().max(200).allow(""),
  ctaText: Joi.string().trim().max(80).allow(""),
  ctaUrl: Joi.string().trim().max(500).allow(""),
  mediaType: Joi.string().valid("image", "video"),
  desktopMedia: Joi.string().trim().allow(""),
  mobileMedia: Joi.string().trim().allow(""),
  desktopPoster: Joi.string().trim().allow(""),
  mobilePoster: Joi.string().trim().allow(""),
  desktopImage: Joi.string().trim().allow(""),
  mobileImage: Joi.string().trim().allow(""),
  showOverlay: Joi.boolean(),
  overlayOpacity: Joi.number().min(0).max(1),
  hoverModeEnabled: Joi.boolean(),
  categoryHeading: Joi.string().trim().max(160).allow(""),
  categoryDescription: Joi.string().trim().max(500).allow(""),
  status: Joi.string().valid(...BANNER_STATUS),
  displayOrder: Joi.number().integer().min(0),
  startDate: Joi.date().allow(null),
  endDate: Joi.date().allow(null),
  showOnHomepage: Joi.boolean(),
  containerId: Joi.string().allow("", null),
  categories: Joi.array().items(bannerCategoryItemSchema).max(12),
};

const createBannerSchema = Joi.object({
  name: bannerPayload.name.required(),
  slug: bannerPayload.slug,
  title: bannerPayload.title,
  subtitle: bannerPayload.subtitle,
  description: bannerPayload.description,
  featuredCollectionText: bannerPayload.featuredCollectionText,
  ctaText: bannerPayload.ctaText,
  ctaUrl: bannerPayload.ctaUrl,
  mediaType: bannerPayload.mediaType,
  desktopMedia: bannerPayload.desktopMedia,
  mobileMedia: bannerPayload.mobileMedia,
  desktopPoster: bannerPayload.desktopPoster,
  mobilePoster: bannerPayload.mobilePoster,
  desktopImage: bannerPayload.desktopImage,
  mobileImage: bannerPayload.mobileImage,
  showOverlay: bannerPayload.showOverlay,
  overlayOpacity: bannerPayload.overlayOpacity,
  hoverModeEnabled: bannerPayload.hoverModeEnabled,
  categoryHeading: bannerPayload.categoryHeading,
  categoryDescription: bannerPayload.categoryDescription,
  status: bannerPayload.status,
  displayOrder: bannerPayload.displayOrder,
  startDate: bannerPayload.startDate,
  endDate: bannerPayload.endDate,
  showOnHomepage: bannerPayload.showOnHomepage,
  containerId: bannerPayload.containerId,
  categories: bannerPayload.categories,
});

const updateBannerSchema = Joi.object(bannerPayload).min(1);

const assignCategoriesSchema = Joi.object({
  categories: Joi.array().items(bannerCategoryItemSchema).min(1).max(12).required(),
});

const reorderBannersSchema = Joi.object({
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

const bannerSettingsSchema = Joi.object({
  maxCategoryCards: Joi.number().integer().min(1).max(12),
  autoplay: Joi.boolean(),
  autoplayIntervalMs: Joi.number().integer().min(1000).max(60000),
  transitionEffect: Joi.string().valid("fade", "slide", "zoom"),
  pauseOnHover: Joi.boolean(),
  enableLoop: Joi.boolean(),
  showArrows: Joi.boolean(),
  showDots: Joi.boolean(),
}).min(1);

const trackBannerSchema = Joi.object({
  eventType: Joi.string().valid("view", "click", "category_click", "conversion").required(),
  categoryId: Joi.string().allow("", null),
  sessionId: Joi.string().allow("", null),
  revenue: Joi.number().min(0).optional(),
  orderId: Joi.string().allow("", null),
});

module.exports = {
  createBannerSchema,
  updateBannerSchema,
  assignCategoriesSchema,
  reorderBannersSchema,
  bannerSettingsSchema,
  trackBannerSchema,
};
