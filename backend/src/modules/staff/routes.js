const express = require("express");
const { validate } = require("../../middleware/validate");
const authController = require("./controllers/auth.controller");
const { staffAuthRequired } = require("./middleware/staff-auth");
const {
  staffLoginSchema,
  staffRefreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} = require("./validators");

const router = express.Router();

router.post("/auth/login", validate(staffLoginSchema), authController.login);
router.post("/auth/refresh", validate(staffRefreshSchema), authController.refresh);
router.get("/auth/csrf", authController.csrf);
router.post("/auth/logout", authController.logout);
router.get("/auth/me", staffAuthRequired, authController.me);
router.post(
  "/auth/password-reset/request",
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);
router.post(
  "/auth/password-reset/reset",
  validate(passwordResetSchema),
  authController.resetPassword
);

module.exports = router;
