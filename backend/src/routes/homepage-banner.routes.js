const express = require("express");
const homepageBannerController = require("../controllers/homepage-banner.controller");
const { validate } = require("../middleware/validate");
const { trackBannerSchema } = require("../utils/validators/homepage-banner.validation");
const { authOptional } = require("../middleware/auth");

const router = express.Router();

router.get("/banners", homepageBannerController.listPublicBanners);

router.post(
  "/banners/:id/track",
  authOptional,
  validate(trackBannerSchema),
  homepageBannerController.trackBannerEvent
);

module.exports = router;
