const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { isInfluencerCommerceEnabled } = require("../services/influencer-commerce-config.service");

const ADMIN_BYPASS_ROLES = new Set(["admin", "super_admin", "support_admin", "finance_admin"]);

/**
 * Blocks influencer-facing APIs when influencer_commerce_enabled is false.
 * Allows admin/workspace roles (JWT bearer) and /admin/** subroutes to keep moderation tools working.
 */
const influencerCommerceGate = asyncHandler(async (req, _res, next) => {
  const enabled = await isInfluencerCommerceEnabled();
  if (enabled) return next();

  if (req.user && ADMIN_BYPASS_ROLES.has(req.user.role)) {
    return next();
  }

  const p = typeof req.path === "string" ? req.path : "/";
  if (p.startsWith("/admin")) {
    return next();
  }

    return next(
    new AppError(
      "Influencer commerce is disabled by the platform administrator.",
      403,
      "INFLUENCER_COMMERCE_DISABLED"
    )
  );
});

module.exports = { influencerCommerceGate };
