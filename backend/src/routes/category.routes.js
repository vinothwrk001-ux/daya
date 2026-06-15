const express = require("express");
const Joi = require("joi");
const categoryController = require("../controllers/category.controller");
const { authOptional } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.get("/", categoryController.getActiveCategories);
router.get("/homepage", categoryController.getHomepageCategories);
router.get("/hero-banner", categoryController.getHeroBannerCategories);
router.get("/slug/:slug", categoryController.getCategoryBySlug);

router.post(
  "/:id/track",
  authOptional,
  validate(
    Joi.object({
      eventType: Joi.string().valid("view", "click", "product_view", "add_to_cart", "order").required(),
      sessionId: Joi.string().allow("", null),
      productId: Joi.string().allow("", null),
      orderId: Joi.string().allow("", null),
      revenue: Joi.number().min(0).optional(),
    })
  ),
  categoryController.trackCategoryEvent
);

module.exports = router;
