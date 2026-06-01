import { logger } from "../services/logger/logger.js";
import { useState, useEffect, useCallback } from "react";
import vendorModuleService from "../services/vendorModule.service";

/**
 * Hook to manage vendor modules in admin panel
 */
export const useVendorModules = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const buildStats = useCallback((moduleList) => {
    const total = moduleList.length;
    const enabledGlobally = moduleList.filter((module) => module.enabled).length;
    const enabledForVendors = moduleList.filter(
      (module) => module.enabled && module.vendorEnabled
    ).length;
    const disabledForVendors = total - enabledForVendors;

    return {
      total,
      enabledGlobally,
      enabledForVendors,
      disabledForVendors,
      readableForVendors: enabledForVendors,
    };
  }, []);

  // Fetch all modules
  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vendorModuleService.getAllModules();
      setModules(data);
      setStats(buildStats(data));
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch modules");
      logger.error("Error fetching modules:", { error: err });
    } finally {
      setLoading(false);
    }
  }, [buildStats]);

  // Fetch module statistics
  const fetchStats = useCallback(async () => {
    try {
      const data = await vendorModuleService.getModuleStats();
      setStats(data);
    } catch (err) {
      logger.error("Error fetching module stats:", { error: err });
    }
  }, []);

  // Update vendor access for a module
  const updateVendorAccess = useCallback(
    async (moduleKey, vendorEnabled) => {
      try {
        const updatedModule = await vendorModuleService.updateVendorAccess(
          moduleKey,
          vendorEnabled
        );
        setModules((prev) =>
          {
            const nextModules = prev.map((m) =>
              m.key === moduleKey ? { ...m, vendorEnabled } : m
            );
            setStats(buildStats(nextModules));
            return nextModules;
          }
        );
        return updatedModule;
      } catch (err) {
        setError(err.message || "Failed to update module access");
        throw err;
      }
    },
    [buildStats]
  );

  const updateModuleSettings = useCallback(async (moduleKey, payload) => {
    try {
      const updatedModule = await vendorModuleService.updateModuleSettings(moduleKey, payload);
      setModules((prev) => {
        const nextModules = prev.map((module) =>
          module.key === moduleKey
            ? {
                ...module,
                ...updatedModule,
              }
            : module
        );
        setStats(buildStats(nextModules));
        return nextModules;
      });
      setError(null);
      return updatedModule;
    } catch (err) {
      setError(err.message || "Failed to update module settings");
      throw err;
    }
  }, [buildStats]);

  // Update global module status
  const updateModuleStatus = useCallback(async (moduleKey, enabled) => {
    try {
      const updatedModule = await vendorModuleService.updateModuleStatus(
        moduleKey,
        enabled
      );
      setModules((prev) =>
        {
          const nextModules = prev.map((m) =>
            m.key === moduleKey
              ? { ...m, enabled, vendorEnabled: enabled ? m.vendorEnabled : false }
              : m
          );
          setStats(buildStats(nextModules));
          return nextModules;
        }
      );
      return updatedModule;
    } catch (err) {
      setError(err.message || "Failed to update module status");
      throw err;
    }
  }, [buildStats]);

  // Initialize modules
  const initModules = useCallback(async () => {
    try {
      const data = await vendorModuleService.initializeModules();
      setModules(data);
      setStats(buildStats(data));
      return data;
    } catch (err) {
      setError(err.message || "Failed to initialize modules");
      throw err;
    }
  }, [buildStats]);

  // Load initial data once on mount
  useEffect(() => {
    fetchModules();
    fetchStats();
  }, [fetchModules, fetchStats]);

  return {
    modules,
    loading,
    error,
    stats,
    updateVendorAccess,
    updateModuleStatus,
    updateModuleSettings,
    initModules,
  };
};

/**
 * Hook to check vendor module access
 */
export const useVendorModuleAccess = () => {
  const [accessMap, setAccessMap] = useState({});
  const [loading, setLoading] = useState(false);

  const checkAccess = useCallback(async (moduleKeys) => {
    try {
      setLoading(true);
      const data = await vendorModuleService.checkModuleAccess(moduleKeys);
      setAccessMap(data);
      return data;
    } catch (err) {
      logger.error("Error checking module access:", { error: err });
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  const hasAccess = useCallback((moduleKey) => {
    return accessMap[moduleKey] === true;
  }, [accessMap]);

  return {
    accessMap,
    loading,
    checkAccess,
    hasAccess,
  };
};

/**
 * Hook to get vendor-accessible modules
 * ✅ Fetches only enabled modules for vendors
 */
export const useAccessibleVendorModules = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccessibleModules = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await vendorModuleService.getAccessibleModules();
      setModules(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message || "Failed to fetch accessible modules");
      logger.error("Error fetching accessible modules:", { error: err });
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAccessibleModules();

    // Poll every 10 seconds so admin toggles remove access quickly.
    const intervalId = setInterval(() => {
      fetchAccessibleModules({ silent: true });
    }, 10000);

    const handleWindowFocus = () => {
      fetchAccessibleModules({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAccessibleModules({ silent: true });
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAccessibleModules]);

  return { modules, loading, error, refreshModules: fetchAccessibleModules };
};

