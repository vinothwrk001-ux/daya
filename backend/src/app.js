require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");

const { requestLoggerStream, logger } = require("./utils/logger");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const vendorRoutes = require("./routes/vendor.routes");
const vendorStorefrontRoutes = require("./routes/vendor-storefront.routes");
const vendorPublicRoutes = require("./routes/vendor-public.routes");
const adminRoutes = require("./routes/admin.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const paymentRoutes = require("./routes/payment.routes");
const payoutRoutes = require("./routes/payout.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const shippingRoutes = require("./routes/shipping.routes");
const pickupRoutes = require("./routes/pickup.routes");
const webhookRoutes = require("./routes/webhook.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const subcategoryRoutes = require("./routes/subcategory.routes");
const attributeRoutes = require("./routes/attribute.routes");
const productModuleRoutes = require("./routes/product-module.routes");
const exportRoutes = require("./routes/export.routes");
const vendorModuleRoutes = require("./routes/vendorModule.routes");
const homepageContainerRoutes = require("./routes/homepage-container.routes");
const homepageLayoutRoutes = require("./routes/homepage-layout.routes");
const homepageContainerController = require("./controllers/homepage-container.controller");
const pricingRoutes = require("./routes/pricing.routes");
const staffRoutes = require("./modules/staff/routes");
const settlementRoutes = require("./routes/settlement.routes");
const notificationRoutes = require("./routes/notification.routes");
const reviewRoutes = require("./routes/review.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const publicFeatureRoutes = require("./routes/public.routes");
const configRoutes = require("./routes/config.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const influencerRoutes = require("./modules/influencer/routes");
const campaignRoutes = require("./modules/campaign/routes");
const reelRoutes = require("./modules/reel/routes");
const trackingRoutes = require("./modules/tracking/routes");
const commissionRoutes = require("./modules/commission/routes");
const recommendationRoutes = require("./modules/recommendation/routes");
const { authOptional } = require("./middleware/auth");
const { influencerCommerceGate } = require("./middleware/influencerCommerceGate");

function createLimiter({
  windowMs = 15 * 60 * 1000,
  limit,
  message,
  skip,
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
}

function createApp() {
  const app = express();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const authRateLimit = Number(process.env.AUTH_RATE_LIMIT_MAX || (isDevelopment ? 60 : 20));
  const apiRateLimit = Number(process.env.API_RATE_LIMIT_MAX || (isDevelopment ? 5000 : 1000));

  app.disable("x-powered-by");

  app.use(helmet());

  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: origins.length ? origins : true,
      credentials: true,
    })
  );

  const authLimiter = createLimiter({
    limit: authRateLimit,
    message: "Too many login attempts. Please wait a moment and try again.",
  });

  const apiLimiter = createLimiter({
    limit: apiRateLimit,
    message: "Too many requests. Please slow down and try again shortly.",
    skip: (req) =>
      req.path === "/health" ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/api/auth") ||
      req.path.startsWith("/api/staff/auth"),
  });

  app.use(
    express.json({
      limit: "25mb",
      verify: (req, res, buffer) => {
        if (req.originalUrl.startsWith("/api/webhooks/")) {
          req.rawBody = buffer.toString("utf8");
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use(cookieParser());

  // Local upload fallback (Cloudinary preferred)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use(
    morgan("combined", {
      stream: requestLoggerStream,
      skip: (req) => req.path === "/health",
    })
  );

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/refresh", authLimiter);
  app.use("/api/staff/auth/login", authLimiter);
  app.use("/api/staff/auth/refresh", authLimiter);
  app.use("/api/staff/auth/password-reset/request", authLimiter);
  app.use("/api/staff/auth/password-reset/reset", authLimiter);
  app.use("/api", apiLimiter);

  app.use("/api/auth", authRoutes);
  app.use("/api/vendor", vendorRoutes);
  app.use("/api/vendor-store", vendorStorefrontRoutes);
  app.use("/api/vendor-stores", vendorStorefrontRoutes);
  app.use("/api/vendors", vendorPublicRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/checkout", checkoutRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/payouts", payoutRoutes);
  app.use("/api/delivery", deliveryRoutes);
  app.use("/api/shipping", shippingRoutes);
  app.use("/api", pickupRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/wishlist", wishlistRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/subcategories", subcategoryRoutes);
  app.use("/api/attributes", attributeRoutes);
  app.use("/api/product-modules", productModuleRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/modules", vendorModuleRoutes);
  app.get("/api/container-schema/:type", homepageContainerController.getContainerSchema);
  app.use("/api/homepage-containers", homepageContainerRoutes);
  app.use("/api/homepage-builder", homepageLayoutRoutes);
  app.use("/api/pricing", pricingRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/admin", settlementRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/public", publicFeatureRoutes);
  app.use("/api/config", configRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/influencer", authOptional, influencerCommerceGate, influencerRoutes);
  app.use("/api/campaign", authOptional, influencerCommerceGate, campaignRoutes);
  app.use("/api/reel", authOptional, influencerCommerceGate, reelRoutes);
  app.use("/api/tracking", authOptional, influencerCommerceGate, trackingRoutes);
  app.use("/api/commission", authOptional, influencerCommerceGate, commissionRoutes);
  app.use("/api/recommendations", recommendationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  // Ensure logger is initialized
  logger.info("App initialized");
  return app;
}

module.exports = { createApp };

