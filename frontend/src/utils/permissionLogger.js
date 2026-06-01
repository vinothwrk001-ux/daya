import { logger } from "../services/logger/logger.js";
/**
 * Frontend Permission Logging & Debugging Utility
 * Tracks permission-related events on the client side
 */

const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

const isDev = import.meta.env.DEV;

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
  if (!isDev && level === LOG_LEVELS.DEBUG) return;

  const payload = { context, ...data };

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

export function logLogin(email, roleId, permissions) {
  log(LOG_LEVELS.INFO, "AUTH_LOGIN", "Staff logged in", {
    email,
    roleId,
    permissionSummary: summarizePermissions(permissions),
  });
}

export function logLogout(email) {
  log(LOG_LEVELS.INFO, "AUTH_LOGOUT", "Staff logged out", {
    email,
  });
}

export function logPermissionSyncStart() {
  log(LOG_LEVELS.DEBUG, "PERMISSION_SYNC", "Starting permission sync...");
}

export function logPermissionSyncSuccess(email, permissions, syncedAt) {
  log(LOG_LEVELS.INFO, "PERMISSION_SYNC", "Permission sync successful", {
    email,
    permissionSummary: summarizePermissions(permissions),
    syncedAt,
  });
}

export function logPermissionSyncFailed(email, error) {
  log(LOG_LEVELS.WARN, "PERMISSION_SYNC", "Permission sync failed", {
    email,
    error: error?.message || String(error),
  });
}

export function logPeriodicSync(interval) {
  log(LOG_LEVELS.DEBUG, "PERMISSION_SYNC", `Periodic sync scheduled every ${interval}ms`);
}

export function logPermissionCheck(permission, granted, availablePermissions) {
  log(
    granted ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
    "PERMISSION_CHECK",
    `Permission check: ${permission} - ${granted ? "GRANTED" : "DENIED"}`,
    {
      permission,
      granted,
      permissionSummary: summarizePermissions(availablePermissions),
    }
  );
}

export function logModuleAccess(moduleName, permission, granted) {
  log(
    granted ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
    "MODULE_ACCESS",
    `Module access: ${moduleName} - ${granted ? "ALLOWED" : "DENIED"}`,
    {
      moduleName,
      permission,
      granted,
    }
  );
}

export function logRouteNavigation(route, permission, allowed) {
  log(
    allowed ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
    "ROUTE_NAVIGATION",
    `Navigation to ${route} - ${allowed ? "ALLOWED" : "BLOCKED"}`,
    {
      route,
      permission,
      allowed,
    }
  );
}

export function logUnauthorizedAccess(route, permission) {
  log(LOG_LEVELS.WARN, "UNAUTHORIZED_ACCESS", `Attempted access to ${route} without permission`, {
    route,
    permission,
  });
}

export function logStateUpdate(stateName, oldValue, newValue) {
  const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);
  if (changed) {
    log(LOG_LEVELS.DEBUG, "STATE_UPDATE", `Auth state updated - ${stateName}`, {
      stateName,
      oldValue: typeof oldValue === "object" ? Object.keys(oldValue || {}) : oldValue,
      newValue: typeof newValue === "object" ? Object.keys(newValue || {}) : newValue,
    });
  }
}

export function logAuthError(error, context = "") {
  log(LOG_LEVELS.ERROR, "AUTH_ERROR", `Authentication error ${context}`, {
    error: error?.message || String(error),
    status: error?.response?.status,
  });
}

export function logPermissionError(error, context = "") {
  log(LOG_LEVELS.ERROR, "PERMISSION_ERROR", `Permission error ${context}`, {
    error: error?.message || String(error),
  });
}

export function logSyncPerformance(duration, status) {
  log(LOG_LEVELS.DEBUG, "PERFORMANCE", `Permission sync completed in ${duration}ms - ${status}`);
}

export function logSlowSync(duration) {
  if (duration > 3000) {
    log(LOG_LEVELS.WARN, "PERFORMANCE", `Slow permission sync detected: ${duration}ms`);
  }
}
