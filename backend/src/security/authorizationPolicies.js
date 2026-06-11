const { AppError } = require("../utils/AppError");
const { hasPermission, normalizeRole } = require("../utils/adminPermissions");
const { hasStaffPermission } = require("../modules/staff/permissions");

const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const FINANCE_ROLES = new Set(["finance_admin"]);
const SUPPORT_ROLES = new Set(["support_admin"]);
const FINANCIAL_DOCUMENT_CATEGORIES = new Set(["bank", "tax", "withdrawal", "finance"]);
const COMPLIANCE_DOCUMENT_CATEGORIES = new Set(["kyc", "identity", "verification", "compliance"]);

function actor(input = {}) {
  return {
    id: String(input.id || input.sub || input._id || ""),
    role: normalizeRole(input.role),
    roles: Array.from(new Set([input.role, ...(input.roles || [])].filter(Boolean))).map(normalizeRole),
    authType: input.authType || "user",
    permissions: input.permissions || {},
  };
}

function id(value) {
  return String(value?._id || value || "");
}

function hasAnyRole(currentActor, roles) {
  const actorRoles = new Set(currentActor.roles?.length ? currentActor.roles : [currentActor.role]);
  return roles.some((role) => actorRoles.has(normalizeRole(role)));
}

function owns(currentActor, value) {
  return Boolean(currentActor.id && id(value) === currentActor.id);
}

function canStaff(currentActor, permission) {
  return currentActor.authType === "staff" && hasStaffPermission(currentActor.permissions, permission);
}

function canAdmin(currentActor, permission) {
  if (hasAnyRole(currentActor, ["super_admin", "admin"])) return true;
  return hasPermission(currentActor.role, permission);
}

const policies = {
  order(currentActor, action, resource = {}) {
    if (hasAnyRole(currentActor, ["super_admin", "admin", "support_admin", "finance_admin"])) {
      return action === "read" || action === "update" || action === "cancel";
    }
    if (currentActor.role === "user") return owns(currentActor, resource.userId || resource.customerId);
    return false;
  },

  product(currentActor, action, resource = {}) {
    if (canAdmin(currentActor, action === "delete" ? "products:delete" : "products:read")) return true;
    return action === "read" && resource.status === "APPROVED" && resource.isActive !== false;
  },

  document(currentActor, action, resource = {}) {
    if (resource.deletedAt || resource.accessRevokedAt || resource.status === "revoked") return false;
    if (resource.ownerType === "customer" && currentActor.role === "user") return owns(currentActor, resource.ownerId);
    if (resource.ownerType === currentActor.role) return owns(currentActor, resource.ownerId);
    if (hasAnyRole(currentActor, Array.from(ADMIN_ROLES))) return true;

    const category = String(resource.category || resource.documentType || "").toLowerCase();
    if (hasAnyRole(currentActor, Array.from(FINANCE_ROLES)) && FINANCIAL_DOCUMENT_CATEGORIES.has(category)) return true;
    if (hasAnyRole(currentActor, Array.from(SUPPORT_ROLES)) && COMPLIANCE_DOCUMENT_CATEGORIES.has(category)) return true;
    return false;
  },

  rbac(currentActor, action) {
    if (currentActor.authType === "staff") return canStaff(currentActor, `roles.${action}`);
    return hasAnyRole(currentActor, ["super_admin", "admin"]) && hasPermission(currentActor.role, `roles:${action}`);
  },
};

function can(inputActor, resourceType, action, resource) {
  const currentActor = actor(inputActor);
  const policy = policies[resourceType];
  if (!policy) return false;
  return Boolean(policy(currentActor, action, resource));
}

function requireAccess(inputActor, resourceType, action, resource, message = "Access denied") {
  if (!can(inputActor, resourceType, action, resource)) {
    throw new AppError(message, 403, "AUTHORIZATION_DENIED", { resourceType, action });
  }
}

module.exports = {
  actor,
  can,
  requireAccess,
  policies,
};
