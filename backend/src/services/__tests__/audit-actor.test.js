const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { normalizeAuditActor, isValidObjectId } = require("../../utils/auditActor");

test("normalizeAuditActor maps authenticated users to customer actorId", () => {
  const userId = new mongoose.Types.ObjectId();
  const normalized = normalizeAuditActor({ sub: String(userId), role: "customer" });

  assert.equal(normalized.actorType, "customer");
  assert.equal(String(normalized.actorId), String(userId));
  assert.equal(normalized.actorRole, "customer");
  assert.equal(normalized.guestSessionId, null);
});

test("normalizeAuditActor never casts guest string to ObjectId", () => {
  const normalized = normalizeAuditActor({ sub: "guest", role: "guest" }, {
    guestSessionId: "guest_abc123",
  });

  assert.equal(normalized.actorType, "guest");
  assert.equal(normalized.actorId, null);
  assert.equal(normalized.actorRole, "guest");
  assert.equal(normalized.guestSessionId, "guest_abc123");
});

test("normalizeAuditActor treats explicit guest actorType as guest", () => {
  const normalized = normalizeAuditActor(
    { actorType: "guest", role: "guest", guestSessionId: "guest_token_xyz" },
    { guestSessionId: "guest_token_xyz" }
  );

  assert.equal(normalized.actorType, "guest");
  assert.equal(normalized.actorId, null);
  assert.equal(normalized.guestSessionId, "guest_token_xyz");
});

test("isValidObjectId rejects guest and system sentinel strings", () => {
  assert.equal(isValidObjectId("guest"), false);
  assert.equal(isValidObjectId("system"), false);
  assert.equal(isValidObjectId(new mongoose.Types.ObjectId()), true);
});

test("normalizeAuditActor rejects invalid ObjectId strings", () => {
  const normalized = normalizeAuditActor({ sub: "not-an-object-id", role: "customer" }, {
    guestSessionId: "guest_fallback",
  });

  assert.equal(normalized.actorType, "guest");
  assert.equal(normalized.actorId, null);
  assert.equal(normalized.guestSessionId, "guest_fallback");
});
