const assert = require("node:assert/strict");
const test = require("node:test");

const { can, requireAccess } = require("../../security/authorizationPolicies");

const userA = { id: "user-a", role: "user", roles: ["user"] };
const userBOrder = { _id: "order-b", userId: "user-b" };
const vendorA = { id: "vendor-a", role: "vendor", roles: ["vendor"] };
const vendorBProduct = { _id: "product-b", sellerId: "vendor-b", status: "DRAFT", isActive: true };
const influencerA = { id: "influencer-a", role: "influencer", roles: ["influencer"] };

test("customer cannot access another customer's order", () => {
  assert.equal(can(userA, "order", "read", userBOrder), false);
  assert.throws(() => requireAccess(userA, "order", "read", userBOrder), /Access denied/);
});

test("vendor cannot access another vendor's product", () => {
  assert.equal(can(vendorA, "product", "update", vendorBProduct), false);
});

test("influencer cannot modify another influencer's reel or collection", () => {
  assert.equal(can(influencerA, "influencerOwned", "update", { _id: "reel-b", influencerId: "influencer-b" }), false);
  assert.equal(can(influencerA, "influencerOwned", "delete", { _id: "collection-b", influencerId: "influencer-b" }), false);
});

test("influencer cannot access another influencer's commission or withdrawal", () => {
  assert.equal(can(influencerA, "commission", "read", { influencerId: "influencer-b" }), false);
  assert.equal(can(influencerA, "withdrawal", "cancel", { influencerId: "influencer-b" }), false);
});

test("finance admin cannot modify RBAC", () => {
  assert.equal(can({ id: "fin-a", role: "finance_admin", roles: ["finance_admin"] }, "rbac", "update", {}), false);
});

test("read only admin cannot create commission rules through admin policy", () => {
  assert.equal(can({ id: "read-a", role: "read_only_admin", roles: ["read_only_admin"] }, "commission", "create", {}), false);
});

test("staff without financial or compliance permissions cannot access KYC document", () => {
  assert.equal(
    can(
      { id: "staff-a", role: "staff", authType: "staff", permissions: { products: { read: true } } },
      "document",
      "download",
      { ownerType: "influencer", ownerId: "influencer-b", category: "identity", status: "pending" }
    ),
    false
  );
});
