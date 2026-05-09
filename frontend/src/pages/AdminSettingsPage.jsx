import { useCallback, useEffect, useState } from "react";
import { adminHttp } from "../services/adminHttp";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";

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
            {error}. If this key does not exist yet, run <strong>POST /api/config/initialize-defaults</strong> once or restart so defaults are seeded.
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
      </section>
    </div>
  );
}
