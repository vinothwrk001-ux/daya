import { useEffect, useState } from "react";
import { logout as logoutRequest } from "../services/authService";
import {
  changeUserPassword,
  getUserActivity,
  getUserBilling,
  getUserProfile,
  getUserSessions,
  logoutUserDevices,
  revokeUserSession,
  updateUserProfile,
} from "../services/userService";
import { formatCurrency } from "../utils/formatCurrency";
import { useAuthStore } from "../context/authStore";
import { useDarkMode } from "../hooks/useDarkMode";
import { PasswordField } from "../components/PasswordField";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Unable to save settings.";
}

export function SettingsPage() {
  const localLogout = useAuthStore((state) => state.logout);
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [preferences, setPreferences] = useState({
    orderUpdates: true,
    deliveryAlerts: true,
    paymentAlerts: true,
    promotions: false,
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [sessions, setSessions] = useState([]);
  const [billing, setBilling] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSettings() {
    setLoading(true);
    try {
      const [profileResponse, sessionsResponse, billingResponse, activityResponse] = await Promise.all([
        getUserProfile(),
        getUserSessions(),
        getUserBilling({ page: 1, limit: 5 }),
        getUserActivity({ limit: 8 }),
      ]);

      setPreferences(
        profileResponse.data?.preferences?.notificationPreferences || {
          orderUpdates: true,
          deliveryAlerts: true,
          paymentAlerts: true,
          promotions: false,
        }
      );
      setSessions(sessionsResponse.data || []);
      setBilling(billingResponse.data?.billing || []);
      setActivity(activityResponse.data || []);
      setError("");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function savePreferences() {
    setSavingPrefs(true);
    setError("");
    setMessage("");
    try {
      await updateUserProfile({ notificationPreferences: preferences });
      setMessage("Preferences saved.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function savePassword() {
    setSavingPassword(true);
    setError("");
    setMessage("");
    try {
      await changeUserPassword(passwords);
      await logoutRequest();
      localLogout();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSavingPassword(false);
    }
  }

  async function revokeSession(sessionId) {
    try {
      await revokeUserSession(sessionId);
      await loadSettings();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function logoutAllDevices() {
    try {
      await logoutUserDevices();
      await logoutRequest();
      localLogout();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Security and settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control notifications, sessions, billing visibility, and account security from one place.</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Notification preferences</h2>
            <div className="mt-5 grid gap-3">
              {Object.entries(preferences).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <span className="text-sm font-medium capitalize text-slate-700 dark:text-slate-200">{key.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark mode</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Stored locally on this device</div>
              </div>
              <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
            </div>
            <button
              type="button"
              onClick={savePreferences}
              disabled={savingPrefs || loading}
              className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {savingPrefs ? "Saving..." : "Save preferences"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Change password</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Current password</span>
                <PasswordField
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">New password</span>
                <PasswordField
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={savePassword}
              disabled={savingPassword}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingPassword ? "Updating..." : "Update password"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent billing</h2>
            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ) : billing.length ? (
                billing.map((item) => (
                  <div key={item._id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950 dark:text-white">{item.orderNumber}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-950 dark:text-white">{formatCurrency(item.totalAmount || 0)}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.paymentStatus}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No billing records yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Active sessions</h2>
              <button
                type="button"
                onClick={logoutAllDevices}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"
              >
                Logout all devices
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ) : sessions.length ? (
                sessions.map((session) => (
                  <div key={session._id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{session.userAgent || "Unknown device"}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">IP {session.ipAddress || "Unknown"} | Last used {new Date(session.lastUsedAt || session.createdAt).toLocaleString()}</div>
                    <button
                      type="button"
                      onClick={() => revokeSession(session._id)}
                      className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Sign out session
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No active sessions found.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent activity</h2>
            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ) : activity.length ? (
                activity.map((entry) => (
                  <div key={entry._id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{entry.action}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No recent activity yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
