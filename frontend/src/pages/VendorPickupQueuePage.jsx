import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorMetricCard, VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function VendorPickupQueuePage() {
  const [queue, setQueue] = useState([]);
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState({ readyCount: 0, recommendedThreshold: 10, recommendation: "" });
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedShipmentIds = useMemo(
    () => queue.filter((shipment) => selected[shipment.shipmentId]).map((shipment) => shipment.shipmentId),
    [queue, selected]
  );
  const allSelected = queue.length > 0 && selectedShipmentIds.length === queue.length;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [queueResponse, batchResponse] = await Promise.all([
        vendorDashboardService.getVendorPickupQueue({ limit: 100 }),
        vendorDashboardService.getVendorPickupBatches({ limit: 10 }),
      ]);
      const nextQueue = queueResponse?.data?.shipments || queueResponse?.shipments || [];
      setQueue(nextQueue);
      setSummary(queueResponse?.data?.summary || queueResponse?.summary || { readyCount: nextQueue.length, recommendedThreshold: 10, recommendation: "" });
      setBatches(batchResponse?.data?.batches || batchResponse?.batches || []);
      setSelected((current) => {
        const validIds = new Set(nextQueue.map((shipment) => shipment.shipmentId));
        return Object.fromEntries(Object.entries(current).filter(([shipmentId, isSelected]) => isSelected && validIds.has(shipmentId)));
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleShipment(shipmentId) {
    setSelected((current) => ({
      ...current,
      [shipmentId]: !current[shipmentId],
    }));
  }

  function toggleAll() {
    if (allSelected) {
      setSelected({});
      return;
    }
    setSelected(Object.fromEntries(queue.map((shipment) => [shipment.shipmentId, true])));
  }

  async function handleSchedulePickup() {
    if (!selectedShipmentIds.length) {
      setError("Select at least one shipment to schedule pickup.");
      return;
    }
    if (!(await confirmAction({
      title: "Schedule pickup",
      message: `You are scheduling ${selectedShipmentIds.length} shipments. Continue?`,
      confirmLabel: "Schedule",
    }))) {
      return;
    }

    setScheduling(true);
    setError("");
    setSuccess("");
    try {
      const response = await vendorDashboardService.scheduleVendorPickup({ shipmentIds: selectedShipmentIds });
      const batch = response?.data?.batch || response?.batch;
      setSuccess(batch?.batchId ? `Pickup Scheduled Successfully. Batch ID: ${batch.batchId}` : "Pickup Scheduled Successfully.");
      setSelected({});
      await load();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <VendorMetricCard label="Ready Shipments" value={summary.readyCount || 0} hint="Shipments created and waiting for pickup batching." />
        <VendorMetricCard label="Selected" value={selectedShipmentIds.length} hint="These will be sent in one Shiprocket pickup request." />
        <VendorMetricCard
          label="Recommendation"
          value={summary.readyCount >= (summary.recommendedThreshold || 10) ? "Batch now" : "Optional"}
          hint={summary.recommendation || `Recommended threshold: ${summary.recommendedThreshold || 10} shipments.`}
        />
      </div>

      <VendorSection
        title="Ready for Pickup"
        description={`${summary.readyCount || 0} shipments ready for scheduling.`}
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAll}
              disabled={!queue.length || scheduling}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              {allSelected ? "Clear Selection" : "Select All"}
            </button>
            <button
              type="button"
              onClick={handleSchedulePickup}
              disabled={!selectedShipmentIds.length || scheduling}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {scheduling ? "Scheduling..." : "Schedule Pickup"}
            </button>
          </div>
        )}
      >
        {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <VendorDataTable
            rows={queue.map((shipment) => ({
              id: shipment.shipmentId,
              orderId: shipment._id,
              orderNumber: shipment.orderNumber,
              shipmentId: shipment.shipmentId,
              courier: shipment.courierName || shipment.deliveryPartner || "Pending",
              trackingId: shipment.trackingId || "Pending",
              shippingStatus: shipment.shippingStatus,
              pickupStatus: shipment.pickupStatus,
              destination: [shipment.shippingAddress?.city, shipment.shippingAddress?.state].filter(Boolean).join(", ") || "Address pending",
            }))}
            emptyMessage="No shipments are waiting in the pickup queue."
            columns={[
              {
                key: "select",
                label: "",
                render: (row) => <input type="checkbox" checked={Boolean(selected[row.shipmentId])} onChange={() => toggleShipment(row.shipmentId)} />,
              },
              { key: "orderNumber", label: "Order" },
              { key: "shipmentId", label: "Shipment ID" },
              { key: "courier", label: "Courier" },
              { key: "trackingId", label: "AWB / Tracking" },
              { key: "destination", label: "Destination" },
              { key: "shippingStatus", label: "Status", render: (row) => <StatusBadge value={row.shippingStatus} /> },
              { key: "pickupStatus", label: "Pickup", render: (row) => <StatusBadge value={row.pickupStatus} /> },
              {
                key: "action",
                label: "Action",
                render: (row) => (
                  <Link to={`/vendor/delivery/${row.orderId}/edit`} className="text-xs font-semibold text-blue-600 hover:underline">
                    View order
                  </Link>
                ),
              },
            ]}
          />
        )}
      </VendorSection>

      <VendorSection title="Pickup History" description="Most recent scheduled pickup batches.">
        <VendorDataTable
          rows={(batches || []).map((batch) => ({
            id: batch.batchId,
            batchId: batch.batchId,
            totalShipments: batch.totalShipments,
            courier: batch.courier || "Pending",
            status: batch.status,
            scheduledAt: batch.scheduledAt ? new Date(batch.scheduledAt).toLocaleString() : "",
            pickupDate: batch.pickupDate ? new Date(batch.pickupDate).toLocaleString() : "Pending",
          }))}
          emptyMessage="No pickup batches scheduled yet."
          columns={[
            { key: "batchId", label: "Batch ID" },
            { key: "totalShipments", label: "Shipments" },
            { key: "courier", label: "Courier" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "scheduledAt", label: "Scheduled At" },
            { key: "pickupDate", label: "Pickup Date" },
          ]}
        />
      </VendorSection>
    </div>
  );
}
