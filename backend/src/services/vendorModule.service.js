const { VendorModule } = require("../models/VendorModule");
const { getDefaultVendorModules, isValidModuleKey } = require("../config/vendorModules.config");
const { AppError } = require("../utils/AppError");
const { AuditLog } = require("../models/AuditLog");
const { logger } = require("../utils/logger");

class VendorModuleService {
  constructor() {
    // In-memory cache for frequently accessed data
    this.accessCache = new Map(); // moduleKey -> { accessible, timestamp }
    this.cacheTTL = 30000; // 30 seconds cache TTL
  }

  /**
   * Get cached accessible modules
   * Returns from cache if available and not expired
   */
  _getFromCache(cacheKey) {
    const cached = this.accessCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.accessCache.delete(cacheKey);
    return null;
  }

  /**
   * Set cache entry
   */
  _setCache(cacheKey, data) {
    this.accessCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all caches (called on module update)
   */
  _clearCache() {
    this.accessCache.clear();
  }

  _normalizePermissionKey(permission) {
    return String(permission || "").trim().replace(/:/g, ".");
  }

  _shouldLogDebug() {
    return process.env.NODE_ENV !== "production";
  }

  _buildAccessDecision(module, user, action = "read") {
    const featureEnabled = module?.enabled === true;
    const vendorModuleEnabled = module?.vendorEnabled === true;
    const permissionAllowed = this._hasRequiredPermission(user, module?.requiredPermission);
    const normalizedAction = action || "read";

    return {
      allowed: Boolean(module) && featureEnabled && vendorModuleEnabled && permissionAllowed,
      action: normalizedAction,
      moduleKey: module?.key || null,
      featureEnabled,
      vendorModuleEnabled,
      permissionAllowed,
      requiredPermission: module?.requiredPermission || null,
      userPermissions: user?.permissions || null,
    };
  }

  _logAccessDecision(context, decision, user) {
    if (!this._shouldLogDebug()) return;
    logger.security("Vendor module access decision", {
      source: "vendorModule.service",
      event: "vendor_module_access_decision",
      context,
      module: decision.moduleKey,
      action: decision.action,
      allowed: decision.allowed,
      featureEnabled: decision.featureEnabled,
      vendorModuleEnabled: decision.vendorModuleEnabled,
      permissionAllowed: decision.permissionAllowed,
      requiredPermission: decision.requiredPermission,
      userId: user?.sub || user?._id || null,
      role: user?.role || null,
      permissionCount: Object.values(decision.userPermissions || {}).reduce(
        (total, actions) => total + Object.values(actions || {}).filter(Boolean).length,
        0
      ),
    });
  }

  _buildEffectivePermissions(module, user) {
    const allowed = this._buildAccessDecision(module, user, "read").allowed;
    return {
      create: allowed,
      read: allowed,
      update: allowed,
      delete: allowed,
    };
  }

  _hasRequiredPermission(user, requiredPermission) {
    if (!requiredPermission) {
      return true;
    }

    const normalizedPermission = this._normalizePermissionKey(requiredPermission);
    const rawPermissions = user?.permissions;

    // Backward-compatible path for legacy vendors without explicit permission payloads.
    if (!rawPermissions) {
      return true;
    }

    if (Array.isArray(rawPermissions)) {
      return rawPermissions.some((permission) => this._normalizePermissionKey(permission) === normalizedPermission);
    }

    if (typeof rawPermissions === "object") {
      const [moduleName, action] = normalizedPermission.split(".");
      if (moduleName && action && rawPermissions[moduleName]?.[action] === true) {
        return true;
      }

      return Object.entries(rawPermissions).some(([permission, value]) => {
        if (value !== true) {
          return false;
        }
        return this._normalizePermissionKey(permission) === normalizedPermission;
      });
    }

    return false;
  }

  _canUserAccessModule(module, user) {
    return this._buildAccessDecision(module, user, "read").allowed;
  }

  _canUserPerformAction(module, action, user) {
    return this._buildAccessDecision(module, user, action).allowed;
  }

  /**
   * Initialize vendor modules (run once during setup)
   */
  async initializeModules() {
    const defaultModules = getDefaultVendorModules();
    const existingModules = await VendorModule.find({ key: { $in: defaultModules.map((module) => module.key) } })
      .select("key")
      .lean();
    const existingKeys = new Set(existingModules.map((module) => module.key));
    const missingModules = defaultModules.filter((module) => !existingKeys.has(module.key));

    if (missingModules.length > 0) {
      await VendorModule.insertMany(missingModules, { ordered: false });
    }
  }

  async ensureModulesInitialized() {
    await this.initializeModules();
  }

  /**
   * Get all vendor modules
   */
  async getAllModules() {
    await this.ensureModulesInitialized();
    const modules = await VendorModule.find().sort({ order: 1 });
    return modules.filter((module) => isValidModuleKey(module.key));
  }

  /**
   * Get modules accessible to vendors (enabled both globally and for vendors)
   */
  async getVendorAccessibleModules(user) {
    await this.ensureModulesInitialized();
    const modules = await VendorModule.find({
      enabled: true,
      vendorEnabled: true,
    }).sort({ order: 1 });

    return modules
      .filter((module) => isValidModuleKey(module.key) && this._canUserAccessModule(module, user))
      .map((module) => {
        const decision = this._buildAccessDecision(module, user, "read");

        return {
          ...(module.toObject?.() || module),
          accessDebug: this._shouldLogDebug()
            ? {
                requiredPermission: decision.requiredPermission,
                permissionAllowed: decision.permissionAllowed,
                featureEnabled: decision.featureEnabled,
                vendorModuleEnabled: decision.vendorModuleEnabled,
              }
            : undefined,
        };
      });
  }

  /**
   * Get a specific module by key
   */
  async getModuleByKey(key) {
    await this.ensureModulesInitialized();
    const module = await VendorModule.findOne({ key });
    if (!module || !isValidModuleKey(module.key)) {
      throw new AppError(`Module '${key}' not found`, 404, "MODULE_NOT_FOUND");
    }
    return module;
  }

  /**
   * Update module's vendor access (admin only)
   * 🔥 CRITICAL: This controls vendor access globally
   * ✅ Clears cache to ensure immediate effect
   */
  async updateModuleVendorAccess(moduleKey, vendorEnabled, adminUser) {
    const module = await this.getModuleByKey(moduleKey);

    const oldValue = module.vendorEnabled;
    module.vendorEnabled = module.enabled === true ? vendorEnabled : false;
    module.updatedBy = adminUser._id;
    await module.save();

    // Clear cache to ensure immediate effect
    this._clearCache();

    // Audit log
    if (typeof AuditLog !== "undefined") {
      try {
        await AuditLog.create({
          action: "UPDATE_VENDOR_MODULE_ACCESS",
          entity: "VendorModule",
          entityId: module._id,
          changedFields: {
            vendorEnabled: { oldValue, newValue: module.vendorEnabled },
          },
          userId: adminUser._id,
          ipAddress: adminUser.ipAddress,
          userAgent: adminUser.userAgent,
        });
      } catch (err) {
        logger.error("Failed to create vendor module audit log", {
          source: "vendorModule.service",
          event: "vendor_module_audit_log_failed",
          action: "module_update",
          error: err,
        });
      }
    }

    return module;
  }

  async updateVendorModuleSettings(moduleKey, updates, adminUser) {
    const module = await this.getModuleByKey(moduleKey);
    const changedFields = {};

    if (typeof updates.enabled === "boolean" && updates.enabled !== module.enabled) {
      changedFields.enabled = {
        oldValue: module.enabled,
        newValue: updates.enabled,
      };
      module.enabled = updates.enabled;
    }

    if (typeof updates.vendorEnabled === "boolean" && updates.vendorEnabled !== module.vendorEnabled) {
      changedFields.vendorEnabled = {
        oldValue: module.vendorEnabled,
        newValue: updates.vendorEnabled,
      };
      module.vendorEnabled = updates.vendorEnabled;
    }

    if (module.enabled === false && module.vendorEnabled !== false) {
      changedFields.vendorEnabled = {
        oldValue: module.vendorEnabled,
        newValue: false,
      };
      module.vendorEnabled = false;
    }

    module.updatedBy = adminUser._id;
    await module.save();
    this._clearCache();

    if (typeof AuditLog !== "undefined") {
      try {
        await AuditLog.create({
          action: "UPDATE_VENDOR_MODULE_SETTINGS",
          entity: "VendorModule",
          entityId: module._id,
          changedFields,
          userId: adminUser._id,
          ipAddress: adminUser.ipAddress,
          userAgent: adminUser.userAgent,
        });
      } catch (err) {
        logger.error("Failed to create vendor module audit log", {
          source: "vendorModule.service",
          event: "vendor_module_audit_log_failed",
          action: "vendor_module_update",
          error: err,
        });
      }
    }

    return module;
  }

  /**
   * Update global feature flag
   * ✅ Clears cache to ensure immediate effect
   */
  async updateModuleGlobalStatus(moduleKey, enabled, adminUser) {
    const module = await this.getModuleByKey(moduleKey);

    const oldValue = module.enabled;
    const oldVendorEnabled = module.vendorEnabled;
    module.enabled = enabled;
    if (enabled === false) {
      module.vendorEnabled = false;
    }
    module.updatedBy = adminUser._id;
    await module.save();

    // Clear cache to ensure immediate effect
    this._clearCache();

    // Audit log
    if (typeof AuditLog !== "undefined") {
      try {
        await AuditLog.create({
          action: "UPDATE_VENDOR_MODULE_STATUS",
          entity: "VendorModule",
          entityId: module._id,
          changedFields: {
            enabled: { oldValue, newValue: enabled },
            ...(enabled === false && oldVendorEnabled !== false
              ? {
                  vendorEnabled: { oldValue: oldVendorEnabled, newValue: false },
                }
              : {}),
          },
          userId: adminUser._id,
          ipAddress: adminUser.ipAddress,
          userAgent: adminUser.userAgent,
        });
      } catch (err) {
        logger.error("Failed to create vendor module audit log", {
          source: "vendorModule.service",
          event: "vendor_module_audit_log_failed",
          action: "global_feature_update",
          error: err,
        });
      }
    }

    return module;
  }

  async getGlobalModuleEnabledMap() {
    await this.ensureModulesInitialized();
    const modules = await VendorModule.find().select("key enabled").lean();

    return modules.reduce((accumulator, module) => {
      if (isValidModuleKey(module.key)) {
        accumulator[module.key] = module.enabled === true;
      }
      return accumulator;
    }, {});
  }

  async isModuleGloballyEnabled(moduleKey) {
    if (!isValidModuleKey(moduleKey)) {
      return true;
    }

    await this.ensureModulesInitialized();
    const module = await VendorModule.findOne({ key: moduleKey }).select("enabled").lean();
    return module ? module.enabled === true : true;
  }

  /**
   * 🔥 CRITICAL ACCESS LOGIC
   * Check if vendor can access a module
   * ✅ Uses cache for performance (30s TTL)
   */
  async canVendorAccessModule(moduleKey, user) {
    await this.ensureModulesInitialized();
    const normalizedPermissionFingerprint = JSON.stringify(user?.permissions || null);
    const cacheKey = `module:${moduleKey}:${normalizedPermissionFingerprint}`;

    // Try cache first
    const cached = this._getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    if (!isValidModuleKey(moduleKey)) {
      this._setCache(cacheKey, false);
      return false;
    }

    const module = await VendorModule.findOne({ key: moduleKey });
    const decision = this._buildAccessDecision(module, user, "read");
    this._logAccessDecision("module.read", decision, user);
    this._setCache(cacheKey, decision.allowed);
    return decision.allowed;
  }

  async canVendorPerformAction(moduleKey, action, user) {
    await this.ensureModulesInitialized();
    const normalizedPermissionFingerprint = JSON.stringify(user?.permissions || null);
    const cacheKey = `module-action:${moduleKey}:${action}:${normalizedPermissionFingerprint}`;
    const cached = this._getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    if (!isValidModuleKey(moduleKey)) {
      this._setCache(cacheKey, false);
      return false;
    }

    const module = await VendorModule.findOne({ key: moduleKey });
    const decision = this._buildAccessDecision(module, user, "read");
    this._logAccessDecision("module.action", decision, user);
    this._setCache(cacheKey, decision.allowed);
    return decision.allowed;
  }

  /**
   * Batch check multiple modules
   */
  async canVendorAccessModules(moduleKeys, user) {
    await this.ensureModulesInitialized();
    const validModuleKeys = moduleKeys.filter((key) => isValidModuleKey(key));
    const modules = await VendorModule.find({ key: { $in: validModuleKeys } });

    const result = {};
    moduleKeys.forEach((key) => {
      const module = modules.find((m) => m.key === key);
      result[key] = this._canUserAccessModule(module, user);
    });

    return result;
  }

  async canVendorPerformActions(requestedPermissions, user) {
    await this.ensureModulesInitialized();
    const results = {};
    const moduleKeys = [
      ...new Set(
        requestedPermissions
          .map((permission) => String(permission || "").split(".")[0])
          .filter((moduleKey) => isValidModuleKey(moduleKey))
      ),
    ];
    const modules = await VendorModule.find({ key: { $in: moduleKeys } });

    requestedPermissions.forEach((permission) => {
      const [moduleKey] = String(permission || "").split(".");
      const module = modules.find((entry) => entry.key === moduleKey);
      results[permission] = this._canUserAccessModule(module, user);
    });

    return results;
  }

  /**
   * Get module stats for admin dashboard
   */
  async getModuleStats() {
    await this.ensureModulesInitialized();
    const validModules = await VendorModule.find().lean();
    const supportedModules = validModules.filter((module) => isValidModuleKey(module.key));
    const enabledGlobally = supportedModules.filter((module) => module.enabled).length;
    const enabledForVendors = supportedModules.filter((module) => module.enabled && module.vendorEnabled).length;
    const disabledForVendors = supportedModules.length - enabledForVendors;

    return {
      total: supportedModules.length,
      enabledGlobally,
      enabledForVendors,
      disabledForVendors,
      readableForVendors: enabledForVendors,
    };
  }
}

module.exports = new VendorModuleService();
