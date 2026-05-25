const express = require("express");
const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { isInfluencerCommerceEnabled } = require("../services/influencer-commerce-config.service");
const companyBrandingController = require("../controllers/company-branding.controller");

const router = express.Router();

router.get(
  "/features",
  asyncHandler(async (_req, res) => {
    const influencerCommerceEnabled = await isInfluencerCommerceEnabled();
    return ok(res, { influencerCommerceEnabled }, "OK");
  })
);

router.get("/branding", companyBrandingController.getPublicConfig);
router.get("/branding/manifest.webmanifest", companyBrandingController.getManifest);

module.exports = router;
