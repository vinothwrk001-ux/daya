const express = require("express");
const companyBrandingController = require("../controllers/company-branding.controller");

const router = express.Router();

router.get("/branding", companyBrandingController.getPublicConfig);
router.get("/branding/manifest.webmanifest", companyBrandingController.getManifest);

module.exports = router;
