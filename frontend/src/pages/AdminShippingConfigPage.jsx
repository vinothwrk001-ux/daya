import { useCallback, useEffect, useMemo, useState } from "react";
import { BackButton } from "../components/BackButton";
import { adminHttp } from "../services/adminHttp";

const ZONES = [
  { id: "LOCAL", label: "Local", description: "Same-city delivery" },
  { id: "REGIONAL", label: "Regional", description: "Nearby districts or standard service area" },
  { id: "REMOTE", label: "Remote", description: "Far or difficult-to-serve areas" },
];

function normalizeError(err) {
  const issues = err?.response?.data?.details?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map((issue) => issue.message).join(", ");
  }
  return err?.response?.data?.message || err?.message || "Request failed";
}

function parseMultilineList(value = "") {
  return Array.from(
    new Set(
      String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatMultilineList(values = []) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function formatKg(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.000";
  }
  return numericValue.toFixed(3);
}

function createRuleForm(defaultState = "Tamil Nadu") {
  return {
    state: defaultState,
    zone: "LOCAL",
    baseWeight: "",
    basePrice: "",
    pricePerKg: "",
    minWeight: "",
    maxWeight: "",
    freeShippingThreshold: "",
    minOrderValue: "",
    isActive: true,
    notes: "",
  };
}

function createRowId() {
  return `shipping-state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocationState(stateName = "Tamil Nadu") {
  return {
    id: createRowId(),
    state: stateName,
    defaultZone: "REGIONAL",
    zones: {
      LOCAL: { citiesText: "", districtsText: "", pincodesText: "" },
      REGIONAL: { citiesText: "", districtsText: "", pincodesText: "" },
      REMOTE: { citiesText: "", districtsText: "", pincodesText: "" },
    },
  };
}

function normalizeLocationStateForForm(entry = {}) {
  const base = createLocationState(entry.state || "Tamil Nadu");
  return {
    id: entry.id || base.id,
    state: entry.state || base.state,
    defaultZone: entry.defaultZone || base.defaultZone,
    zones: Object.fromEntries(
      ZONES.map(({ id }) => [
        id,
        {
          citiesText: formatMultilineList(entry.zones?.[id]?.cities || []),
          districtsText: formatMultilineList(entry.zones?.[id]?.districts || []),
          pincodesText: formatMultilineList(entry.zones?.[id]?.pincodes || []),
        },
      ])
    ),
  };
}

export function AdminShippingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [savingLocations, setSavingLocations] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState(null);
  const [availableStates, setAvailableStates] = useState(["Tamil Nadu"]);
  const [locationStates, setLocationStates] = useState([createLocationState()]);
  const [showForm, setShowForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [formData, setFormData] = useState(createRuleForm());
  const [previewWeight, setPreviewWeight] = useState("");
  const [previewResult, setPreviewResult] = useState(null);

  const stateOptions = useMemo(() => {
    const names = [
      ...availableStates,
      ...locationStates.map((entry) => entry.state),
      formData.state,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [availableStates, locationStates, formData.state]);

  const loadRules = useCallback(async () => {
    const res = await adminHttp.get("/api/admin/shipping-config");
    setRules(Array.isArray(res.data?.data?.data) ? res.data.data.data : []);
  }, []);

  const loadStatistics = useCallback(async () => {
    const res = await adminHttp.get("/api/admin/shipping-config/statistics");
    setStats(res.data?.data || null);
  }, []);

  const loadOptions = useCallback(async () => {
    const res = await adminHttp.get("/api/admin/shipping-config/options");
    setAvailableStates(res.data?.data?.states?.length ? res.data.data.states : ["Tamil Nadu"]);
  }, []);

  const loadLocationConfig = useCallback(async () => {
    const res = await adminHttp.get("/api/admin/shipping-config/location-config");
    const states = Array.isArray(res.data?.data?.states) ? res.data.data.states : [];
    setLocationStates(states.length ? states.map(normalizeLocationStateForForm) : [createLocationState()]);
  }, []);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadRules(), loadStatistics(), loadOptions(), loadLocationConfig()]);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  }, [loadLocationConfig, loadOptions, loadRules, loadStatistics]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  function resetForm() {
    setFormData(createRuleForm(stateOptions[0] || "Tamil Nadu"));
    setEditingRuleId(null);
    setShowForm(false);
  }

  function handleEditRule(rule) {
    setFormData({
      state: rule.state,
      zone: rule.zone,
      baseWeight: String(Number(rule.baseWeight || 0)),
      basePrice: String(Number(rule.basePrice || 0)),
      pricePerKg: String(Number(rule.pricePerKg || 0)),
      minWeight: String(Number(rule.minWeight || 0)),
      maxWeight: String(Number(rule.maxWeight || 0)),
      freeShippingThreshold: String(Number(rule.freeShippingThreshold || 0)),
      minOrderValue: String(Number(rule.minOrderValue || 0)),
      isActive: Boolean(rule.isActive),
      notes: rule.notes || "",
    });
    setEditingRuleId(rule._id);
    setShowForm(true);
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSaveRule() {
    try {
      setSavingRule(true);
      setError("");
      setSuccess("");

      const payload = {
        state: String(formData.state || "").trim(),
        zone: formData.zone,
        baseWeight: Number(formData.baseWeight),
        basePrice: Number(formData.basePrice),
        pricePerKg: Number(formData.pricePerKg),
        minWeight: Number(formData.minWeight),
        maxWeight: Number(formData.maxWeight),
        freeShippingThreshold: formData.freeShippingThreshold ? Number(formData.freeShippingThreshold) : 0,
        minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : 0,
        isActive: Boolean(formData.isActive),
        notes: String(formData.notes || "").trim(),
      };

      if (!payload.state) {
        throw new Error("State is required");
      }
      if (!Number.isFinite(payload.baseWeight) || payload.baseWeight < 0) {
        throw new Error("Base weight must be a valid number");
      }
      if (!Number.isFinite(payload.basePrice) || payload.basePrice < 0) {
        throw new Error("Base price must be a valid number");
      }
      if (!Number.isFinite(payload.pricePerKg) || payload.pricePerKg < 0) {
        throw new Error("Price per kg must be a valid number");
      }
      if (!Number.isFinite(payload.minWeight) || payload.minWeight < 0.001) {
        throw new Error("Min weight must be at least 0.001");
      }
      if (!Number.isFinite(payload.maxWeight) || payload.maxWeight < 0.001) {
        throw new Error("Max weight must be at least 0.001");
      }
      if (payload.minWeight >= payload.maxWeight) {
        throw new Error("Min weight must be less than max weight");
      }
      if (payload.baseWeight > payload.maxWeight) {
        throw new Error("Base weight must not exceed max weight");
      }

      if (editingRuleId) {
        await adminHttp.put(`/api/admin/shipping-config/${editingRuleId}`, payload);
        setSuccess("Shipping rule updated successfully.");
      } else {
        await adminHttp.post("/api/admin/shipping-config", payload);
        setSuccess("Shipping rule created successfully.");
      }

      resetForm();
      await Promise.all([loadRules(), loadStatistics(), loadOptions()]);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!window.confirm("Delete this shipping rule?")) return;

    try {
      setSavingRule(true);
      setError("");
      setSuccess("");
      await adminHttp.delete(`/api/admin/shipping-config/${ruleId}`);
      setSuccess("Shipping rule deleted successfully.");
      await Promise.all([loadRules(), loadStatistics()]);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setSavingRule(false);
    }
  }

  async function handlePreviewShipping() {
    if (!previewWeight) {
      setError("Enter a weight to preview shipping.");
      return;
    }

    try {
      setError("");
      const res = await adminHttp.post("/api/admin/shipping-config/calculate-preview", {
        weight: Number(previewWeight),
        state: formData.state || stateOptions[0] || "Tamil Nadu",
      });
      setPreviewResult(res.data?.data || null);
    } catch (e) {
      setError(normalizeError(e));
    }
  }

  function updateLocationState(index, patch) {
    setLocationStates((prev) =>
      prev.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
    );
  }

  function updateLocationZoneField(index, zone, field, value) {
    setLocationStates((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              zones: {
                ...entry.zones,
                [zone]: {
                  ...entry.zones[zone],
                  [field]: value,
                },
              },
            }
          : entry
      )
    );
  }

  function addLocationState() {
    setLocationStates((prev) => [...prev, createLocationState("")]);
  }

  function removeLocationState(index) {
    setLocationStates((prev) => (prev.length > 1 ? prev.filter((_, entryIndex) => entryIndex !== index) : prev));
  }

  async function saveLocationConfig() {
    try {
      setSavingLocations(true);
      setError("");
      setSuccess("");

      const payload = {
        states: locationStates.map((entry) => ({
          state: String(entry.state || "").trim(),
          defaultZone: entry.defaultZone,
          zones: Object.fromEntries(
            ZONES.map(({ id }) => [
              id,
              {
                cities: parseMultilineList(entry.zones?.[id]?.citiesText),
                districts: parseMultilineList(entry.zones?.[id]?.districtsText),
                pincodes: parseMultilineList(entry.zones?.[id]?.pincodesText),
              },
            ])
          ),
        })),
      };

      await adminHttp.put("/api/admin/shipping-config/location-config", payload);
      setSuccess("Shipping location mapping updated successfully.");
      await Promise.all([loadLocationConfig(), loadOptions()]);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setSavingLocations(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <BackButton />

        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Shipping Configuration</h1>
              <p className="mt-1 text-gray-600">
                Manage weight-based shipping rules and admin-configurable zone mapping.
              </p>
            </div>
            <button
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              {showForm ? "Cancel" : "+ Add Shipping Rule"}
            </button>
          </div>

          {stats ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Total Rules</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRules}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Active Rules</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeRules}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">States Covered</p>
                <p className="text-2xl font-bold text-gray-900">{stats.coverage?.states || 0}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Zones Covered</p>
                <p className="text-2xl font-bold text-gray-900">{stats.coverage?.zones || 0}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>
          ) : null}

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Zone Resolution Matrix</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Map cities, districts, and pincodes to LOCAL, REGIONAL, and REMOTE zones without hardcoded logic.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addLocationState}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Add State
                </button>
                <button
                  type="button"
                  onClick={saveLocationConfig}
                  disabled={savingLocations}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingLocations ? "Saving..." : "Save Zone Mapping"}
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {locationStates.map((entry, index) => (
                <div key={entry.id} className="rounded-2xl border border-gray-200 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        value={entry.state}
                        onChange={(event) => updateLocationState(index, { state: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Tamil Nadu"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Default Zone</label>
                      <select
                        value={entry.defaultZone}
                        onChange={(event) => updateLocationState(index, { defaultZone: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      >
                        {ZONES.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLocationState(index)}
                      disabled={locationStates.length === 1}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    {ZONES.map((zone) => (
                      <div key={zone.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3">
                          <div className="font-semibold text-slate-950">{zone.label}</div>
                          <div className="text-xs text-slate-500">{zone.description}</div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                              Cities
                            </label>
                            <textarea
                              rows="4"
                              value={entry.zones?.[zone.id]?.citiesText || ""}
                              onChange={(event) => updateLocationZoneField(index, zone.id, "citiesText", event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="One city per line"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                              Districts
                            </label>
                            <textarea
                              rows="4"
                              value={entry.zones?.[zone.id]?.districtsText || ""}
                              onChange={(event) => updateLocationZoneField(index, zone.id, "districtsText", event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="One district per line"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                              Pincodes
                            </label>
                            <textarea
                              rows="4"
                              value={entry.zones?.[zone.id]?.pincodesText || ""}
                              onChange={(event) => updateLocationZoneField(index, zone.id, "pincodesText", event.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              placeholder="One pincode per line"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {showForm ? (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRuleId ? "Edit Shipping Rule" : "Create Shipping Rule"}
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">State *</label>
                  <input
                    name="state"
                    list="shipping-states"
                    value={formData.state}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Tamil Nadu"
                  />
                  <datalist id="shipping-states">
                    {stateOptions.map((stateName) => (
                      <option key={stateName} value={stateName} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Zone *</label>
                  <select
                    name="zone"
                    value={formData.zone}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {ZONES.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Base Weight (kg) *</label>
                  <input
                    type="number"
                    name="baseWeight"
                    value={formData.baseWeight}
                    onChange={handleFormChange}
                    step="0.001"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Base Price (Rs.) *</label>
                  <input
                    type="number"
                    name="basePrice"
                    value={formData.basePrice}
                    onChange={handleFormChange}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Price Per Kg (Rs.) *</label>
                  <input
                    type="number"
                    name="pricePerKg"
                    value={formData.pricePerKg}
                    onChange={handleFormChange}
                    step="0.1"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Weight (kg) *</label>
                  <input
                    type="number"
                    name="minWeight"
                    value={formData.minWeight}
                    onChange={handleFormChange}
                    step="0.001"
                    min="0.001"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Weight (kg) *</label>
                  <input
                    type="number"
                    name="maxWeight"
                    value={formData.maxWeight}
                    onChange={handleFormChange}
                    step="0.001"
                    min="0.001"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Free Shipping Threshold (Rs.)</label>
                  <input
                    type="number"
                    name="freeShippingThreshold"
                    value={formData.freeShippingThreshold}
                    onChange={handleFormChange}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Minimum Order Value (Rs.)</label>
                  <input
                    type="number"
                    name="minOrderValue"
                    value={formData.minOrderValue}
                    onChange={handleFormChange}
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  rows="3"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Optional admin notes"
                />
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleFormChange}
                />
                Rule is active
              </label>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveRule}
                  disabled={savingRule}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
                >
                  {savingRule ? "Saving..." : editingRuleId ? "Update Rule" : "Create Rule"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Preview Shipping Cost</h2>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="w-full md:max-w-xs">
                <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                <input
                  type="number"
                  value={previewWeight}
                  onChange={(event) => setPreviewWeight(event.target.value)}
                  step="0.001"
                  min="0.001"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="w-full md:max-w-xs">
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  value={formData.state}
                  onChange={(event) => setFormData((prev) => ({ ...prev, state: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <button
                type="button"
                onClick={handlePreviewShipping}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white"
              >
                Calculate
              </button>
            </div>

            {previewResult?.previews?.length ? (
              <div className="mt-6 space-y-3">
                {previewResult.previews.map((preview, index) => (
                  <div key={`${preview.zone}-${index}`} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-950">{preview.zone}</span>
                      <span className="font-bold text-green-700">Rs. {Number(preview.cost || 0).toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Base Rs. {Number(preview.breakdown?.basePrice || 0).toFixed(2)} for first{" "}
                      {formatKg(preview.breakdown?.baseWeight || 0)}kg, plus Rs.{" "}
                      {Number(preview.breakdown?.pricePerKg || 0).toFixed(2)} per extra kg.
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900">Shipping Rules</h2>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading shipping rules...</div>
            ) : rules.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No shipping rules configured yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">State</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Zone</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Weight Range</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Base Price</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Per Kg</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rules.map((rule) => (
                      <tr key={rule._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-800">{rule.state}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{rule.zone}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {formatKg(rule.minWeight)}kg - {formatKg(rule.maxWeight)}kg
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800">Rs. {Number(rule.basePrice).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">Rs. {Number(rule.pricePerKg).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {rule.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => handleEditRule(rule)}
                            className="mr-3 text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
