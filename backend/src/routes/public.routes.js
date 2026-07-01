const express = require("express");
const companyBrandingController = require("../controllers/company-branding.controller");
const themeEngineController = require("../modules/theme-engine/controller");

const router = express.Router();

router.get("/branding", companyBrandingController.getPublicConfig);
router.get("/branding/manifest.webmanifest", companyBrandingController.getManifest);
router.get("/theme", themeEngineController.getPublicThemeConfig);

module.exports = router;
