import { useState } from "react";
import { useStaffPermission, useRequirePermission } from "../hooks/useStaffAuth";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function StaffSettingsPage() {
  useRequirePermission("settings.update");
  const { hasPermission } = useStaffPermission();
  const [settings, setSettings] = useState({
    platformName: "Daya Creatives Platform",
    maxUploadSize: 5,
    maintenanceMode: false,
    enableNotifications: true,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const canUpdate = hasPermission("settings.update");

  async function handleSave() {
    setLoading(true);
    setError("");
    setSaved(false);

    try {
      // Placeholder for actual API call
      // await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!canUpdate) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-950">Access Denied</p>
          <p className="mt-2 text-sm text-slate-600">You don't have permission to access settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage platform-wide configuration and preferences</p>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Success */}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Settings saved successfully!
        </div>
      )}

      {/* Settings Form */}
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <div className="space-y-6">
          {/* Platform Name */}
          <div>
            <label className="block text-sm font-medium text-slate-950">Platform Name</label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Max Upload Size */}
          <div>
            <label className="block text-sm font-medium text-slate-950">Max Upload Size (MB)</label>
            <input
              type="number"
              value={settings.maxUploadSize}
              onChange={(e) => setSettings({ ...settings, maxUploadSize: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Maintenance Mode */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="maintenance"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="maintenance" className="text-sm font-medium text-slate-950">
              Enable Maintenance Mode
            </label>
          </div>

          {/* Notifications */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notifications"
              checked={settings.enableNotifications}
              onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="notifications" className="text-sm font-medium text-slate-950">
              Enable Notifications
            </label>
          </div>

          {/* Save Button */}
          <div className="flex gap-4 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
