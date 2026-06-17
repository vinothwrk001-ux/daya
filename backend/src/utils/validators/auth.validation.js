const Joi = require("joi");

const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const phonePattern = /^[0-9]{10}$/;

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().pattern(gmailPattern).allow("", null).messages({
    "string.pattern.base": "Email must be a valid Gmail address",
  }),
  phone: Joi.string().trim().pattern(phonePattern).required().messages({
    "string.pattern.base": "Phone number must be exactly 10 digits",
  }),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid("user").default("user"),
});

const loginSchema = Joi.object({
  identifier: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (!value) return helpers.error("any.required");
      if (value.includes("@")) {
        if (!gmailPattern.test(value)) {
          return helpers.message("Login email must be a valid Gmail address");
        }
        return value;
      }
      if (!phonePattern.test(value)) {
        return helpers.message("Phone number must be exactly 10 digits");
      }
      return value;
    })
    .required(),
  password: Joi.string().min(6).max(128).required(),
});

/**
 * Password Reset Validation Schemas
 */

const forgotPasswordRequestSchema = Joi.object({
  identifier: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (!value) return helpers.error("any.required");
      if (value.includes("@")) {
        if (!gmailPattern.test(value)) {
          return helpers.message("Email must be a valid Gmail address");
        }
        return value;
      }
      if (!phonePattern.test(value)) {
        return helpers.message("Phone number must be exactly 10 digits");
      }
      return value;
    })
    .required(),
  otpType: Joi.string().valid("email", "phone").default("email"),
});

const verifyOTPSchema = Joi.object({
  resetOtpId: Joi.string().required().messages({
    "string.empty": "Reset ID is required",
  }),
  otp: Joi.string()
    .trim()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.pattern.base": "OTP must be a 6-digit number",
      "string.empty": "OTP is required",
    }),
});

const resendOTPSchema = Joi.object({
  resetOtpId: Joi.string().required().messages({
    "string.empty": "Reset ID is required",
  }),
});

const resetPasswordSchema = Joi.object({
  resetOtpId: Joi.string().required().messages({
    "string.empty": "Reset ID is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
      "string.min": "Password must be at least 8 characters",
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")).messages({
    "any.only": "Passwords do not match",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordRequestSchema,
  verifyOTPSchema,
  resendOTPSchema,
  resetPasswordSchema,
};

