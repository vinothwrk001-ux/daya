import { useCallback, useEffect, useMemo, useState } from "react";
import { acceptCampaign, getInfluencerCampaigns, rejectCampaign } from "../../services/influencerCommerceService";
import { CampaignCard } from "../../components/influencer/CampaignCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "proposed", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Declined / cancelled" },
];

export default function InfluencerCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await getInfluencerCampaigns();
      setCampaigns(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load campaigns.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return campaigns;
    return campaigns.filter((c) => (c.state || "").toLowerCase() === filter);
  }, [campaigns, filter]);

  async function handleAccept(campaign) {
    setBusyId(campaign._id);
    try {
      await acceptCampaign(campaign._id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Accept failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(campaign) {
    const ok = window.confirm("Decline this campaign proposal?");
    if (!ok) return;
    setBusyId(campaign._id);
    try {
      await rejectCampaign(campaign._id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Decline failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Campaign pipeline</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Only campaigns assigned to you are listed. Accept to activate and unlock reel uploads.</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              filter === f.id
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => (
            <CampaignCard key={c._id} campaign={c} onAccept={handleAccept} onReject={handleReject} busyId={busyId} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No campaigns in this view</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">When vendors invite you, proposals appear under Pending.</p>
        </div>
      )}
    </div>
  );
}
