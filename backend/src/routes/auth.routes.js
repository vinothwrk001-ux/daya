const express = require("express");
const { validate } = require("../middleware/validate");
const { authRequired, authOptional } = require("../middleware/auth");
const authController = require("../controllers/auth.controller");
const { registerSchema, loginSchema } = require("../utils/validators/auth.validation");
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

router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
// Use authOptional for logout - allows graceful logout even if token is missing
router.post("/logout", authOptional, authController.logout);
router.post("/logout-all", authRequired, authController.logoutAll);
router.get("/me", authRequired, authController.me);
router.patch("/preferences/theme", authRequired, authController.updateThemePreference);

/**
 * POST-LOGIN MERGE
 * Merge guest cart and wishlist data after successful login
 */
router.post("/merge-guest-data", authRequired, authController.mergeGuestData);

module.exports = router;

