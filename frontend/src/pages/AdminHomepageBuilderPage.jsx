import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  History,
  LayoutDashboard,
  Loader2,
  Monitor,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from "lucide-react";
import { DynamicHomepageRenderer } from "../components/homepage/DynamicHomepageRenderer";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { hasStaffPermission } from "../utils/staffPermissions";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import {
  createHomepageBuilderLayout,
  deleteHomepageBuilderLayout,
  getHomepageBuilderLayout,
  listHomepageBuilderContainers,
  listHomepageBuilderLayouts,
  listHomepageBuilderVersions,
  previewHomepageBuilderLayout,
  publishHomepageBuilderLayout,
  rollbackHomepageBuilderVersion,
  saveHomepageBuilderDraft,
} from "../services/homepageBuilderService";

const DEVICE_CONFIG = {
  desktop: { label: "Desktop", icon: Monitor, width: 1440, columns: 12, canvasClass: "max-w-[1440px]" },
  tablet: { label: "Tablet", icon: Tablet, width: 768, columns: 6, canvasClass: "max-w-[768px]" },
  mobile: { label: "Mobile", icon: Smartphone, width: 375, columns: 1, canvasClass: "max-w-[375px]" },
};

const LAYOUT_TYPES = [
  "Hero Banner",
  "Featured Products",
  "Category Grid",
  "Product Carousel",
  "Collection Banner",
  "Deals Section",
  "Offer Banner",
  "Brand Showcase",
  "Video Banner",
  "Text Content",
  "Custom HTML",
  "Newsletter",
  "Vendor Showcase",
  "Multi Banner Grid",
  "Product Grid",
  "Product Slider",
  "Flash Sale",
  "Recently Viewed",
  "Recommended Products",
];

const PRESETS = [
  { id: "preset-12", label: "12", spans: [12], type: "Hero Banner" },
  { id: "preset-6-6", label: "6 + 6", spans: [6, 6], type: "Offer Banner" },
  { id: "preset-3-3-3-3", label: "3 + 3 + 3 + 3", spans: [3, 3, 3, 3], type: "Category Grid" },
  { id: "preset-6-3-3", label: "6 + 3 + 3", spans: [6, 3, 3], type: "Multi Banner Grid" },
  { id: "preset-8-4", label: "8 + 4", spans: [8, 4], type: "Collection Banner" },
  { id: "preset-4-4-4", label: "4 + 4 + 4", spans: [4, 4, 4], type: "Product Grid" },
  { id: "preset-9-3", label: "9 + 3", spans: [9, 3], type: "Hero Banner" },
  { id: "preset-3-9", label: "3 + 9", spans: [3, 9], type: "Brand Showcase" },
  { id: "preset-2x6", label: "2 + 2 + 2 + 2 + 2 + 2", spans: [2, 2, 2, 2, 2, 2], type: "Category Grid" },
  { id: "preset-custom", label: "Custom", spans: [12], type: "Custom HTML" },
];

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "SLIDER", label: "Hero" },
  { value: "BANNER", label: "Banner" },
  { value: "GRID", label: "Grid" },
  { value: "CAROUSEL", label: "Carousel" },
  { value: "FEATURED", label: "Featured" },
  { value: "FLASH_SALE", label: "Flash Sale" },
  { value: "RECOMMENDED", label: "Recommended" },
];

const PROPERTY_TABS = ["Layout", "Container", "SEO", "Visibility", "Animation", "Spacing", "Background", "Typography", "Advanced"];

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-800",
  scheduled: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
};
const INPUT_CLASS = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback = min) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
}

function createEmptyDraft(name = "Homepage Layout") {
  return {
    name,
    slug: slugify(name),
    seo: {
      metaTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      openGraphTitle: "",
      openGraphDescription: "",
      openGraphImage: "",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
      twitterCard: "summary_large_image",
      schemaMarkup: "",
    },
    visibility: {
      desktop: true,
      tablet: true,
      mobile: true,
      guest: true,
      customer: true,
      vendor: true,
      admin: true,
      country: "",
      language: "",
      currency: "",
    },
    scheduling: {
      status: "draft",
      publishDate: "",
      expiryDate: "",
    },
    typography: {
      headingFont: "",
      bodyFont: "",
      textScale: 100,
    },
    notes: "",
    builder: {
      mode: "responsive-grid",
      grid: { desktop: 12, tablet: 6, mobile: 1 },
      canvas: {
        desktop: { width: DEVICE_CONFIG.desktop.width },
        tablet: { width: DEVICE_CONFIG.tablet.width },
        mobile: { width: DEVICE_CONFIG.mobile.width },
      },
    },
    layouts: [],
    rows: [],
    auditLog: [],
  };
}

function normalizeDeviceConfig(value = {}, device = "desktop", desktopSpan = 12) {
  const columns = DEVICE_CONFIG[device].columns;
  const fallbackSpan = device === "mobile" ? 1 : Math.min(columns, desktopSpan);
  return {
    colSpan: clamp(value.colSpan ?? value.span, 1, columns, fallbackSpan),
    rowSpan: clamp(value.rowSpan, 1, 24, 1),
    height: clamp(value.height, 80, 2400, device === "desktop" ? 360 : device === "tablet" ? 320 : 280),
    visible: value.visible !== false,
  };
}

function normalizeLayout(layout = {}, index = 0) {
  const desktopSpan = clamp(layout.desktop?.colSpan ?? layout.desktopConfig?.colSpan ?? layout.desktopConfig?.span ?? layout.desktopConfig?.columns, 1, 12, 12);
  const assignedContainerId = layout.assignedContainerId || layout.containerId || "";
  return {
    id: layout.id || layout.instanceId || createId("layout"),
    name: layout.name || layout.type || `Layout ${index + 1}`,
    slug: layout.slug || slugify(layout.name || layout.type || `layout-${index + 1}`),
    type: layout.type || layout.layoutType || "Hero Banner",
    desktop: normalizeDeviceConfig(layout.desktop || layout.desktopConfig || {}, "desktop", desktopSpan),
    tablet: normalizeDeviceConfig(layout.tablet || layout.tabletConfig || {}, "tablet", desktopSpan),
    mobile: normalizeDeviceConfig(layout.mobile || layout.mobileConfig || {}, "mobile", 1),
    sortOrder: clamp(layout.sortOrder ?? layout.zIndex ?? layout.order, 0, 10000, index),
    assignedContainerId: assignedContainerId ? String(assignedContainerId) : null,
    createdAt: layout.createdAt || new Date().toISOString(),
    updatedAt: layout.updatedAt || new Date().toISOString(),
    visible: layout.visible !== false,
    visibility: layout.visibility || {},
    animation: layout.animation || { type: "fadeUp", duration: 450 },
    spacing: layout.spacing || { padding: 0, gap: 24, marginTop: 0, marginBottom: 0 },
    background: layout.background || { color: "", image: "", fit: "cover" },
    typography: layout.typography || {},
    advanced: layout.advanced || { customClass: "", analyticsKey: "" },
    settings: layout.settings || {},
    containerSettings: layout.containerSettings || {},
  };
}

function normalizeDraft(input, fallbackName = "Homepage Layout") {
  const base = createEmptyDraft(input?.name || fallbackName);
  const layouts = Array.isArray(input?.layouts) ? input.layouts : [];
  return {
    ...base,
    ...(input || {}),
    name: input?.name || fallbackName,
    slug: input?.slug || slugify(input?.name || fallbackName),
    seo: { ...base.seo, ...(input?.seo || {}) },
    visibility: { ...base.visibility, ...(input?.visibility || {}) },
    scheduling: { ...base.scheduling, ...(input?.scheduling || {}) },
    typography: { ...base.typography, ...(input?.typography || {}) },
    builder: {
      ...base.builder,
      ...(input?.builder || {}),
      grid: { ...base.builder.grid, ...(input?.builder?.grid || {}) },
      canvas: {
        desktop: { ...base.builder.canvas.desktop, ...(input?.builder?.canvas?.desktop || {}) },
        tablet: { ...base.builder.canvas.tablet, ...(input?.builder?.canvas?.tablet || {}) },
        mobile: { ...base.builder.canvas.mobile, ...(input?.builder?.canvas?.mobile || {}) },
      },
    },
    layouts: layouts.map(normalizeLayout).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function renumberLayouts(layouts = []) {
  return layouts.map((layout, index) => ({ ...layout, sortOrder: index, updatedAt: new Date().toISOString() }));
}

function createLayoutSlot(type = "Hero Banner", desktopSpan = 12, index = 0) {
  const name = `${type} ${index + 1}`;
  return normalizeLayout(
    {
      id: createId("layout"),
      name,
      slug: slugify(name),
      type,
      desktop: { colSpan: desktopSpan, rowSpan: 1, height: type === "Hero Banner" ? 600 : 360, visible: true },
      tablet: { colSpan: Math.min(6, Math.max(1, Math.ceil(desktopSpan / 2))), rowSpan: 1, height: type === "Hero Banner" ? 450 : 320, visible: true },
      mobile: { colSpan: 1, rowSpan: 1, height: type === "Hero Banner" ? 320 : 280, visible: true },
      sortOrder: index,
    },
    index
  );
}

function buildSavePayload(layoutName, draft, isDefault, updatedAt) {
  const normalized = normalizeDraft(draft, layoutName);
  return {
    name: layoutName || normalized.name,
    slug: normalized.slug || slugify(layoutName || normalized.name),
    isDefault,
    lastKnownUpdatedAt: updatedAt || undefined,
    draft: {
      ...normalized,
      name: layoutName || normalized.name,
      slug: normalized.slug || slugify(layoutName || normalized.name),
      rows: [],
    },
  };
}

function getContainerLabel(container) {
  return container?.title || container?.name || "Untitled Container";
}

function getContainerTypeLabel(container) {
  return String(container?.containerType || container?.type || "CUSTOM").replace(/_/g, " ");
}

function resolveContainerThumbnail(container) {
  const raw =
    container?.thumbnail ||
    container?.config?.bannerImage ||
    container?.config?.masonryImage ||
    container?.config?.image ||
    container?.config?.categoryBanner ||
    container?.config?.brandBanner ||
    container?.config?.comboBanner ||
    container?.config?.flashBanner ||
    container?.config?.slides?.[0]?.image ||
    "";
  return raw ? resolveApiAssetUrl(raw) : "";
}

function validateDraft(draft) {
  const messages = [];
  for (const layout of draft.layouts || []) {
    for (const device of Object.keys(DEVICE_CONFIG)) {
      const config = layout[device];
      const columns = DEVICE_CONFIG[device].columns;
      if (!config || config.colSpan < 1 || config.colSpan > columns || config.height < 0 || config.rowSpan < 1) {
        messages.push(`${layout.name} has invalid ${device} sizing.`);
      }
    }
  }
  return messages;
}

export function AdminHomepageBuilderPage() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [containerLibrary, setContainerLibrary] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [activeLayoutId, setActiveLayoutId] = useState("");
  const [layoutName, setLayoutName] = useState("Homepage Layout");
  const [layoutUpdatedAt, setLayoutUpdatedAt] = useState("");
  const [draft, setDraft] = useState(createEmptyDraft());
  const [preview, setPreview] = useState({ layout: null, rows: [], containers: [], warnings: [] });
  const [selectedDevice, setSelectedDevice] = useState("desktop");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [propertyTab, setPropertyTab] = useState("Layout");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("ALL");
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [activeDrag, setActiveDrag] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const saveTimerRef = useRef(null);
  const prevDraftJsonRef = useRef("");
  const prevPreviewDeviceRef = useRef(null);
  const previewBackoffRef = useRef(0);

  const authUser = useAuthStore((store) => store.user);
  const authToken = useAuthStore((store) => store.token);
  const staffToken = useStaffAuthStore((store) => store.token);
  const staffUser = useStaffAuthStore((store) => store.user);
  const isLegacyAdmin = ["admin", "super_admin", "support_admin", "finance_admin"].includes(String(authUser?.role || "").toLowerCase());
  const canEdit = isLegacyAdmin || hasStaffPermission(staffUser?.permissions, "settings.update");
  const hasAuth = Boolean(authToken || staffToken);

  const libraryMap = useMemo(() => new Map(containerLibrary.map((item) => [String(item._id), item])), [containerLibrary]);
  const selectedSlot = useMemo(() => draft.layouts.find((layout) => layout.id === selectedSlotId) || null, [draft.layouts, selectedSlotId]);
  const selectedContainer = useMemo(
    () => (selectedSlot?.assignedContainerId ? libraryMap.get(String(selectedSlot.assignedContainerId)) : null),
    [libraryMap, selectedSlot]
  );
  const validationMessages = useMemo(() => validateDraft(draft), [draft]);
  const visibleLibrary = useMemo(() => {
    const search = librarySearch.trim().toLowerCase();
    return containerLibrary
      .filter((container) => {
        if (libraryFilter !== "ALL" && container.containerType !== libraryFilter) return false;
        if (!search) return true;
        return [container.title, container.name, container.description, container.containerType, container.slug]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
      .slice(0, 1000);
  }, [containerLibrary, libraryFilter, librarySearch]);

  const refreshLayouts = useCallback(async () => {
    const response = await listHomepageBuilderLayouts();
    const next = response?.data || [];
    setLayouts(next);
    return next;
  }, []);

  const refreshVersions = useCallback(async (layoutId) => {
    if (!layoutId) {
      setVersions([]);
      return;
    }
    const response = await listHomepageBuilderVersions(layoutId);
    setVersions(response?.data || []);
  }, []);

  const openLayout = useCallback(
    async (layoutId, nextLibrary) => {
      if (!layoutId) return;
      setLayoutLoading(true);
      setError("");
      setNotice("");
      try {
        const response = await getHomepageBuilderLayout(layoutId);
        const layout = response?.data;
        const nextDraft = normalizeDraft(layout?.draft || createEmptyDraft(layout?.name || "Homepage Layout"), layout?.name || "Homepage Layout");
        setActiveLayoutId(layoutId);
        setLayoutName(layout?.name || nextDraft.name);
        setLayoutUpdatedAt(layout?.updatedAt || "");
        setIsDefault(Boolean(layout?.isDefault));
        setDraft(nextDraft);
        setSelectedSlotId(nextDraft.layouts[0]?.id || "");
        if (Array.isArray(nextLibrary)) {
          setContainerLibrary(nextLibrary);
        }
        await refreshVersions(layoutId);
      } catch (loadError) {
        setError(normalizeError(loadError));
      } finally {
        setLayoutLoading(false);
      }
    },
    [refreshVersions]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [containersRes, layoutsRes] = await Promise.all([listHomepageBuilderContainers(), listHomepageBuilderLayouts()]);
      const nextLibrary = containersRes?.data || [];
      const nextLayouts = layoutsRes?.data || [];
      setContainerLibrary(nextLibrary);
      setLayouts(nextLayouts);
      if (nextLayouts[0]?._id) {
        await openLayout(nextLayouts[0]._id, nextLibrary);
      } else {
        setDraft(createEmptyDraft());
      }
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [openLayout]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const commitDraft = useCallback(
    (updater) => {
      setDraft((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        setSaveState("dirty");
        return normalizeDraft(next, layoutName);
      });
    },
    [layoutName]
  );

  const persistDraft = useCallback(
    async (nextDraft = draft, options = {}) => {
      if (!activeLayoutId || !canEdit || !hasAuth) return null;
      const messages = validateDraft(nextDraft);
      if (messages.length) {
        setError(messages[0]);
        setSaveState("error");
        return null;
      }
      setSaving(true);
      setError("");
      try {
        const response = await saveHomepageBuilderDraft(activeLayoutId, buildSavePayload(layoutName, nextDraft, isDefault, layoutUpdatedAt));
        const saved = response?.data;
        setLayoutUpdatedAt(saved?.updatedAt || saved?.draft?.savedAt || "");
        setSaveState("saved");
        if (!options.silent) await refreshLayouts();
        return saved;
      } catch (saveError) {
        setError(normalizeError(saveError));
        setSaveState("error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [activeLayoutId, canEdit, draft, hasAuth, isDefault, layoutName, layoutUpdatedAt, refreshLayouts]
  );

  useEffect(() => {
    if (!activeLayoutId || saveState !== "dirty" || !canEdit) return undefined;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistDraft(draft, { silent: true });
    }, 1400);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [activeLayoutId, canEdit, draft, persistDraft, saveState]);

  useEffect(() => {
    if (!activeLayoutId || !hasAuth) return undefined;
    // build a stable JSON snapshot of the draft we send to preview
    const draftSnapshot = buildSavePayload(layoutName, draft, isDefault, layoutUpdatedAt).draft;
    let draftJson;
    try {
      draftJson = JSON.stringify(draftSnapshot);
    } catch {
      draftJson = "";
    }

    // If nothing meaningful changed since last preview, skip calling the preview API
    if (prevDraftJsonRef.current === draftJson && prevPreviewDeviceRef.current === selectedDevice) {
      return undefined;
    }

    // Respect backoff if server asked us to slow down
    if (previewBackoffRef.current && Date.now() < previewBackoffRef.current) {
      prevDraftJsonRef.current = draftJson;
      prevPreviewDeviceRef.current = selectedDevice;
      return undefined;
    }

    prevDraftJsonRef.current = draftJson;
    prevPreviewDeviceRef.current = selectedDevice;

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await previewHomepageBuilderLayout({ draft: JSON.parse(draftJson), device: selectedDevice });
        if (active) setPreview(response?.data || { layout: null, rows: [], containers: [], warnings: [] });
      } catch (previewError) {
        if (!active) return;
        const message = normalizeError(previewError);
        setError(message);
        // if server rate-limits us, back off for 10s
        if (previewError?.response?.status === 429) {
          previewBackoffRef.current = Date.now() + 10000;
        }
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeLayoutId, draft, hasAuth, isDefault, layoutName, layoutUpdatedAt, selectedDevice]);

  const handleCreateLayoutDocument = useCallback(async () => {
    if (!canEdit) return;
    const name = `Homepage Layout ${layouts.length + 1}`;
    setLayoutLoading(true);
    setError("");
    try {
      const response = await createHomepageBuilderLayout({
        name,
        slug: slugify(name),
        isDefault: layouts.length === 0,
        draft: createEmptyDraft(name),
      });
      const created = response?.data;
      await refreshLayouts();
      if (created?._id) await openLayout(created._id, containerLibrary);
    } catch (createError) {
      setError(normalizeError(createError));
    } finally {
      setLayoutLoading(false);
    }
  }, [canEdit, containerLibrary, layouts.length, openLayout, refreshLayouts]);

  const addPreset = useCallback(
    (preset) => {
      if (!canEdit) return;
      commitDraft((current) => {
        const startIndex = current.layouts.length;
        const nextSlots = preset.spans.map((span, index) => createLayoutSlot(preset.type, span, startIndex + index));
        setSelectedSlotId(nextSlots[0]?.id || "");
        return { ...current, layouts: renumberLayouts([...(current.layouts || []), ...nextSlots]) };
      });
    },
    [canEdit, commitDraft]
  );

  const updateSlot = useCallback(
    (slotId, updater) => {
      if (!canEdit) return;
      commitDraft((current) => ({
        ...current,
        layouts: current.layouts.map((layout) => (layout.id === slotId ? (typeof updater === "function" ? updater(layout) : updater) : layout)),
      }));
    },
    [canEdit, commitDraft]
  );

  const assignContainer = useCallback(
    (slotId, containerId) => {
      if (!canEdit) return;
      updateSlot(slotId, (slot) => ({
        ...slot,
        assignedContainerId: containerId,
        containerSettings: slot.assignedContainerId === containerId ? slot.containerSettings : {},
        updatedAt: new Date().toISOString(),
      }));
      setSelectedSlotId(slotId);
    },
    [canEdit, updateSlot]
  );

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active.data.current || null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const dragData = event.active.data.current;
      const dropData = event.over?.data.current;
      setActiveDrag(null);
      if (!dragData || !dropData || !canEdit) return;
      if (dragData.type === "library" && dropData.type === "slot") {
        assignContainer(dropData.slotId, dragData.containerId);
      }
    },
    [assignContainer, canEdit]
  );

  const deleteSlot = useCallback(
    (slotId) => {
      if (!canEdit) return;
      commitDraft((current) => ({ ...current, layouts: renumberLayouts(current.layouts.filter((layout) => layout.id !== slotId)) }));
      if (selectedSlotId === slotId) setSelectedSlotId("");
    },
    [canEdit, commitDraft, selectedSlotId]
  );

  const duplicateSlot = useCallback(
    (slotId) => {
      if (!canEdit) return;
      commitDraft((current) => {
        const source = current.layouts.find((layout) => layout.id === slotId);
        if (!source) return current;
        const clone = deepClone(source);
        clone.id = createId("layout");
        clone.name = `${source.name} Copy`;
        clone.slug = slugify(clone.name);
        clone.sortOrder = current.layouts.length;
        clone.createdAt = new Date().toISOString();
        clone.updatedAt = new Date().toISOString();
        setSelectedSlotId(clone.id);
        return { ...current, layouts: renumberLayouts([...current.layouts, clone]) };
      });
    },
    [canEdit, commitDraft]
  );

  const moveSlot = useCallback(
    (slotId, direction) => {
      if (!canEdit) return;
      commitDraft((current) => {
        const index = current.layouts.findIndex((layout) => layout.id === slotId);
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || nextIndex < 0 || nextIndex >= current.layouts.length) return current;
        const nextLayouts = [...current.layouts];
        const [item] = nextLayouts.splice(index, 1);
        nextLayouts.splice(nextIndex, 0, item);
        return { ...current, layouts: renumberLayouts(nextLayouts) };
      });
    },
    [canEdit, commitDraft]
  );

  const resizeSlot = useCallback(
    (slotId, device, field, value) => {
      updateSlot(slotId, (slot) => {
        const config = slot[device];
        const columns = DEVICE_CONFIG[device].columns;
        const nextValue = field === "colSpan" ? clamp(value, 1, columns, config.colSpan) : clamp(value, field === "height" ? 80 : 1, field === "height" ? 2400 : 24, config[field]);
        const nextSlot = { ...slot, [device]: { ...config, [field]: nextValue }, updatedAt: new Date().toISOString() };
        if (device === "desktop" && field === "colSpan") {
          nextSlot.tablet = { ...nextSlot.tablet, colSpan: Math.min(6, Math.max(1, Math.ceil(nextValue / 2))) };
          nextSlot.mobile = { ...nextSlot.mobile, colSpan: 1 };
        }
        return nextSlot;
      });
    },
    [updateSlot]
  );

  const updateDraftField = useCallback(
    (section, field, value) => {
      if (!canEdit) return;
      commitDraft((current) => ({
        ...current,
        [section]: {
          ...(current[section] || {}),
          [field]: value,
        },
      }));
    },
    [canEdit, commitDraft]
  );

  const handlePublish = useCallback(async () => {
    if (!activeLayoutId || !canEdit) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const saved = await persistDraft(draft, { silent: false });
      if (!saved) return;
      await publishHomepageBuilderLayout(activeLayoutId);
      await refreshLayouts();
      await refreshVersions(activeLayoutId);
      setNotice("Homepage layout published.");
      setSaveState("saved");
    } catch (publishError) {
      setError(normalizeError(publishError));
    } finally {
      setPublishing(false);
    }
  }, [activeLayoutId, canEdit, draft, persistDraft, refreshLayouts, refreshVersions]);

  const handleRollback = useCallback(
    async (versionId) => {
      if (!activeLayoutId || !canEdit) return;
      setLayoutLoading(true);
      setError("");
      try {
        await rollbackHomepageBuilderVersion(activeLayoutId, versionId);
        await openLayout(activeLayoutId, containerLibrary);
        setNotice("Homepage layout rolled back.");
      } catch (rollbackError) {
        setError(normalizeError(rollbackError));
      } finally {
        setLayoutLoading(false);
      }
    },
    [activeLayoutId, canEdit, containerLibrary, openLayout]
  );

  const handleDeleteLayout = useCallback(async () => {
    if (!activeLayoutId || !canEdit || !window.confirm("Delete this homepage layout and revision history?")) return;
    setLayoutLoading(true);
    setError("");
    try {
      await deleteHomepageBuilderLayout(activeLayoutId);
      const nextLayouts = await refreshLayouts();
      if (nextLayouts[0]?._id) {
        await openLayout(nextLayouts[0]._id, containerLibrary);
      } else {
        setActiveLayoutId("");
        setDraft(createEmptyDraft());
        setSelectedSlotId("");
        setVersions([]);
      }
      setNotice("Homepage layout deleted.");
    } catch (deleteError) {
      setError(normalizeError(deleteError));
    } finally {
      setLayoutLoading(false);
    }
  }, [activeLayoutId, canEdit, containerLibrary, openLayout, refreshLayouts]);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading homepage builder...</div>;
  }

  const activeStatus = (layouts.find((layout) => layout._id === activeLayoutId)?.status || draft.scheduling?.status || "draft").toLowerCase();

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marketing / Homepage Builder</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={layoutName}
                  disabled={!canEdit}
                  onChange={(event) => {
                    setLayoutName(event.target.value);
                    commitDraft((current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }));
                  }}
                  className="min-w-[260px] rounded-lg border border-slate-200 px-3 py-2 text-2xl font-semibold text-slate-950"
                />
                <StatusPill tone={STATUS_STYLES[activeStatus] || STATUS_STYLES.draft}>{activeStatus.toUpperCase()}</StatusPill>
                <StatusPill tone={saveState === "dirty" ? "bg-amber-100 text-amber-800" : saveState === "error" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>
                  {saveState === "dirty" ? "Autosave Pending" : saveState === "error" ? "Save Failed" : "Saved"}
                </StatusPill>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LayoutChooser layouts={layouts} activeLayoutId={activeLayoutId} onSelect={(id) => openLayout(id, containerLibrary)} />
              <IconButton label="New Layout" onClick={handleCreateLayoutDocument} disabled={!canEdit}>
                <Plus className="h-4 w-4" />
              </IconButton>
              <IconButton label="Save Draft" onClick={() => persistDraft(draft)} disabled={!canEdit || saving || !activeLayoutId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </IconButton>
              <IconButton label="Publish Homepage" onClick={handlePublish} disabled={!canEdit || publishing || !activeLayoutId || validationMessages.length > 0} primary>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </IconButton>
              <IconButton label="Delete Layout" onClick={handleDeleteLayout} disabled={!canEdit || !activeLayoutId} danger>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} disabled={!canEdit} />
              Default homepage
            </label>
            {!canEdit ? <StatusPill tone="bg-slate-100 text-slate-700">Read Only</StatusPill> : null}
            {layoutLoading ? <StatusPill tone="bg-sky-100 text-sky-800">Syncing</StatusPill> : null}
          </div>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          {notice ? <InlineMessage tone="info">{notice}</InlineMessage> : null}
          {validationMessages.length ? <InlineMessage tone="warning">{validationMessages[0]}</InlineMessage> : null}
          {preview?.warnings?.length ? <InlineMessage tone="warning">{preview.warnings[0]?.message}</InlineMessage> : null}
        </div>

        {!activeLayoutId ? (
          <EmptyLayoutState canEdit={canEdit} onCreate={handleCreateLayoutDocument} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
            <ContainerLibrary
              containers={visibleLibrary}
              search={librarySearch}
              filter={libraryFilter}
              onSearch={setLibrarySearch}
              onFilter={setLibraryFilter}
            />

            <main className="min-w-0 space-y-4">
              <CanvasToolbar selectedDevice={selectedDevice} onDeviceChange={setSelectedDevice} onAddPreset={addPreset} />
              <BuilderCanvas
                draft={draft}
                selectedDevice={selectedDevice}
                selectedSlotId={selectedSlotId}
                libraryMap={libraryMap}
                canEdit={canEdit}
                onSelect={setSelectedSlotId}
                onDelete={deleteSlot}
                onDuplicate={duplicateSlot}
                onMove={moveSlot}
                onResize={resizeSlot}
              />
              <PreviewPanel selectedDevice={selectedDevice} preview={preview} loading={!preview?.layout && Boolean(activeLayoutId)} />
            </main>

            <aside className="space-y-4">
              <PropertiesPanel
                tab={propertyTab}
                onTab={setPropertyTab}
                draft={draft}
                slot={selectedSlot}
                container={selectedContainer}
                canEdit={canEdit}
                selectedDevice={selectedDevice}
                onUpdateSlot={updateSlot}
                onResize={resizeSlot}
                onDraftField={updateDraftField}
              />
              <VersionPanel
                versions={versions}
                open={showVersions}
                onToggle={() => setShowVersions((current) => !current)}
                onRollback={handleRollback}
                canEdit={canEdit}
              />
            </aside>
          </div>
        )}
      </div>

      <DragOverlay>{activeDrag?.container ? <LibraryDragCard container={activeDrag.container} /> : null}</DragOverlay>
    </DndContext>
  );
}

function ContainerLibrary({ containers, search, filter, onSearch, onFilter }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-950">Container Library</div>
          <div className="text-xs text-slate-500">{containers.length} available</div>
        </div>
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search containers" className="min-w-0 flex-1 text-sm outline-none" />
      </label>
      <select value={filter} onChange={(event) => onFilter(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        {FILTERS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <div className="mt-3 max-h-[calc(100vh-270px)] space-y-2 overflow-auto pr-1">
        {containers.map((container) => (
          <LibraryCard key={container._id} container={container} />
        ))}
      </div>
    </aside>
  );
}

function LibraryCard({ container }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `container-${container._id}`,
    data: { type: "library", containerId: String(container._id), container },
  });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.45 : 1 };
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <ContainerThumb container={container} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-950">{getContainerLabel(container)}</span>
        <span className="mt-1 block truncate text-xs uppercase tracking-wide text-slate-500">{getContainerTypeLabel(container)}</span>
      </span>
      <StatusPill tone={String(container.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
        {container.status || "ACTIVE"}
      </StatusPill>
    </button>
  );
}

function LibraryDragCard({ container }) {
  return (
    <div className="w-72 rounded-lg border border-slate-300 bg-white p-3 shadow-xl">
      <div className="text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{getContainerTypeLabel(container)}</div>
    </div>
  );
}

function CanvasToolbar({ selectedDevice, onDeviceChange, onAddPreset }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Object.entries(DEVICE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const active = key === selectedDevice;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onDeviceChange(key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"}`}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => onAddPreset(preset)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300">
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuilderCanvas({ draft, selectedDevice, selectedSlotId, libraryMap, canEdit, onSelect, onDelete, onDuplicate, onMove, onResize }) {
  const config = DEVICE_CONFIG[selectedDevice];
  return (
    <section className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 shadow-sm">
      <div className={`mx-auto min-h-[520px] w-full ${config.canvasClass} rounded-lg border border-slate-300 bg-white p-3`}>
        <div
          className="grid auto-rows-min gap-3"
          style={{
            gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          }}
        >
          {draft.layouts.length ? (
            draft.layouts.map((slot, index) => (
              <LayoutSlotCard
                key={slot.id}
                slot={slot}
                index={index}
                selectedDevice={selectedDevice}
                selected={slot.id === selectedSlotId}
                container={slot.assignedContainerId ? libraryMap.get(String(slot.assignedContainerId)) : null}
                canEdit={canEdit}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onMove={onMove}
                onResize={onResize}
              />
            ))
          ) : (
            <div className="col-span-full flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
              Add a preset to start building.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LayoutSlotCard({ slot, index, selectedDevice, selected, container, canEdit, onSelect, onDelete, onDuplicate, onMove, onResize }) {
  const config = slot[selectedDevice];
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { type: "slot", slotId: slot.id },
  });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(slot.id)}
      className={`group relative min-w-0 overflow-hidden rounded-lg border bg-white transition ${selected ? "border-slate-950 shadow-md" : isOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
      style={{ gridColumn: `span ${config.colSpan} / span ${config.colSpan}`, minHeight: `${config.height}px` }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{slot.name}</div>
          <div className="truncate text-xs text-slate-500">
            {slot.type} / {config.colSpan} col / {config.height}px
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); onMove(slot.id, "up"); }} disabled={!canEdit || index === 0} title="Move up">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); onMove(slot.id, "down"); }} disabled={!canEdit} title="Move down">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); onDuplicate(slot.id); }} disabled={!canEdit} title="Duplicate">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1 text-rose-500 hover:bg-rose-50" onClick={(event) => { event.stopPropagation(); onDelete(slot.id); }} disabled={!canEdit} title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex h-full min-h-[180px] flex-col p-3">
        {container ? (
          <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <ContainerThumb container={container} large />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{getContainerTypeLabel(container)}</div>
              </div>
            </div>
            <div className="mt-auto pt-4 text-xs text-slate-500">Drop another container here to replace it.</div>
          </div>
        ) : (
          <div className={`flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed text-sm ${isOver ? "border-emerald-400 text-emerald-700" : "border-slate-300 text-slate-500"}`}>
            Drop existing container here
          </div>
        )}
      </div>

      <div className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm group-hover:flex">
        {spanOptions(selectedDevice).map((span) => (
          <button key={span} type="button" onClick={(event) => { event.stopPropagation(); onResize(slot.id, selectedDevice, "colSpan", span); }} className={`rounded px-2 py-1 text-xs font-semibold ${config.colSpan === span ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {span}
          </button>
        ))}
      </div>
    </div>
  );
}

function spanOptions(device) {
  if (device === "mobile") return [1];
  if (device === "tablet") return [1, 2, 3, 4, 5, 6];
  return [2, 3, 4, 6, 8, 9, 12];
}

function PreviewPanel({ selectedDevice, preview, loading }) {
  const config = DEVICE_CONFIG[selectedDevice];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Live Preview</div>
          <div className="text-xs text-slate-500">{config.width}px storefront renderer</div>
        </div>
        <Eye className="h-4 w-4 text-slate-400" />
      </div>
      <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className={`mx-auto w-full ${config.canvasClass} bg-white`}>
          <DynamicHomepageRenderer rows={preview?.rows || []} containers={preview?.containers || []} loading={loading} bareCarouselShell device={selectedDevice} canvasWidth={config.width} />
        </div>
      </div>
    </section>
  );
}

function PropertiesPanel({ tab, onTab, draft, slot, container, canEdit, selectedDevice, onUpdateSlot, onResize, onDraftField }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Properties</div>
          <div className="text-xs text-slate-500">{slot ? slot.name : "No layout selected"}</div>
        </div>
        <Settings2 className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {PROPERTY_TABS.map((item) => (
          <button key={item} type="button" onClick={() => onTab(item)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${tab === item ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "Layout" ? <LayoutTab slot={slot} canEdit={canEdit} selectedDevice={selectedDevice} onUpdateSlot={onUpdateSlot} onResize={onResize} /> : null}
        {tab === "Container" ? <ContainerTab slot={slot} container={container} canEdit={canEdit} onUpdateSlot={onUpdateSlot} /> : null}
        {tab === "SEO" ? <SeoTab seo={draft.seo} canEdit={canEdit} onChange={(field, value) => onDraftField("seo", field, value)} /> : null}
        {tab === "Visibility" ? <VisibilityTab values={draft.visibility} canEdit={canEdit} onChange={(field, value) => onDraftField("visibility", field, value)} /> : null}
        {tab === "Animation" ? <SlotObjectTab slot={slot} section="animation" canEdit={canEdit} onUpdateSlot={onUpdateSlot} fields={[["type", "Animation"], ["duration", "Duration"]]} /> : null}
        {tab === "Spacing" ? <SlotObjectTab slot={slot} section="spacing" canEdit={canEdit} onUpdateSlot={onUpdateSlot} fields={[["padding", "Padding"], ["gap", "Gap"], ["marginTop", "Margin Top"], ["marginBottom", "Margin Bottom"]]} /> : null}
        {tab === "Background" ? <SlotObjectTab slot={slot} section="background" canEdit={canEdit} onUpdateSlot={onUpdateSlot} fields={[["color", "Color"], ["image", "Image"], ["fit", "Fit"]]} /> : null}
        {tab === "Typography" ? <TypographyTab values={draft.typography} canEdit={canEdit} onChange={(field, value) => onDraftField("typography", field, value)} /> : null}
        {tab === "Advanced" ? <AdvancedTab slot={slot} draft={draft} canEdit={canEdit} onUpdateSlot={onUpdateSlot} onDraftField={onDraftField} /> : null}
      </div>
    </section>
  );
}

function LayoutTab({ slot, canEdit, selectedDevice, onUpdateSlot, onResize }) {
  if (!slot) return <PanelEmpty>Select a layout slot.</PanelEmpty>;
  const config = slot[selectedDevice];
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input value={slot.name} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }))} className={INPUT_CLASS} />
      </Field>
      <Field label="Type">
        <select value={slot.type} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, type: event.target.value }))} className={INPUT_CLASS}>
          {LAYOUT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${DEVICE_CONFIG[selectedDevice].label} Columns`}>
          <input type="number" min={1} max={DEVICE_CONFIG[selectedDevice].columns} value={config.colSpan} disabled={!canEdit} onChange={(event) => onResize(slot.id, selectedDevice, "colSpan", event.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Height">
          <input type="number" min={80} max={2400} value={config.height} disabled={!canEdit} onChange={(event) => onResize(slot.id, selectedDevice, "height", event.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={config.visible !== false} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [selectedDevice]: { ...current[selectedDevice], visible: event.target.checked } }))} />
        Visible on {DEVICE_CONFIG[selectedDevice].label}
      </label>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Responsive Summary</div>
        {Object.keys(DEVICE_CONFIG).map((device) => (
          <div key={device} className="flex justify-between py-1 text-sm text-slate-700">
            <span>{DEVICE_CONFIG[device].label}</span>
            <span>{slot[device].colSpan} col / {slot[device].height}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContainerTab({ slot, container, canEdit, onUpdateSlot }) {
  if (!slot) return <PanelEmpty>Select a layout slot.</PanelEmpty>;
  if (!container) return <PanelEmpty>Assign a container from the library.</PanelEmpty>;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-3">
          <ContainerThumb container={container} large />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{getContainerTypeLabel(container)}</div>
          </div>
        </div>
      </div>
      <Field label="Container Overrides JSON">
        <textarea
          rows={8}
          value={JSON.stringify(slot.containerSettings || {}, null, 2)}
          disabled={!canEdit}
          onChange={(event) => {
            try {
              const parsed = event.target.value ? JSON.parse(event.target.value) : {};
              onUpdateSlot(slot.id, (current) => ({ ...current, containerSettings: parsed }));
            } catch {
              // Keep editing local text valid by ignoring malformed JSON until it is corrected.
            }
          }}
          className={`${INPUT_CLASS} font-mono`}
        />
      </Field>
    </div>
  );
}

function SeoTab({ seo, canEdit, onChange }) {
  return (
    <div className="space-y-3">
      {[
        ["metaTitle", "Meta Title"],
        ["metaDescription", "Meta Description"],
        ["canonicalUrl", "Canonical URL"],
        ["openGraphTitle", "Open Graph Title"],
        ["openGraphDescription", "Open Graph Description"],
        ["openGraphImage", "Open Graph Image"],
        ["twitterTitle", "Twitter Title"],
        ["twitterDescription", "Twitter Description"],
        ["twitterImage", "Twitter Image"],
        ["twitterCard", "Twitter Card"],
      ].map(([field, label]) => (
        <Field key={field} label={label}>
          <input value={seo?.[field] || ""} disabled={!canEdit} onChange={(event) => onChange(field, event.target.value)} className={INPUT_CLASS} />
        </Field>
      ))}
      <Field label="Schema JSON-LD">
        <textarea rows={6} value={seo?.schemaMarkup || ""} disabled={!canEdit} onChange={(event) => onChange("schemaMarkup", event.target.value)} className={`${INPUT_CLASS} font-mono`} />
      </Field>
    </div>
  );
}

function VisibilityTab({ values, canEdit, onChange }) {
  const toggles = ["desktop", "tablet", "mobile", "guest", "customer", "vendor", "admin"];
  return (
    <div className="space-y-3">
      {toggles.map((field) => (
        <label key={field} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <span className="capitalize">{field}</span>
          <input type="checkbox" checked={values?.[field] !== false} disabled={!canEdit} onChange={(event) => onChange(field, event.target.checked)} />
        </label>
      ))}
      {["country", "language", "currency"].map((field) => (
        <Field key={field} label={field[0].toUpperCase() + field.slice(1)}>
          <input value={values?.[field] || ""} disabled={!canEdit} onChange={(event) => onChange(field, event.target.value)} className={INPUT_CLASS} />
        </Field>
      ))}
    </div>
  );
}

function TypographyTab({ values, canEdit, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="Heading Font">
        <input value={values?.headingFont || ""} disabled={!canEdit} onChange={(event) => onChange("headingFont", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Body Font">
        <input value={values?.bodyFont || ""} disabled={!canEdit} onChange={(event) => onChange("bodyFont", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Text Scale">
        <input type="number" min={80} max={140} value={values?.textScale || 100} disabled={!canEdit} onChange={(event) => onChange("textScale", Number(event.target.value || 100))} className={INPUT_CLASS} />
      </Field>
    </div>
  );
}

function SlotObjectTab({ slot, section, fields, canEdit, onUpdateSlot }) {
  if (!slot) return <PanelEmpty>Select a layout slot.</PanelEmpty>;
  return (
    <div className="space-y-3">
      {fields.map(([field, label]) => (
        <Field key={field} label={label}>
          <input
            value={slot?.[section]?.[field] ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              onUpdateSlot(slot.id, (current) => ({
                ...current,
                [section]: { ...(current[section] || {}), [field]: event.target.value },
              }))
            }
            className={INPUT_CLASS}
          />
        </Field>
      ))}
    </div>
  );
}

function AdvancedTab({ slot, draft, canEdit, onUpdateSlot, onDraftField }) {
  return (
    <div className="space-y-3">
      {slot ? (
        <>
          <Field label="Custom Class">
            <input value={slot.advanced?.customClass || ""} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, advanced: { ...(current.advanced || {}), customClass: event.target.value } }))} className={INPUT_CLASS} />
          </Field>
          <Field label="Analytics Key">
            <input value={slot.advanced?.analyticsKey || ""} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, advanced: { ...(current.advanced || {}), analyticsKey: event.target.value } }))} className={INPUT_CLASS} />
          </Field>
        </>
      ) : null}
      <Field label="Publish Date">
        <input type="datetime-local" value={draft.scheduling?.publishDate || ""} disabled={!canEdit} onChange={(event) => onDraftField("scheduling", "publishDate", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Expiry Date">
        <input type="datetime-local" value={draft.scheduling?.expiryDate || ""} disabled={!canEdit} onChange={(event) => onDraftField("scheduling", "expiryDate", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Status">
        <select value={draft.scheduling?.status || "draft"} disabled={!canEdit} onChange={(event) => onDraftField("scheduling", "status", event.target.value)} className={INPUT_CLASS}>
          {["draft", "scheduled", "published", "archived"].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function VersionPanel({ versions, open, onToggle, onRollback, canEdit }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-sm font-semibold text-slate-950">Revision History</span>
          <span className="text-xs text-slate-500">{versions.length} versions</span>
        </span>
        <History className="h-4 w-4 text-slate-400" />
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {versions.length ? versions.map((version) => (
            <div key={version._id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Version {version.version}</div>
                  <div className="text-xs text-slate-500">{version.publishedAt ? new Date(version.publishedAt).toLocaleString() : "Draft"}</div>
                </div>
                <button type="button" onClick={() => onRollback(version._id)} disabled={!canEdit} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Rollback">
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          )) : <PanelEmpty>No published versions yet.</PanelEmpty>}
        </div>
      ) : null}
    </section>
  );
}

function LayoutChooser({ layouts, activeLayoutId, onSelect }) {
  return (
    <select value={activeLayoutId} onChange={(event) => onSelect(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
      <option value="">Select layout</option>
      {layouts.map((layout) => (
        <option key={layout._id} value={layout._id}>
          {layout.name}{layout.status === "published" ? " - Live" : ""}
        </option>
      ))}
    </select>
  );
}

function EmptyLayoutState({ canEdit, onCreate }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <Archive className="mx-auto h-8 w-8 text-slate-400" />
      <div className="mt-3 text-base font-semibold text-slate-950">No homepage builder layout yet</div>
      <button type="button" onClick={onCreate} disabled={!canEdit} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Plus className="h-4 w-4" />
        Create Layout
      </button>
    </div>
  );
}

function ContainerThumb({ container, large = false }) {
  const src = resolveContainerThumbnail(container);
  return (
    <span className={`${large ? "h-14 w-14" : "h-11 w-11"} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100`}>
      {src ? <img src={src} alt={getContainerLabel(container)} className="h-full w-full object-cover" loading="lazy" /> : <LayoutDashboard className="h-5 w-5 text-slate-400" />}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function PanelEmpty({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-sm text-slate-500">{children}</div>;
}

function IconButton({ label, children, onClick, disabled, primary = false, danger = false }) {
  const classes = primary
    ? "bg-slate-950 text-white"
    : danger
      ? "border border-rose-200 text-rose-600 hover:bg-rose-50"
      : "border border-slate-200 text-slate-700 hover:bg-slate-50";
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}>
      {children}
    </button>
  );
}

function StatusPill({ tone, children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{children}</span>;
}

function InlineMessage({ tone = "info", children }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-sky-200 bg-sky-50 text-sky-800";
  return <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${toneClass}`}>{children}</div>;
}
