const express = require("express");
const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { isInfluencerCommerceEnabled } = require("../services/influencer-commerce-config.service");

const router = express.Router();

router.get(
  "/features",
  asyncHandler(async (_req, res) => {
    const influencerCommerceEnabled = await isInfluencerCommerceEnabled();
    return ok(res, { influencerCommerceEnabled }, "OK");
  })
);

module.exports = router;
