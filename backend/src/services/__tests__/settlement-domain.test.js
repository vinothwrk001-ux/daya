const test = require("node:test");
const assert = require("node:assert/strict");
const { hasPermission } = require("../../utils/adminPermissions");
const { permissionExists } = require("../../modules/staff/permissions");

test("legacy finance/admin permissions include explicit settlement controls", () => {
  assert.equal(hasPermission("admin", "settlements.settle"), true);
  assert.equal(hasPermission("super_admin", "settlements.reverse"), true);
  assert.equal(hasPermission("finance_admin", "settlements.read"), true);
  assert.equal(hasPermission("finance_admin", "settlements.settle"), false);
});

test("staff permission catalog includes settlement critical operations", () => {
  for (const permission of ["settlements.read", "settlements.settle", "settlements.hold", "settlements.release", "settlements.reverse", "settlements.payout"]) {
    assert.equal(permissionExists(permission), true);
  }
});
