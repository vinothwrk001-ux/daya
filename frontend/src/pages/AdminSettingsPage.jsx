import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { AlertTriangle, DatabaseZap } from "lucide-react";
import { Link } from "react-router-dom";
import { resetPlatformData } from "../services/adminApi";
import { adminHttp } from "../services/adminHttp";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";

const RESET_CONFIRMATION = "RESET ALL DATA";

function normalizePatchError(err) {
  return err?.response?.data?.message || err?.message || "Request failed.";
}

export function AdminSettingsPage() {
  const { reload } = usePlatformFeatures();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminHttp.get("/api/config/influencer_commerce_enabled");
      const row = data?.data;
      const raw = row?.value;
      setEnabled(!(raw === false || raw === "false" || raw === 0));
    } catch (err) {
      setError(normalizePatchError(err));
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function save(next) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await adminHttp.patch("/api/config/influencer_commerce_enabled", {
        value: Boolean(next),
        description:
          "When false: influencer login/register blocked, storefront reels hidden, influencer and vendor influencer APIs blocked. Admin moderation routes remain available.",
      });
      setEnabled(Boolean(next));
      setMessage(next ? "Influencer commerce is now enabled." : "Influencer commerce is disabled across the platform.");
      await reload();
    } catch (err) {
      setError(normalizePatchError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPlatformData() {
    if (resetConfirmation !== RESET_CONFIRMATION) return;
    const approved = await confirmAction({ message: "This will permanently delete every document from every MongoDB collection. Collections and indexes will remain. Continue?", tone: "danger", confirmLabel: "Confirm" });
    if (!approved) return;

    setResetting(true);
    setResetMessage("");
    setResetError("");
    setResetResult(null);
    try {
      const response = await resetPlatformData(resetConfirmation);
      const result = response?.data || {};
      setResetResult(result);
      setResetConfirmation("");
      setResetMessage(`Platform data reset completed. ${result.deletedDocuments || 0} documents removed from ${result.collectionsCleared || 0} collections.`);
    } catch (err) {
      setResetError(normalizePatchError(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Influencer commerce</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Master switch for influencer logins, creator dashboards, vendor &quot;Influencer Commerce&quot;, reels on the storefront, and tracking attribution. Moderation endpoints under{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">/api/*/admin/</code> stay available while this is off.
        </p>

        {loading ? (
          <div className="mt-6 h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-700">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Enable influencer commerce</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn off to freeze the program for all creators and sellers.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={saving}
              onClick={() => save(!enabled)}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${enabled ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"}`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </label>
        )}

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
            {error}. If this key does not exist yet, ask an operator to run the server-side platform bootstrap script.
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Notes</h2>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Configuration is stored in <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PlatformConfig</code> under{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">influencer_commerce_enabled</code>. Public clients read the derived flag from{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/public/features</code>.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Branding workspace</div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage logos, favicon, SEO branding, theme colors, and rollback history without touching storefront code.
          </p>
          <Link
            to="/admin/settings/company-branding"
            className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Open Company Branding
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/60 dark:bg-slate-900 xl:col-span-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <DatabaseZap className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Reset platform data</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                Deletes every document from MongoDB collections, including vendors, products, orders, carts, revenue, refunds, users, sessions, settings, recommendation data, and audit records. Collections and indexes are kept so the backend can start cleanly.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            Permanent action
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Type {RESET_CONFIRMATION} to enable reset</span>
            <input
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              placeholder={RESET_CONFIRMATION}
              disabled={resetting}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-rose-950/50"
            />
          </label>
          <button
            type="button"
            onClick={handleResetPlatformData}
            disabled={resetting || resetConfirmation !== RESET_CONFIRMATION}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            <DatabaseZap className="h-4 w-4" />
            {resetting ? "Resetting..." : "Reset Data"}
          </button>
        </div>

        {resetResult ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            Last reset removed <strong>{resetResult.deletedDocuments || 0}</strong> documents from <strong>{resetResult.collectionsCleared || 0}</strong> collections.
          </div>
        ) : null}
        {resetMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {resetMessage}
          </div>
        ) : null}
        {resetError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
            {resetError}
          </div>
        ) : null}
      </section>
    </div>
  );
}
