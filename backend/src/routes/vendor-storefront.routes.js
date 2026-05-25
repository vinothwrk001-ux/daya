const express = require("express");
const { authOptional, authRequired, requireRole } = require("../middleware/auth");
const controller = require("../controllers/vendor-storefront.controller");

const router = express.Router();

router.get("/:slug", authOptional, controller.getStorefront);
router.get("/:slug/products", authOptional, controller.getProducts);
router.get("/:slug/reviews", authOptional, controller.getReviews);
router.get("/:slug/followers", controller.getFollowers);
router.post("/:slug/follow", authRequired, requireRole("user"), controller.follow);
router.delete("/:slug/follow", authRequired, requireRole("user"), controller.unfollow);
router.post("/:slug/events", authOptional, controller.track);

module.exports = router;
