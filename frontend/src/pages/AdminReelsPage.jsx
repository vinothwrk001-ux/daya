import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Film, Plus, Trash2, BarChart3, Target } from "lucide-react";
import { confirmAction, showError, showSuccess } from "../services/notificationService";
import { deleteAdminReel, listAdminReels, publishAdminReel } from "../services/reelService";
import { formatCurrency } from "../utils/formatCurrency";

export function AdminReelsPage() {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listAdminReels({ status: status || undefined, search: search || undefined });
        setReels(data.reels || []);
      } catch (error) {
        showError(error?.response?.data?.message || "Failed to load reels");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [status, search]);

  const stats = useMemo(
    () => ({
      total: reels.length,
      published: reels.filter((reel) => reel.status === "published").length,
      revenue: reels.reduce((sum, reel) => sum + Number(reel.revenueTotal || 0), 0),
    }),
    [reels]
  );

  async function handleDelete(reelId) {
    const confirmed = await confirmAction("Delete this reel permanently?");
    if (!confirmed) return;
    try {
      await deleteAdminReel(reelId);
      setReels((current) => current.filter((reel) => reel._id !== reelId));
      showSuccess("Reel deleted");
    } catch (error) {
      showError(error?.response?.data?.message || "Unable to delete reel");
    }
  }

  async function handlePublish(reelId) {
    try {
      await publishAdminReel(reelId);
      setReels((current) =>
        current.map((reel) => (reel._id === reelId ? { ...reel, status: "published" } : reel))
      );
      showSuccess("Reel published");
    } catch (error) {
      showError(error?.response?.data?.message || "Unable to publish reel");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Reels & Shorts</h1>
          <p className="text-sm text-slate-500">Manage shoppable short-form video content.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/reels/analytics"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            to="/admin/reels/attribution"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700"
          >
            <Target className="h-4 w-4" />
            Attribution
          </Link>
          <button
            type="button"
            onClick={() => navigate("/admin/reels/create")}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create Reel
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Reels</p>
          <p className="mt-2 text-2xl font-black">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
          <p className="mt-2 text-2xl font-black">{stats.published}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(stats.revenue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reels..."
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Reel</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Views</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading reels...
                </td>
              </tr>
            ) : null}
            {!loading && !reels.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No reels found.
                </td>
              </tr>
            ) : null}
            {reels.map((reel) => (
              <tr key={reel._id}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      <Film className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{reel.title}</p>
                      <p className="text-xs text-slate-500">{reel.associatedProducts?.length || 0} products</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize dark:bg-slate-800">
                    {reel.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm">{reel.viewsCount || 0}</td>
                <td className="px-4 py-4 text-sm">{formatCurrency(reel.revenueTotal || 0)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    {reel.status !== "published" ? (
                      <button
                        type="button"
                        onClick={() => handlePublish(reel._id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Publish
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/reels/${reel._id}/edit`)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(reel._id)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
