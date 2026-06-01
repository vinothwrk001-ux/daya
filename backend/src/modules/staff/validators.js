const Joi = require("joi");
const { STAFF_PERMISSION_CATALOG } = require("./permissions");

const phonePattern = /^[0-9+\-\s()]{7,20}$/;
const strongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;

const permissionSchema = Joi.object(
  Object.fromEntries(
    Object.entries(STAFF_PERMISSION_CATALOG).map(([moduleName, actions]) => [
      moduleName,
      Joi.object(
        Object.fromEntries(actions.map((action) => [action, Joi.boolean().default(false)]))
      ).default({}),
    ])
  )
);

const roleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(300).allow("").default(""),
  permissions: permissionSchema.required(),
});

const staffPasswordSchema = Joi.string()
  .pattern(strongPasswordPattern)
  .required()
  .messages({
    "string.pattern.base":
      "Password must include uppercase, lowercase, number, and special character",
  });

const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email().lowercase().required(),
  phone: Joi.string().trim().pattern(phonePattern).required(),
  password: staffPasswordSchema,
  roleId: Joi.string().trim().required(),
  status: Joi.string().valid("active", "suspended").default("active"),
});

const updateStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  email: Joi.string().trim().email().lowercase(),
  phone: Joi.string().trim().pattern(phonePattern),
  password: Joi.string().pattern(strongPasswordPattern).messages({
    "string.pattern.base":
      "Password must include uppercase, lowercase, number, and special character",
  }),
  roleId: Joi.string().trim(),
  status: Joi.string().valid("active", "suspended"),
}).min(1);

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
  roleSchema,
  createStaffSchema,
  updateStaffSchema,
  staffLoginSchema,
  staffRefreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
};
