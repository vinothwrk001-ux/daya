import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  History,
  LayoutTemplate,
  Monitor,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { DynamicHomepageRenderer } from "../components/homepage/DynamicHomepageRenderer";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import {
  createHomepageBuilderLayout,
  getHomepageBuilderLayout,
  listHomepageBuilderContainers,
  listHomepageBuilderLayouts,
  listHomepageBuilderVersions,
  previewHomepageBuilderLayout,
  publishHomepageBuilderLayout,
  rollbackHomepageBuilderVersion,
  saveHomepageBuilderDraft,
} from "../services/homepageBuilderService";

const inputClassName =
  "min-h-[46px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800/70";
const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition";
const defaultSeo = {
  metaTitle: "",
  metaDescription: "",
  openGraphTitle: "",
  openGraphDescription: "",
  openGraphImage: "",
  canonicalUrl: "",
  schemaMarkup: "",
};

const previewDevices = [
  { value: "desktop", label: "Desktop", icon: Monitor },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "mobile", label: "Mobile", icon: Smartphone },
];

const rowPresets = [
  { label: "1 Col", value: "1-col", count: 1 },
  { label: "2 Col", value: "2-col", count: 2 },
  { label: "3 Col", value: "3-col", count: 3 },
  { label: "4 Col", value: "4-col", count: 4 },
  { label: "Custom", value: "custom", count: 3 },
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

function defaultWidths(count) {
  if (count <= 1) {
    return { desktop: [100], tablet: [100], mobile: [100] };
  }
  if (count === 2) {
    return { desktop: [50, 50], tablet: [50, 50], mobile: [100, 100] };
  }
  if (count === 3) {
    return { desktop: [33.34, 33.33, 33.33], tablet: [50, 50, 100], mobile: [100, 100, 100] };
  }
  return { desktop: [25, 25, 25, 25], tablet: [50, 50, 50, 50], mobile: [100, 100, 100, 100] };
}

function createColumn(index, widths) {
  return {
    id: createId("column"),
    order: index,
    width: widths.desktop[index],
    span: Math.max(1, Math.round((widths.desktop[index] / 100) * 12)),
    desktopWidth: widths.desktop[index],
    tabletWidth: widths.tablet[index],
    mobileWidth: widths.mobile[index],
    minWidth: 12,
    containers: [],
  };
}

function createRow(type = "1-col", count = 1, order = 0) {
  const safeCount = Math.min(Math.max(count, 1), 4);
  const widths = defaultWidths(safeCount);
  return {
    id: createId("row"),
    order,
    type,
    collapsed: false,
    columns: Array.from({ length: safeCount }).map((_, index) => createColumn(index, widths)),
  };
}

function createEmptyDraft(name = "Homepage Layout") {
  return {
    name,
    slug: slugify(name),
    seo: { ...defaultSeo },
    rows: [],
    notes: "",
  };
}

function createInstanceFromContainer(container, index = 0) {
  return {
    instanceId: createId("instance"),
    containerId: container._id,
    order: index,
    visible: true,
    settings: {
      minHeight: Number(container.presentation?.layout?.customHeight || 0),
      padding: Number(container.presentation?.layout?.padding || 0),
      marginTop: Number(container.presentation?.layout?.marginTop || 0),
      marginRight: Number(container.presentation?.layout?.marginRight || 0),
      marginBottom: Number(container.presentation?.layout?.marginBottom || 0),
      marginLeft: Number(container.presentation?.layout?.marginLeft || 0),
      backgroundColor: "",
      customCssClasses: container.presentation?.customCssClasses || "",
    },
    desktopConfig: {
      width: 0,
      height: Number(container.presentation?.layout?.customHeight || 0),
      columns: Number(container.config?.desktopColumns || 0),
      spacing: Number(container.config?.gapSize || 0),
      visible: container.visibility?.desktop !== false,
    },
    tabletConfig: {
      width: 0,
      height: Number(container.presentation?.layout?.customHeight || 0),
      columns: Number(container.config?.tabletColumns || 0),
      spacing: Number(container.config?.gapSize || 0),
      visible: container.visibility?.tablet !== false,
    },
    mobileConfig: {
      width: 0,
      height: Number(container.presentation?.layout?.customHeight || 0),
      columns: Number(container.config?.mobileColumns || 0),
      spacing: Number(container.config?.gapSize || 0),
      visible: container.visibility?.mobile !== false,
    },
  };
}

function withOrderedRows(rows = []) {
  return rows.map((row, rowIndex) => ({
    ...row,
    order: rowIndex,
    columns: (row.columns || []).map((column, columnIndex) => ({
      ...column,
      order: columnIndex,
      containers: (column.containers || []).map((instance, instanceIndex) => ({
        ...instance,
        order: instanceIndex,
      })),
    })),
  }));
}

function buildDraftPayload(layoutName, draft, isDefault) {
  return {
    name: layoutName || draft.name,
    slug: draft.slug || slugify(layoutName || draft.name),
    isDefault,
    draft: {
      ...draft,
      rows: withOrderedRows(draft.rows || []),
    },
  };
}

function getContainerLabel(container) {
  return container?.title || container?.name || "Container";
}

function getContainerTypeLabel(container) {
  return container?.containerType?.replace(/_/g, " ") || "Container";
}

function findColumn(rows, columnId) {
  for (const row of rows) {
    for (const column of row.columns || []) {
      if (column.id === columnId) {
        return { rowId: row.id, column };
      }
    }
  }
  return null;
}

function findInstance(rows, instanceId) {
  for (const row of rows) {
    for (const column of row.columns || []) {
      const index = (column.containers || []).findIndex((item) => item.instanceId === instanceId);
      if (index >= 0) {
        return { rowId: row.id, columnId: column.id, index, instance: column.containers[index] };
      }
    }
  }
  return null;
}

function setDeviceWidths(row, device, nextWidths) {
  const key = device === "tablet" ? "tabletWidth" : device === "mobile" ? "mobileWidth" : "desktopWidth";
  return {
    ...row,
    columns: row.columns.map((column) =>
      nextWidths[column.id] !== undefined ? { ...column, [key]: nextWidths[column.id] } : column
    ),
  };
}

function rebalanceRowColumns(row, nextCount = row.columns.length) {
  const count = Math.min(Math.max(nextCount, 1), 4);
  const widths = defaultWidths(count);
  const nextColumns = [...(row.columns || [])];
  while (nextColumns.length < count) {
    nextColumns.push(createColumn(nextColumns.length, widths));
  }
  const trimmed = nextColumns.slice(0, count);
  return {
    ...row,
    type: count === 1 ? "1-col" : count === 2 ? "2-col" : count === 3 ? "3-col" : count === 4 ? "4-col" : "custom",
    columns: trimmed.map((column, index) => ({
      ...column,
      order: index,
      width: widths.desktop[index],
      span: Math.max(1, Math.round((widths.desktop[index] / 100) * 12)),
      desktopWidth: widths.desktop[index],
      tabletWidth: widths.tablet[index],
      mobileWidth: widths.mobile[index],
    })),
  };
}

function getDragLabel(activeDrag, libraryMap, draft) {
  if (!activeDrag) return "";
  if (activeDrag.type === "library") {
    return getContainerLabel(libraryMap.get(String(activeDrag.containerId)));
  }
  if (activeDrag.type === "row") {
    const row = (draft.rows || []).find((item) => item.id === activeDrag.rowId);
    return row ? `Row ${row.order + 1}` : "Row";
  }
  if (activeDrag.type === "instance") {
    const located = findInstance(draft.rows || [], activeDrag.instanceId);
    const container = libraryMap.get(String(located?.instance?.containerId));
    return getContainerLabel(container);
  }
  return "";
}

export function AdminHomepageBuilderPage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [containerLibrary, setContainerLibrary] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [activeLayoutId, setActiveLayoutId] = useState("");
  const [layoutName, setLayoutName] = useState("Homepage Layout");
  const [layoutUpdatedAt, setLayoutUpdatedAt] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [draft, setDraft] = useState(createEmptyDraft());
  const [preview, setPreview] = useState({ layout: null, rows: [], containers: [] });
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [activeDrag, setActiveDrag] = useState(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserTarget, setChooserTarget] = useState(null);
  const saveTimeoutRef = useRef(null);
  const resizeStateRef = useRef(null);

  const authToken = useAuthStore((s) => s.token);
  const staffToken = useStaffAuthStore((s) => s.token);
  const hasAuth = Boolean(authToken || staffToken);

  const libraryMap = useMemo(
    () => new Map(containerLibrary.map((item) => [String(item._id), item])),
    [containerLibrary]
  );

  const selectedInstance = useMemo(
    () => findInstance(draft.rows || [], selectedInstanceId)?.instance || null,
    [draft.rows, selectedInstanceId]
  );

  const selectedContainer = useMemo(
    () => (selectedInstance ? libraryMap.get(String(selectedInstance.containerId)) : null),
    [libraryMap, selectedInstance]
  );

  const refreshLayouts = useCallback(async () => {
    const response = await listHomepageBuilderLayouts();
    const nextLayouts = response?.data || [];
    setLayouts(nextLayouts);
    return nextLayouts;
  }, []);

  const refreshVersions = useCallback(async (layoutId) => {
    if (!layoutId) return;
    const response = await listHomepageBuilderVersions(layoutId);
    setVersions(response?.data || []);
  }, []);

  async function openLayout(layoutId, nextLibrary = containerLibrary) {
    if (!layoutId) return;
    setLayoutLoading(true);
    setError("");
    try {
      const response = await getHomepageBuilderLayout(layoutId);
      const layout = response?.data;
      const nextDraft = deepClone(layout?.draft || createEmptyDraft(layout?.name || "Homepage Layout"));
      nextDraft.rows = withOrderedRows(nextDraft.rows || []);
      setActiveLayoutId(layoutId);
      setLayoutName(layout?.name || nextDraft.name || "Homepage Layout");
      setLayoutUpdatedAt(layout?.updatedAt || "");
      setIsDefault(Boolean(layout?.isDefault));
      setDraft(nextDraft);
      setSelectedInstanceId(nextDraft.rows?.[0]?.columns?.[0]?.containers?.[0]?.instanceId || "");
      setHistoryPast([]);
      setHistoryFuture([]);
      setSaveState("saved");
      setContainerLibrary(nextLibrary);
      await refreshVersions(layoutId);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLayoutLoading(false);
    }
  }

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
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function commitDraft(updater, { trackHistory = true } = {}) {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const normalized = next?.rows ? { ...next, rows: withOrderedRows(next.rows || []) } : next;
      if (trackHistory) {
        setHistoryPast((past) => [...past.slice(-39), deepClone(current)]);
        setHistoryFuture([]);
      }
      setSaveState("dirty");
      return normalized;
    });
  }

  async function persistDraft(nextDraft = draft, options = {}) {
    if (!activeLayoutId) return null;
    setSaving(true);
    setError("");
    if (!hasAuth) {
      setError("Unauthorized: you are not signed in for admin actions.");
      setSaving(false);
      setSaveState("error");
      return null;
    }
    try {
      const response = await saveHomepageBuilderDraft(
        activeLayoutId,
        buildDraftPayload(layoutName, nextDraft, isDefault)
      );
      setLayoutUpdatedAt(response?.data?.updatedAt || response?.data?.draft?.savedAt || layoutUpdatedAt);
      if (!options.silent) {
        await refreshLayouts();
      }
      setSaveState("saved");
      return response?.data;
    } catch (err) {
      setError(normalizeError(err));
      setSaveState("error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!activeLayoutId || saveState !== "dirty") return undefined;
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      persistDraft(draft, { silent: true });
    }, 2000);
    return () => window.clearTimeout(saveTimeoutRef.current);
  }, [activeLayoutId, draft, saveState]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        if (!hasAuth) return;
        const response = await previewHomepageBuilderLayout({
          draft: buildDraftPayload(layoutName, draft, isDefault).draft,
          device: previewDevice,
        });
        if (active) {
          setPreview(response?.data || { layout: null, rows: [], containers: [] });
        }
      } catch (err) {
        if (active) {
          setError(normalizeError(err));
        }
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [draft, isDefault, layoutName, layoutUpdatedAt, previewDevice]);

  function handleUndo() {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) => [deepClone(draft), ...future.slice(0, 39)]);
    setDraft(previous);
    setSaveState("dirty");
  }

  function handleRedo() {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryPast((past) => [...past.slice(-39), deepClone(draft)]);
    setHistoryFuture((future) => future.slice(1));
    setDraft(next);
    setSaveState("dirty");
  }

  function addRow(preset) {
    commitDraft((current) => ({
      ...current,
      rows: withOrderedRows([...current.rows, createRow(preset.value, preset.count, current.rows.length)]),
    }));
  }

  function duplicateRow(rowId) {
    commitDraft((current) => {
      const index = current.rows.findIndex((row) => row.id === rowId);
      if (index < 0) return current;
      const source = current.rows[index];
      const clone = {
        ...deepClone(source),
        id: createId("row"),
        columns: source.columns.map((column) => ({
          ...deepClone(column),
          id: createId("column"),
          containers: column.containers.map((instance) => ({
            ...deepClone(instance),
            instanceId: createId("instance"),
          })),
        })),
      };
      const nextRows = [...current.rows];
      nextRows.splice(index + 1, 0, clone);
      return { ...current, rows: withOrderedRows(nextRows) };
    });
  }

  function deleteRow(rowId) {
    commitDraft((current) => ({
      ...current,
      rows: withOrderedRows(current.rows.filter((row) => row.id !== rowId)),
    }));
  }

  function toggleRowCollapse(rowId) {
    commitDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, collapsed: !row.collapsed } : row)),
    }));
  }

  function addColumnToRow(rowId) {
    commitDraft((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId ? rebalanceRowColumns(row, Math.min((row.columns || []).length + 1, 4)) : row
      ),
    }));
  }

  function removeColumnFromRow(rowId, columnId) {
    commitDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => {
        if (row.id !== rowId || row.columns.length <= 1) return row;
        const columnIndex = row.columns.findIndex((column) => column.id === columnId);
        if (columnIndex < 0) return row;
        const nextColumns = row.columns.filter((column) => column.id !== columnId);
        const movedItems = row.columns[columnIndex].containers || [];
        if (movedItems.length) {
          const targetIndex = Math.max(0, columnIndex - 1);
          nextColumns[targetIndex] = {
            ...nextColumns[targetIndex],
            containers: [...nextColumns[targetIndex].containers, ...movedItems],
          };
        }
        return rebalanceRowColumns({ ...row, columns: nextColumns }, nextColumns.length);
      }),
    }));
  }

  function updateInstance(instanceId, updater) {
    commitDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => ({
        ...row,
        columns: row.columns.map((column) => ({
          ...column,
          containers: column.containers.map((item) =>
            item.instanceId === instanceId ? (typeof updater === "function" ? updater(item) : updater) : item
          ),
        })),
      })),
    }));
  }

  function duplicateInstance(instanceId) {
    commitDraft((current) => {
      const located = findInstance(current.rows, instanceId);
      if (!located) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.id !== located.rowId
            ? row
            : {
                ...row,
                columns: row.columns.map((column) =>
                  column.id !== located.columnId
                    ? column
                    : {
                        ...column,
                        containers: column.containers.flatMap((item) =>
                          item.instanceId === instanceId
                            ? [item, { ...deepClone(item), instanceId: createId("instance") }]
                            : [item]
                        ),
                      }
                ),
              }
        ),
      };
    });
  }

  function deleteInstance(instanceId) {
    commitDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => ({
        ...row,
        columns: row.columns.map((column) => ({
          ...column,
          containers: column.containers.filter((item) => item.instanceId !== instanceId),
        })),
      })),
    }));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId("");
    }
  }

  function toggleInstance(instanceId) {
    updateInstance(instanceId, (item) => ({ ...item, visible: !item.visible }));
  }

  function insertLibraryContainer(current, containerId, target) {
    const sourceContainer = libraryMap.get(String(containerId));
    if (!sourceContainer) return current;
    const instance = createInstanceFromContainer(sourceContainer);
    return moveOrInsertInstance(current, instance, null, target);
  }

  function openChooserForColumn(rowId, columnId) {
    setChooserTarget({ rowId, columnId });
    setChooserOpen(true);
  }

  function closeChooser() {
    setChooserOpen(false);
    setChooserTarget(null);
  }

  function moveOrInsertInstance(current, instanceOrSource, source, target) {
    const nextRows = deepClone(current.rows);
    let movingInstance = source ? null : deepClone(instanceOrSource);

    if (source) {
      const sourceColumn = findColumn(nextRows, source.columnId)?.column;
      if (!sourceColumn) return current;
      const sourceIndex = sourceColumn.containers.findIndex((item) => item.instanceId === source.instanceId);
      if (sourceIndex < 0) return current;
      movingInstance = sourceColumn.containers[sourceIndex];
      sourceColumn.containers.splice(sourceIndex, 1);
    }

    if (!movingInstance) return current;
    const targetColumn = findColumn(nextRows, target.columnId)?.column;
    if (!targetColumn) return current;

    let insertIndex = targetColumn.containers.length;
    if (target.instanceId) {
      const foundIndex = targetColumn.containers.findIndex((item) => item.instanceId === target.instanceId);
      if (foundIndex >= 0) {
        insertIndex = foundIndex;
      }
    }
    targetColumn.containers.splice(insertIndex, 0, movingInstance);
    return { ...current, rows: withOrderedRows(nextRows) };
  }

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current || null);
  }

  function handleDragEnd(event) {
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;
    setActiveDrag(null);
    if (!activeData || !overData) return;

    if (activeData.type === "row" && overData.type === "row" && activeData.rowId !== overData.rowId) {
      commitDraft((current) => {
        const oldIndex = current.rows.findIndex((row) => row.id === activeData.rowId);
        const newIndex = current.rows.findIndex((row) => row.id === overData.rowId);
        if (oldIndex < 0 || newIndex < 0) return current;
        const nextRows = [...current.rows];
        const [moved] = nextRows.splice(oldIndex, 1);
        nextRows.splice(newIndex, 0, moved);
        return { ...current, rows: withOrderedRows(nextRows) };
      });
      return;
    }

    const target =
      overData.type === "column"
        ? { columnId: overData.columnId }
        : overData.type === "instance"
          ? { columnId: overData.columnId, instanceId: overData.instanceId }
          : null;

    if (!target) return;

    if (activeData.type === "library") {
      commitDraft((current) => insertLibraryContainer(current, activeData.containerId, target));
      return;
    }

    if (activeData.type === "instance") {
      if (activeData.instanceId === target.instanceId) return;
      commitDraft((current) =>
        moveOrInsertInstance(
          current,
          null,
          {
            rowId: activeData.rowId,
            columnId: activeData.columnId,
            instanceId: activeData.instanceId,
          },
          target
        )
      );
    }
  }

  useEffect(() => {
    function handleMove(event) {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      const rowWidth = Math.max(state.rowWidth, 1);
      const deltaPercent = (delta / rowWidth) * 100;
      const left = Math.max(state.minWidth, state.startLeft + deltaPercent);
      const right = Math.max(state.minWidth, state.startRight - deltaPercent);
      const combined = left + right;
      const normalizedLeft = Number(((left / combined) * state.combined).toFixed(2));
      const normalizedRight = Number((state.combined - normalizedLeft).toFixed(2));

      commitDraft(
        (current) => ({
          ...current,
          rows: current.rows.map((row) => {
            if (row.id !== state.rowId) return row;
            const nextWidths = {
              [state.leftColumnId]: normalizedLeft,
              [state.rightColumnId]: normalizedRight,
            };
            return setDeviceWidths(row, state.device, nextWidths);
          }),
        }),
        { trackHistory: false }
      );
    }

    function handleUp() {
      resizeStateRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    if (resizeStateRef.current) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  function startColumnResize(event, row, leftColumn, rightColumn) {
    event.preventDefault();
    const container = event.currentTarget.closest("[data-row-width]");
    const rowWidth = container?.getBoundingClientRect().width || 1;
    const key = previewDevice === "tablet" ? "tabletWidth" : previewDevice === "mobile" ? "mobileWidth" : "desktopWidth";
    resizeStateRef.current = {
      startX: event.clientX,
      rowId: row.id,
      leftColumnId: leftColumn.id,
      rightColumnId: rightColumn.id,
      startLeft: Number(leftColumn[key] || 0),
      startRight: Number(rightColumn[key] || 0),
      combined: Number((leftColumn[key] || 0) + (rightColumn[key] || 0)),
      minWidth: 12,
      rowWidth,
      device: previewDevice,
    };
  }

  async function handleCreateLayout() {
    setSaving(true);
    setError("");
    try {
      const name = `Homepage Layout ${layouts.length + 1}`;
      const response = await createHomepageBuilderLayout({
        name,
        slug: slugify(name),
        isDefault: layouts.length === 0,
        draft: createEmptyDraft(name),
      });
      const created = response?.data;
      const nextLayouts = await refreshLayouts();
      await openLayout(created?._id || nextLayouts[0]?._id);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!activeLayoutId) return;
    setPublishing(true);
    setError("");
    try {
      await persistDraft(draft, { silent: true });
      await publishHomepageBuilderLayout(activeLayoutId);
      const nextLayouts = await refreshLayouts();
      await openLayout(activeLayoutId);
      setLayouts(nextLayouts);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(versionId) {
    if (!activeLayoutId) return;
    setPublishing(true);
    setError("");
    try {
      await rollbackHomepageBuilderVersion(activeLayoutId, versionId);
      const nextLayouts = await refreshLayouts();
      await openLayout(activeLayoutId);
      setLayouts(nextLayouts);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Loading homepage builder...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Catalog • Homepage Builder
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              Grid Homepage Layout Builder
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Arrange existing Homepage Containers into responsive rows and columns, preview instantly, and publish the live homepage without code changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleUndo} disabled={!historyPast.length} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}>
              <Undo2 className="h-4 w-4" />
              Undo
            </button>
            <button type="button" onClick={handleRedo} disabled={!historyFuture.length} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}>
              <Redo2 className="h-4 w-4" />
              Redo
            </button>
            <button type="button" onClick={() => persistDraft()} disabled={!activeLayoutId || saving} className={`${buttonClassName} bg-slate-900 text-white dark:bg-white dark:text-slate-900`}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={handlePublish} disabled={!activeLayoutId || publishing} className={`${buttonClassName} bg-emerald-600 text-white`}>
              <WandSparkles className="h-4 w-4" />
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <StatusPill>Save state: {saveState}</StatusPill>
          <StatusPill>Rows: {draft.rows.length}</StatusPill>
          <StatusPill>
            Containers: {draft.rows.reduce((sum, row) => sum + row.columns.reduce((columnSum, column) => columnSum + column.containers.length, 0), 0)}
          </StatusPill>
          <StatusPill>Versions: {versions.length}</StatusPill>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Layouts</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Drafts, published layouts, and rollback history.</div>
              </div>
              <button type="button" onClick={handleCreateLayout} className={`${buttonClassName} bg-slate-900 px-3 py-2 text-white dark:bg-white dark:text-slate-900`}>
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select value={activeLayoutId} onChange={(event) => openLayout(event.target.value)} className={inputClassName}>
                <option value="">Select a layout</option>
                {layouts.map((layout) => (
                  <option key={layout._id} value={layout._id}>
                    {layout.name} {layout.isDefault ? "• Live" : ""}
                  </option>
                ))}
              </select>
              <Field label="Layout name">
                <input
                  value={layoutName}
                  onChange={(event) => {
                    setLayoutName(event.target.value);
                    commitDraft((current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }), {
                      trackHistory: false,
                    });
                  }}
                  className={inputClassName}
                />
              </Field>
              <Field label="Slug">
                <input
                  value={draft.slug}
                  onChange={(event) => commitDraft((current) => ({ ...current, slug: slugify(event.target.value) }), { trackHistory: false })}
                  className={inputClassName}
                />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
                Make this the default published homepage
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Add Row</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Insert preset grid structures into the homepage flow.</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {rowPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => addRow(preset)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Container Library</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Drag existing Homepage Containers into any column.</div>
            <div className="mt-4 space-y-3">
              {containerLibrary.map((container) => (
                <DraggableLibraryCard key={container._id} container={container} />
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Canvas</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rows can be reordered. Columns accept drag-and-drop and can be resized for the current device mode.</div>
              </div>
              <div className="flex items-center gap-2">
                {previewDevices.map((device) => {
                  const Icon = device.icon;
                  const active = previewDevice === device.value;
                  return (
                    <button
                      key={device.value}
                      type="button"
                      onClick={() => setPreviewDevice(device.value)}
                      className={`rounded-full p-2 transition ${active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveDrag(null)}
              >
                <div className="space-y-5">
                  {draft.rows.map((row) => (
                    <RowCard
                      key={row.id}
                      row={row}
                      device={previewDevice}
                      libraryMap={libraryMap}
                      selectedInstanceId={selectedInstanceId}
                      onSelectInstance={setSelectedInstanceId}
                      onDuplicateRow={duplicateRow}
                      onDeleteRow={deleteRow}
                      onToggleRowCollapse={toggleRowCollapse}
                      onAddColumn={addColumnToRow}
                      onRemoveColumn={removeColumnFromRow}
                      onStartResize={startColumnResize}
                      onToggleInstance={toggleInstance}
                      onDuplicateInstance={duplicateInstance}
                      onDeleteInstance={deleteInstance}
                      onOpenChooser={openChooserForColumn}
                    />
                  ))}
                  {!draft.rows.length ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      Add a row preset, then drag Homepage Containers into the grid.
                    </div>
                  ) : null}
                </div>

                <DragOverlay>
                  {activeDrag ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      {getDragLabel(activeDrag, libraryMap, draft)}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Version History</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Published snapshots can be restored in one click.</div>
              </div>
              <History className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 space-y-3">
              {versions.length ? (
                versions.map((version) => (
                  <div key={version._id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Version {version.version}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {version.publishedAt ? new Date(version.publishedAt).toLocaleString() : "Draft snapshot"}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRollback(version._id)} className={`${buttonClassName} border border-slate-200 bg-white px-3 py-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200`}>
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No published versions yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Live Preview</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Powered by the same dynamic renderer used on the storefront homepage.</div>
              </div>
              <StatusPill>{previewDevice}</StatusPill>
            </div>
            <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <DynamicHomepageRenderer rows={preview.rows || []} containers={preview.containers || []} loading={layoutLoading} />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Container Settings</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Layout-only settings for the selected instance. Content stays in Homepage Containers.</div>
            <div className="mt-4">
              {selectedInstance ? (
                <InstanceSettingsPanel
                  instance={selectedInstance}
                  container={selectedContainer}
                  onChange={(updater) => updateInstance(selectedInstance.instanceId, updater)}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Select a container on the canvas to edit its layout and responsive behavior.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <ChooserModal
        open={chooserOpen}
        onClose={closeChooser}
        library={containerLibrary}
        onSelect={(containerId) => {
          if (!chooserTarget) return closeChooser();
          commitDraft((current) => insertLibraryContainer(current, containerId, { columnId: chooserTarget.columnId }));
          closeChooser();
        }}
      />
    </div>
  );
}

// Render chooser modal at root of the page component
// (we place it after the main component to keep file structure simple)


function DraggableLibraryCard({ container }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${container._id}`,
    data: { type: "library", containerId: container._id },
  });

  return (
    <div
      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 ${isDragging ? "opacity-60" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{getContainerLabel(container)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{getContainerTypeLabel(container)}</div>
          <div className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{container.description || "Drag into a row column to create a layout instance."}</div>
        </div>
      </div>
    </div>
  );
}

function RowCard({
  row,
  device,
  libraryMap,
  selectedInstanceId,
  onSelectInstance,
  onDuplicateRow,
  onDeleteRow,
  onToggleRowCollapse,
  onAddColumn,
  onRemoveColumn,
  onStartResize,
  onToggleInstance,
  onDuplicateInstance,
  onDeleteInstance,
  onOpenChooser,
}) {
  const rowDrag = useDraggable({ id: `row-${row.id}`, data: { type: "row", rowId: row.id } });
  const rowDrop = useDroppable({ id: `row-drop-${row.id}`, data: { type: "row", rowId: row.id } });
  const dragStyle = {
    transform: CSS.Translate.toString(rowDrag.transform),
    opacity: rowDrag.isDragging ? 0.65 : 1,
  };
  const widthKey = device === "tablet" ? "tabletWidth" : device === "mobile" ? "mobileWidth" : "desktopWidth";

  return (
    <div
      ref={rowDrop.setNodeRef}
      style={dragStyle}
      className={`rounded-[28px] border bg-white p-4 shadow-sm dark:bg-slate-900 ${rowDrop.isOver ? "border-orange-400" : "border-slate-200 dark:border-slate-800"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            ref={rowDrag.setNodeRef}
            {...rowDrag.attributes}
            {...rowDrag.listeners}
            className="rounded-full border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">Row {row.order + 1}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {row.type} • {row.columns.length} columns
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onAddColumn(row.id)} disabled={row.columns.length >= 4} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
            Add Column
          </button>
          <button type="button" onClick={() => onDuplicateRow(row.id)} className="rounded-full border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onToggleRowCollapse(row.id)} className="rounded-full border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300">
            {row.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => onDeleteRow(row.id)} className="rounded-full border border-rose-200 p-2 text-rose-500 dark:border-rose-900/50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!row.collapsed ? (
        <div className="mt-4" data-row-width>
          <div className="flex flex-wrap items-stretch gap-4">
            {row.columns.map((column, index) => (
              <ColumnDropZone
                key={column.id}
                row={row}
                column={column}
                widthPercent={column[widthKey]}
                libraryMap={libraryMap}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={onSelectInstance}
                onToggleInstance={onToggleInstance}
                onDuplicateInstance={onDuplicateInstance}
                onDeleteInstance={onDeleteInstance}
                onRemoveColumn={onRemoveColumn}
                onOpenChooser={onOpenChooser}
              >
                {index < row.columns.length - 1 ? (
                  <ResizeHandle onMouseDown={(event) => onStartResize(event, row, column, row.columns[index + 1])} />
                ) : null}
              </ColumnDropZone>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnDropZone({
  row,
  column,
  widthPercent,
  libraryMap,
  selectedInstanceId,
  onSelectInstance,
  onToggleInstance,
  onDuplicateInstance,
  onDeleteInstance,
  onRemoveColumn,
  onOpenChooser,
  children,
}) {
  const drop = useDroppable({ id: `column-${column.id}`, data: { type: "column", rowId: row.id, columnId: column.id } });

  return (
    <div
      ref={drop.setNodeRef}
      style={{
        flexBasis: widthPercent >= 99 ? "100%" : `calc(${widthPercent}% - 1rem)`,
        maxWidth: widthPercent >= 99 ? "100%" : `calc(${widthPercent}% - 1rem)`,
      }}
      className={`relative min-w-[240px] flex-1 rounded-[24px] border border-dashed p-3 ${drop.isOver ? "border-orange-400 bg-orange-50/70 dark:bg-orange-950/10" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {Math.round(widthPercent)}% width
        </div>
        {row.columns.length > 1 ? (
          <button type="button" onClick={() => onRemoveColumn(row.id, column.id)} className="rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {column.containers.length ? (
          column.containers.map((instance) => (
            <ContainerCanvasCard
              key={instance.instanceId}
              rowId={row.id}
              columnId={column.id}
              instance={instance}
              container={libraryMap.get(String(instance.containerId))}
              selected={instance.instanceId === selectedInstanceId}
              onSelect={() => onSelectInstance(instance.instanceId)}
              onToggle={() => onToggleInstance(instance.instanceId)}
              onDuplicate={() => onDuplicateInstance(instance.instanceId)}
              onDelete={() => onDeleteInstance(instance.instanceId)}
            />
          ))
        ) : (
          <div className="flex min-h-[160px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white/80 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
            Drop container here
          </div>
        )}
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => onOpenChooser && onOpenChooser(row.id, column.id)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950"
          >
            Add container
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ContainerCanvasCard({ rowId, columnId, instance, container, selected, onSelect, onToggle, onDuplicate, onDelete }) {
  const drag = useDraggable({
    id: `instance-${instance.instanceId}`,
    data: { type: "instance", rowId, columnId, instanceId: instance.instanceId },
  });
  const drop = useDroppable({
    id: `instance-drop-${instance.instanceId}`,
    data: { type: "instance", rowId, columnId, instanceId: instance.instanceId },
  });

  return (
    <div
      ref={drop.setNodeRef}
      style={{ transform: CSS.Translate.toString(drag.transform), opacity: drag.isDragging ? 0.6 : 1 }}
      className={`rounded-[22px] border bg-white shadow-sm dark:bg-slate-900 ${selected ? "border-slate-900 dark:border-white" : drop.isOver ? "border-orange-400" : "border-slate-200 dark:border-slate-800"}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <button type="button" onClick={onSelect} className="text-left">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{getContainerLabel(container)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {getContainerTypeLabel(container)}
          </div>
        </button>
        <button type="button" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} className="rounded-full border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300">
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onSelect} className="block w-full px-4 py-4 text-left">
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-5 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{getContainerLabel(container)}</div>
          <div className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
            {container?.description || "Existing Homepage Container placed in a builder column."}
          </div>
        </div>
      </button>
      <div className="flex items-center justify-end gap-1 px-3 pb-3">
        <button type="button" onClick={onDuplicate} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Copy className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggle} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          {instance.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onDelete} className="rounded-full p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ResizeHandle({ onMouseDown }) {
  return (
    <div className="pointer-events-none absolute right-[-12px] top-0 flex h-full items-center">
      <button
        type="button"
        onMouseDown={onMouseDown}
        className="pointer-events-auto flex h-20 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        ↔
      </button>
    </div>
  );
}

function InstanceSettingsPanel({ instance, container, onChange }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="font-semibold text-slate-950 dark:text-white">{getContainerLabel(container)}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Source: Homepage Containers • {getContainerTypeLabel(container)}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-950 dark:text-white">Instance Layout</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Min height">
            <input
              type="number"
              min={0}
              max={2400}
              value={instance.settings?.minHeight || 0}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, minHeight: Number(event.target.value || 0) } }))}
              className={inputClassName}
            />
          </Field>
          <Field label="Padding">
            <input
              type="number"
              min={0}
              max={160}
              value={instance.settings?.padding || 0}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, padding: Number(event.target.value || 0) } }))}
              className={inputClassName}
            />
          </Field>
          <Field label="Margin top">
            <input
              type="number"
              min={0}
              max={160}
              value={instance.settings?.marginTop || 0}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, marginTop: Number(event.target.value || 0) } }))}
              className={inputClassName}
            />
          </Field>
          <Field label="Margin bottom">
            <input
              type="number"
              min={0}
              max={160}
              value={instance.settings?.marginBottom || 0}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, marginBottom: Number(event.target.value || 0) } }))}
              className={inputClassName}
            />
          </Field>
          <Field label="Background">
            <input
              value={instance.settings?.backgroundColor || ""}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, backgroundColor: event.target.value } }))}
              className={inputClassName}
              placeholder="#ffffff"
            />
          </Field>
          <Field label="Custom classes">
            <input
              value={instance.settings?.customCssClasses || ""}
              onChange={(event) => onChange((current) => ({ ...current, settings: { ...current.settings, customCssClasses: event.target.value } }))}
              className={inputClassName}
              placeholder="hero-instance"
            />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={instance.visible !== false} onChange={(event) => onChange((current) => ({ ...current, visible: event.target.checked }))} />
          Visible in layout
        </label>
      </div>

      {[
        { key: "desktopConfig", label: "Desktop", icon: Monitor },
        { key: "tabletConfig", label: "Tablet", icon: Tablet },
        { key: "mobileConfig", label: "Mobile", icon: Smartphone },
      ].map((device) => {
        const Icon = device.icon;
        const config = instance[device.key] || {};
        return (
          <div key={device.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-orange-500" />
              <div className="text-sm font-semibold text-slate-950 dark:text-white">{device.label}</div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Height">
                <input
                  type="number"
                  min={0}
                  max={2400}
                  value={config.height || 0}
                  onChange={(event) => onChange((current) => ({ ...current, [device.key]: { ...current[device.key], height: Number(event.target.value || 0) } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="Columns">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={config.columns || 0}
                  onChange={(event) => onChange((current) => ({ ...current, [device.key]: { ...current[device.key], columns: Number(event.target.value || 0) } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="Spacing">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={config.spacing || 0}
                  onChange={(event) => onChange((current) => ({ ...current, [device.key]: { ...current[device.key], spacing: Number(event.target.value || 0) } }))}
                  className={inputClassName}
                />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={config.visible !== false} onChange={(event) => onChange((current) => ({ ...current, [device.key]: { ...current[device.key], visible: event.target.checked } }))} />
              Visible on {device.label.toLowerCase()}
            </label>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ children }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

function ChooserModal({ open, onClose, library, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Choose a container</div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700">Close</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 max-h-80 overflow-auto">
          {library.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => onSelect(item._id)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="font-semibold text-slate-900 dark:text-white">{getContainerLabel(item)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getContainerTypeLabel(item)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
