const express = require("express");
const Joi = require("joi");
const { authOptional } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");

const router = express.Router();

router.post(
  "/click",
  authOptional,
  validate(
    Joi.object({
      reelId: Joi.string().required(),
      productId: Joi.string().required(),
      anonymousId: Joi.string().allow("", null),
    })
  ),
  controller.click
);

module.exports = router;
