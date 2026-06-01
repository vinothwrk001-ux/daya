/**
 * Permission Verification Controller
 * Endpoints for debugging and verifying permission state
 */

const { ok, error: sendError } = require("../../../utils/apiResponse");
const { asyncHandler } = require("../../../utils/asyncHandler");
const { AppError } = require("../../../utils/AppError");
const { logger } = require("../../../utils/logger");
const {
  verifyStaffPermissions,
  verifyRoleStaff,
  generatePermissionReport,
} = require("../services/permission-audit.service");
const { Staff } = require("../models/Staff");
const { Role } = require("../models/Role");

const verifyStaffPermissionsEndpoint = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const result = await verifyStaffPermissions(staffId);
  return ok(res, result, "Staff permissions verified");
});

const verifyRoleStaffEndpoint = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const result = await verifyRoleStaff(roleId);
  return ok(res, result, "Role staff verified");
});

const getPermissionReportEndpoint = asyncHandler(async (req, res) => {
  const result = await generatePermissionReport();
  return ok(res, result, "Permission report generated");
});

/**
 * Test endpoint to simulate permission sync workflow
 */
const testPermissionSyncEndpoint = asyncHandler(async (req, res) => {
  const { staffId, expectedPermission } = req.body;

  if (!staffId) {
    throw new AppError("staffId is required", 400, "INVALID_REQUEST");
  }

  const staff = await Staff.findById(staffId).populate("roleId");
  if (!staff) {
    throw new AppError("Staff not found", 404, "NOT_FOUND");
  }

  const permissions = staff.roleId?.permissions || {};
  const [module, action] = (expectedPermission || "").split(".");

  const hasPermission = permissions?.[module]?.[action] === true;

  const result = {
    staffId,
    staff: {
      name: staff.name,
      email: staff.email,
      status: staff.status,
      roleId: staff.roleId?._id,
      roleName: staff.roleId?.name,
    },
    permissions: {
      all: permissions,
      module: permissions[module] || null,
      specific: expectedPermission ? hasPermission : null,
    },
    test: {
      permission: expectedPermission,
      granted: hasPermission,
      modules: Object.keys(permissions),
      activePermissions: Object.entries(permissions)
        .map(([m, perms]) => `${m}:[${Object.entries(perms || {})
          .filter(([, v]) => v)
          .map(([a]) => a)
          .join(",")}]`)
        .join("|"),
    },
    syncedAt: new Date(),
  };

  logger.audit("Permission sync test completed", {
    source: "permission-verification.controller",
    event: "permission_sync_test",
    staffId: String(staffId),
    roleName: result.roleName,
    permissionCount: result.totalPermissions,
    valid: result.valid,
  });
  return ok(res, result, "Permission sync test completed");
});

/**
 * Test endpoint to check if staff has permission to access a specific module
 */
const testModuleAccessEndpoint = asyncHandler(async (req, res) => {
  const { staffId, moduleName, action } = req.body;

  if (!staffId || !moduleName || !action) {
    throw new AppError("staffId, moduleName, and action are required", 400, "INVALID_REQUEST");
  }

  const staff = await Staff.findById(staffId).populate("roleId");
  if (!staff) {
    throw new AppError("Staff not found", 404, "NOT_FOUND");
  }

  const permissions = staff.roleId?.permissions || {};
  const hasAccess = permissions?.[moduleName]?.[action] === true;

  const result = {
    staffId,
    staff: {
      name: staff.name,
      email: staff.email,
      role: staff.roleId?.name,
    },
    accessTest: {
      module: moduleName,
      action,
      requested: `${moduleName}.${action}`,
      granted: hasAccess,
    },
    availablePermissions: Object.entries(permissions)
      .map(([m, perms]) => ({
        module: m,
        actions: Object.entries(perms || {})
          .filter(([, v]) => v)
          .map(([a]) => a),
      }))
      .filter((m) => m.actions.length > 0),
    reason: hasAccess
      ? "Access granted"
      : `Missing permission: ${moduleName}.${action}`,
    testedAt: new Date(),
  };

  logger.audit("Module access test completed", {
    source: "permission-verification.controller",
    event: "module_access_test",
    staffId: String(staffId),
    moduleName,
    action,
    hasAccess,
  });
  return ok(res, result, `Module access test completed - ${hasAccess ? "GRANTED" : "DENIED"}`);
});

/**
 * Simulate permission update and test sync
 */
const testPermissionUpdateSyncEndpoint = asyncHandler(async (req, res) => {
  const { roleId, staffId } = req.body;

  if (!roleId || !staffId) {
    throw new AppError("roleId and staffId are required", 400, "INVALID_REQUEST");
  }

  const role = await Role.findById(roleId);
  if (!role) {
    throw new AppError("Role not found", 404, "NOT_FOUND");
  }

  const staff = await Staff.findById(staffId).populate("roleId");
  if (!staff) {
    throw new AppError("Staff not found", 404, "NOT_FOUND");
  }

  // Verify staff has the role
  if (String(staff.roleId?._id) !== String(roleId)) {
    throw new AppError("Staff does not have this role assigned", 400, "INVALID_REQUEST");
  }

  const beforePermissions = staff.roleId?.permissions || {};
  const afterPermissions = role.permissions;

  const result = {
    testType: "PERMISSION_UPDATE_SYNC",
    roleId,
    staffId,
    staff: {
      name: staff.name,
      email: staff.email,
      role: role.name,
    },
    comparisonBefore: {
      role: {
        id: staff.roleId?._id,
        name: staff.roleId?.name,
      },
      permissions: beforePermissions,
    },
    comparisonAfter: {
      role: {
        id: role._id,
        name: role.name,
      },
      permissions: afterPermissions,
    },
    syncStatus: {
      synchronized: JSON.stringify(beforePermissions) === JSON.stringify(afterPermissions),
      difference: JSON.stringify(beforePermissions) !== JSON.stringify(afterPermissions) ? "Permissions have changed or will change on next sync" : "Permissions are synchronized",
    },
    recommendation: "Run /auth/me on staff client to sync latest permissions",
    testedAt: new Date(),
  };

  logger.audit("Permission update sync test completed", {
    source: "permission-verification.controller",
    event: "permission_update_sync_test",
    roleId: String(roleId),
    roleName: result.roleName,
    staffCount: result.staffCount,
    permissionsChanged: result.permissionsChanged,
  });
  return ok(res, result, "Permission update sync test completed");
});

module.exports = {
  verifyStaffPermissionsEndpoint,
  verifyRoleStaffEndpoint,
  getPermissionReportEndpoint,
  testPermissionSyncEndpoint,
  testModuleAccessEndpoint,
  testPermissionUpdateSyncEndpoint,
};
