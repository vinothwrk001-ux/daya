import { useEffect, useState } from "react";
import { getCurrentLocationAddress } from "../services/locationService";
import { EMPTY_ADDRESS_FORM, getAddressPayloadFromForm, validateAddressForm } from "../utils/checkout";

export function AddressModal({
  open,
  initialValues = EMPTY_ADDRESS_FORM,
  saving = false,
  title = "Add New Address",
  description = "Save a delivery address without leaving checkout.",
  submitLabel = "Save address",
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialValues);
    setErrors({});
  }, [initialValues, open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  function handleFieldChange(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function applyResolvedLocation(location) {
    setForm((current) => ({
      ...current,
      addressLine: location?.address?.addressLine || current.addressLine,
      city: location?.address?.city || current.city,
      state: location?.address?.state || current.state,
      pincode: location?.address?.pincode || current.pincode,
      country: location?.address?.country || current.country || "India",
      latitude: location?.address?.latitude,
      longitude: location?.address?.longitude,
    }));
  }

  async function handleUseCurrentLocation() {
    setLocationLoading(true);
    try {
      const location = await getCurrentLocationAddress();
      await applyResolvedLocation(location);
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    const nextErrors = validateAddressForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit?.(getAddressPayloadFromForm(form), form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-3 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Checkout
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                {title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close address modal"
            >
              ×
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locationLoading}
              className="rounded-xl border border-[color:var(--commerce-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--commerce-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locationLoading ? "Detecting..." : "Use Current Location"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["addressLine", "Address"],
              ["city", "City"],
              ["state", "State"],
              ["pincode", "Pincode"],
              ["country", "Country"],
            ].map(([key, label]) => (
              <label key={key} className={key === "addressLine" ? "sm:col-span-2" : ""}>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </div>
                <input
                  value={form[key] ?? ""}
                  onChange={(event) => handleFieldChange(key, event.target.value)}
                  className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[color:var(--commerce-accent)] dark:bg-slate-950 dark:text-white ${
                    errors[key] ? "border-rose-300" : "border-slate-200 dark:border-slate-800"
                  }`}
                />
                {errors[key] ? <div className="mt-1 text-xs text-rose-600">{errors[key]}</div> : null}
              </label>
            ))}
          </div>



          <label className="mt-4 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(form.isDefault)}
              onChange={(event) => handleFieldChange("isDefault", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[color:var(--commerce-accent)]"
            />
            Set as default delivery address
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[color:var(--commerce-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
