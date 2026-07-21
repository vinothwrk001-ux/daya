const express = require("express");
const { validate } = require("../middleware/validate");
const { authRequired, authOptional } = require("../middleware/auth");
const authController = require("../controllers/auth.controller");
const passwordResetController = require("../controllers/passwordReset.controller");
const {
  registerSchema,
  loginSchema,
  forgotPasswordRequestSchema,
  verifyOTPSchema,
  resendOTPSchema,
  resetPasswordSchema,
} = require("../validators/auth.validation");
const { AppError } = require("../utils/AppError");

const router = express.Router();

router.post(
  "/register",
  validate(registerSchema),
  (req, res, next) => {
    if (req.body.role === "admin" && process.env.ALLOW_ADMIN_REGISTRATION !== "true") {
      return next(new AppError("Admin registration disabled", 403, "FORBIDDEN"));
    }
    next();
  },
  authController.register
);

router.get("/check-username", authController.checkUsername);

router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.get("/csrf", authController.csrf);
// Use authOptional for logout - allows graceful logout even if token is missing
router.post("/logout", authOptional, authController.logout);
router.post("/logout-all", authRequired, authController.logoutAll);
router.get("/me", authRequired, authController.me);
router.patch("/preferences/theme", authRequired, authController.updateThemePreference);

/**
 * PASSWORD RESET FLOW
 * Step 1: Request OTP via email or phone
 * Step 2: Verify OTP
 * Step 3: Reset password
 */
router.post("/forgot-password/request", validate(forgotPasswordRequestSchema), passwordResetController.requestPasswordReset);
router.post("/forgot-password/verify-otp", validate(verifyOTPSchema), passwordResetController.verifyOTP);
router.post("/forgot-password/resend-otp", validate(resendOTPSchema), passwordResetController.resendOTP);
router.post("/forgot-password/reset", validate(resetPasswordSchema), passwordResetController.resetPassword);

/**
 * POST-LOGIN MERGE
 * Merge guest cart and wishlist data after successful login
 */
router.post("/merge-guest-data", authRequired, authController.mergeGuestData);

module.exports = router;

