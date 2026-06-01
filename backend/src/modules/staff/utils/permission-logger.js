/**
 * Permission Logging & Debugging Utility
 * Centralizes permission-related logging for easy troubleshooting
 */

const { logger } = require("../../../utils/logger");

const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

function summarizePermissions(permissions) {
  if (!permissions) return { moduleCount: 0, permissionCount: 0 };
  return Object.entries(permissions).reduce(
    (summary, [, actions]) => ({
      moduleCount: summary.moduleCount + 1,
      permissionCount:
        summary.permissionCount +
        Object.values(actions || {}).filter(Boolean).length,
    }),
    { moduleCount: 0, permissionCount: 0 }
  );
}

function log(level, context, message, data = {}) {
  const payload = { source: "staff-permission-logger", context, ...data };
  
  if (level === LOG_LEVELS.ERROR) {
    logger.error(message, payload);
  } else if (level === LOG_LEVELS.WARN) {
    logger.warn(message, payload);
  } else if (level === LOG_LEVELS.INFO) {
    logger.info(message, payload);
  } else {
    logger.debug(message, payload);
  }
}

// ========== AUTHENTICATION LOGS ==========

function logLogin(staffId, email, roleId, permissions) {
  log(LOG_LEVELS.INFO, "AUTH_LOGIN", `Staff logged in`, {
    staffId,
    email,
    roleId,
    permissionSummary: summarizePermissions(permissions),
  });
}

function logLogout(staffId, email) {
  log(LOG_LEVELS.INFO, "AUTH_LOGOUT", `Staff logged out`, {
    staffId,
    email,
  });
}

function logSessionRefresh(staffId, oldPermissions, newPermissions) {
  const permissionsChanged = JSON.stringify(oldPermissions) !== JSON.stringify(newPermissions);
  log(
    permissionsChanged ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG,
    "AUTH_SESSION_REFRESH",
    `Session refreshed${permissionsChanged ? " - PERMISSIONS CHANGED" : ""}`,
    {
      staffId,
    oldPermissionSummary: summarizePermissions(oldPermissions),
    newPermissionSummary: summarizePermissions(newPermissions),
    }
  );
}

// ========== PERMISSION CHECK LOGS ==========

function logPermissionCheck(staffId, email, permission, granted, availablePermissions) {
  const [module, action] = permission.split(".");
  log(
    granted ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
    "PERMISSION_CHECK",
    `${staffId} requested ${permission}: ${granted ? "✓ GRANTED" : "✗ DENIED"}`,
    {
      staffId,
      email,
      permission,
      granted,
      module,
      action,
      permissionSummary: summarizePermissions(availablePermissions),
    }
  );
}

function logPermissionDenied(staffId, email, permission, reason) {
  log(LOG_LEVELS.WARN, "PERMISSION_DENIED", `Access denied for ${permission}`, {
    staffId,
    email,
    permission,
    reason,
  });
}

// ========== ROLE & PERMISSION MANAGEMENT LOGS ==========

function logRoleUpdate(roleId, roleName, oldPermissions, newPermissions) {
  const changed = JSON.stringify(oldPermissions) !== JSON.stringify(newPermissions);
  if (changed) {
    log(LOG_LEVELS.WARN, "ROLE_UPDATE", `Role updated - PERMISSIONS CHANGED`, {
      roleId,
      roleName,
      oldPermissionSummary: summarizePermissions(oldPermissions),
      newPermissionSummary: summarizePermissions(newPermissions),
    });
  } else {
    log(LOG_LEVELS.INFO, "ROLE_UPDATE", `Role updated`, {
      roleId,
      roleName,
    });
  }
}

function logPermissionAssignment(staffId, email, oldRoleId, newRoleId, permissions) {
  log(LOG_LEVELS.INFO, "PERMISSION_ASSIGNMENT", `Staff role changed`, {
    staffId,
    email,
    oldRoleId,
    newRoleId,
    newPermissionSummary: summarizePermissions(permissions),
  });
}

// ========== SYNC & CACHE LOGS ==========

function logPermissionSync(staffId, email, source, permissions) {
  log(LOG_LEVELS.DEBUG, "PERMISSION_SYNC", `Permissions synced from ${source}`, {
    staffId,
    email,
    source,
    permissionSummary: summarizePermissions(permissions),
  });
}

function logCacheHit(staffId, permission) {
  log(LOG_LEVELS.DEBUG, "CACHE_HIT", `Permission check from cache`, {
    staffId,
    permission,
  });
}

function logCacheMiss(staffId, permission) {
  log(LOG_LEVELS.DEBUG, "CACHE_MISS", `Permission check required server call`, {
    staffId,
    permission,
  });
}

// ========== ERROR LOGS ==========

function logAuthError(staffId, email, reason) {
  log(LOG_LEVELS.ERROR, "AUTH_ERROR", `Authentication failed`, {
    staffId,
    email,
    reason,
  });
}

function logRoleError(roleId, reason) {
  log(LOG_LEVELS.ERROR, "ROLE_ERROR", `Role operation failed`, {
    roleId,
    reason,
  });
}

function logPermissionError(staffId, permission, reason) {
  log(LOG_LEVELS.ERROR, "PERMISSION_ERROR", `Permission operation failed`, {
    staffId,
    permission,
    reason,
  });
}

// ========== VERIFICATION & AUDIT LOGS ==========

function logPermissionVerification(staffId, email, roleId, roleName, result) {
  log(
    result.valid ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
    "PERMISSION_VERIFICATION",
    `Permission verification - ${result.valid ? "VALID" : "INVALID"}`,
    {
      staffId,
      email,
      roleId,
      roleName,
      valid: result.valid,
      discrepancies: result.discrepancies,
      permissionSummary: summarizePermissions(result.rolePermissions),
    }
  );
}

module.exports = {
  LOG_LEVELS,
  summarizePermissions,
  log,
  logLogin,
  logLogout,
  logSessionRefresh,
  logPermissionCheck,
  logPermissionDenied,
  logRoleUpdate,
  logPermissionAssignment,
  logPermissionSync,
  logCacheHit,
  logCacheMiss,
  logAuthError,
  logRoleError,
  logPermissionError,
  logPermissionVerification,
};
