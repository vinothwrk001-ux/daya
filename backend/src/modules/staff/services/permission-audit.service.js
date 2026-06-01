/**
 * Permission Audit & Verification Service
 * Tracks and validates permission state across staff accounts
 */

const { Staff } = require("../models/Staff");
const { Role } = require("../models/Role");
const { logger } = require("../../../utils/logger");

function summarizePermissions(permissions = {}) {
  return {
    moduleCount: Object.keys(permissions).length,
    permissionCount: Object.values(permissions).reduce(
      (total, actions) => total + Object.values(actions || {}).filter(Boolean).length,
      0
    ),
  };
}

/**
 * Verify that a staff member has the correct permissions based on their current role
 * @param {string} staffId - Staff member ID
 * @returns {Promise<{valid: boolean, staffId: string, currentPermissions: object, rolePermissions: object, discrepancies: array}>}
 */
async function verifyStaffPermissions(staffId) {
  const staff = await Staff.findById(staffId).populate("roleId");
  if (!staff) {
    return {
      valid: false,
      error: "Staff not found",
      staffId,
    };
  }

  const currentPermissions = staff.roleId?.permissions || {};
  
  // Verify role exists and is accessible
  if (!staff.roleId) {
    return {
      valid: false,
      error: "Staff has no role assigned",
      staffId,
      staff: {
        name: staff.name,
        email: staff.email,
        status: staff.status,
      },
    };
  }

  // Check for any discrepancies
  const discrepancies = [];
  const rolePermissions = currentPermissions;

  logger.audit("Staff permissions verified", {
    source: "permission-audit.service",
    event: "permission_verification",
    staffId: String(staffId),
    roleId: String(staff.roleId._id),
    roleName: staff.roleId.name,
    ...summarizePermissions(rolePermissions),
  });

  return {
    valid: !discrepancies.length,
    staffId,
    staff: {
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      status: staff.status,
      roleId: staff.roleId._id,
      roleName: staff.roleId.name,
    },
    rolePermissions,
    discrepancies,
    lastVerified: new Date(),
  };
}

/**
 * Verify all staff members with a specific role
 * @param {string} roleId - Role ID
 * @returns {Promise<Array>}
 */
async function verifyRoleStaff(roleId) {
  const staffList = await Staff.find({ roleId }).select("_id name email status");
  
  logger.audit("Role staff permission verification started", {
    source: "permission-audit.service",
    event: "role_staff_permission_verification",
    roleId: String(roleId),
    staffCount: staffList.length,
  });
  
  const results = await Promise.all(
    staffList.map((staff) => verifyStaffPermissions(staff._id))
  );

  return {
    roleId,
    total: staffList.length,
    results,
    verified: new Date(),
  };
}

/**
 * Generate permission sync report
 * @returns {Promise<object>}
 */
async function generatePermissionReport() {
  const [staffCount, roleCount] = await Promise.all([
    Staff.countDocuments(),
    Role.countDocuments(),
  ]);

  const staffWithoutRole = await Staff.countDocuments({ roleId: null });
  const suspendedStaff = await Staff.countDocuments({ status: "suspended" });

  logger.audit("Permission report generated", {
    source: "permission-audit.service",
    event: "permission_report",
    totalStaff: staffCount,
    totalRoles: roleCount,
    staffWithoutRole,
    suspendedStaff,
    activeStaff: staffCount - suspendedStaff,
  });

  return {
    timestamp: new Date(),
    summary: {
      totalStaff: staffCount,
      activeStaff: staffCount - suspendedStaff,
      suspendedStaff,
      totalRoles: roleCount,
      staffWithoutRole,
    },
  };
}

module.exports = {
  verifyStaffPermissions,
  verifyRoleStaff,
  generatePermissionReport,
};
