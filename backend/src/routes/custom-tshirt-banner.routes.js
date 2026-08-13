const express = require("express");
const multer = require("multer");
const customTShirtBannerController = require("../controllers/custom-tshirt-banner.controller");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Public route
router.get("/public", customTShirtBannerController.listPublicBanners);

// Admin routes
router.use(adminWorkspaceAuthRequired);

router.get(
  "/",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }),
  customTShirtBannerController.listAdminBanners
);

router.post(
  "/",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  upload.array("image", 1), // Expecting a single file under 'image' key
  customTShirtBannerController.createBanner
);

router.delete(
  "/:id",
  requireWorkspacePermission("settings.delete", { legacyPermission: "settings:update" }),
  customTShirtBannerController.deleteBanner
);

module.exports = router;
