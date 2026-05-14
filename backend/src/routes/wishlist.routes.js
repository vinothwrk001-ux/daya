const express = require("express");
const { authRequired, authOptional } = require("../middleware/auth");
const wishlistController = require("../controllers/wishlist.controller");

const router = express.Router();

/**
 * AUTHENTICATED USER ENDPOINTS
 * Traditional wishlist operations - require authentication
 */
router.get("/", authRequired, wishlistController.list);
router.get("/:productId/status", authOptional, wishlistController.status);
router.post("/:productId", authRequired, wishlistController.add);
router.delete("/:productId", authRequired, wishlistController.remove);

/**
 * GUEST VALIDATION ENDPOINTS
 * Allow guests to validate products for wishlist
 */
router.post("/:productId/validate", authOptional, wishlistController.validateProduct);
router.get("/:productId/check", authOptional, wishlistController.getProductStatus);
router.post("/validate-items", authOptional, wishlistController.validateWishlistItems);

/**
 * MERGE ENDPOINT
 * After guest login - merge guest wishlist into user wishlist
 */
router.post("/merge", authRequired, wishlistController.mergeGuestWishlist);

module.exports = router;

