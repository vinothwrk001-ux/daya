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
  role: Joi.string().valid("user", "vendor", "influencer").default("user"),
}).custom((value, helpers) => {
  if (["vendor", "influencer"].includes(value.role)) {
    if (!value.email) return helpers.error("any.custom", { message: "Email is required for vendors" });
  }
  return value;
}, "Role-based register rules");

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

module.exports = { registerSchema, loginSchema };

