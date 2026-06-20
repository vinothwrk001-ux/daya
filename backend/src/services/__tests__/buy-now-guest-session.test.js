const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const auditService = require("../audit.service");
const checkoutSessionService = require("../checkoutSession.service");
const guestCartService = require("../guestCart.service");
const { AuditLog } = require("../../models/AuditLog");
const { CheckoutSession } = require("../../models/CheckoutSession");

const originalAuditLogCreate = AuditLog.create;
const originalCheckoutSessionCreate = CheckoutSession.create;
const originalValidateAndEnrichItem = guestCartService.validateAndEnrichItem;

test("guest buy now session audit log stores guestSessionId without actorId", async () => {
  const productId = new mongoose.Types.ObjectId();
  const createdSession = {
    _id: new mongoose.Types.ObjectId(),
    sessionId: "bn_test_guest",
    guestToken: "guest_test_token",
    productId,
    variantId: "",
    quantity: 1,
    unitPrice: 499,
    productName: "Guest Product",
    productImage: "",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };

  let capturedAuditPayload = null;

  guestCartService.validateAndEnrichItem = async () => ({
    variantId: "",
    quantity: 1,
    price: 499,
    name: "Guest Product",
    image: "",
    variantSku: "",
    variantTitle: "",
    variantAttributes: {},
  });

  CheckoutSession.create = async (payload) => ({
    ...createdSession,
    ...payload,
  });

  AuditLog.create = async (payload) => {
    capturedAuditPayload = payload;
    return payload;
  };

  try {
    const session = await checkoutSessionService.createBuyNowSession({
      userId: null,
      guestToken: "guest_test_token",
      productId,
      quantity: 1,
      variantId: "",
      auditMeta: {
        actor: { actorType: "guest", role: "guest", guestSessionId: "guest_test_token" },
        guestSessionId: "guest_test_token",
      },
    });

    assert.ok(session.sessionId, "session should be created");
    assert.ok(capturedAuditPayload, "audit log should be written");
    assert.equal(capturedAuditPayload.actorType, "guest");
    assert.equal(capturedAuditPayload.actorId, null);
    assert.equal(capturedAuditPayload.guestSessionId, "guest_test_token");
    assert.equal(capturedAuditPayload.action, "BUY_NOW_SESSION_CREATED");
  } finally {
    AuditLog.create = originalAuditLogCreate;
    CheckoutSession.create = originalCheckoutSessionCreate;
    guestCartService.validateAndEnrichItem = originalValidateAndEnrichItem;
  }
});

test("authenticated buy now session audit log stores customer actorId", async () => {
  const productId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const createdSession = {
    _id: new mongoose.Types.ObjectId(),
    sessionId: "bn_test_auth",
    userId,
    guestToken: null,
    productId,
    variantId: "",
    quantity: 1,
    unitPrice: 799,
    productName: "Auth Product",
    productImage: "",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };

  let capturedAuditPayload = null;

  guestCartService.validateAndEnrichItem = async () => ({
    variantId: "",
    quantity: 1,
    price: 799,
    name: "Auth Product",
    image: "",
    variantSku: "",
    variantTitle: "",
    variantAttributes: {},
  });

  CheckoutSession.create = async (payload) => ({
    ...createdSession,
    ...payload,
  });

  AuditLog.create = async (payload) => {
    capturedAuditPayload = payload;
    return payload;
  };

  try {
    await checkoutSessionService.createBuyNowSession({
      userId,
      productId,
      quantity: 1,
      variantId: "",
      auditMeta: {
        actor: { sub: String(userId), role: "customer" },
      },
    });

    assert.ok(capturedAuditPayload, "audit log should be written");
    assert.equal(capturedAuditPayload.actorType, "customer");
    assert.equal(String(capturedAuditPayload.actorId), String(userId));
    assert.equal(capturedAuditPayload.guestSessionId, null);
  } finally {
    AuditLog.create = originalAuditLogCreate;
    CheckoutSession.create = originalCheckoutSessionCreate;
    guestCartService.validateAndEnrichItem = originalValidateAndEnrichItem;
  }
});

test("auditService.log rejects invalid actorId strings", async () => {
  let capturedAuditPayload = null;

  AuditLog.create = async (payload) => {
    capturedAuditPayload = payload;
    return payload;
  };

  try {
    await auditService.log({
      actor: { sub: "guest", role: "guest" },
      guestSessionId: "guest_session_123",
      action: "TEST_GUEST_ACTION",
      entityType: "CheckoutSession",
      entityId: "entity_1",
    });

    assert.equal(capturedAuditPayload.actorType, "guest");
    assert.equal(capturedAuditPayload.actorId, null);
    assert.equal(capturedAuditPayload.guestSessionId, "guest_session_123");
  } finally {
    AuditLog.create = originalAuditLogCreate;
  }
});
