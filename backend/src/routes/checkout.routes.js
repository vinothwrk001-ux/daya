const express = require("express");
const { authRequired, authOptional } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const checkoutController = require("../controllers/checkout.controller");
const {
  checkoutPrepareSchema,
  checkoutCreateSchema,
} = require("../utils/validators/checkout.validation");

const router = express.Router();

/**
 * AUTHENTICATED USER CHECKOUT
 */
router.post("/prepare", authRequired, validate(checkoutPrepareSchema), checkoutController.prepare);
router.post("/create", authRequired, validate(checkoutCreateSchema), checkoutController.createOrder);

/**
 * GUEST CHECKOUT
 * Allow guests to prepare checkout with their cart items
 * Actual order creation still requires authentication
 */
router.post("/guest/prepare", authOptional, checkoutController.prepareGuestCheckout);

module.exports = router;


