import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Rnd } from "react-rnd";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Monitor,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { DynamicHomepageRenderer } from "../components/homepage/DynamicHomepageRenderer";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { hasStaffPermission } from "../utils/staffPermissions";
import {
  createHomepageBuilderLayout,
  deleteHomepageBuilderLayout,
  getHomepageBuilderContainerSchema,
  getHomepageBuilderLayout,
  listHomepageBuilderContainers,
  listHomepageBuilderLayouts,
  listHomepageBuilderVersions,
  previewHomepageBuilderLayout,
  publishHomepageBuilderLayout,
  rollbackHomepageBuilderVersion,
  saveHomepageBuilderDraft,
} from "../services/homepageBuilderService";

const GRID_SIZE = 20;
const DEVICE_CONFIG = {
  desktop: { label: "Desktop", icon: Monitor, width: 1200, height: 2200 },
  tablet: { label: "Tablet", icon: Tablet, width: 840, height: 2400 },
  mobile: { label: "Mobile", icon: Smartphone, width: 390, height: 2600 },
};
const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-200 text-slate-700",
};
const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "CAROUSEL", label: "Carousel" },
  { value: "BANNER", label: "Banner" },
  { value: "SLIDER", label: "Hero" },
  { value: "GRID", label: "Grid" },
  { value: "FEATURED", label: "Featured" },
  { value: "TRENDING", label: "Trending" },
];

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function snap(value) {
  return Math.round(Number(value || 0) / GRID_SIZE) * GRID_SIZE;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function createEmptyDraft(name = "Homepage Layout") {
  return {
    name,
    slug: slugify(name),
    seo: {
      metaTitle: "",
      metaDescription: "",
      openGraphTitle: "",
      openGraphDescription: "",
      openGraphImage: "",
      canonicalUrl: "",
      schemaMarkup: "",
    },
    notes: "",
    builder: {
      mode: "visual",
      gridSize: GRID_SIZE,
      canvas: {
        desktop: { width: DEVICE_CONFIG.desktop.width, height: DEVICE_CONFIG.desktop.height },
        tablet: { width: DEVICE_CONFIG.tablet.width, height: DEVICE_CONFIG.tablet.height },
        mobile: { width: DEVICE_CONFIG.mobile.width, height: DEVICE_CONFIG.mobile.height },
      },
    },
    layouts: [],
    rows: [],
  };
}

function getCanvasSize(draft, device) {
  const fallback = DEVICE_CONFIG[device] || DEVICE_CONFIG.desktop;
  const canvas = draft?.builder?.canvas?.[device] || {};
  return {
    width: Number(canvas.width || fallback.width),
    height: Number(canvas.height || fallback.height),
  };
}

function getSlotConfig(slot, device) {
  if (device === "mobile") return slot.mobileConfig || {};
  if (device === "tablet") return slot.tabletConfig || {};
  return slot.desktopConfig || {};
}

function getSlotRect(slot, device, draft) {
  const deviceConfig = getSlotConfig(slot, device);
  const canvas = getCanvasSize(draft, device);
  const width = clamp(deviceConfig.width || slot.width || 320, 80, canvas.width);
  const height = clamp(deviceConfig.height || slot.height || 320, 80, 2400);
  const x = clamp(deviceConfig.x ?? slot.x ?? 0, 0, Math.max(0, canvas.width - width));
  const y = clamp(deviceConfig.y ?? slot.y ?? 0, 0, Math.max(0, canvas.height - height));
  return { x, y, width, height, right: x + width, bottom: y + height };
}

function rectsOverlap(a, b, tolerance = 4) {
  return a.x + tolerance < b.right && a.right - tolerance > b.x && a.y + tolerance < b.bottom && a.bottom - tolerance > b.y;
}

function collides(slotId, nextRect, draft, device) {
  return (draft.layouts || []).some((layout) => {
    if (layout.id === slotId) return false;
    const layoutConfig = getSlotConfig(layout, device);
    if (layout.visible === false || layoutConfig.visible === false) return false;
    return rectsOverlap(nextRect, getSlotRect(layout, device, draft));
  });
}

function createLayoutSlot(draft, device = "desktop") {
  const canvas = getCanvasSize(draft, device);
  const layouts = draft.layouts || [];
  const nextY = layouts.reduce((maxBottom, item) => Math.max(maxBottom, getSlotRect(item, device, draft).bottom), 0);
  const width = device === "mobile" ? canvas.width : Math.min(canvas.width, 560);
  const x = 0;
  const y = snap(nextY + GRID_SIZE);
  const baseRect = {
    x,
    y,
    width: snap(width),
    height: 320,
    columns: 0,
    spacing: 0,
    visible: true,
  };

  return {
    id: createId("layout"),
    containerId: null,
    x,
    y,
    width: baseRect.width,
    height: baseRect.height,
    visible: true,
    zIndex: layouts.length + 1,
    settings: {
      minHeight: 320,
      padding: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      backgroundColor: "",
      customCssClasses: "",
      lockAspectRatio: false,
    },
    containerSettings: {},
    desktopConfig: { ...baseRect },
    tabletConfig: { ...baseRect, width: Math.min(baseRect.width, DEVICE_CONFIG.tablet.width) },
    mobileConfig: { ...baseRect, width: DEVICE_CONFIG.mobile.width },
  };
}

function normalizeDraft(input, fallbackName = "Homepage Layout") {
  const base = createEmptyDraft(input?.name || fallbackName);
  const layouts = Array.isArray(input?.layouts) ? input.layouts : [];
  return {
    ...base,
    ...input,
    name: input?.name || fallbackName,
    slug: input?.slug || slugify(input?.name || fallbackName),
    builder: {
      ...base.builder,
      ...(input?.builder || {}),
      canvas: {
        desktop: { ...base.builder.canvas.desktop, ...(input?.builder?.canvas?.desktop || {}) },
        tablet: { ...base.builder.canvas.tablet, ...(input?.builder?.canvas?.tablet || {}) },
        mobile: { ...base.builder.canvas.mobile, ...(input?.builder?.canvas?.mobile || {}) },
      },
    },
    layouts: layouts.map((layout, index) => ({
      ...createLayoutSlot(base),
      ...layout,
      id: layout.id || createId("layout"),
      containerId: layout.containerId || null,
      zIndex: Number(layout.zIndex || index + 1),
      settings: {
        ...createLayoutSlot(base).settings,
        ...(layout.settings || {}),
      },
      containerSettings: layout.containerSettings && typeof layout.containerSettings === "object" ? layout.containerSettings : {},
      desktopConfig: {
        ...createLayoutSlot(base).desktopConfig,
        ...(layout.desktopConfig || {}),
      },
      tabletConfig: {
        ...createLayoutSlot(base).tabletConfig,
        ...(layout.tabletConfig || {}),
      },
      mobileConfig: {
        ...createLayoutSlot(base).mobileConfig,
        ...(layout.mobileConfig || {}),
      },
    })),
  };
}

function fixResponsiveConfigCollisions(layouts) {
  // Auto-fix tablet and mobile configs to avoid collisions by stacking vertically
  return layouts.map((layout, index) => {
    const result = { ...layout };
    
    // For tablet: stack all visible layouts vertically
    let tabletY = 0;
    for (let i = 0; i < index; i++) {
      if (layouts[i].visible !== false && getSlotConfig(layouts[i], "tablet").visible !== false) {
        const prevConfig = getSlotConfig(layouts[i], "tablet");
        tabletY = Math.max(tabletY, (prevConfig.y || 0) + (prevConfig.height || 0) + GRID_SIZE);
      }
    }
    result.tabletConfig = {
      ...result.tabletConfig,
      y: snap(result.tabletConfig.y !== undefined && result.tabletConfig.y >= tabletY ? result.tabletConfig.y : tabletY),
    };

    // For mobile: stack all visible layouts vertically
    let mobileY = 0;
    for (let i = 0; i < index; i++) {
      if (layouts[i].visible !== false && getSlotConfig(layouts[i], "mobile").visible !== false) {
        const prevConfig = getSlotConfig(layouts[i], "mobile");
        mobileY = Math.max(mobileY, (prevConfig.y || 0) + (prevConfig.height || 0) + GRID_SIZE);
      }
    }
    result.mobileConfig = {
      ...result.mobileConfig,
      y: snap(result.mobileConfig.y !== undefined && result.mobileConfig.y >= mobileY ? result.mobileConfig.y : mobileY),
    };

    return result;
  });
}

function buildSavePayload(layoutName, draft, isDefault, updatedAt) {
  const normalized = normalizeDraft(draft, layoutName);
  // Fix responsive config collisions before sending to backend
  normalized.layouts = fixResponsiveConfigCollisions(normalized.layouts);
  return {
    name: layoutName || normalized.name,
    slug: normalized.slug || slugify(layoutName || normalized.name),
    isDefault,
    lastKnownUpdatedAt: updatedAt || undefined,
    draft: {
      ...normalized,
      name: layoutName || normalized.name,
      slug: normalized.slug || slugify(layoutName || normalized.name),
      rows: normalized.rows || [],
    },
  };
}

function getContainerLabel(container) {
  return container?.title || container?.name || "Untitled Container";
}

function getContainerTypeLabel(container) {
  return String(container?.containerType || "CUSTOM").replace(/_/g, " ");
}

function resolveContainerThumbnail(container) {
  if (!container) return "";
  return (
    container?.config?.bannerImage ||
    container?.config?.image ||
    container?.config?.categoryBanner ||
    container?.config?.brandBanner ||
    container?.config?.comboBanner ||
    container?.config?.flashBanner ||
    container?.config?.slides?.[0]?.image ||
    ""
  );
}

function getComplexFieldValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseComplexFieldValue(field, value) {
  if (!value) return field.type === "array" || field.type === "async-multiselect" || field.type === "tags" ? [] : "";
  try {
    return JSON.parse(value);
  } catch {
    if (field.type === "array" || field.type === "async-multiselect" || field.type === "tags") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  }
}

export function AdminHomepageBuilderPage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
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
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("ALL");
  const [librarySort, setLibrarySort] = useState("recent");
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [activeDrag, setActiveDrag] = useState(null);
  const [schemaMap, setSchemaMap] = useState({});
  const [replacementPicker, setReplacementPicker] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [showContainerLibraryHorizontal, setShowContainerLibraryHorizontal] = useState(false);
  const saveTimerRef = useRef(null);
  const previewControllerRef = useRef(null);

  const authUser = useAuthStore((store) => store.user);
  const authToken = useAuthStore((store) => store.token);
  const staffToken = useStaffAuthStore((store) => store.token);
  const staffUser = useStaffAuthStore((store) => store.user);
  const isLegacyAdmin = ["admin", "super_admin", "support_admin", "finance_admin"].includes(String(authUser?.role || "").toLowerCase());
  const canEdit = isLegacyAdmin || hasStaffPermission(staffUser?.permissions, "settings.update");
  const hasAuth = Boolean(authToken || staffToken);

  const libraryMap = useMemo(
    () => new Map((containerLibrary || []).map((item) => [String(item._id), item])),
    [containerLibrary]
  );

  const selectedSlot = useMemo(
    () => (draft.layouts || []).find((layout) => layout.id === selectedSlotId) || null,
    [draft.layouts, selectedSlotId]
  );

  const selectedContainer = useMemo(
    () => (selectedSlot?.containerId ? libraryMap.get(String(selectedSlot.containerId)) : null),
    [libraryMap, selectedSlot]
  );

  const filteredLibrary = useMemo(() => {
    const search = librarySearch.trim().toLowerCase();
    const filtered = (containerLibrary || []).filter((container) => {
      if (libraryFilter !== "ALL" && container.containerType !== libraryFilter) return false;
      if (!search) return true;
      return [container.title, container.description, container.containerType, container.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (librarySort === "name") return String(left.title || "").localeCompare(String(right.title || ""));
      if (librarySort === "status") return String(left.status || "").localeCompare(String(right.status || ""));
      return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
    });
    return sorted;
  }, [containerLibrary, libraryFilter, librarySearch, librarySort]);

  const canvasSize = useMemo(() => getCanvasSize(draft, selectedDevice), [draft, selectedDevice]);

  const loadSchema = useCallback(async (type) => {
    if (!type) return null;
    // Note: schemaMap is accessed from closure, not dependency array to prevent cascading recreations
    const response = await getHomepageBuilderContainerSchema(type);
    const schema = response?.data || null;
    if (schema) {
      setSchemaMap((current) => ({ ...current, [type]: schema }));
    }
    return schema;
  }, []);

  const refreshLayouts = useCallback(async () => {
    const response = await listHomepageBuilderLayouts();
    const nextLayouts = response?.data || [];
    setLayouts(nextLayouts);
    return nextLayouts;
  }, []);

  const refreshVersions = useCallback(async (layoutId) => {
    if (!layoutId) {
      setVersions([]);
      return;
    }
    const response = await listHomepageBuilderVersions(layoutId);
    setVersions(response?.data || []);
  }, []);

  const openLayout = useCallback(async (layoutId, nextLibrary = containerLibrary) => {
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
      setSelectedSlotId(nextDraft.layouts?.[0]?.id || "");
      setContainerLibrary(nextLibrary);
      await refreshVersions(layoutId);
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLayoutLoading(false);
    }
  }, [refreshVersions]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [containersRes, layoutsRes] = await Promise.all([
        listHomepageBuilderContainers(),
        listHomepageBuilderLayouts(),
      ]);
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
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedContainer?.containerType) return;
    loadSchema(selectedContainer.containerType).catch(() => {});
  }, [loadSchema, selectedContainer?.containerType]);

  const commitDraft = useCallback((updater) => {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      setSaveState("dirty");
      return normalizeDraft(next, layoutName);
    });
  }, [layoutName]);

  const persistDraft = useCallback(async (nextDraft = draft, options = {}) => {
    if (!activeLayoutId || !canEdit || !hasAuth) return null;
    setSaving(true);
    setError("");
    try {
      const response = await saveHomepageBuilderDraft(
        activeLayoutId,
        buildSavePayload(layoutName, nextDraft, isDefault, layoutUpdatedAt)
      );
      const saved = response?.data;
      setLayoutUpdatedAt(saved?.updatedAt || saved?.draft?.savedAt || "");
      setSaveState("saved");
      if (!options.silent) {
        await refreshLayouts();
      }
      return saved;
    } catch (saveError) {
      setError(normalizeError(saveError));
      setSaveState("error");
      return null;
    } finally {
      setSaving(false);
    }
  }, [activeLayoutId, canEdit, hasAuth, isDefault, layoutName, layoutUpdatedAt, refreshLayouts]);

  useEffect(() => {
    if (!activeLayoutId || saveState !== "dirty" || !canEdit) return undefined;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistDraft(draft, { silent: true });
    }, 2000);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [activeLayoutId, canEdit, draft, persistDraft, saveState]);

  useEffect(() => {
    if (!activeLayoutId || !hasAuth || saving) return undefined;
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await previewHomepageBuilderLayout({
          draft: buildSavePayload(layoutName, draft, isDefault, layoutUpdatedAt).draft,
          device: selectedDevice,
        });
        if (active) {
          setPreview(response?.data || { layout: null, rows: [], containers: [], warnings: [] });
        }
      } catch (previewError) {
        if (active) {
          setError(normalizeError(previewError));
        }
      }
    }, 1000); // Increased from 250ms to 1000ms (1 second) to reduce request frequency
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeLayoutId, draft, hasAuth, isDefault, layoutName, layoutUpdatedAt, selectedDevice, saving]);

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
      const nextLayouts = await refreshLayouts();
      if (created?._id) {
        await openLayout(created._id, containerLibrary);
      } else if (nextLayouts[0]?._id) {
        await openLayout(nextLayouts[0]._id, containerLibrary);
      }
    } catch (createError) {
      setError(normalizeError(createError));
    } finally {
      setLayoutLoading(false);
    }
  }, [canEdit, containerLibrary, layouts.length, openLayout, refreshLayouts]);

  const handleAddSlot = useCallback(() => {
    if (!canEdit) return;
    commitDraft((current) => {
      const nextSlot = createLayoutSlot(current, selectedDevice);
      setSelectedSlotId(nextSlot.id);
      return {
        ...current,
        layouts: [...(current.layouts || []), nextSlot],
      };
    });
  }, [canEdit, commitDraft, selectedDevice]);

  const updateSlot = useCallback((slotId, updater) => {
    if (!canEdit) return;
    commitDraft((current) => ({
      ...current,
      layouts: (current.layouts || []).map((layout) =>
        layout.id === slotId ? (typeof updater === "function" ? updater(layout) : updater) : layout
      ),
    }));
  }, [canEdit, commitDraft]);

  const applyRectChange = useCallback((slotId, rect) => {
    updateSlot(slotId, (slot) => {
      const nextConfig = {
        ...getSlotConfig(slot, selectedDevice),
        x: snap(rect.x),
        y: snap(rect.y),
        width: snap(rect.width),
        height: snap(rect.height),
        visible: getSlotConfig(slot, selectedDevice).visible !== false,
      };
      const nextSlot = {
        ...slot,
        ...(selectedDevice === "desktop"
          ? {
              x: nextConfig.x,
              y: nextConfig.y,
              width: nextConfig.width,
              height: nextConfig.height,
            }
          : {}),
        [`${selectedDevice}Config`]: nextConfig,
      };
      return nextSlot;
    });
  }, [selectedDevice, updateSlot]);

  const handleSlotRectCommit = useCallback((slotId, rect) => {
    const nextRect = {
      x: snap(rect.x),
      y: snap(rect.y),
      width: snap(rect.width),
      height: snap(rect.height),
      right: snap(rect.x) + snap(rect.width),
      bottom: snap(rect.y) + snap(rect.height),
    };

    if (collides(slotId, nextRect, draft, selectedDevice)) {
      setNotice("Layout collision prevented. Move or resize into free space.");
      return;
    }

    applyRectChange(slotId, rect);
  }, [applyRectChange, draft, selectedDevice]);

  const handleAssignContainer = useCallback((slotId, containerId) => {
    if (!canEdit) return;
    updateSlot(slotId, (slot) => ({
      ...slot,
      containerId,
      containerSettings: slot.containerId === containerId ? slot.containerSettings || {} : {},
    }));
    setSelectedSlotId(slotId);
    setReplacementPicker(false);
  }, [canEdit, updateSlot]);

  const handleDeleteSlot = useCallback((slotId) => {
    if (!canEdit) return;
    commitDraft((current) => ({
      ...current,
      layouts: (current.layouts || []).filter((layout) => layout.id !== slotId),
    }));
    if (selectedSlotId === slotId) {
      setSelectedSlotId("");
    }
  }, [canEdit, commitDraft, selectedSlotId]);

  const handleDuplicateSlot = useCallback((slotId) => {
    if (!canEdit) return;
    commitDraft((current) => {
      const source = (current.layouts || []).find((layout) => layout.id === slotId);
      if (!source) return current;
      const clone = deepClone(source);
      clone.id = createId("layout");
      clone.zIndex = (current.layouts || []).length + 1;
      for (const device of ["desktop", "tablet", "mobile"]) {
        const key = `${device}Config`;
        clone[key] = {
          ...(clone[key] || {}),
          x: snap((clone[key]?.x ?? clone.x ?? 0) + GRID_SIZE),
          y: snap((clone[key]?.y ?? clone.y ?? 0) + GRID_SIZE),
        };
      }
      clone.x = snap((clone.x || 0) + GRID_SIZE);
      clone.y = snap((clone.y || 0) + GRID_SIZE);
      if (collides(clone.id, getSlotRect(clone, selectedDevice, current), { ...current, layouts: [...(current.layouts || []), clone] }, selectedDevice)) {
        clone.desktopConfig.y = snap(getSlotRect(source, selectedDevice, current).bottom + GRID_SIZE);
        clone.tabletConfig.y = clone.desktopConfig.y;
        clone.mobileConfig.y = clone.desktopConfig.y;
        clone.y = clone.desktopConfig.y;
      }
      setSelectedSlotId(clone.id);
      return {
        ...current,
        layouts: [...(current.layouts || []), clone],
      };
    });
  }, [canEdit, commitDraft, selectedDevice]);

  const handleToggleVisibility = useCallback((slotId) => {
    updateSlot(slotId, (slot) => ({
      ...slot,
      visible: slot.visible === false,
    }));
  }, [updateSlot]);

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active.data.current || null);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const dragData = event.active.data.current;
    const dropData = event.over?.data.current;
    setActiveDrag(null);
    if (!dragData || !dropData || !canEdit) return;
    if (dragData.type === "library" && dropData.type === "slot") {
      handleAssignContainer(dropData.slotId, dragData.containerId);
    }
  }, [canEdit, handleAssignContainer]);

  const handlePublish = useCallback(async () => {
    if (!activeLayoutId || !canEdit) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      await persistDraft(draft, { silent: false });
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

  const handleRollback = useCallback(async (versionId) => {
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
  }, [activeLayoutId, canEdit, containerLibrary, openLayout]);

  const handleDeleteLayout = useCallback(async () => {
    if (!activeLayoutId || !canEdit || !window.confirm("Delete this homepage layout and its versions?")) return;
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
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading homepage builder...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Marketing • Homepage Builder
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              Visual Homepage Layout Builder
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Arrange existing homepage containers visually without changing the underlying container system. Slots are responsive, autosaved, publishable, and rendered through the existing storefront pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LayoutChooser
              layouts={layouts}
              activeLayoutId={activeLayoutId}
              onSelect={(id) => openLayout(id, containerLibrary)}
            />
            {canEdit ? (
              <button
                type="button"
                onClick={handleCreateLayoutDocument}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                <Plus className="h-4 w-4" />
                New Layout
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => persistDraft(draft)}
              disabled={!canEdit || saving || !activeLayoutId}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canEdit || publishing || !activeLayoutId}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={handleDeleteLayout}
                disabled={!activeLayoutId}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StatusPill tone={STATUS_STYLES[(layouts.find((layout) => layout._id === activeLayoutId)?.status || "draft").toLowerCase()]}>
            {(layouts.find((layout) => layout._id === activeLayoutId)?.status || "draft").toUpperCase()}
          </StatusPill>
          <StatusPill tone={saveState === "dirty" ? "bg-amber-100 text-amber-700" : saveState === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}>
            {saveState === "dirty" ? "Autosave Pending" : saveState === "error" ? "Save Failed" : "Saved"}
          </StatusPill>
          <StatusPill tone={isDefault ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}>
            {isDefault ? "Default Homepage" : "Secondary Layout"}
          </StatusPill>
          {!canEdit ? <StatusPill tone="bg-slate-100 text-slate-700">Read Only</StatusPill> : null}
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} disabled={!canEdit} />
            Set as default when published
          </label>
        </div>

        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        {notice ? <InlineMessage tone="info">{notice}</InlineMessage> : null}
        {preview?.warnings?.length ? (
          <InlineMessage tone="warning">
            {preview.warnings[0]?.message}
          </InlineMessage>
        ) : null}
      </div>

      {!activeLayoutId ? (
        <EmptyLayoutState canEdit={canEdit} onCreate={handleCreateLayoutDocument} />
      ) : (
        <div className="space-y-4">
            {/* Container Library Section - Above Canvas */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Container Library</div>
                  <div className="mt-1 text-xs text-slate-500">Available containers to add to your homepage layout. Drag and drop containers onto the canvas below.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContainerLibraryHorizontal(!showContainerLibraryHorizontal)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                    showContainerLibraryHorizontal
                      ? "bg-indigo-100 text-indigo-700"
                      : "border border-slate-200 text-slate-700"
                  }`}
                  title="Toggle Container Library View"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {showContainerLibraryHorizontal ? "Hide Containers" : "Show Containers"}
                </button>
              </div>

              {showContainerLibraryHorizontal && (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 overflow-auto">
                  <div className="flex gap-4 flex-wrap">
                    {(containerLibrary || []).map((container) => (
                      <div
                        key={container._id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData("containerData", JSON.stringify(container));
                        }}
                        className="flex flex-col items-center gap-3 p-4 rounded-[16px] border border-slate-200 bg-white cursor-move hover:border-indigo-300 hover:bg-indigo-50 transition min-w-[120px] shadow-sm"
                      >
                        <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-[12px] flex items-center justify-center overflow-hidden">
                          {container.thumbnail && container.thumbnail !== "" ? (
                            <img src={container.thumbnail} alt={container.name} className="w-full h-full object-cover" />
                          ) : (
                            <LayoutDashboard className="h-8 w-8 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-center text-sm font-semibold text-slate-900 truncate max-w-[120px]">{container.name}</div>
                          <div className="text-xs text-slate-500 text-center">{container.type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-950">Canvas</div>
                  <div className="mt-1 text-xs text-slate-500">Snap grid {GRID_SIZE}px • collision protected • responsive slots</div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    Add Layout
                  </button>
                ) : null}
              </div>

              <div className="flex gap-2">
                {Object.entries(DEVICE_CONFIG).map(([device, config]) => {
                  const Icon = config.icon;
                  const active = device === selectedDevice;
                  return (
                    <button
                      key={device}
                      type="button"
                      onClick={() => setSelectedDevice(device)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-4">
                  <div className="text-sm font-semibold text-slate-950">Homepage Canvas</div>
                  <div className="mt-1 text-xs text-slate-500">Drag, resize, replace, hide, duplicate, and delete layout blocks.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setShowPreviewPanel(!showPreviewPanel)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                      showPreviewPanel
                        ? "bg-indigo-100 text-indigo-700"
                        : "border border-slate-200 text-slate-700"
                    }`}
                  >
                    {showPreviewPanel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                      showSettingsPanel
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 text-slate-700"
                    }`}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => openLayout(activeLayoutId, containerLibrary)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Reload
                  </button>
                </div>

                <div className="overflow-auto rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.18)_1px,_transparent_0)] p-4 min-h-[1600px]" style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}>
                  <div
                    className="relative mx-auto rounded-[28px] border border-dashed border-slate-300 bg-slate-50"
                    style={{ width: canvasSize.width, height: Math.max(canvasSize.height, 1000) }}
                  >
                    {/* Canvas Icons Overlay */}
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        title="Live Preview"
                      >
                        <Play className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        title="Canvas Settings"
                      >
                        <Settings2 className="h-5 w-5" />
                      </button>
                    </div>
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
                      {(draft.layouts || []).map((slot) => (
                        <CanvasSlot
                          key={slot.id}
                          slot={slot}
                          draft={draft}
                          device={selectedDevice}
                          container={slot.containerId ? libraryMap.get(String(slot.containerId)) : null}
                          selected={slot.id === selectedSlotId}
                          canEdit={canEdit}
                          onSelect={() => setSelectedSlotId(slot.id)}
                          onChangeRect={handleSlotRectCommit}
                          onDelete={handleDeleteSlot}
                          onDuplicate={handleDuplicateSlot}
                          onToggleVisibility={handleToggleVisibility}
                          onOpenReplace={() => {
                            setSelectedSlotId(slot.id);
                            setReplacementPicker(true);
                          }}
                        />
                      ))}

                      {layoutLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-white/70 backdrop-blur-sm">
                          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                        </div>
                      ) : null}
                    </DndContext>
                  </div>
                </div>
              </div>
            </div>

            <section className="space-y-6">
              {showPreviewPanel ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Live Homepage Preview</div>
                      <div className="mt-1 text-xs text-slate-500">Rendered through the existing shared storefront renderer with published-layout compatibility.</div>
                    </div>
                    <StatusPill tone="bg-slate-100 text-slate-700">
                      {DEVICE_CONFIG[selectedDevice].label}
                    </StatusPill>
                  </div>
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <DynamicHomepageRenderer rows={preview.rows || []} containers={preview.containers || []} loading={layoutLoading} bareCarouselShell />
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}

      <ReplacementModal
        open={replacementPicker}
        library={filteredLibrary}
        onClose={() => setReplacementPicker(false)}
        onSelect={(containerId) => {
          if (!selectedSlotId) return;
          handleAssignContainer(selectedSlotId, containerId);
        }}
      />
    </div>
  );
}

function LayoutChooser({ layouts, activeLayoutId, onSelect }) {
  return (
    <select
      value={activeLayoutId}
      onChange={(event) => onSelect(event.target.value)}
      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
    >
      {layouts.length ? layouts.map((layout) => (
        <option key={layout._id} value={layout._id}>
          {layout.name}
        </option>
      )) : <option value="">No layouts</option>}
    </select>
  );
}

function EmptyLayoutState({ canEdit, onCreate }) {
  return (
    <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
        <LayoutDashboard className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-slate-950">No homepage layouts yet</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Create the first visual layout document, then add empty slots and drop existing homepage containers into place.
      </p>
      {canEdit ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Create Homepage Layout
        </button>
      ) : null}
    </div>
  );
}

function InlineMessage({ children, tone }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";
  return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

function StatusPill({ children, tone }) {
  return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>{children}</span>;
}

function LibraryCard({ container, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${container._id}`,
    data: { type: "library", containerId: container._id },
    disabled: !canEdit,
  });
  const thumbnail = resolveContainerThumbnail(container);

  return (
    <div
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }}
      className="rounded-[22px] border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300"
    >
      <div className="flex gap-3">
        <button
          type="button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          disabled={!canEdit}
          className="mt-1 rounded-full border border-slate-200 p-2 text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="h-14 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {thumbnail ? (
                <img src={thumbnail} alt={getContainerLabel(container)} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {container.containerType}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">{getContainerTypeLabel(container)}</div>
              <div className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{container.description || "Existing homepage container"}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <StatusPill tone={container.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}>
              {container.status}
            </StatusPill>
          </div>
        </div>
      </div>
    </div>
  );
}

const CanvasSlot = memo(function CanvasSlot({
  slot,
  draft,
  device,
  container,
  selected,
  canEdit,
  onSelect,
  onChangeRect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onOpenReplace,
}) {
  const rect = getSlotRect(slot, device, draft);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { type: "slot", slotId: slot.id },
    disabled: !canEdit,
  });

  return (
    <Rnd
      size={{ width: rect.width, height: rect.height }}
      position={{ x: rect.x, y: rect.y }}
      bounds="parent"
      dragGrid={[GRID_SIZE, GRID_SIZE]}
      resizeGrid={[GRID_SIZE, GRID_SIZE]}
      disableDragging={!canEdit}
      enableResizing={canEdit ? { topLeft: true, topRight: true, bottomLeft: true, bottomRight: true } : false}
      lockAspectRatio={slot?.settings?.lockAspectRatio === true}
      onDragStart={onSelect}
      onResizeStart={onSelect}
      onDragStop={(_, data) => onChangeRect(slot.id, { x: data.x, y: data.y, width: rect.width, height: rect.height })}
      onResizeStop={(_, __, ref, ___, position) =>
        onChangeRect(slot.id, {
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        })
      }
      style={{ zIndex: selected ? 40 : slot.zIndex || 1 }}
      className="group"
    >
      <div
        ref={setNodeRef}
        onClick={onSelect}
        className={`relative h-full w-full overflow-hidden rounded-[24px] border transition ${
          selected
            ? "border-indigo-500 bg-white shadow-[0_18px_50px_-24px_rgba(99,102,241,0.45)]"
            : isOver
              ? "border-orange-400 bg-orange-50"
              : "border-slate-300 bg-white"
        }`}
      >
        {selected ? (
          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 px-2 py-1 shadow-lg">
            <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicate(slot.id); }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenReplace(); }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              <WandSparkles className="h-4 w-4" />
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onToggleVisibility(slot.id); }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              {slot.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(slot.id); }} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{slot.id}</div>
              <div className="mt-1 text-xs text-slate-500">
                {Math.round(rect.width)} × {Math.round(rect.height)} px
              </div>
            </div>
            <StatusPill tone={container ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
              {container ? "Assigned" : "Empty"}
            </StatusPill>
          </div>

          {container ? (
            <button type="button" onClick={onSelect} className="flex h-full w-full flex-col px-4 py-4 text-left">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">{getContainerTypeLabel(container)}</div>
                <div className="mt-3 line-clamp-3 text-xs leading-6 text-slate-500">{container.description || "This slot references an existing homepage container."}</div>
              </div>
              <div className="mt-auto rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                Drag another container here to replace it.
              </div>
            </button>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
              Drop existing container here
            </div>
          )}
        </div>
      </div>
    </Rnd>
  );
});

function LayoutSettingsPanel({ draft, slot, device, canEdit, onUpdateSlot, onRectCommit }) {
  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        Select a layout slot to edit its position, size, spacing, background, and responsive visibility.
      </div>
    );
  }

  const rect = getSlotRect(slot, device, draft);
  const updateConfigField = (field, value) => {
    onUpdateSlot(slot.id, (current) => ({
      ...current,
      ...(device === "desktop" && ["x", "y", "width", "height"].includes(field) ? { [field]: value } : {}),
      [`${device}Config`]: {
        ...getSlotConfig(current, device),
        [field]: value,
      },
    }));
  };

  const commitRectField = (field, value) => {
    const nextRect = { ...rect, [field]: snap(value) };
    onRectCommit(slot.id, nextRect);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-950">Layout Properties</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="ID">
            <input value={slot.id} disabled className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500" />
          </Field>
          <Field label="Z Index">
            <input
              type="number"
              min={0}
              max={500}
              value={slot.zIndex || 1}
              disabled={!canEdit}
              onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, zIndex: Number(event.target.value || 1) }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </Field>
          <Field label="Position X">
            <input type="number" value={rect.x} disabled={!canEdit} onChange={(event) => updateConfigField("x", Number(event.target.value || 0))} onBlur={(event) => commitRectField("x", Number(event.target.value || 0))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Position Y">
            <input type="number" value={rect.y} disabled={!canEdit} onChange={(event) => updateConfigField("y", Number(event.target.value || 0))} onBlur={(event) => commitRectField("y", Number(event.target.value || 0))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Width">
            <input type="number" value={rect.width} disabled={!canEdit} onChange={(event) => updateConfigField("width", Number(event.target.value || 0))} onBlur={(event) => commitRectField("width", Number(event.target.value || 0))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Height">
            <input type="number" value={rect.height} disabled={!canEdit} onChange={(event) => updateConfigField("height", Number(event.target.value || 0))} onBlur={(event) => commitRectField("height", Number(event.target.value || 0))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-950">Spacing & Background</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Padding">
            <input type="number" min={0} max={160} value={slot.settings?.padding || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, padding: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Background">
            <input value={slot.settings?.backgroundColor || ""} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, backgroundColor: event.target.value } }))} placeholder="#ffffff" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Margin Top">
            <input type="number" min={0} max={160} value={slot.settings?.marginTop || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, marginTop: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Margin Bottom">
            <input type="number" min={0} max={160} value={slot.settings?.marginBottom || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, marginBottom: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Margin Left">
            <input type="number" min={0} max={160} value={slot.settings?.marginLeft || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, marginLeft: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
          <Field label="Margin Right">
            <input type="number" min={0} max={160} value={slot.settings?.marginRight || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, marginRight: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </Field>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={slot.visible !== false} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, visible: event.target.checked }))} />
            Visible in layout
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={slot.settings?.lockAspectRatio === true} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, settings: { ...current.settings, lockAspectRatio: event.target.checked } }))} />
            Lock aspect ratio
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-950">Responsive Overrides</div>
        <div className="mt-4 space-y-4">
          {Object.entries(DEVICE_CONFIG).map(([key, config]) => {
            const item = getSlotConfig(slot, key);
            const Icon = config.icon;
            return (
              <div key={key} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-950">{config.label}</div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="X">
                    <input type="number" value={item.x || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [`${key}Config`]: { ...getSlotConfig(current, key), x: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </Field>
                  <Field label="Y">
                    <input type="number" value={item.y || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [`${key}Config`]: { ...getSlotConfig(current, key), y: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </Field>
                  <Field label="Width">
                    <input type="number" value={item.width || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [`${key}Config`]: { ...getSlotConfig(current, key), width: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </Field>
                  <Field label="Height">
                    <input type="number" value={item.height || 0} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [`${key}Config`]: { ...getSlotConfig(current, key), height: Number(event.target.value || 0) } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </Field>
                </div>
                <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={item.visible !== false} disabled={!canEdit} onChange={(event) => onUpdateSlot(slot.id, (current) => ({ ...current, [`${key}Config`]: { ...getSlotConfig(current, key), visible: event.target.checked } }))} />
                  Visible on {config.label.toLowerCase()}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContainerSettingsPanel({ slot, container, schema, canEdit, onLoadSchema, onUpdateSlot, onReplace }) {
  useEffect(() => {
    if (container?.containerType && !schema) {
      onLoadSchema(container.containerType).catch(() => {});
    }
  }, [container?.containerType, onLoadSchema, schema]);

  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        Select a slot to inspect its assigned container and configure layout-level container overrides.
      </div>
    );
  }

  if (!container) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        This slot is empty. Assign a container from the library to unlock schema-driven settings.
      </div>
    );
  }

  const typeFields = schema?.typeFields || [];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">{getContainerLabel(container)}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{getContainerTypeLabel(container)}</div>
            <div className="mt-2 text-xs leading-6 text-slate-500">
              Homepage Containers remain the source of truth. These fields store layout-specific overrides that are merged at render time.
            </div>
          </div>
          <button type="button" onClick={onReplace} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            <WandSparkles className="h-4 w-4" />
            Replace
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-950">Container Overrides</div>
        <div className="mt-4 space-y-4">
          {typeFields.length ? typeFields.map((field) => (
            <SchemaField
              key={field.name}
              field={field}
              value={slot.containerSettings?.[field.name] ?? container?.config?.[field.name]}
              disabled={!canEdit}
              onChange={(nextValue) =>
                onUpdateSlot(slot.id, (current) => ({
                  ...current,
                  containerSettings: {
                    ...(current.containerSettings || {}),
                    [field.name]: nextValue,
                  },
                }))
              }
            />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
              No schema-driven override fields are registered for this container type.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SchemaField({ field, value, disabled, onChange }) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <span>{field.label}</span>
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={field.label}>
        <select value={value ?? field.defaultValue ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
          {(field.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === "number") {
    return (
      <Field label={field.label}>
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step || 1}
          value={value ?? field.defaultValue ?? 0}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value || 0))}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
        />
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field label={field.label}>
        <textarea value={value ?? field.defaultValue ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
      </Field>
    );
  }

  if (field.type === "array" || field.type === "async-multiselect" || field.type === "tags") {
    return (
      <Field label={field.label}>
        <textarea
          value={getComplexFieldValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(parseComplexFieldValue(field, event.target.value))}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-mono"
        />
      </Field>
    );
  }

  return (
    <Field label={field.label}>
      <input value={value ?? field.defaultValue ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
    </Field>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-900">{label}</span>
      {children}
    </label>
  );
}

function ReplacementModal({ open, library, onClose, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-950">Replace Container</div>
            <div className="mt-1 text-sm text-slate-500">Choose an existing homepage container for the selected slot.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] gap-3 overflow-auto p-6 md:grid-cols-2">
          {library.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => onSelect(item._id)}
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300"
            >
              <div className="text-sm font-semibold text-slate-950">{getContainerLabel(item)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">{getContainerTypeLabel(item)}</div>
              <div className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">{item.description || "Existing homepage container"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
