const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const checkoutSessionService = require("../services/checkoutSession.service");

function getAuditMeta(req) {
  return {
    actor: req.user || { sub: "guest", role: "guest" },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

const createBuyNowSession = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variantId = "", guestToken = "" } = req.body || {};
  const session = await checkoutSessionService.createBuyNowSession({
    userId: req.user?.sub || null,
    guestToken: guestToken || null,
    productId,
    quantity,
    variantId,
    auditMeta: getAuditMeta(req),
  });

  return ok(
    res,
    {
      sessionId: session.sessionId,
      guestToken: session.guestToken,
      expiresAt: session.expiresAt,
      productId: session.productId,
      variantId: session.variantId,
      quantity: session.quantity,
      unitPrice: session.unitPrice,
      productName: session.productName,
      productImage: session.productImage,
      checkoutMode: "buy_now",
    },
    "Buy now checkout session created"
  );
});

const getBuyNowSession = asyncHandler(async (req, res) => {
  const guestToken = req.query?.guestToken || req.body?.guestToken || "";
  const session = await checkoutSessionService.getSession(req.params.sessionId, {
    userId: req.user?.sub || null,
    guestToken,
  });

  return ok(res, session, "Buy now checkout session loaded");
});

const attachUserToBuyNowSession = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const { guestToken = "" } = req.body || {};
  const session = await checkoutSessionService.attachUserToSession(
    req.params.sessionId,
    req.user.sub,
    guestToken || null
  );

  return ok(res, session, "Buy now checkout session attached to user");
});

const updateBuyNowSession = asyncHandler(async (req, res) => {
  const { quantity, guestToken = "" } = req.body || {};
  const result = await checkoutSessionService.updateQuantity(req.params.sessionId, quantity, {
    userId: req.user?.sub || null,
    guestToken,
    auditMeta: getAuditMeta(req),
  });

  if (result.removed) {
    return ok(res, { removed: true }, "Buy now checkout session cancelled");
  }

  return ok(res, result.session, "Buy now checkout session updated");
});

const prepareBuyNowSession = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, currency, guestToken = "" } = req.body || {};
  const summary = await checkoutSessionService.prepare(req.params.sessionId, {
    userId: req.user?.sub || null,
    guestToken,
    shippingAddress,
    paymentMethod,
    currency,
  });

  return ok(res, summary, "Buy now checkout prepared");
});

const createBuyNowOrder = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Login required to create order", 401, "AUTH_REQUIRED");
  }

  const { shippingAddress, paymentMethod = "COD", idempotencyKey } = req.body || {};
  const result = await checkoutSessionService.createOrder(req.params.sessionId, {
    userId: req.user.sub,
    shippingAddress,
    paymentMethod,
    idempotencyKey,
    auditMeta: getAuditMeta(req),
  });

  return ok(res, result, "Buy now order created");
});

module.exports = {
  createBuyNowSession,
  getBuyNowSession,
  attachUserToBuyNowSession,
  updateBuyNowSession,
  prepareBuyNowSession,
  createBuyNowOrder,
};
