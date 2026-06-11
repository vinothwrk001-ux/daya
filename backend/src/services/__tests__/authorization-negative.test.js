const assert = require("node:assert/strict");
const test = require("node:test");

const { can, requireAccess } = require("../../security/authorizationPolicies");

const userA = { id: "user-a", role: "user", roles: ["user"] };
const userBOrder = { _id: "order-b", userId: "user-b" };
const draftProduct = { _id: "product-b", status: "DRAFT", isActive: true };

test("customer cannot access another customer's order", () => {
  assert.equal(can(userA, "order", "read", userBOrder), false);
  assert.throws(() => requireAccess(userA, "order", "read", userBOrder), /Access denied/);
});

test("customer cannot mutate platform-managed products", () => {
  assert.equal(can(userA, "product", "update", draftProduct), false);
});

test("finance admin cannot modify RBAC", () => {
  assert.equal(can({ id: "fin-a", role: "finance_admin", roles: ["finance_admin"] }, "rbac", "update", {}), false);
});

test("finance admin cannot delete products", () => {
  assert.equal(can({ id: "fin-a", role: "finance_admin", roles: ["finance_admin"] }, "product", "delete", draftProduct), false);
});

test("staff without financial or compliance permissions cannot access KYC document", () => {
  assert.equal(
    can(
      { id: "staff-a", role: "staff", authType: "staff", permissions: { products: { read: true } } },
      "document",
      "download",
      { ownerType: "customer", ownerId: "user-b", category: "identity", status: "pending" }
    ),
    false
  );
});
