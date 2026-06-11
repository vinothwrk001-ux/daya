import { useState } from "react";
import { confirmAction } from "../services/notificationService";
import { AlertTriangle, DatabaseZap } from "lucide-react";
import { Link } from "react-router-dom";
import { resetPlatformData } from "../services/adminApi";

const RESET_CONFIRMATION = "RESET ALL DATA";

function normalizePatchError(err) {
  return err?.response?.data?.message || err?.message || "Request failed.";
}

export function AdminSettingsPage() {
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

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
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Branding workspace</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Manage logos, favicon, SEO branding, theme colors, and rollback history without touching storefront code.
        </p>
        <Link
          to="/admin/settings/company-branding"
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          Open Company Branding
        </Link>
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
                Deletes every document from MongoDB collections, including products, orders, carts, revenue, refunds, users, sessions, settings, recommendation data, and audit records. Collections and indexes are kept so the backend can start cleanly.
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
