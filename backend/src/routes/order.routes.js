const express = require("express");
const { authRequired } = require("../middleware/auth");
const orderController = require("../controllers/order.controller");

const router = express.Router();

router.use(authRequired);

// User flows
router.post("/create", orderController.create);
router.get("/user", orderController.listUser);

// Per-order routes (keep after more specific prefixes)
router.get("/:id", orderController.getById);
router.get("/:id/track", orderController.track);
router.post("/:id/cancel", express.json(), orderController.cancel);
router.patch("/:id/cancel", orderController.cancel);
router.patch("/:id/return", orderController.requestReturn);

module.exports = router;

