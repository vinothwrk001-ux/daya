const express = require("express");
const { authRequired, requireRole } = require("../../middleware/auth");
const controller = require("./controller");

const router = express.Router();

router.get("/wallet", authRequired, requireRole("influencer"), controller.wallet);
router.get("/admin/overview", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.overview);

module.exports = router;
