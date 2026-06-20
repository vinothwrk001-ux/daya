const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { CheckoutSession } = require("../models/CheckoutSession");
const guestCartService = require("./guestCart.service");
const checkoutService = require("./checkout.service");
const auditService = require("./audit.service");

const SESSION_TTL_MS = 30 * 60 * 1000;

function generateSessionId() {
  return `bn_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
}

function sessionToCartItem(session) {
  return {
    productId: session.productId,
    quantity: session.quantity,
    variantId: session.variantId || "",
    price: session.unitPrice,
    image: session.productImage || "",
    name: session.productName || "",
    variantSku: session.variantSku || "",
    variantTitle: session.variantTitle || "",
    variantAttributes: session.variantAttributes || {},
  };
}

function assertActiveSession(session) {
  if (!session) {
    throw new AppError("Checkout session not found", 404, "NOT_FOUND");
  }
  if (session.status !== "ACTIVE") {
    throw new AppError("Checkout session is no longer active", 400, "CHECKOUT_SESSION_INACTIVE");
  }
  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Checkout session expired", 410, "CHECKOUT_SESSION_EXPIRED");
  }
}

function assertSessionAccess(session, { userId = null, guestToken = null } = {}) {
  assertActiveSession(session);

  if (userId && session.userId && String(session.userId) !== String(userId)) {
    throw new AppError("Checkout session ownership mismatch", 403, "FORBIDDEN");
  }

  if (!userId && session.guestToken && guestToken && String(session.guestToken) !== String(guestToken)) {
    throw new AppError("Checkout session token mismatch", 403, "FORBIDDEN");
  }

  if (userId && !session.userId && session.guestToken) {
    if (!guestToken || String(session.guestToken) !== String(guestToken)) {
      throw new AppError("Guest checkout session token required", 403, "FORBIDDEN");
    }
  }
}

class CheckoutSessionService {
  async createBuyNowSession({ userId = null, guestToken = null, productId, quantity = 1, variantId = "", auditMeta = null }) {
    asObjectId(productId, "productId");
    const qty = Number(quantity || 1);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new AppError("Quantity must be >= 1", 400, "VALIDATION_ERROR");
    }

    const enriched = await guestCartService.validateAndEnrichItem(productId, qty, variantId);
    const resolvedGuestToken = userId ? guestToken || null : guestToken || `guest_${crypto.randomBytes(12).toString("hex")}`;
    const session = await CheckoutSession.create({
      sessionId: generateSessionId(),
      userId: userId || null,
      guestToken: resolvedGuestToken,
      mode: "BUY_NOW",
      productId,
      variantId: enriched.variantId || "",
      quantity: enriched.quantity,
      unitPrice: enriched.price,
      productName: enriched.name,
      productImage: enriched.image,
      variantSku: enriched.variantSku || "",
      variantTitle: enriched.variantTitle || "",
      variantAttributes: enriched.variantAttributes || {},
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    await auditService.log({
      actor:
        auditMeta?.actor ||
        (userId
          ? { sub: userId, role: "customer" }
          : { actorType: "guest", role: "guest", guestSessionId: resolvedGuestToken }),
      guestSessionId: auditMeta?.guestSessionId || resolvedGuestToken,
      action: "BUY_NOW_SESSION_CREATED",
      entityType: "CheckoutSession",
      entityId: session._id,
      metadata: {
        sessionId: session.sessionId,
        productId: String(productId),
        variantId: enriched.variantId || "",
        quantity: enriched.quantity,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return session;
  }

  async getSession(sessionId, { userId = null, guestToken = null } = {}) {
    const session = await CheckoutSession.findOne({ sessionId }).exec();
    assertSessionAccess(session, { userId, guestToken });
    return session;
  }

  async attachUserToSession(sessionId, userId, guestToken = null) {
    const session = await CheckoutSession.findOne({ sessionId, status: "ACTIVE" }).exec();
    assertSessionAccess(session, { guestToken });

    if (session.userId && String(session.userId) !== String(userId)) {
      throw new AppError("Checkout session ownership mismatch", 403, "FORBIDDEN");
    }

    if (!session.userId) {
      session.userId = userId;
      await session.save();
    }

    return session;
  }

  async updateQuantity(sessionId, quantity, { userId = null, guestToken = null, auditMeta = null } = {}) {
    const session = await this.getSession(sessionId, { userId, guestToken });
    const qty = Number(quantity);
    if (!Number.isFinite(qty)) {
      throw new AppError("Quantity is required", 400, "VALIDATION_ERROR");
    }

    if (qty <= 0) {
      session.status = "CANCELLED";
      await session.save();
      return { session, removed: true };
    }

    const enriched = await guestCartService.validateAndEnrichItem(session.productId, qty, session.variantId);
    const previousQuantity = session.quantity;
    session.quantity = enriched.quantity;
    session.unitPrice = enriched.price;
    session.productName = enriched.name;
    session.productImage = enriched.image;
    session.variantSku = enriched.variantSku || "";
    session.variantTitle = enriched.variantTitle || "";
    session.variantAttributes = enriched.variantAttributes || {};
    await session.save();

    await auditService.log({
      actor:
        auditMeta?.actor ||
        (userId
          ? { sub: userId, role: "customer" }
          : { actorType: "guest", role: "guest", guestSessionId: guestToken || session.guestToken }),
      guestSessionId: auditMeta?.guestSessionId || guestToken || session.guestToken || null,
      action: "BUY_NOW_SESSION_QUANTITY_UPDATED",
      entityType: "CheckoutSession",
      entityId: session._id,
      metadata: {
        sessionId: session.sessionId,
        oldValue: previousQuantity,
        newValue: session.quantity,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return { session, removed: false };
  }

  async prepare(sessionId, { userId = null, guestToken = null, shippingAddress, paymentMethod, currency } = {}) {
    const session = await this.getSession(sessionId, { userId, guestToken });
    const summary = await checkoutService.prepareFromItems([sessionToCartItem(session)], {
      userId: userId || session.userId || null,
      shippingAddress,
      paymentMethod,
      currency: currency || session.currency,
    });

    return {
      ...summary,
      checkoutMode: "buy_now",
      checkoutSessionId: session.sessionId,
    };
  }

  async createOrder(
    sessionId,
    {
      userId,
      shippingAddress,
      paymentMethod = "COD",
      idempotencyKey = null,
      auditMeta = null,
    } = {}
  ) {
    if (!userId) {
      throw new AppError("Login required to place order", 401, "AUTH_REQUIRED");
    }

    const session = await this.getSession(sessionId, { userId });
    if (!session.userId || String(session.userId) !== String(userId)) {
      throw new AppError("Checkout session must belong to the authenticated user", 403, "FORBIDDEN");
    }

    const result = await checkoutService.createOrder(userId, {
      shippingAddress,
      paymentMethod,
      idempotencyKey,
      auditMeta,
      sourceItems: [sessionToCartItem(session)],
      skipCartClear: true,
      checkoutSessionId: session.sessionId,
      currencyOverride: session.currency || "INR",
    });

    return result;
  }

  async completeSession(sessionId, { userId = null, orderGroupId = "" } = {}) {
    const session = await CheckoutSession.findOne({ sessionId }).exec();
    if (!session) return null;
    if (userId && session.userId && String(session.userId) !== String(userId)) {
      return null;
    }

    session.status = "COMPLETED";
    session.orderGroupId = orderGroupId || session.orderGroupId;
    await session.save();
    return session;
  }
}

module.exports = new CheckoutSessionService();
