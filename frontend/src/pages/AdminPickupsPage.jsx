import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { listPickupBatches, scheduleAdminPickup } from "../services/adminApi";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminPickupsPage() {
  const [batches, setBatches] = useState([]);
  const [shipmentIdsText, setShipmentIdsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const shipmentIds = useMemo(
    () => shipmentIdsText.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
    [shipmentIdsText]
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await listPickupBatches({ limit: 25 });
      setBatches(response?.data?.batches || response?.batches || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSchedule() {
    if (!shipmentIds.length) {
      setError("Enter at least one shipment id.");
      return;
    }

    setScheduling(true);
    setError("");
    setSuccess("");
    try {
      const response = await scheduleAdminPickup({
        shipmentIds,
      });
      const batch = response?.data?.batch || response?.batch;
      setSuccess(batch?.batchId ? `Pickup scheduled successfully. Batch ID: ${batch.batchId}` : "Pickup scheduled successfully.");
      setShipmentIdsText("");
      await load();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Schedule Pickup</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Schedule pickup for one shipment group in a single API call.</p>
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shipment IDs</span>
            <textarea
              value={shipmentIdsText}
              onChange={(e) => setShipmentIdsText(e.target.value)}
              rows={4}
              placeholder="Enter shipment ids separated by commas, spaces, or new lines"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">{shipmentIds.length} shipments in this request.</div>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={!shipmentIds.length || scheduling}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {scheduling ? "Scheduling..." : "Schedule Pickup"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Pickup Batches</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All scheduled pickup batches across fulfillment operations.</p>

        {loading ? (
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : batches.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr>
                  {["Batch", "Shipments", "Courier", "Status", "Scheduled", "Pickup Date"].map((label) => (
                    <th key={label} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {batches.map((batch) => (
                  <tr key={batch.batchId}>
                    <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{batch.batchId}</td>
                    <td className="px-3 py-3">{batch.totalShipments}</td>
                    <td className="px-3 py-3">{batch.courier || "Pending"}</td>
                    <td className="px-3 py-3"><StatusBadge value={batch.status} /></td>
                    <td className="px-3 py-3">{batch.scheduledAt ? new Date(batch.scheduledAt).toLocaleString() : ""}</td>
                    <td className="px-3 py-3">{batch.pickupDate ? new Date(batch.pickupDate).toLocaleString() : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No pickup batches found.
          </div>
        )}
      </section>
    </div>
  );
}
