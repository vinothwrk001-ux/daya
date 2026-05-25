const express = require("express");
const { authOptional, authRequired, requireRole } = require("../middleware/auth");
const storefrontController = require("../controllers/vendor-storefront.controller");

const router = express.Router();

router.get("/:slug", authOptional, storefrontController.getStorefront);
router.get("/:slug/products", authOptional, storefrontController.getProducts);
router.post("/:slug/follow", authRequired, requireRole("user"), storefrontController.follow);
router.delete("/:slug/follow", authRequired, requireRole("user"), storefrontController.unfollow);

module.exports = router;
