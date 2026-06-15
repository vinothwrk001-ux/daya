const express = require("express");
const { authRequired, authOptional } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const checkoutController = require("../controllers/checkout.controller");
const checkoutSessionController = require("../controllers/checkoutSession.controller");
const {
  checkoutPrepareSchema,
  checkoutCreateSchema,
} = require("../utils/validators/checkout.validation");
const {
  buyNowSessionCreateSchema,
  buyNowSessionUpdateSchema,
  buyNowSessionPrepareSchema,
  buyNowSessionCreateOrderSchema,
  buyNowAttachUserSchema,
} = require("../utils/validators/checkoutSession.validation");

const router = express.Router();

/**
 * AUTHENTICATED USER CHECKOUT
 */
router.post("/prepare", authRequired, validate(checkoutPrepareSchema), checkoutController.prepare);
router.post("/create", authRequired, validate(checkoutCreateSchema), checkoutController.createOrder);

/**
 * BUY NOW CHECKOUT (does not modify cart)
 */
router.post(
  "/buy-now/session",
  authOptional,
  validate(buyNowSessionCreateSchema),
  checkoutSessionController.createBuyNowSession
);
router.get("/buy-now/session/:sessionId", authOptional, checkoutSessionController.getBuyNowSession);
router.post(
  "/buy-now/session/:sessionId/attach-user",
  authRequired,
  validate(buyNowAttachUserSchema),
  checkoutSessionController.attachUserToBuyNowSession
);
router.patch(
  "/buy-now/session/:sessionId",
  authOptional,
  validate(buyNowSessionUpdateSchema),
  checkoutSessionController.updateBuyNowSession
);
router.post(
  "/buy-now/session/:sessionId/prepare",
  authOptional,
  validate(buyNowSessionPrepareSchema),
  checkoutSessionController.prepareBuyNowSession
);
router.post(
  "/buy-now/session/:sessionId/create",
  authRequired,
  validate(buyNowSessionCreateOrderSchema),
  checkoutSessionController.createBuyNowOrder
);

/**
 * GUEST CHECKOUT
 * Allow guests to prepare checkout with their cart items
 * Actual order creation still requires authentication
 */
router.post("/guest/prepare", authOptional, checkoutController.prepareGuestCheckout);

module.exports = router;


