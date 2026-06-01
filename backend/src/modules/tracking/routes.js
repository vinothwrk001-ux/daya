const express = require("express");
const Joi = require("joi");
const { authOptional } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { eventSecurity } = require("./security.middleware");
const controller = require("./controller");

const router = express.Router();

router.post(
  "/click",
  authOptional,
  eventSecurity("product_click", { blockOnLimit: false }),
  validate(
    Joi.object({
        reelId: Joi.string().allow("", null),
        storefrontId: Joi.string().allow("", null),
        collectionId: Joi.string().allow("", null),
        postId: Joi.string().allow("", null),
        influencerId: Joi.string().allow("", null),
        trackingCode: Joi.string().allow("", null),
        productId: Joi.string().required(),
        anonymousId: Joi.string().allow("", null),
        surface: Joi.string().allow("", null),
      })
  ),
  controller.click
);

router.post(
  "/event",
  authOptional,
  eventSecurity("tracking_event", { blockOnLimit: false }),
  validate(
    Joi.object({
      trackingToken: Joi.string().required(),
      anonymousId: Joi.string().allow("", null),
      eventType: Joi.string().valid("product_view", "add_to_cart", "wishlist", "checkout_started", "order_completed", "order_cancelled", "refund", "commission_approved", "commission_paid").required(),
      metadata: Joi.object().unknown(true).default({}),
    })
  ),
  controller.event
);

module.exports = router;
