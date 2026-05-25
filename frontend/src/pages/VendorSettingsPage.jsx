import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VendorSection } from "../components/VendorPanel";
import { LocationPickerMap } from "../components/LocationPickerMap";
import * as vendorDashboardService from "../services/vendorDashboardService";
import { getCurrentLocationAddress, reverseGeocodeCoordinates } from "../services/locationService";
import { useCategories } from "../hooks/useCategories";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function createEmptyPickupLocation(isDefault = false) {
  return {
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    latitude: "",
    longitude: "",
    isDefault,
  };
}

function derivePickupLocations(vendor = {}) {
  const locations = Array.isArray(vendor.pickupLocations) && vendor.pickupLocations.length
    ? vendor.pickupLocations
    : (vendor.pickupAddress ? [{ ...vendor.pickupAddress, isDefault: true }] : []);

  if (!locations.length) {
    return [createEmptyPickupLocation(true)];
  }

  if (!locations.some((location) => location?.isDefault)) {
    return locations.map((location, index) => ({ ...location, isDefault: index === 0 }));
  }

  return locations;
}

function summarizePickupLocation(location = {}) {
  const missing = [];
  if (!String(location.name || "").trim()) missing.push("name");
  if (!String(location.phone || "").trim()) missing.push("phone");
  if (!String(location.addressLine1 || "").trim()) missing.push("address");
  if (!String(location.city || "").trim()) missing.push("city");
  if (!String(location.state || "").trim()) missing.push("state");
  if (!String(location.pincode || "").trim()) missing.push("pincode");
  if (!String(location.country || "").trim()) missing.push("country");
  return missing;
}

function hasPinnedCoordinates(location = {}) {
  return Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
}

function getPickupLocationMapCoordinates(location = {}) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return {
    lat: Number.isFinite(latitude) ? latitude : 13.0827,
    lng: Number.isFinite(longitude) ? longitude : 80.2707,
  };
}

const defaultForm = {
  companyName: "",
  shopName: "",
  storeSlug: "",
  storeDescription: "",
  supportEmail: "",
  supportPhone: "",
  logoUrl: "",
  bannerUrl: "",
  storeThemeColor: "#0f766e",
  storeCategoriesText: "",
  storeSeo: {
    metaTitle: "",
    metaDescription: "",
    metaKeywords: [],
    ogImage: "",
  },
  storeAbout: {
    missionTitle: "",
    missionText: "",
    visionTitle: "",
    visionText: "",
    valueTitle: "",
    valueText: "",
  },
  payoutSchedule: "weekly",
  defaultCourier: "",
  lowStockThreshold: 10,
  address: "",
  notificationPreferences: {
    emailOrders: true,
    emailPayouts: true,
    pushOrders: true,
    pushSystem: true,
  },
  pickupAddress: {
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    latitude: "",
    longitude: "",
  },
  pickupLocations: [createEmptyPickupLocation(true)],
  shippingSettings: {
    allowedShippingModes: ["SELF", "PLATFORM"],
    effectiveShippingModes: ["SELF", "PLATFORM"],
    defaultShippingMode: "SELF",
    preferredPickupLocation: "Primary",
  },
  adminShippingModes: {
    selfShipping: true,
    platformShipping: true,
  },
};

export function VendorSettingsPage() {
  const nav = useNavigate();
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { categories = [] } = useCategories();
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState("");
  const [mapEditorIndex, setMapEditorIndex] = useState(0);
  const [mapLoadingIndex, setMapLoadingIndex] = useState(-1);
  const [deviceLocationIndex, setDeviceLocationIndex] = useState(-1);
  const categoryOptions = [
    ...new Set([
      ...categories.map((category) => category.name || category.title || category.label).filter(Boolean),
      ...(form.storeCategories || []),
    ]),
  ];

  useEffect(() => {
    vendorDashboardService
      .getVendorSettings()
      .then((response) => {
        const vendor = response.data;
        const pickupLocations = derivePickupLocations(vendor);
        const defaultPickupAddress = pickupLocations.find((location) => location.isDefault) || pickupLocations[0] || defaultForm.pickupAddress;
        const defaultIndex = Math.max(
          pickupLocations.findIndex((location) => location.isDefault),
          0
        );
        setForm({
          ...defaultForm,
          ...vendor,
          pickupAddress: defaultPickupAddress,
          pickupLocations,
          storeCategories: vendor.storeCategories || [],
          storeCategoriesText: (vendor.storeCategories || []).join(", "),
          notificationPreferences: {
            ...defaultForm.notificationPreferences,
            ...(vendor.notificationPreferences || {}),
          },
          storeAbout: {
            ...defaultForm.storeAbout,
            ...(vendor.storeAbout || {}),
          },
        });
        setMapEditorIndex(defaultIndex);
      })
      .catch((err) => setError(err?.response?.data?.message || "Failed to load settings."));
  }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function renderField(label, children, { hint = "", className = "" } = {}) {
    return (
      <label className={`grid gap-1.5 ${className}`}>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
        {children}
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </label>
    );
  }

  function selectedCategoriesFromEvent(event) {
    return Array.from(event.target.selectedOptions).map((option) => option.value);
  }

  async function handleStoreMediaUpload(field, context, file) {
    if (!file) return;
    setUploadingMedia(field);
    setError("");
    try {
      const response = await vendorDashboardService.uploadVendorStoreMedia(file, context);
      const uploaded = response?.data || response;
      setField(field, uploaded?.url || "");
      setMessage(`${context === "banner" ? "Banner" : "Logo"} uploaded. Save settings to publish it.`);
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to upload ${context === "banner" ? "banner" : "logo"}.`);
    } finally {
      setUploadingMedia("");
    }
  }

  function setPickupLocations(value) {
    setForm((current) => ({
      ...current,
      pickupLocations: typeof value === "function" ? value(current.pickupLocations || []) : value,
    }));
  }

  function updatePickupLocation(index, patch) {
    setPickupLocations((current) =>
      (current || []).map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        return typeof patch === "function" ? patch(entry) : { ...entry, ...patch };
      })
    );
  }

  async function reverseGeocodeWithGoogle({ lat, lng }) {
    if (typeof window === "undefined" || !window.google?.maps?.Geocoder) {
      return null;
    }

    const geocoder = new window.google.maps.Geocoder();
    const result = await geocoder.geocode({ location: { lat, lng } });
    const first = Array.isArray(result?.results) ? result.results[0] : null;
    if (!first) return null;

    const byType = (type) =>
      first.address_components?.find((component) => component.types?.includes(type))?.long_name || "";

    return {
      address: {
        addressLine1: [byType("street_number"), byType("route"), byType("sublocality_level_1")].filter(Boolean).join(", "),
        city: byType("locality") || byType("administrative_area_level_2"),
        state: byType("administrative_area_level_1"),
        pincode: byType("postal_code"),
        country: byType("country") || "India",
        latitude: lat,
        longitude: lng,
      },
    };
  }

  function applyResolvedPickupLocation(index, location) {
    updatePickupLocation(index, (current) => ({
      ...current,
      addressLine1: location?.address?.addressLine1 || location?.address?.addressLine || current.addressLine1,
      city: location?.address?.city || current.city,
      state: location?.address?.state || current.state,
      pincode: location?.address?.pincode || current.pincode,
      country: location?.address?.country || current.country || "India",
      latitude: location?.address?.latitude,
      longitude: location?.address?.longitude,
    }));
  }

  async function handlePickupMapLocationChange(index, { lat, lng }) {
    setMapLoadingIndex(index);
    try {
      const location =
        (mapsKey ? await reverseGeocodeWithGoogle({ lat, lng }) : null) ||
        (await reverseGeocodeCoordinates({ latitude: lat, longitude: lng }));
      applyResolvedPickupLocation(index, location);
    } catch (err) {
      setError(err?.message === "reverse_geocode_failed" ? "Unable to resolve that pin to an address right now." : "Unable to update pickup location from the map.");
    } finally {
      setMapLoadingIndex(-1);
    }
  }

  async function handleUseCurrentPickupLocation(index) {
    setDeviceLocationIndex(index);
    try {
      const location = await getCurrentLocationAddress();
      applyResolvedPickupLocation(index, location);
      setMapEditorIndex(index);
      setError("");
    } catch {
      setError("Unable to detect your current location. Please allow location access or place the pin manually.");
    } finally {
      setDeviceLocationIndex(-1);
    }
  }

  async function save() {
    try {
      const normalizedLocations = (form.pickupLocations || []).filter((location) =>
        Object.values(location || {}).some((value) => value === true || String(value || "").trim())
      );
      const safeLocations = normalizedLocations.length ? normalizedLocations : [createEmptyPickupLocation(true)];
      const defaultPickupAddress = safeLocations.find((location) => location.isDefault) || safeLocations[0];
      const response = await vendorDashboardService.updateVendorSettings({
        ...form,
        storeCategories: form.storeCategories || [],
        pickupLocations: safeLocations,
        pickupAddress: defaultPickupAddress,
      });
      const vendor = response?.data ?? response;
      const pickupLocations = derivePickupLocations(vendor);
      const nextPickupAddress = pickupLocations.find((location) => location.isDefault) || pickupLocations[0] || defaultForm.pickupAddress;
      const defaultIndex = Math.max(
        pickupLocations.findIndex((location) => location.isDefault),
        0
      );
      setForm({
        ...defaultForm,
        ...vendor,
        pickupAddress: nextPickupAddress,
        pickupLocations,
        storeCategories: vendor.storeCategories || [],
        storeCategoriesText: (vendor.storeCategories || []).join(", "),
        notificationPreferences: {
          ...defaultForm.notificationPreferences,
          ...(vendor.notificationPreferences || {}),
        },
        storeAbout: {
          ...defaultForm.storeAbout,
          ...(vendor.storeAbout || {}),
        },
      });
      setMapEditorIndex(defaultIndex);
      setMessage("Settings updated successfully.");
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save vendor settings.");
    }
  }

  return (
    <div className="grid gap-6">
      {(() => {
        const defaultPickupLocation = (form.pickupLocations || []).find((location) => location.isDefault) || form.pickupLocations?.[0] || form.pickupAddress;
        const missingFields = summarizePickupLocation(defaultPickupLocation);
        if (!missingFields.length) return null;
        return (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Default pickup location is incomplete. Missing: {missingFields.join(", ")}.
          </div>
        );
      })()}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <VendorSection title="Store Profile" description="Public storefront information for your vendor account.">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Vendor ID</div>
          <div className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{form.vendorCode || "Will be assigned automatically"}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {renderField("Company Name", <input value={form.companyName || ""} onChange={(e) => setField("companyName", e.target.value)} placeholder="Company name" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField(
            "Shop Display Name",
            <input value={form.shopName || ""} onChange={(e) => setField("shopName", e.target.value)} placeholder={form.companyName ? `Leave blank to use "${form.companyName}"` : "Shop display name"} className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />,
            { hint: "Defaults to company name if empty." }
          )}
          {renderField("Store Slug", <input value={form.storeSlug || ""} onChange={(e) => setField("storeSlug", e.target.value)} placeholder="Store slug" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField("Support Email", <input value={form.supportEmail || ""} onChange={(e) => setField("supportEmail", e.target.value)} placeholder="Support email" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField("Support Phone", <input value={form.supportPhone || ""} onChange={(e) => setField("supportPhone", e.target.value)} placeholder="Support phone" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField("Default Courier", <input value={form.defaultCourier || ""} onChange={(e) => setField("defaultCourier", e.target.value)} placeholder="Default courier" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}

          {renderField(
            "Logo Image",
            <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-900">
                  {form.logoUrl ? <img src={resolveApiAssetUrl(form.logoUrl)} alt="Store logo preview" className="h-full w-full object-contain" /> : "Logo"}
                </div>
                <input type="file" accept="image/*" onChange={(e) => handleStoreMediaUpload("logoUrl", "logo", e.target.files?.[0])} className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:file:bg-white dark:file:text-slate-950" />
              </div>
              <input value={form.logoUrl || ""} onChange={(e) => setField("logoUrl", e.target.value)} placeholder="Or paste logo URL" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
              {uploadingMedia === "logoUrl" ? <span className="text-xs text-slate-500">Uploading logo...</span> : null}
            </div>
          )}

          {renderField(
            "Banner Image",
            <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="aspect-[5/1] overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-900">
                {form.bannerUrl ? <img src={resolveApiAssetUrl(form.bannerUrl)} alt="Store banner preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center">Banner preview</div>}
              </div>
              <input type="file" accept="image/*" onChange={(e) => handleStoreMediaUpload("bannerUrl", "banner", e.target.files?.[0])} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:file:bg-white dark:file:text-slate-950" />
              <input value={form.bannerUrl || ""} onChange={(e) => setField("bannerUrl", e.target.value)} placeholder="Or paste banner URL" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
              {uploadingMedia === "bannerUrl" ? <span className="text-xs text-slate-500">Uploading banner...</span> : null}
            </div>
          )}

          {renderField("Store Theme Color", <input value={form.storeThemeColor || "#0f766e"} onChange={(e) => setField("storeThemeColor", e.target.value)} placeholder="#0f766e" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField(
            "Store Categories",
            <select multiple value={form.storeCategories || []} onChange={(e) => setField("storeCategories", selectedCategoriesFromEvent(e))} className="min-h-32 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>,
            { hint: "Hold Ctrl or Cmd to select multiple categories." }
          )}
          {renderField("About the Store", <textarea value={form.storeDescription || ""} onChange={(e) => setField("storeDescription", e.target.value)} placeholder="Write the About the Store description shown on your storefront" className="min-h-28 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />, { className: "md:col-span-2", hint: "This text appears in the About the Store section on your public storefront." })}
          <div className="md:col-span-2 grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">About Highlight Cards</h3>
              <p className="mt-1 text-xs text-slate-500">These three cards appear under About the Store.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {renderField("Mission Title", <input value={form.storeAbout?.missionTitle || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), missionTitle: e.target.value })} placeholder="Our Mission" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
              {renderField("Vision Title", <input value={form.storeAbout?.visionTitle || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), visionTitle: e.target.value })} placeholder="Our Vision" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
              {renderField("Value Title", <input value={form.storeAbout?.valueTitle || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), valueTitle: e.target.value })} placeholder="Our Value" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
              {renderField("Mission Text", <input value={form.storeAbout?.missionText || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), missionText: e.target.value })} placeholder="Quality Products" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
              {renderField("Vision Text", <input value={form.storeAbout?.visionText || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), visionText: e.target.value })} placeholder="Customer Delight" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
              {renderField("Value Text", <input value={form.storeAbout?.valueText || ""} onChange={(e) => setField("storeAbout", { ...(form.storeAbout || {}), valueText: e.target.value })} placeholder="Trust & Transparency" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
            </div>
          </div>
          {renderField("SEO Meta Title", <input value={form.storeSeo?.metaTitle || ""} onChange={(e) => setField("storeSeo", { ...(form.storeSeo || {}), metaTitle: e.target.value })} placeholder="SEO meta title" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField("Open Graph Image URL", <input value={form.storeSeo?.ogImage || ""} onChange={(e) => setField("storeSeo", { ...(form.storeSeo || {}), ogImage: e.target.value })} placeholder="Open Graph image URL" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />)}
          {renderField("SEO Meta Description", <textarea value={form.storeSeo?.metaDescription || ""} onChange={(e) => setField("storeSeo", { ...(form.storeSeo || {}), metaDescription: e.target.value })} placeholder="SEO meta description" className="min-h-20 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />, { className: "md:col-span-2" })}
          {renderField("Business Address", <textarea value={form.address || ""} onChange={(e) => setField("address", e.target.value)} placeholder="Business address" className="min-h-24 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />, { className: "md:col-span-2" })}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          Direct contact, external website, WhatsApp, email, phone, and social contacts are not shown on public store pages. Customers purchase only through marketplace cart and checkout.
        </div>
      </VendorSection>

      <VendorSection title="Payout & Alerts" description="Banking details, payout schedule, and vendor notification policy.">
        <div className="grid gap-4 md:grid-cols-2">
          <select value={form.payoutSchedule || "weekly"} onChange={(e) => setField("payoutSchedule", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input value={form.lowStockThreshold || 10} onChange={(e) => setField("lowStockThreshold", Number(e.target.value))} type="number" min="0" placeholder="Low stock threshold" className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Payout Account Details</h3>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 dark:border-blue-900 dark:bg-blue-950">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Manage your bank and payout account details in the{" "}
              <button
                type="button"
                onClick={() => nav("/vendor/finance/account")}
                className="font-semibold underline hover:text-blue-700 dark:hover:text-blue-300"
              >
                Finance → Payout Account
              </button>{" "}
              section. All payout account changes are verified by our finance team before processing withdrawals.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">Role & Security</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">JWT-protected seller workspace with ownership enforcement on products, orders, payouts, and support data.</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Object.entries(form.notificationPreferences || {}).map(([key, value]) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) =>
                  setField("notificationPreferences", {
                    ...form.notificationPreferences,
                    [key]: event.target.checked,
                  })
                }
              />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </VendorSection>

      <VendorSection title="Shipping Settings" description="Choose your default fulfillment mode from the options enabled by admin.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Available modes</div>
            <div className="mt-3 grid gap-3">
              {[
                { key: "SELF", label: "Self Shipping", adminEnabled: form.adminShippingModes?.selfShipping },
                { key: "PLATFORM", label: "Platform Shipping", adminEnabled: form.adminShippingModes?.platformShipping },
              ].map((mode) => {
                const checked = (form.shippingSettings?.allowedShippingModes || []).includes(mode.key);
                return (
                  <label key={mode.key} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${mode.adminEnabled ? "border-slate-200 dark:border-slate-700" : "border-slate-100 opacity-60 dark:border-slate-800"}`}>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{mode.label}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {mode.adminEnabled ? "Enabled by admin" : "Disabled by admin"}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!mode.adminEnabled}
                      onChange={(event) => {
                        const current = new Set(form.shippingSettings?.allowedShippingModes || []);
                        if (event.target.checked) current.add(mode.key);
                        else current.delete(mode.key);
                        setField("shippingSettings", {
                          ...form.shippingSettings,
                          allowedShippingModes: Array.from(current),
                          defaultShippingMode: current.has(form.shippingSettings?.defaultShippingMode)
                            ? form.shippingSettings.defaultShippingMode
                            : Array.from(current)[0] || "",
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4">
            <select
              value={form.shippingSettings?.defaultShippingMode || "SELF"}
              onChange={(e) => setField("shippingSettings", { ...form.shippingSettings, defaultShippingMode: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
            >
              {(form.shippingSettings?.allowedShippingModes || []).map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "SELF" ? "Self Shipping" : "Platform Shipping"}
                </option>
              ))}
            </select>
            <input
              value={form.shippingSettings?.preferredPickupLocation || "Primary"}
              onChange={(e) => setField("shippingSettings", { ...form.shippingSettings, preferredPickupLocation: e.target.value })}
              placeholder="Preferred pickup location"
              className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Orders default to your selected mode, and each order is still enforced against the current admin-enabled marketplace modes.
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(form.pickupLocations || []).map((location, index) => {
            const missing = summarizePickupLocation(location);
            return (
              <div key={`pickup-location-${index}`} className="md:col-span-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">
                      Pickup Location {index + 1} {location.isDefault ? "(Default)" : ""}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {missing.length ? `Missing: ${missing.join(", ")}` : "Ready for platform pickup requests"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPickupLocations((current) =>
                          (current || []).map((entry, entryIndex) => ({
                            ...entry,
                            isDefault: entryIndex === index,
                          }))
                        )
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Set Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapEditorIndex((current) => (current === index ? -1 : index))}
                      className="rounded-xl border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700"
                    >
                      {mapEditorIndex === index ? "Hide Map" : "Open Map"}
                    </button>
                    {(form.pickupLocations || []).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = (form.pickupLocations || []).filter((_, entryIndex) => entryIndex !== index);
                          const normalized = remaining.some((entry) => entry.isDefault)
                            ? remaining
                            : remaining.map((entry, entryIndex) => ({ ...entry, isDefault: entryIndex === 0 }));
                          setPickupLocations(normalized);
                          setMapEditorIndex((current) => {
                            if (current === index) return normalized.length ? Math.min(index, normalized.length - 1) : -1;
                            if (current > index) return current - 1;
                            return current;
                          });
                        }}
                        className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    value={location.name || ""}
                    onChange={(e) => updatePickupLocation(index, { name: e.target.value })}
                    placeholder="Pickup contact / warehouse name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.phone || ""}
                    onChange={(e) => updatePickupLocation(index, { phone: e.target.value })}
                    placeholder="Pickup phone"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.addressLine1 || ""}
                    onChange={(e) => updatePickupLocation(index, { addressLine1: e.target.value })}
                    placeholder="Pickup address line 1"
                    className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.addressLine2 || ""}
                    onChange={(e) => updatePickupLocation(index, { addressLine2: e.target.value })}
                    placeholder="Pickup address line 2"
                    className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.city || ""}
                    onChange={(e) => updatePickupLocation(index, { city: e.target.value })}
                    placeholder="Pickup city"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.state || ""}
                    onChange={(e) => updatePickupLocation(index, { state: e.target.value })}
                    placeholder="Pickup state"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.pincode || ""}
                    onChange={(e) => updatePickupLocation(index, { pincode: e.target.value })}
                    placeholder="Pickup pincode"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={location.country || "India"}
                    onChange={(e) => updatePickupLocation(index, { country: e.target.value })}
                    placeholder="Pickup country"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">Exact Pickup Pin</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {hasPinnedCoordinates(location)
                            ? `Pinned at ${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
                            : "No exact map pin selected yet. Add one for faster pickup routing."}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUseCurrentPickupLocation(index)}
                        disabled={deviceLocationIndex === index}
                        className="rounded-xl border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deviceLocationIndex === index ? "Detecting..." : "Use Current Location"}
                      </button>
                    </div>
                    {mapLoadingIndex === index ? (
                      <div className="mt-3 text-xs font-medium text-sky-700">Resolving the pinned location...</div>
                    ) : null}
                    {mapEditorIndex === index ? (
                      <div className="mt-4">
                        {mapsKey ? (
                          <LocationPickerMap
                            apiKey={mapsKey}
                            lat={getPickupLocationMapCoordinates(location).lat}
                            lng={getPickupLocationMapCoordinates(location).lng}
                            onChange={(coords) => handlePickupMapLocationChange(index, coords)}
                          />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                            Add <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in <code className="font-mono">frontend/.env</code> to enable the draggable pickup pin.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                const nextLocations = [...(form.pickupLocations || []), createEmptyPickupLocation(false)];
                setPickupLocations(nextLocations);
                setMapEditorIndex(nextLocations.length - 1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Add Pickup Location
            </button>
          </div>
        </div>
      </VendorSection>

      <div>
        <button onClick={save} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
          Save Settings
        </button>
      </div>
    </div>
  );
}
