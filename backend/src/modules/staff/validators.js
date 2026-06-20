const Joi = require("joi");

const strongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;

const staffPasswordSchema = Joi.string()
  .pattern(strongPasswordPattern)
  .required()
  .messages({
    "string.pattern.base":
      "Password must include uppercase, lowercase, number, and special character",
  });

const staffLoginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
});

const staffRefreshSchema = Joi.object({}).unknown(false);

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
});

const passwordResetSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: staffPasswordSchema,
});

module.exports = {
  staffLoginSchema,
  staffRefreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
};
