const express = require("express");
const router = express.Router();
const customTShirtColorController = require("../controllers/custom-tshirt-color.controller");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");

// Public routes
router.get("/public", customTShirtColorController.getPublicCustomTShirtColors);

// Admin routes
router.use(adminWorkspaceAuthRequired);

router.get("/", requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }), customTShirtColorController.getAdminCustomTShirtColors);
router.post("/", requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }), customTShirtColorController.createCustomTShirtColor);
router.put("/:id", requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }), customTShirtColorController.updateCustomTShirtColor);
router.delete("/:id", requireWorkspacePermission("settings.delete", { legacyPermission: "settings:update" }), customTShirtColorController.deleteCustomTShirtColor);

module.exports = router;
