import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Copy,
  History,
  Layers,
  Monitor,
  Palette,
  Play,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from "lucide-react";
import { GlobalThemeEditor, ThemePreviewPanel } from "../components/admin/theme-engine/ThemeBuilderPanels";
import { applyPreviewTheme } from "../theme/themeRenderer";
import { createEmptyThemeForm } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import {
  createTheme,
  createThemeFromPreset,
  deleteTheme,
  duplicateTheme,
  getTheme,
  getThemeVersions,
  listThemes,
  notifyThemeUpdated,
  publishTheme,
  rollbackTheme,
  scheduleTheme,
  updateTheme,
} from "../services/themeEngineService";

const TABS = [
  { id: "library", label: "Theme Library", icon: Palette },
  { id: "builder", label: "Theme Builder", icon: Layers },
  { id: "layers", label: "Page & Component Layers", icon: Layers },
  { id: "preview", label: "Live Preview", icon: Monitor },
  { id: "schedule", label: "Scheduler", icon: Calendar },
  { id: "history", label: "Version History", icon: History },
];

const BREAKPOINTS = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

const LAYER_GROUPS = [
  { key: "pageThemes", label: "Page Themes", optionsKey: "pages" },
  { key: "sectionThemes", label: "Section Themes", optionsKey: "sections" },
  { key: "componentThemes", label: "Component Themes", optionsKey: "components" },
];

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Theme operation failed.";
}

export function AdminThemeEnginePage() {
  const { reload: reloadPublicTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("library");
  const [breakpoint, setBreakpoint] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [themes, setThemes] = useState([]);
  const [presets, setPresets] = useState([]);
  const [registry, setRegistry] = useState({ pages: [], sections: [], components: [] });
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(createEmptyThemeForm());
  const [versions, setVersions] = useState([]);
  const [layerSelection, setLayerSelection] = useState({ group: "pageThemes", key: "homepage" });

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listThemes();
      setThemes(data.themes || []);
      setPresets(data.presets || []);
      setRegistry(data.registry || { pages: [], sections: [], components: [] });
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTheme = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [themeData, versionData] = await Promise.all([getTheme(id), getThemeVersions(id)]);
      setSelectedId(id);
      setForm({
        name: themeData.name || "",
        description: themeData.description || "",
        themeType: themeData.themeType || "custom",
        status: themeData.status || "draft",
        globalTheme: themeData.globalTheme || createEmptyThemeForm().globalTheme,
        pageThemes: themeData.pageThemes || {},
        sectionThemes: themeData.sectionThemes || {},
        componentThemes: themeData.componentThemes || {},
        mobileTheme: themeData.mobileTheme || {},
        tabletTheme: themeData.tabletTheme || {},
        desktopTheme: themeData.desktopTheme || {},
        schedule: {
          enabled: Boolean(themeData.schedule?.enabled),
          startAt: themeData.schedule?.startAt ? themeData.schedule.startAt.slice(0, 16) : "",
          endAt: themeData.schedule?.endAt ? themeData.schedule.endAt.slice(0, 16) : "",
          timezone: themeData.schedule?.timezone || "UTC",
        },
      });
      setVersions(versionData.versions || []);
      applyPreviewTheme(themeData.globalTheme || createEmptyThemeForm().globalTheme);
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary().catch(() => {});
  }, [loadLibrary]);

  useEffect(() => {
    return () => {
      reloadPublicTheme().catch(() => {});
    };
  }, [reloadPublicTheme]);

  const layerOptions = useMemo(() => {
    const group = LAYER_GROUPS.find((item) => item.key === layerSelection.group);
    return registry[group?.optionsKey] || [];
  }, [layerSelection.group, registry]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name,
        description: form.description,
        themeType: form.themeType,
        status: form.status,
        globalTheme: form.globalTheme,
        pageThemes: form.pageThemes,
        sectionThemes: form.sectionThemes,
        componentThemes: form.componentThemes,
        mobileTheme: form.mobileTheme,
        tabletTheme: form.tabletTheme,
        desktopTheme: form.desktopTheme,
        schedule: form.schedule,
      };

      const saved = selectedId
        ? await updateTheme(selectedId, payload)
        : await createTheme(payload);

      setSelectedId(saved._id);
      setMessage(selectedId ? "Theme saved." : "Theme created.");
      await loadLibrary();
      if (saved._id) {
        const versionData = await getThemeVersions(saved._id);
        setVersions(versionData.versions || []);
      }
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await publishTheme(selectedId);
      setMessage("Theme published and activated.");
      notifyThemeUpdated();
      await reloadPublicTheme();
      await loadLibrary();
      await loadTheme(selectedId);
    } catch (publishError) {
      setError(normalizeError(publishError));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id = selectedId) => {
    if (!id) return;
    setSaving(true);
    try {
      const copy = await duplicateTheme(id);
      setMessage("Theme duplicated.");
      await loadLibrary();
      await loadTheme(copy._id);
      setActiveTab("builder");
    } catch (duplicateError) {
      setError(normalizeError(duplicateError));
    } finally {
      setSaving(false);
    }
  };

  const handlePresetCreate = async (presetKey) => {
    setSaving(true);
    try {
      const created = await createThemeFromPreset(presetKey);
      setMessage("Preset theme created.");
      await loadLibrary();
      await loadTheme(created._id);
      setActiveTab("builder");
    } catch (presetError) {
      setError(normalizeError(presetError));
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await scheduleTheme(selectedId, {
        enabled: form.schedule.enabled,
        startAt: form.schedule.startAt || null,
        endAt: form.schedule.endAt || null,
        timezone: form.schedule.timezone,
      });
      setMessage("Theme schedule saved.");
      await loadTheme(selectedId);
    } catch (scheduleError) {
      setError(normalizeError(scheduleError));
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionId) => {
    if (!selectedId || !versionId) return;
    setSaving(true);
    try {
      await rollbackTheme(selectedId, versionId);
      setMessage("Theme rolled back.");
      notifyThemeUpdated();
      await reloadPublicTheme();
      await loadTheme(selectedId);
    } catch (rollbackError) {
      setError(normalizeError(rollbackError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await deleteTheme(id);
      setMessage("Theme deleted.");
      if (selectedId === id) {
        setSelectedId("");
        setForm(createEmptyThemeForm());
      }
      await loadLibrary();
    } catch (deleteError) {
      setError(normalizeError(deleteError));
    } finally {
      setSaving(false);
    }
  };

  const previewTheme = form.globalTheme;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-orange-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Theme Engine</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Platform Theme Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Customize global design tokens, page layers, sections, and components with live preview. Publish instantly without redeploying.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedId("");
                setForm(createEmptyThemeForm());
                setActiveTab("builder");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              <Plus className="h-4 w-4" />
              New Theme
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Theme"}
            </button>
            <button
              type="button"
              disabled={!selectedId || saving}
              onClick={handlePublish}
              className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Publish
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "library" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Saved Themes</h2>
              <div className="mt-4 space-y-3">
                {loading ? <p className="text-sm text-slate-500">Loading themes...</p> : null}
                {!loading && themes.length === 0 ? <p className="text-sm text-slate-500">No themes yet. Create one from a preset or start blank.</p> : null}
                {themes.map((theme) => (
                  <div key={theme._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{theme.name}</p>
                        {theme.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span> : null}
                        {theme.isDefault ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Default</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {theme.themeType} · v{theme.version} · {theme.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { loadTheme(theme._id); setActiveTab("builder"); }} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDuplicate(theme._id)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        <Copy className="mr-1 inline h-3 w-3" />
                        Duplicate
                      </button>
                      {!theme.isActive && !theme.isDefault ? (
                        <button type="button" onClick={() => handleDelete(theme._id)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">
                          <Trash2 className="mr-1 inline h-3 w-3" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Preset Library</h2>
            <p className="mt-1 text-sm text-slate-500">Start from enterprise-ready themes.</p>
            <div className="mt-4 grid gap-3">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handlePresetCreate(preset.key)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-orange-300 hover:bg-orange-50"
                >
                  <p className="font-semibold text-slate-900">{preset.name}</p>
                  <p className="text-xs text-slate-500">{preset.themeType}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "builder" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Theme Details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Theme Name</span>
                  <input className={INPUT_CLASS} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Description</span>
                  <textarea className={INPUT_CLASS} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </label>
              </div>
            </div>
            <GlobalThemeEditor
              globalTheme={form.globalTheme}
              onChange={(nextGlobalTheme) => setForm((current) => ({ ...current, globalTheme: nextGlobalTheme }))}
              onPreview={applyPreviewTheme}
            />
          </div>
          <ThemePreviewPanel theme={previewTheme} breakpoint={breakpoint} />
        </div>
      ) : null}

      {activeTab === "layers" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Layer Target</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Layer Group</span>
                <select
                  className={INPUT_CLASS}
                  value={layerSelection.group}
                  onChange={(event) => setLayerSelection((current) => ({ ...current, group: event.target.value, key: "" }))}
                >
                  {LAYER_GROUPS.map((group) => (
                    <option key={group.key} value={group.key}>{group.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Target</span>
                <select
                  className={INPUT_CLASS}
                  value={layerSelection.key}
                  onChange={(event) => setLayerSelection((current) => ({ ...current, key: event.target.value }))}
                >
                  <option value="">Select target</option>
                  {layerOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {layerSelection.key ? (
            <GlobalThemeEditor
              globalTheme={form[layerSelection.group]?.[layerSelection.key] || {}}
              onChange={(nextLayerTheme) =>
                setForm((current) => ({
                  ...current,
                  [layerSelection.group]: {
                    ...(current[layerSelection.group] || {}),
                    [layerSelection.key]: nextLayerTheme,
                  },
                }))
              }
              onPreview={(nextLayerTheme) =>
                applyPreviewTheme({
                  ...form.globalTheme,
                  ...nextLayerTheme,
                })
              }
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
              Select a page, section, or component to customize its theme layer.
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "preview" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {BREAKPOINTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBreakpoint(item.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    breakpoint === item.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <ThemePreviewPanel theme={previewTheme} breakpoint={breakpoint} />
        </div>
      ) : null}

      {activeTab === "schedule" ? (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Theme Scheduler</h2>
          <p className="mt-1 text-sm text-slate-500">Schedule festival, sale, or launch themes to activate automatically.</p>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.schedule.enabled}
                onChange={(event) => setForm((current) => ({ ...current, schedule: { ...current.schedule, enabled: event.target.checked } }))}
              />
              Enable scheduled activation
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Start</span>
              <input type="datetime-local" className={INPUT_CLASS} value={form.schedule.startAt} onChange={(event) => setForm((current) => ({ ...current, schedule: { ...current.schedule, startAt: event.target.value } }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">End</span>
              <input type="datetime-local" className={INPUT_CLASS} value={form.schedule.endAt} onChange={(event) => setForm((current) => ({ ...current, schedule: { ...current.schedule, endAt: event.target.value } }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Timezone</span>
              <input className={INPUT_CLASS} value={form.schedule.timezone} onChange={(event) => setForm((current) => ({ ...current, schedule: { ...current.schedule, timezone: event.target.value } }))} />
            </label>
            <button type="button" disabled={!selectedId || saving} onClick={handleScheduleSave} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Play className="h-4 w-4" />
              Save Schedule
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Version History</h2>
          {!selectedId ? <p className="mt-3 text-sm text-slate-500">Select a theme to view version history.</p> : null}
          <div className="mt-4 space-y-3">
            {versions.map((version) => (
              <div key={version._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-semibold text-slate-900">Version {version.versionNumber}</p>
                  <p className="text-xs text-slate-500">
                    {version.changeType} · {version.changedBy || "system"} · {version.changedAt ? new Date(version.changedAt).toLocaleString() : ""}
                  </p>
                </div>
                {version.rollbackAvailable ? (
                  <button type="button" onClick={() => handleRollback(version._id)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Rollback
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
