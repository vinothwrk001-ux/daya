import { logger } from "../services/logger/logger.js";
import React, { useState } from "react";
import { useVendorModules } from "../hooks/useVendorModules";
import {
  Activity,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader,
  Package,
  CreditCard,
  BarChart3,
  Package2,
  RotateCcw,
  Star,
  ShoppingCart,
  Truck,
} from "lucide-react";

const MODULE_ICONS = {
  delivery: Truck,
  orders: ShoppingCart,
  products: Package,
  payments: CreditCard,
  analytics: BarChart3,
  inventory: Package2,
  returns: RotateCcw,
  reviews: Star,
};

function Toggle({ checked, disabled, loading, onClick, color = "bg-blue-500" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
        checked ? `${color} ${disabled ? "" : "hover:brightness-95"}` : "bg-gray-300 hover:bg-gray-400"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      >
        {loading ? <Loader className="absolute inset-1 h-4 w-4 animate-spin text-blue-500" /> : null}
      </span>
    </button>
  );
}

export default function AdminVendorAccessPage() {
  const {
    modules,
    loading,
    error,
    stats,
    updateModuleSettings,
    initModules,
  } = useVendorModules();
  const [pendingControl, setPendingControl] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [initializingModules, setInitializingModules] = useState(false);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleInitializeModules = async () => {
    try {
      setInitializingModules(true);
      await initModules();
      showSuccess("Modules initialized successfully.");
    } catch (err) {
      logger.error("Error initializing modules:", { error: err });
    } finally {
      setInitializingModules(false);
    }
  };

  const handleModuleUpdate = async (moduleKey, payload, successLabel) => {
    try {
      const pendingKey = `${moduleKey}:${successLabel}`;
      setPendingControl(pendingKey);
      await updateModuleSettings(moduleKey, payload);
      showSuccess(successLabel);
    } catch (err) {
      logger.error("Error updating module settings:", { error: err });
    } finally {
      setPendingControl(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading vendor modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Vendor Module Access Control</h1>
          <p className="text-gray-600">
            Manage global feature flags and vendor availability for each vendor-facing module.
          </p>
        </div>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
            <div>
              <p className="text-green-700">{successMessage}</p>
            </div>
          </div>
        ) : null}

        {modules.length === 0 && !error ? (
          <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold text-blue-900">Initialize Vendor Modules</h2>
            <p className="mb-4 text-blue-700">
              No modules found. Initialize the default vendor module catalog to begin permission management.
            </p>
            <button
              type="button"
              onClick={handleInitializeModules}
              disabled={initializingModules}
              className="mx-auto flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {initializingModules ? <Loader className="h-4 w-4 animate-spin" /> : null}
              {initializingModules ? "Initializing..." : "Initialize Modules"}
            </button>
          </div>
        ) : null}

        {stats ? (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Modules</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Activity className="h-12 w-12 text-blue-100" />
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Enabled Globally</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stats.enabledGlobally}</p>
                </div>
                <Check className="h-12 w-12 text-green-100" />
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vendor Enabled</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stats.enabledForVendors}</p>
                </div>
                <Eye className="h-12 w-12 text-purple-100" />
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Readable by Vendors</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stats.readableForVendors ?? 0}</p>
                </div>
                <Eye className="h-12 w-12 text-sky-100" />
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Disabled for Vendors</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stats.disabledForVendors}</p>
                </div>
                <EyeOff className="h-12 w-12 text-red-100" />
              </div>
            </div>
          </div>
        ) : null}

        {modules.length > 0 ? (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Module</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Global</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Vendor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {modules.map((module) => {
                    const IconComponent = MODULE_ICONS[module.key] || Package;

                    return (
                      <tr key={module.key} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <IconComponent className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-600" />
                            <div>
                              <p className="font-semibold text-gray-900">{module.name}</p>
                              <p className="text-xs uppercase tracking-wider text-gray-500">{module.key}</p>
                              <p className="mt-1 text-sm text-gray-600">{module.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Toggle
                            checked={module.enabled}
                            loading={pendingControl === `${module.key}:global`}
                            onClick={() =>
                              handleModuleUpdate(
                                module.key,
                                { enabled: !module.enabled },
                                "global"
                              )
                            }
                            color="bg-green-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Toggle
                            checked={module.vendorEnabled}
                            disabled={!module.enabled}
                            loading={pendingControl === `${module.key}:vendor`}
                            onClick={() =>
                              handleModuleUpdate(
                                module.key,
                                { vendorEnabled: !module.vendorEnabled },
                                "vendor"
                              )
                            }
                            color="bg-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
