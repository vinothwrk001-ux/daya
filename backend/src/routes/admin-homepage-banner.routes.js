const express = require("express");
const multer = require("multer");
const homepageBannerController = require("../controllers/homepage-banner.controller");
const { validate } = require("../middleware/validate");
const {
  createBannerSchema,
  updateBannerSchema,
  assignCategoriesSchema,
} = require("../utils/validators/homepage-banner.validation");
const {
  adminWorkspaceAuthRequired,
  requireWorkspacePermission,
} = require("../middleware/adminAccess");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(adminWorkspaceAuthRequired);

router.get(
  "/banners",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }),
  homepageBannerController.listAdminBanners
);
router.get(
  "/banners/analytics/summary",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }),
  homepageBannerController.getAnalyticsSummary
);
router.get(
  "/banners/settings",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }),
  homepageBannerController.getSettings
);
router.put(
  "/banners/settings",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  homepageBannerController.updateSettings
);
router.get(
  "/banners/:id",
  requireWorkspacePermission("settings.read", { legacyPermission: "settings:read" }),
  homepageBannerController.getAdminBanner
);
router.post(
  "/banners",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  validate(createBannerSchema),
  homepageBannerController.createBanner
);
router.put(
  "/banners/:id",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  validate(updateBannerSchema),
  homepageBannerController.updateBanner
);
router.delete(
  "/banners/:id",
  requireWorkspacePermission("settings.delete", { legacyPermission: "settings:update" }),
  homepageBannerController.deleteBanner
);
router.put(
  "/banners/:id/categories",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  validate(assignCategoriesSchema),
  homepageBannerController.assignCategories
);
router.delete(
  "/banners/:id/categories/:categoryId",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  homepageBannerController.removeCategory
);
router.post(
  "/banners/:id/media",
  requireWorkspacePermission("settings.update", { legacyPermission: "settings:update" }),
  upload.fields([
    { name: "desktop", maxCount: 1 },
    { name: "mobile", maxCount: 1 },
  ]),
  homepageBannerController.uploadBannerImages
);

module.exports = router;
