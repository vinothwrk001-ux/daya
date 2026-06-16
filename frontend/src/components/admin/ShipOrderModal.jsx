import { useEffect, useState } from "react";

export function ShipOrderModal({ open, onClose, onConfirm, loading = false, initialValues = {} }) {
  const [courierName, setCourierName] = useState(initialValues.courierName || "");
  const [trackingNumber, setTrackingNumber] = useState(initialValues.trackingNumber || initialValues.trackingId || "");
  const [trackingUrl, setTrackingUrl] = useState(initialValues.trackingUrl || "");
  const [shippingDate, setShippingDate] = useState(
    initialValues.shippingDate || new Date().toISOString().slice(0, 10)
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(initialValues.expectedDeliveryDate || "");
  const [shippingNotes, setShippingNotes] = useState(initialValues.shippingNotes || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCourierName(initialValues.courierName || "");
    setTrackingNumber(initialValues.trackingNumber || initialValues.trackingId || "");
    setTrackingUrl(initialValues.trackingUrl || "");
    setShippingDate(initialValues.shippingDate || new Date().toISOString().slice(0, 10));
    setExpectedDeliveryDate(initialValues.expectedDeliveryDate || "");
    setShippingNotes(initialValues.shippingNotes || "");
    setError("");
  }, [open, initialValues]);

  if (!open) return null;

  function validate() {
    if (!courierName.trim()) return "Courier name is required.";
    if (!trackingNumber.trim()) return "Tracking number is required.";
    if (!trackingUrl.trim()) return "Tracking URL is required.";
    try {
      const parsed = new URL(trackingUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "Tracking URL must start with http or https.";
      }
    } catch {
      return "Enter a valid tracking URL.";
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextError = validate();
    setError(nextError);
    if (nextError) return;

    await onConfirm({
      courierName: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim(),
      shippingDate: shippingDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      shippingNotes: shippingNotes.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-order-title"
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ship-order-title" className="text-lg font-semibold text-slate-950 dark:text-white">
              Confirm Shipment
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Save tracking details, mark the order as shipped, and send the customer a WhatsApp notification.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Courier name</span>
            <input
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracking number</span>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracking URL</span>
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shipping date</span>
              <input
                type="date"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Expected delivery</span>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shipping notes</span>
            <textarea
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
              rows={3}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Confirming..." : "Confirm Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
