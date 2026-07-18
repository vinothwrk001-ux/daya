import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteOrder, getOrderById, shipOrder, updateOrder } from "../services/adminApi";
import { StatusBadge } from "../components/StatusBadge";
import { ShipOrderModal } from "../components/admin/ShipOrderModal";
import { formatCurrency } from "../utils/formatCurrency";
import { formatWeight, getWeightUnit, getWeightValue } from "../utils/weight";
import { useAdminSession } from "../hooks/useAdminSession";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

function resolvePickupAddress(order) {
  return order?.pickupAddressSnapshot || null;
}

function formatTimelineDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function resolveItemProductId(item) {
  const value = item?.productNumber || item?.productId?.productNumber || item?.productId?.SKU || item?.productId?._id || item?.productId || item?.sku || "";
  return value ? String(value) : "N/A";
}

function resolveItemProductName(item) {
  return item?.productName || item?.name || "Unknown product";
}

function resolveItemSku(item) {
  return item?.sku || item?.productId?.SKU || item?.variantSku || "";
}

function buildOrderTimeline(order) {
  if (!order) return [];

  const events = [];
  const pushEvent = (key, title, timestamp, note = "") => {
    if (!timestamp) return;
    events.push({ key, title, timestamp: new Date(timestamp), note });
  };

  pushEvent("created", "Order Created", order.createdAt);
  if (order.paymentStatus === "Paid" || order.paymentCapturedAt) {
    pushEvent("payment", "Payment Confirmed", order.paymentCapturedAt || order.updatedAt, order.paymentStatus);
  }
  if (order.status === "Packed" || order.timeline?.some((item) => item.status === "Packed")) {
    const packedEvent = order.timeline?.find((item) => item.status === "Packed");
    pushEvent("packed", "Packed", packedEvent?.timestamp, packedEvent?.note);
  }
  if (order.trackingAssignedAt || order.status === "Shipped") {
    pushEvent("shipped", "Shipped", order.trackingAssignedAt || order.shippingDate, order.courierName ? `Courier: ${order.courierName}` : "");
  }
  if (order.whatsappSent || order.whatsappSentAt) {
    pushEvent("whatsapp", "WhatsApp Sent", order.whatsappSentAt, "Shipment notification queued or delivered");
  }
  if (order.deliveredAt || order.status === "Delivered") {
    pushEvent("delivered", "Delivered", order.deliveredAt, order.status === "Delivered" ? "Order delivered" : "");
  }

  (order.timeline || []).forEach((item, index) => {
    if (["WhatsApp Sent", "Shipped", "Packed", "Delivered", "Placed"].includes(item.status)) return;
    pushEvent(`timeline-${index}`, item.status, item.timestamp, item.note);
  });

  return events
    .filter((event) => event.timestamp && !Number.isNaN(event.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp);
}

const STATUS_OPTIONS = ["Placed", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned"];

export function AdminOrderDetailsPage() {
  const { basePath, isLegacyAdmin } = useAdminSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("Placed");
  const [shippingMode, setShippingMode] = useState("SELF");
  const [trackingId, setTrackingId] = useState("");
  const [partner, setPartner] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getOrderById(id)
      .then((res) => {
        const o = res?.data ?? res;
        if (cancelled) return;
        setOrder(o);
        setStatus(o?.status || "Placed");
        setShippingMode(o?.shippingMode || "SELF");
        setTrackingId(o?.trackingId || "");
        setPartner(o?.deliveryPartner || "");
        setCourierName(o?.courierName || "");
        setTrackingUrl(o?.trackingUrl || "");
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const items = order?.items || [];
  const user = order?.userId;
  const address = order?.shippingAddress;
  const pickupAddress = resolvePickupAddress(order);
  const timeline = useMemo(() => buildOrderTimeline(order), [order]);
  const paymentSummary = {
    subtotal: Number(order?.subtotal || 0),
    shippingFee: Number(order?.shippingFee || 0),
    platformFee: Number(order?.platformFee || 0),
    tax: Number(order?.taxAmount || 0),
    discount: Number(order?.discountAmount || 0),
    total: Number(order?.totalAmount || 0),
  };

  const canSave = useMemo(() => !!order && !saving && !loading && !shipping, [order, saving, loading, shipping]);
  const canShip = useMemo(
    () => !!order && order.status !== "Shipped" && order.status !== "Cancelled" && !shipping && !loading,
    [order, shipping, loading]
  );
  const hasTrackingFields = Boolean(trackingId.trim() && trackingUrl.trim());

  function validateTrackingFields() {
    if ((trackingId.trim() && !trackingUrl.trim()) || (!trackingId.trim() && trackingUrl.trim())) {
      return "Tracking ID and Tracking URL must be added together.";
    }

    if (trackingUrl.trim()) {
      try {
        const parsed = new URL(trackingUrl.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return "Tracking URL must start with http or https.";
        }
      } catch {
        return "Enter a valid tracking URL.";
      }
    }

    return "";
  }

  async function refreshOrder(updated) {
    const o = updated?.data ?? updated;
    setOrder(o);
    setStatus(o?.status || "Placed");
    setShippingMode(o?.shippingMode || "SELF");
    setTrackingId(o?.trackingId || "");
    setPartner(o?.deliveryPartner || "");
    setCourierName(o?.courierName || "");
    setTrackingUrl(o?.trackingUrl || "");
  }

  async function onSave(statusOverride) {
    const nextFieldError = validateTrackingFields();
    setFieldError(nextFieldError);
    if (nextFieldError) return;

    const nextStatus = statusOverride || status;
    setSaving(true);
    setError("");
    try {
      const res = await updateOrder(id, {
        orderStatus: nextStatus,
        shippingMode,
        deliveryDetails: { trackingId, partner, courierName, trackingUrl },
      });
      await refreshOrder(res);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmShipment(payload) {
    setShipping(true);
    setError("");
    try {
      const res = await shipOrder(id, payload);
      await refreshOrder(res);
      setShipModalOpen(false);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setShipping(false);
    }
  }

  async function onDelete() {
    if (!(await confirmAction({ message: "Soft delete this order?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setDeleting(true);
    setError("");
    try {
      await deleteOrder(id);
      navigate(`${basePath}/orders`, { replace: true });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <ShipOrderModal
        open={shipModalOpen}
        onClose={() => setShipModalOpen(false)}
        onConfirm={onConfirmShipment}
        loading={shipping}
        initialValues={{
          courierName,
          trackingNumber: trackingId,
          trackingUrl,
          shippingDate: order?.shippingDate ? new Date(order.shippingDate).toISOString().slice(0, 10) : "",
          expectedDeliveryDate: order?.expectedDeliveryDate
            ? new Date(order.expectedDeliveryDate).toISOString().slice(0, 10)
            : "",
          shippingNotes: order?.shippingNotes || "",
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Order</div>
          <div className="mt-1 truncate text-xl font-semibold text-slate-950 dark:text-white">
            {loading ? "Loading..." : order?.orderNumber || id}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${basePath}/orders`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back
          </Link>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            disabled={!canShip}
            onClick={() => setShipModalOpen(true)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Mark as Shipped
          </button>
          <Link
            to={`${basePath}/orders/${id}/invoice`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Invoice
          </Link>
          {isLegacyAdmin ? (
            <button
              type="button"
              disabled={loading || deleting}
              onClick={onDelete}
              className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/30"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {fieldError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {fieldError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">Items</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{items.length} line items</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={order?.paymentStatus} />
              <StatusBadge value={order?.status} />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))
            ) : items.length ? (
              items.map((it) => (
                <div key={`${it.productId?._id || it.productId}-${it.variantId || "base"}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    {it.image ? (
                      <img src={it.image} alt={resolveItemProductName(it)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No image</div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-semibold text-slate-950 dark:text-white">{resolveItemProductName(it)}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate" title={resolveItemProductId(it)}>Product ID: {resolveItemProductId(it)}</span>
                      {resolveItemSku(it) ? <span>SKU: {resolveItemSku(it)}</span> : null}
                    </div>
                    {it.variantTitle || it.variantId ? (
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        Variant: {it.variantTitle || Object.entries(it.variantAttributes || {}).map(([key, value]) => `${key}: ${value}`).join(" / ")}
                      </div>
                    ) : null}
                    {getWeightValue(it) > 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Weight: {formatWeight(getWeightValue(it), getWeightUnit(it))}
                        {Number(it.quantity || 0) > 1
                          ? ` each • ${formatWeight(getWeightValue(it) * Number(it.quantity || 0), getWeightUnit(it))} total`
                          : ""}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Qty {it.quantity} · Unit {formatCurrency(it.price)}
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-950 dark:text-white">
                    <div>{formatCurrency((it.price || 0) * (it.quantity || 0))}</div>
                    <div className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">Subtotal</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No items found.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950">
            <div className="mb-2 font-semibold text-slate-950 dark:text-white">Payment summary</div>
            <div className="grid gap-1 text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(paymentSummary.subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Shipping Fee</span><span>{formatCurrency(paymentSummary.shippingFee)}</span></div>
              <div className="flex items-center justify-between"><span>Platform Fee</span><span>{formatCurrency(paymentSummary.platformFee)}</span></div>
              <div className="flex items-center justify-between"><span>Tax</span><span>{formatCurrency(paymentSummary.tax)}</span></div>
              <div className="flex items-center justify-between"><span>Discount</span><span>- {formatCurrency(paymentSummary.discount)}</span></div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-950 dark:border-slate-800 dark:text-white"><span>Total Amount</span><span>{formatCurrency(paymentSummary.total)}</span></div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Order timeline</div>
            <div className="mt-4 grid gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                ))
              ) : timeline.length ? (
                timeline.map((event) => (
                  <div key={event.key} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-950 dark:text-white">{event.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatTimelineDate(event.timestamp)}</div>
                    </div>
                    {event.note ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No timeline events yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Customer</div>
            <div className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-950 dark:text-white">{user?.name || "Unknown"}</div>
              <div>{user?.email || "No email"}</div>
              <div>{user?.phone || ""}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Shipping address</div>
            <div className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-950 dark:text-white">{address?.fullName}</div>
              <div>{address?.phone}</div>
              <div>{address?.line1}</div>
              {address?.line2 ? <div>{address.line2}</div> : null}
              <div>
                {address?.city}, {address?.state} {address?.postalCode}
              </div>
              <div>{address?.country}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Pickup address</div>
            <div className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-950 dark:text-white">
                {pickupAddress?.name || "Not captured yet"}
              </div>
              <div>{pickupAddress?.phone || "No pickup phone"}</div>
              <div>{pickupAddress?.addressLine1 || "No pickup address"}</div>
              {pickupAddress?.addressLine2 ? <div>{pickupAddress.addressLine2}</div> : null}
              <div>
                {[pickupAddress?.city, pickupAddress?.state, pickupAddress?.pincode]
                  .filter(Boolean)
                  .join(", ") || "Pickup city/state/pincode not available"}
              </div>
              <div>{pickupAddress?.country || ""}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Update</div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shipping mode</span>
                <select
                  value={shippingMode}
                  onChange={(e) => setShippingMode(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="SELF">SELF</option>
                  <option value="PLATFORM">PLATFORM</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery partner</span>
                <input
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Courier name</span>
                <input
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracking ID</span>
                <input
                  value={trackingId}
                  onChange={(e) => {
                    setTrackingId(e.target.value);
                    setFieldError("");
                  }}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracking URL</span>
                <input
                  value={trackingUrl}
                  onChange={(e) => {
                    setTrackingUrl(e.target.value);
                    setFieldError("");
                  }}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                WhatsApp shipment notifications are sent only when you confirm shipment and the order status becomes Shipped.
                {order?.trackingAssignedAt ? ` Tracking assigned: ${new Date(order.trackingAssignedAt).toLocaleString()}.` : ""}
                {order?.whatsappSent ? ` WhatsApp sent: ${order?.whatsappSentAt ? new Date(order.whatsappSentAt).toLocaleString() : "yes"}.` : " WhatsApp not sent yet."}
              </div>

              {Array.isArray(order?.whatsappLogs) && order.whatsappLogs.length ? (
                <div className="rounded-2xl border border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
                  <div className="font-semibold text-slate-950 dark:text-white">Recent WhatsApp logs</div>
                  <div className="mt-2 grid gap-2">
                    {order.whatsappLogs.slice(0, 3).map((log) => (
                      <div key={log._id} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                        <span className="capitalize">{log.messageType}</span>
                        <StatusBadge value={log.status} />
                        <span>{log.sentAt ? new Date(log.sentAt).toLocaleString() : "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
