const mongoose = require("mongoose");
const { HomepageLayout, PAGE_CONTEXTS } = require("../models/HomepageLayout");
const { HomepageLayoutAssignment } = require("../models/HomepageLayoutAssignment");
const { HomepageLayoutDraft } = require("../models/HomepageLayoutDraft");
const { HomepageLayoutVersion } = require("../models/HomepageLayoutVersion");
const { HomepageContainer } = require("../models/HomepageContainer");
const homepageContainerService = require("./homepage-container.service");
const { AppError } = require("../utils/AppError");
const redisCache = require("../modules/recommendation/cache");

const PUBLIC_CACHE_TTL_MS = 60 * 1000;
const DEFAULT_GRID_SIZE = 20;
const DEFAULT_CANVAS = Object.freeze({
  desktop: { width: 1440, height: 2200 },
  tablet: { width: 768, height: 2400 },
  mobile: { width: 375, height: 2600 },
});
const DEVICE_KEYS = ["desktop", "tablet", "mobile"];
const DEVICE_COLUMNS = Object.freeze({ desktop: 12, tablet: 6, mobile: 1 });
const DEFAULT_LAYOUT_HEIGHT = Object.freeze({ desktop: 360, tablet: 320, mobile: 280 });
const responseCache = new Map();

function normalizePageContext(value) {
  const next = String(value || "GLOBAL_HOME").trim().toUpperCase();
  return PAGE_CONTEXTS.includes(next) ? next : "GLOBAL_HOME";
}

function setCache(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS });
}

function getCache(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
}

function invalidateCache(prefix = "homepage-builder:") {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
  redisCache.clearByPrefixes([prefix]).catch(() => {});
}

function createId(prefix) {
  return `${prefix}-${new mongoose.Types.ObjectId().toString()}`;
}

function clamp(value, fallback, { min = 0, max = 100 } = {}) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
}

function normalizeSeo(seo = {}) {
  return {
    metaTitle: String(seo.metaTitle || "").trim(),
    metaDescription: String(seo.metaDescription || "").trim(),
    canonicalUrl: String(seo.canonicalUrl || "").trim(),
    openGraphTitle: String(seo.openGraphTitle || "").trim(),
    openGraphDescription: String(seo.openGraphDescription || "").trim(),
    openGraphImage: String(seo.openGraphImage || "").trim(),
    twitterTitle: String(seo.twitterTitle || "").trim(),
    twitterDescription: String(seo.twitterDescription || "").trim(),
    twitterImage: String(seo.twitterImage || "").trim(),
    twitterCard: String(seo.twitterCard || "summary_large_image").trim(),
    schemaMarkup: String(seo.schemaMarkup || "").trim(),
  };
}

function normalizeDeviceConfig(input = {}) {
  return {
    x: clamp(input.x, 0, { min: 0, max: 5000 }),
    y: clamp(input.y, 0, { min: 0, max: 5000 }),
    width: clamp(input.width, 0, { min: 0, max: 2400 }),
    height: clamp(input.height, 0, { min: 0, max: 2400 }),
    columns: clamp(input.columns, 0, { min: 0, max: 12 }),
    spacing: clamp(input.spacing, 0, { min: 0, max: 120 }),
    visible: input.visible !== false,
  };
}

function normalizeSettings(settings = {}) {
  return {
    minHeight: clamp(settings.minHeight, 0, { min: 0, max: 2400 }),
    padding: clamp(settings.padding, 0, { min: 0, max: 160 }),
    marginTop: clamp(settings.marginTop, 0, { min: 0, max: 160 }),
    marginRight: clamp(settings.marginRight, 0, { min: 0, max: 160 }),
    marginBottom: clamp(settings.marginBottom, 0, { min: 0, max: 160 }),
    marginLeft: clamp(settings.marginLeft, 0, { min: 0, max: 160 }),
    backgroundColor: String(settings.backgroundColor || "").trim(),
    customCssClasses: String(settings.customCssClasses || "").trim(),
    lockAspectRatio: settings.lockAspectRatio === true,
  };
}

function normalizeContainerOverrides(input = {}) {
  return input && typeof input === "object" && !Array.isArray(input) ? JSON.parse(JSON.stringify(input)) : {};
}

function normalizeBuilderConfig(input = {}) {
  const canvas = input?.canvas && typeof input.canvas === "object" ? input.canvas : {};
  return {
    mode: String(input.mode || "visual").trim().toLowerCase(),
    gridSize: clamp(input.gridSize, DEFAULT_GRID_SIZE, { min: 4, max: 80 }),
    canvas: {
      desktop: {
        width: clamp(canvas?.desktop?.width, DEFAULT_CANVAS.desktop.width, { min: 320, max: 2400 }),
        height: clamp(canvas?.desktop?.height, DEFAULT_CANVAS.desktop.height, { min: 400, max: 6000 }),
      },
      tablet: {
        width: clamp(canvas?.tablet?.width, DEFAULT_CANVAS.tablet.width, { min: 320, max: 1800 }),
        height: clamp(canvas?.tablet?.height, DEFAULT_CANVAS.tablet.height, { min: 400, max: 6000 }),
      },
      mobile: {
        width: clamp(canvas?.mobile?.width, DEFAULT_CANVAS.mobile.width, { min: 280, max: 1200 }),
        height: clamp(canvas?.mobile?.height, DEFAULT_CANVAS.mobile.height, { min: 400, max: 6000 }),
      },
    },
  };
}

function normalizeInstance(instance = {}, index = 0) {
  return {
    instanceId: String(instance.instanceId || createId("instance")).trim(),
    containerId: String(instance.containerId || "").trim(),
    order: clamp(instance.order, index, { min: 0, max: 10000 }),
    visible: instance.visible !== false,
    settings: normalizeSettings(instance.settings || {}),
    desktopConfig: normalizeDeviceConfig(instance.desktopConfig || {}),
    tabletConfig: normalizeDeviceConfig(instance.tabletConfig || {}),
    mobileConfig: normalizeDeviceConfig(instance.mobileConfig || {}),
  };
}

function defaultWidths(count) {
  if (count <= 1) {
    return {
      desktop: [100],
      tablet: [100],
      mobile: [100],
    };
  }
  if (count === 2) {
    return {
      desktop: [50, 50],
      tablet: [50, 50],
      mobile: [100, 100],
    };
  }
  if (count === 3) {
    return {
      desktop: [33.34, 33.33, 33.33],
      tablet: [50, 50, 100],
      mobile: [100, 100, 100],
    };
  }
  return {
    desktop: [25, 25, 25, 25],
    tablet: [50, 50, 50, 50],
    mobile: [100, 100, 100, 100],
  };
}

function normalizeWidths(values = [], fallbackCount = 1, fallbackKey = "desktop") {
  const defaults = defaultWidths(fallbackCount)[fallbackKey];
  const next = Array.from({ length: fallbackCount }).map((_, index) =>
    clamp(values[index], defaults[index] ?? 100 / fallbackCount, { min: 8, max: 100 })
  );
  const total = next.reduce((sum, value) => sum + value, 0) || 100;
  return next.map((value) => Number(((value / total) * 100).toFixed(2)));
}

function percentToSpan(width) {
  return Math.min(12, Math.max(1, Math.round((Number(width || 100) / 100) * 12)));
}

function resolveRowType(count = 1, inputType = "") {
  const normalized = String(inputType || "").trim();
  if (normalized) return normalized;
  if (count === 1) return "1-col";
  if (count === 2) return "2-col";
  if (count === 3) return "3-col";
  if (count === 4) return "4-col";
  return "custom";
}

function normalizeColumn(column = {}, index = 0, widths = {}, count = 1) {
  const desktopWidth = widths.desktop[index];
  const tabletWidth = widths.tablet[index];
  const mobileWidth = widths.mobile[index];
  return {
    id: String(column.id || createId("column")).trim(),
    order: clamp(column.order, index, { min: 0, max: 10000 }),
    width: clamp(column.width, desktopWidth, { min: 8, max: 100 }),
    span: clamp(column.span, percentToSpan(desktopWidth), { min: 1, max: 12 }),
    desktopWidth,
    tabletWidth,
    mobileWidth,
    minWidth: clamp(column.minWidth, 12, { min: 8, max: 100 }),
    containers: (Array.isArray(column.containers) ? column.containers : [])
      .map((instance, instanceIndex) => normalizeInstance(instance, instanceIndex))
      .sort((a, b) => a.order - b.order),
  };
}

function normalizeRow(row = {}, index = 0) {
  const incomingColumns = Array.isArray(row.columns) ? row.columns : [];
  const count = Math.min(Math.max(incomingColumns.length || 1, 1), 12);
  const widths = {
    desktop: normalizeWidths(
      incomingColumns.map((column) => column.desktopWidth ?? column.width),
      count,
      "desktop"
    ),
    tablet: normalizeWidths(incomingColumns.map((column) => column.tabletWidth), count, "tablet"),
    mobile: normalizeWidths(incomingColumns.map((column) => column.mobileWidth), count, "mobile"),
  };

  return {
    id: String(row.id || createId("row")).trim(),
    order: clamp(row.order, index, { min: 0, max: 10000 }),
    type: resolveRowType(count, row.type),
    collapsed: row.collapsed === true,
    columns: incomingColumns
      .slice(0, count)
      .map((column, columnIndex) => normalizeColumn(column, columnIndex, widths, count))
      .sort((a, b) => a.order - b.order),
  };
}

function convertLegacyContainersToRows(containers = []) {
  const items = Array.isArray(containers) ? containers : [];
  const rows = [];

  for (let index = 0; index < items.length; ) {
    const current = items[index];
    const group = [current];
    let pointer = index + 1;

    while (
      current?.rowId &&
      pointer < items.length &&
      items[pointer]?.rowId &&
      String(items[pointer].rowId) === String(current.rowId)
    ) {
      group.push(items[pointer]);
      pointer += 1;
    }

    const count = Math.min(Math.max(group.length, 1), 4);
    const presets = defaultWidths(count);
    rows.push({
      id: current?.rowId || createId("row"),
      order: rows.length,
      type: resolveRowType(count),
      collapsed: false,
      columns: group.slice(0, count).map((item, groupIndex) => ({
        id: createId("column"),
        order: groupIndex,
        width: presets.desktop[groupIndex],
        span: percentToSpan(presets.desktop[groupIndex]),
        desktopWidth: presets.desktop[groupIndex],
        tabletWidth: presets.tablet[groupIndex],
        mobileWidth: presets.mobile[groupIndex],
        minWidth: 12,
        containers: [normalizeInstance(item, 0)],
      })),
    });
    index += current?.rowId ? group.length : 1;
  }

  return rows;
}

function snapToGrid(value, gridSize = DEFAULT_GRID_SIZE) {
  const safeGrid = Math.max(1, Number(gridSize || DEFAULT_GRID_SIZE));
  return Math.round(Number(value || 0) / safeGrid) * safeGrid;
}

function resolveCanvasWidth(builder, device = "desktop") {
  return Number(builder?.canvas?.[device]?.width || DEFAULT_CANVAS[device]?.width || DEFAULT_CANVAS.desktop.width);
}

function normalizeVisualConfig(input = {}, fallback = {}, builder = normalizeBuilderConfig()) {
  return {
    x: snapToGrid(clamp(input.x, fallback.x, { min: 0, max: 5000 }), builder.gridSize),
    y: snapToGrid(clamp(input.y, fallback.y, { min: 0, max: 5000 }), builder.gridSize),
    width: snapToGrid(clamp(input.width, fallback.width, { min: 80, max: 2400 }), builder.gridSize),
    height: snapToGrid(clamp(input.height, fallback.height, { min: 80, max: 2400 }), builder.gridSize),
    columns: clamp(input.columns, fallback.columns, { min: 0, max: 12 }),
    spacing: clamp(input.spacing, fallback.spacing, { min: 0, max: 120 }),
    visible: input.visible !== false,
  };
}

function convertRowsToLayouts(rows = [], builder = normalizeBuilderConfig()) {
  const safeRows = (Array.isArray(rows) ? rows : []).map((row, index) => normalizeRow(row, index));
  const canvasWidth = resolveCanvasWidth(builder, "desktop");
  const canvasTabletWidth = resolveCanvasWidth(builder, "tablet");
  const canvasMobileWidth = resolveCanvasWidth(builder, "mobile");
  const layouts = [];
  let cursorY = 0;

  for (const row of safeRows) {
    const rowHeights = [];
    const columnSlots = [];
    let columnOffset = 0;

    for (const column of row.columns || []) {
      const columnWidthPx = snapToGrid((Number(column.desktopWidth || column.width || 100) / 100) * canvasWidth, builder.gridSize);
      let columnCursorY = cursorY;

      for (const instance of column.containers || []) {
        const desktopHeight = Number(instance.desktopConfig?.height || instance.settings?.minHeight || 320) || 320;
        const tabletHeight = Number(instance.tabletConfig?.height || desktopHeight) || desktopHeight;
        const mobileHeight = Number(instance.mobileConfig?.height || desktopHeight) || desktopHeight;
        const desktopWidth = columnWidthPx;
        const tabletWidth = snapToGrid((Number(column.tabletWidth || column.width || 100) / 100) * canvasTabletWidth, builder.gridSize);
        const mobileWidth = snapToGrid((Number(column.mobileWidth || column.width || 100) / 100) * canvasMobileWidth, builder.gridSize);

        columnSlots.push({
          id: instance.instanceId || createId("layout"),
          containerId: instance.containerId ? String(instance.containerId) : null,
          x: columnOffset,
          y: columnCursorY,
          width: desktopWidth,
          height: snapToGrid(desktopHeight, builder.gridSize),
          visible: instance.visible !== false,
          zIndex: layouts.length + columnSlots.length + 1,
          settings: normalizeSettings(instance.settings || {}),
          containerSettings: {},
          desktopConfig: normalizeVisualConfig(
            {
              x: columnOffset,
              y: columnCursorY,
              width: desktopWidth,
              height: desktopHeight,
              columns: instance.desktopConfig?.columns,
              spacing: instance.desktopConfig?.spacing,
              visible: instance.desktopConfig?.visible,
            },
            {},
            builder
          ),
          tabletConfig: normalizeVisualConfig(
            {
              x: 0,
              y: columnCursorY,
              width: tabletWidth,
              height: tabletHeight,
              columns: instance.tabletConfig?.columns,
              spacing: instance.tabletConfig?.spacing,
              visible: instance.tabletConfig?.visible,
            },
            {},
            builder
          ),
          mobileConfig: normalizeVisualConfig(
            {
              x: 0,
              y: columnCursorY,
              width: mobileWidth,
              height: mobileHeight,
              columns: instance.mobileConfig?.columns,
              spacing: instance.mobileConfig?.spacing,
              visible: instance.mobileConfig?.visible,
            },
            {},
            builder
          ),
        });
        columnCursorY += snapToGrid(desktopHeight, builder.gridSize) + builder.gridSize;
      }

      rowHeights.push(Math.max(columnCursorY - cursorY, 0));
      columnOffset += columnWidthPx;
    }

    layouts.push(...columnSlots);
    cursorY += Math.max(...rowHeights, 320) + builder.gridSize;
  }

  return layouts.map((layout, index) => normalizeVisualLayout(layout, index, builder));
}

function normalizeSnapshot(payload = {}, fallback = {}) {
  const builder = normalizeBuilderConfig(payload.builder || fallback.builder);
  const fallbackRows = Array.isArray(fallback.rows)
    ? fallback.rows
    : convertLegacyContainersToRows(fallback.containers || []);
  const sourceRows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.containers)
      ? convertLegacyContainersToRows(payload.containers)
      : fallbackRows;
  const sourceLayouts = Array.isArray(payload.layouts)
    ? payload.layouts
    : Array.isArray(fallback.layouts) && fallback.layouts.length
      ? fallback.layouts
      : convertRowsToLayouts(sourceRows, builder);
  const layouts = sourceLayouts.map((layout, index) => normalizeVisualLayout(layout, index, builder));
  const rows = Array.isArray(sourceRows) && sourceRows.length
    ? sourceRows.map((row, index) => normalizeRow(row, index)).sort((a, b) => a.order - b.order)
    : layoutsToRows(layouts, builder, "desktop");

  return {
    name: String(payload.name || fallback.name || "").trim(),
    slug: String(payload.slug || fallback.slug || "").trim(),
    pageContext: normalizePageContext(payload.pageContext || fallback.pageContext),
    seo: normalizeSeo(payload.seo || fallback.seo),
    notes: String(payload.notes || fallback.notes || "").trim(),
    builder,
    layouts,
    assignments: layouts
      .filter((layout) => layout.assignedContainerId)
      .map((layout) => ({
        layoutId: layout.id,
        assignedContainerId: layout.assignedContainerId,
        sortOrder: layout.sortOrder,
      })),
    rows,
    visibility:
      payload.visibility && typeof payload.visibility === "object"
        ? JSON.parse(JSON.stringify(payload.visibility))
        : fallback.visibility && typeof fallback.visibility === "object"
          ? JSON.parse(JSON.stringify(fallback.visibility))
          : {},
    scheduling:
      payload.scheduling && typeof payload.scheduling === "object"
        ? JSON.parse(JSON.stringify(payload.scheduling))
        : fallback.scheduling && typeof fallback.scheduling === "object"
          ? JSON.parse(JSON.stringify(fallback.scheduling))
          : {},
    typography:
      payload.typography && typeof payload.typography === "object"
        ? JSON.parse(JSON.stringify(payload.typography))
        : fallback.typography && typeof fallback.typography === "object"
          ? JSON.parse(JSON.stringify(fallback.typography))
          : {},
    auditLog: Array.isArray(payload.auditLog) ? payload.auditLog.slice(-200) : Array.isArray(fallback.auditLog) ? fallback.auditLog.slice(-200) : [],
  };
}

function spanFromPixels(width, canvasWidth, maxColumns) {
  const nextWidth = Number(width);
  const baseWidth = Math.max(Number(canvasWidth || 0), 1);
  if (!Number.isFinite(nextWidth) || nextWidth <= 0) return maxColumns;
  return clamp(Math.round((nextWidth / baseWidth) * maxColumns), maxColumns, { min: 1, max: maxColumns });
}

function normalizeGridDeviceConfig(input = {}, device = "desktop", fallback = {}) {
  const maxColumns = DEVICE_COLUMNS[device] || DEVICE_COLUMNS.desktop;
  return {
    colSpan: clamp(input.colSpan ?? input.span ?? fallback.colSpan, maxColumns, { min: 1, max: maxColumns }),
    rowSpan: clamp(input.rowSpan ?? fallback.rowSpan, 1, { min: 1, max: 24 }),
    height: clamp(input.height ?? fallback.height, DEFAULT_LAYOUT_HEIGHT[device], { min: 80, max: 2400 }),
    visible: input.visible !== false,
  };
}

function inferLayoutType(layout = {}) {
  return String(layout.type || layout.layoutType || layout.name || "Custom Layout").trim();
}

function normalizeVisualLayout(layout = {}, index = 0, builder = normalizeBuilderConfig()) {
  const baseCanvasWidth = resolveCanvasWidth(builder, "desktop");
  const defaultWidth = Math.max(builder.gridSize * 10, Math.min(baseCanvasWidth, baseCanvasWidth - builder.gridSize * 2));
  const defaultHeight = DEFAULT_LAYOUT_HEIGHT.desktop;
  const pixelBase = {
    x: snapToGrid(clamp(layout.x ?? layout.desktopConfig?.x, 0, { min: 0, max: 5000 }), builder.gridSize),
    y: snapToGrid(clamp(layout.y ?? layout.desktopConfig?.y, index * (defaultHeight + builder.gridSize), { min: 0, max: 5000 }), builder.gridSize),
    width: snapToGrid(clamp(layout.width ?? layout.desktopConfig?.width, defaultWidth, { min: 80, max: 2400 }), builder.gridSize),
    height: snapToGrid(clamp(layout.height ?? layout.desktopConfig?.height, defaultHeight, { min: 80, max: 2400 }), builder.gridSize),
    columns: clamp(layout.columns ?? layout.desktopConfig?.columns, 0, { min: 0, max: 12 }),
    spacing: clamp(layout.spacing ?? layout.desktopConfig?.spacing, 0, { min: 0, max: 120 }),
  };
  const desktopFallback = {
    colSpan: spanFromPixels(pixelBase.width, resolveCanvasWidth(builder, "desktop"), 12),
    rowSpan: 1,
    height: pixelBase.height,
  };
  const tabletFallback = {
    colSpan: spanFromPixels(layout.tabletConfig?.width || pixelBase.width, resolveCanvasWidth(builder, "tablet"), 6),
    rowSpan: 1,
    height: layout.tabletConfig?.height || pixelBase.height || DEFAULT_LAYOUT_HEIGHT.tablet,
  };
  const mobileFallback = {
    colSpan: 1,
    rowSpan: 1,
    height: layout.mobileConfig?.height || pixelBase.height || DEFAULT_LAYOUT_HEIGHT.mobile,
  };
  const assignedContainerId = layout.assignedContainerId || layout.containerId || null;
  const now = new Date().toISOString();
  const settings = normalizeSettings(layout.settings || layout.style || {});
  const desktopConfig = normalizeVisualConfig(layout.desktopConfig || {}, pixelBase, builder);
  const tabletConfig = normalizeVisualConfig(layout.tabletConfig || {}, {
    ...pixelBase,
    width: Math.min(pixelBase.width, resolveCanvasWidth(builder, "tablet")),
  }, builder);
  const mobileConfig = normalizeVisualConfig(layout.mobileConfig || {}, {
    ...pixelBase,
    width: Math.min(pixelBase.width, resolveCanvasWidth(builder, "mobile")),
  }, builder);

  return {
    id: String(layout.id || layout.instanceId || createId("layout")).trim(),
    name: String(layout.name || inferLayoutType(layout)).trim(),
    slug: String(layout.slug || layout.name || `layout-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    type: inferLayoutType(layout),
    containerId: assignedContainerId ? String(assignedContainerId).trim() : null,
    x: pixelBase.x,
    y: pixelBase.y,
    width: pixelBase.width,
    height: pixelBase.height,
    columns: pixelBase.columns,
    zIndex: clamp(layout.zIndex, index + 1, { min: 0, max: 500 }),
    settings,
    containerSettings: normalizeContainerOverrides(layout.containerSettings || layout.configOverrides),
    desktopConfig,
    tabletConfig,
    mobileConfig,
    desktop: normalizeGridDeviceConfig(layout.desktop || layout.desktopConfig || {}, "desktop", desktopFallback),
    tablet: normalizeGridDeviceConfig(layout.tablet || layout.tabletConfig || {}, "tablet", tabletFallback),
    mobile: normalizeGridDeviceConfig(layout.mobile || layout.mobileConfig || {}, "mobile", mobileFallback),
    sortOrder: clamp(layout.sortOrder ?? layout.zIndex ?? layout.order, index, { min: 0, max: 10000 }),
    assignedContainerId: assignedContainerId ? String(assignedContainerId).trim() : null,
    visible: layout.visible !== false,
    visibility: layout.visibility && typeof layout.visibility === "object" ? JSON.parse(JSON.stringify(layout.visibility)) : {},
    animation: layout.animation && typeof layout.animation === "object" ? JSON.parse(JSON.stringify(layout.animation)) : {},
    spacing: layout.spacing && typeof layout.spacing === "object" ? JSON.parse(JSON.stringify(layout.spacing)) : {},
    background: layout.background && typeof layout.background === "object" ? JSON.parse(JSON.stringify(layout.background)) : {},
    typography: layout.typography && typeof layout.typography === "object" ? JSON.parse(JSON.stringify(layout.typography)) : {},
    advanced: layout.advanced && typeof layout.advanced === "object" ? JSON.parse(JSON.stringify(layout.advanced)) : {},
    settings: normalizeSettings(layout.settings || layout.style || {}),
    containerSettings: normalizeContainerOverrides(layout.containerSettings || layout.configOverrides),
    createdAt: layout.createdAt || now,
    updatedAt: now,
  };
}

function resolveSlotConfig(layout = {}, device = "desktop") {
  if (device === "mobile") return layout.mobile || layout.mobileConfig || {};
  if (device === "tablet") return layout.tablet || layout.tabletConfig || {};
  return layout.desktop || layout.desktopConfig || {};
}

function resolveSlotRect(layout = {}, builder = normalizeBuilderConfig(), device = "desktop") {
  const config = resolveSlotConfig(layout, device);
  const maxColumns = DEVICE_COLUMNS[device] || DEVICE_COLUMNS.desktop;
  return {
    x: 0,
    y: Number(layout.sortOrder || 0),
    width: Number(config.colSpan || maxColumns),
    height: Number(config.height || DEFAULT_LAYOUT_HEIGHT[device]),
    right: Number(config.colSpan || maxColumns),
    bottom: Number(config.height || DEFAULT_LAYOUT_HEIGHT[device]),
  };
}

function assertNoVisualCollisions(layouts = []) {
  const assigned = new Map();
  for (const layout of Array.isArray(layouts) ? layouts : []) {
    const containerId = layout?.assignedContainerId || layout?.containerId;
    if (!containerId || layout.visible === false) continue;
    const key = String(containerId);
    if (assigned.has(key)) {
      throw new AppError(
        `Container ${key} is assigned to multiple homepage layout slots`,
        400,
        "DUPLICATE_LAYOUT_ASSIGNMENT"
      );
    }
    assigned.set(key, layout.id);
  }

  for (const device of DEVICE_KEYS) {
    const maxColumns = DEVICE_COLUMNS[device];
    let rowTotal = 0;
    for (const layout of [...(layouts || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) {
      if (layout.visible === false || resolveSlotConfig(layout, device).visible === false) continue;
      const config = resolveSlotConfig(layout, device);
      if (config.colSpan < 1 || config.colSpan > maxColumns || config.height < 0 || config.rowSpan < 1) {
        throw new AppError(`Invalid ${device} responsive span for homepage layout ${layout.id}`, 400, "INVALID_LAYOUT_SPAN");
      }
      if (rowTotal + config.colSpan > maxColumns) rowTotal = 0;
      rowTotal += config.colSpan;
      if (rowTotal === maxColumns) rowTotal = 0;
    }
  }
}

function layoutsToRows(layouts = [], builder = normalizeBuilderConfig(), device = "desktop") {
  const maxColumns = DEVICE_COLUMNS[device] || DEVICE_COLUMNS.desktop;
  const sorted = (Array.isArray(layouts) ? layouts : [])
    .filter((layout) => layout?.assignedContainerId || layout?.containerId)
    .filter((layout) => layout.visible !== false && resolveSlotConfig(layout, device).visible !== false)
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));

  const rows = [];
  let currentRow = { id: createId("row"), order: 0, type: "custom", collapsed: false, columns: [] };
  let usedColumns = 0;

  sorted.forEach((layout) => {
    const config = resolveSlotConfig(layout, device);
    const colSpan = clamp(config.colSpan, maxColumns, { min: 1, max: maxColumns });
    if (currentRow.columns.length && usedColumns + colSpan > maxColumns) {
      rows.push(currentRow);
      currentRow = { id: createId("row"), order: rows.length, type: "custom", collapsed: false, columns: [] };
      usedColumns = 0;
    }

    const widthPercent = Number(((colSpan / maxColumns) * 100).toFixed(4));
    currentRow.columns.push({
      id: createId("column"),
      order: currentRow.columns.length,
      span: colSpan,
      width: widthPercent,
      desktopWidth: widthPercent,
      tabletWidth: widthPercent,
      mobileWidth: 100,
      minWidth: 1,
      colSpan,
      height: config.height,
      containers: [
        {
          instanceId: layout.id,
          containerId: layout.assignedContainerId || layout.containerId,
          order: layout.sortOrder || 0,
          visible: layout.visible !== false,
          settings: layout.settings || {},
          containerSettings: layout.containerSettings || {},
          desktopConfig: layout.desktop || {},
          tabletConfig: layout.tablet || {},
          mobileConfig: layout.mobile || {},
        },
      ],
    });
    usedColumns += colSpan;
    if (usedColumns === maxColumns) {
      rows.push(currentRow);
      currentRow = { id: createId("row"), order: rows.length, type: "custom", collapsed: false, columns: [] };
      usedColumns = 0;
    }
  });

  if (currentRow.columns.length) rows.push(currentRow);
  return rows;
}

function toAdminLayout(layout) {
  return {
    _id: layout._id,
    name: layout.name,
    slug: layout.slug,
    status: layout.status,
    isDefault: Boolean(layout.isDefault),
    pageContext: layout.pageContext || "GLOBAL_HOME",
    versionCounter: Number(layout.versionCounter || 0),
    draft: layout.draft,
    publishedSnapshot: layout.publishedSnapshot,
    activeVersionId: layout.activeVersionId,
    publishedAt: layout.publishedAt,
    createdBy: layout.createdBy,
    updatedBy: layout.updatedBy,
    createdAt: layout.createdAt,
    updatedAt: layout.updatedAt,
  };
}

function getDeviceConfig(instance, device = "desktop") {
  if (device === "mobile") return instance.mobileConfig || {};
  if (device === "tablet") return instance.tabletConfig || {};
  return instance.desktopConfig || {};
}

function applyInstanceToContainer(container, instance, { device = "desktop", rowId = "", columnId = "", widthPercent = 100 } = {}) {
  const merged = JSON.parse(JSON.stringify(container));
  const deviceConfig = getDeviceConfig(instance, device);
  const settings = normalizeSettings(instance.settings || {});

  merged.instanceId = instance.instanceId;
  merged.builderLayout = {
    rowId,
    columnId,
    instanceId: instance.instanceId,
    containerId: instance.containerId,
    order: instance.order,
    widthPercent,
    settings,
    desktopConfig: instance.desktopConfig,
    tabletConfig: instance.tabletConfig,
    mobileConfig: instance.mobileConfig,
    visible: instance.visible,
  };
  merged.visibility = {
    desktop: instance.visible !== false && instance.desktopConfig?.visible !== false,
    tablet: instance.visible !== false && instance.tabletConfig?.visible !== false,
    mobile: instance.visible !== false && instance.mobileConfig?.visible !== false,
  };
  merged.presentation = merged.presentation || {};
  merged.presentation.layout = {
    ...(merged.presentation.layout || {}),
    customHeight:
      Number(deviceConfig.height || settings.minHeight || merged.presentation?.layout?.customHeight || 0) || 0,
    padding: Number(settings.padding || merged.presentation?.layout?.padding || 0) || 0,
    marginTop: Number(settings.marginTop || merged.presentation?.layout?.marginTop || 0) || 0,
    marginRight: Number(settings.marginRight || merged.presentation?.layout?.marginRight || 0) || 0,
    marginBottom: Number(settings.marginBottom || merged.presentation?.layout?.marginBottom || 0) || 0,
    marginLeft: Number(settings.marginLeft || merged.presentation?.layout?.marginLeft || 0) || 0,
  };
  if (settings.backgroundColor) {
    merged.presentation.layout.backgroundType = "solid";
    merged.presentation.layout.backgroundColor = settings.backgroundColor;
  }
  if (settings.customCssClasses) {
    merged.presentation.customCssClasses = settings.customCssClasses;
  }
  merged.config = {
    ...(merged.config || {}),
    ...(instance.desktopConfig?.columns ? { desktopColumns: instance.desktopConfig.columns } : {}),
    ...(instance.tabletConfig?.columns ? { tabletColumns: instance.tabletConfig.columns } : {}),
    ...(instance.mobileConfig?.columns ? { mobileColumns: instance.mobileConfig.columns } : {}),
    ...(deviceConfig?.spacing ? { gapSize: deviceConfig.spacing } : {}),
  };

  return merged;
}

function applyVisualLayoutToContainer(container, layout, { device = "desktop", rowId = "", columnId = "", widthPercent = 100 } = {}) {
  const baseInstance = {
    instanceId: layout.id,
    containerId: layout.assignedContainerId || layout.containerId,
    order: Number(layout.sortOrder || layout.zIndex || 0),
    visible: layout.visible !== false,
    settings: layout.settings || {},
    desktopConfig: layout.desktop || layout.desktopConfig || {},
    tabletConfig: layout.tablet || layout.tabletConfig || {},
    mobileConfig: layout.mobile || layout.mobileConfig || {},
  };
  const merged = applyInstanceToContainer(container, baseInstance, {
    device,
    rowId,
    columnId,
    widthPercent,
  });
  merged.builderLayout.slotId = layout.id;
  merged.builderLayout.name = layout.name;
  merged.builderLayout.slug = layout.slug;
  merged.builderLayout.type = layout.type;
  merged.builderLayout.sortOrder = layout.sortOrder;
  merged.builderLayout.desktop = layout.desktop;
  merged.builderLayout.tablet = layout.tablet;
  merged.builderLayout.mobile = layout.mobile;
  merged.builderLayout.containerSettings = layout.containerSettings || {};
  merged.config = {
    ...(merged.config || {}),
    ...(layout.containerSettings || {}),
  };
  return merged;
}

function matchesSchedule(container = {}, now = new Date()) {
  if (!container.schedule?.enabled) return true;
  if (container.schedule.start && new Date(container.schedule.start) > now) return false;
  if (container.schedule.end && new Date(container.schedule.end) < now) return false;
  return true;
}

function isVisibleForDevice(container = {}, device = "desktop") {
  if (device === "mobile") return container.visibility?.mobile !== false;
  if (device === "tablet") return container.visibility?.tablet !== false;
  return container.visibility?.desktop !== false;
}

async function ensureUniqueSlug(slug, excludeId = null) {
  const existing = await HomepageLayout.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError("Homepage layout slug already exists", 409, "LAYOUT_SLUG_EXISTS");
  }
}

function collectContainerIds(snapshot = {}) {
  const sourceLayouts = Array.isArray(snapshot.layouts) ? snapshot.layouts : [];
  if (sourceLayouts.length) {
    return sourceLayouts.map((layout) => layout.assignedContainerId || layout.containerId).filter(Boolean);
  }
  return (snapshot.rows || []).flatMap((row) =>
    (row.columns || []).flatMap((column) => (column.containers || []).map((instance) => instance.containerId))
  );
}

async function inspectContainerReferences(snapshot) {
  const rawIds = collectContainerIds(snapshot);
  const validIds = [];
  const invalidIds = [];

  for (const item of rawIds) {
    if (!item) continue;
    if (mongoose.isValidObjectId(item)) {
      validIds.push(String(item));
    } else {
      invalidIds.push(String(item));
    }
  }

  const uniqueIds = [...new Set(validIds)];
  const existing = uniqueIds.length
    ? await HomepageContainer.find({
        _id: { $in: uniqueIds },
        status: "ACTIVE",
      })
        .select("_id")
        .lean()
    : [];

  const existingIds = new Set(existing.map((item) => String(item._id)));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(String(id)));

  return {
    invalidIds,
    missingIds,
    existingIds,
  };
}

async function validateContainerReferences(snapshot, options = {}) {
  const referenceState = await inspectContainerReferences(snapshot);
  if (referenceState.invalidIds.length) {
    throw new AppError("One or more homepage layout containers are invalid", 400, "INVALID_LAYOUT_CONTAINER");
  }
  if (!options.allowMissing && referenceState.missingIds.length) {
    throw new AppError(
      "One or more homepage layout containers do not exist or are not active",
      400,
      "LAYOUT_CONTAINER_NOT_FOUND"
    );
  }
  return referenceState;
}

async function ensureSingleDefault(layoutId, pageContext = "GLOBAL_HOME") {
  const normalizedContext = normalizePageContext(pageContext);
  await HomepageLayout.updateMany(
    {
      _id: { $ne: layoutId },
      isDefault: true,
      ...(normalizedContext === "GLOBAL_HOME"
        ? { $or: [{ pageContext: "GLOBAL_HOME" }, { pageContext: { $exists: false } }] }
        : { pageContext: normalizedContext }),
    },
    { $set: { isDefault: false } }
  );
}

async function syncLayoutSidecars(layoutId, snapshot = {}, { status = "draft", actorId = null } = {}) {
  await HomepageLayoutDraft.findOneAndUpdate(
    { layoutDocumentId: layoutId },
    {
      $set: {
        snapshot,
        status: snapshot?.scheduling?.status || status,
        savedBy: actorId,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const assignments = (snapshot.layouts || []).filter((layout) => layout.assignedContainerId);
  const activeLayoutIds = assignments.map((layout) => layout.id);
  await HomepageLayoutAssignment.deleteMany({
    layoutDocumentId: layoutId,
    ...(activeLayoutIds.length ? { layoutId: { $nin: activeLayoutIds } } : {}),
  });

  await Promise.all(
    assignments.map((layout) =>
      HomepageLayoutAssignment.findOneAndUpdate(
        { layoutDocumentId: layoutId, layoutId: layout.id },
        {
          $set: {
            assignedContainerId: layout.assignedContainerId,
            sortOrder: layout.sortOrder,
            desktop: layout.desktop,
            tablet: layout.tablet,
            mobile: layout.mobile,
            status,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      )
    )
  );
}

async function buildLayoutRowsFromRows(rows = [], options = {}) {
  const ids = [...new Set(collectContainerIds({ rows }).filter(Boolean))];
  const resolved = await homepageContainerService.getResolvedContainersByIds(ids, {
    device: options.device || "all",
    includeProducts: options.includeProducts !== false,
    respectVisibility: false,
  });
  const containerMap = new Map(resolved.map((item) => [String(item._id), item]));
  const now = new Date();

  const layoutRows = rows.map((row) => ({
    id: row.id,
    order: row.order,
    type: row.type,
    collapsed: row.collapsed === true,
    columns: (row.columns || []).map((column) => {
      const widthPercent =
        options.device === "mobile"
          ? column.mobileWidth
          : options.device === "tablet"
            ? column.tabletWidth
            : column.desktopWidth;

      const containers = (column.containers || [])
        .map((instance) => {
          const container = containerMap.get(String(instance.containerId));
          if (!container) return null;
          return applyInstanceToContainer(container, instance, {
            device: options.device || "desktop",
            rowId: row.id,
            columnId: column.id,
            widthPercent,
          });
        })
        .filter((container) => {
          if (!container) return false;
          if (options.respectVisibility === false) return true;
          return matchesSchedule(container, now) && isVisibleForDevice(container, options.device || "desktop");
        })
        .sort((a, b) => (a.builderLayout?.order || 0) - (b.builderLayout?.order || 0));

      return {
        id: column.id,
        order: column.order,
        span: column.span,
        width: column.width,
        desktopWidth: column.desktopWidth,
        tabletWidth: column.tabletWidth,
        mobileWidth: column.mobileWidth,
        minWidth: column.minWidth,
        widthPercent,
        containers,
      };
    }),
  }));

  return layoutRows.filter((row) => row.columns.some((column) => column.containers.length > 0));
}

async function buildLayoutRowsFromLayouts(layouts = [], builder = normalizeBuilderConfig(), options = {}) {
  const safeLayouts = Array.isArray(layouts) ? layouts : [];
  const ids = [...new Set(safeLayouts.map((layout) => layout.assignedContainerId || layout.containerId).filter(Boolean))];
  const resolved = await homepageContainerService.getResolvedContainersByIds(ids, {
    device: options.device || "all",
    includeProducts: options.includeProducts !== false,
    respectVisibility: false,
  });
  const containerMap = new Map(resolved.map((item) => [String(item._id), item]));
  const now = new Date();
  const rows = layoutsToRows(safeLayouts, builder, options.device || "desktop");

  return rows
    .map((row) => ({
      ...row,
      columns: row.columns.map((column) => {
        const widthPercent =
          options.device === "mobile"
            ? column.mobileWidth
            : options.device === "tablet"
              ? column.tabletWidth
              : column.desktopWidth;
        const instance = column.containers[0];
        const sourceLayout = safeLayouts.find((item) => item.id === instance.instanceId);
        const sourceContainerId = sourceLayout?.assignedContainerId || sourceLayout?.containerId;
        const container = sourceContainerId ? containerMap.get(String(sourceContainerId)) : null;
        const merged = sourceLayout && container
          ? applyVisualLayoutToContainer(container, sourceLayout, {
              device: options.device || "desktop",
              rowId: row.id,
              columnId: column.id,
              widthPercent,
            })
          : null;

        const containers =
          merged &&
          (options.respectVisibility === false ||
            (matchesSchedule(merged, now) && isVisibleForDevice(merged, options.device || "desktop")))
            ? [merged]
            : [];

        return {
          ...column,
          widthPercent,
          containers,
        };
      }),
    }))
    .filter((row) => row.columns.some((column) => column.containers.length > 0));
}

function flattenRows(rows = []) {
  return rows.flatMap((row) => row.columns.flatMap((column) => column.containers));
}

class HomepageLayoutService {
  async getContainerLibrary() {
    return await homepageContainerService.listActiveContainersForBuilder();
  }

  async listLayouts() {
    const layouts = await HomepageLayout.find({}).sort({ isDefault: -1, updatedAt: -1 }).lean();
    return layouts.map(toAdminLayout);
  }

  async getLayoutById(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage layout id", 400, "INVALID_LAYOUT_ID");
    }
    const layout = await HomepageLayout.findById(id).lean();
    if (!layout) {
      throw new AppError("Homepage layout not found", 404, "LAYOUT_NOT_FOUND");
    }
    return toAdminLayout(layout);
  }

  async createLayout(payload = {}, actorId) {
    const name = String(payload.name || "Homepage Layout").trim();
    const slug = String(payload.slug || name).trim().toLowerCase();
    const pageContext = normalizePageContext(payload.pageContext || payload.draft?.pageContext);
    const snapshot = normalizeSnapshot(payload.draft || {}, { name, slug, pageContext, rows: [], layouts: [] });
    await ensureUniqueSlug(slug);
    await validateContainerReferences(snapshot, { allowMissing: true });
    assertNoVisualCollisions(snapshot.layouts, snapshot.builder);

    const created = await HomepageLayout.create({
      name,
      slug,
      status: "draft",
      isDefault: Boolean(payload.isDefault),
      pageContext,
      draft: {
        ...snapshot,
        version: 0,
        savedAt: new Date(),
        savedBy: actorId,
      },
      createdBy: actorId,
      updatedBy: actorId,
    });

    if (created.isDefault) {
      await ensureSingleDefault(created._id, created.pageContext);
    }

    await syncLayoutSidecars(created._id, snapshot, { status: "draft", actorId });
    invalidateCache();
    return this.getLayoutById(created._id);
  }

  async updateDraft(id, payload = {}, actorId) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage layout id", 400, "INVALID_LAYOUT_ID");
    }

    const layout = await HomepageLayout.findById(id);
    if (!layout) {
      throw new AppError("Homepage layout not found", 404, "LAYOUT_NOT_FOUND");
    }

    if (payload.lastKnownUpdatedAt && new Date(payload.lastKnownUpdatedAt).getTime() !== new Date(layout.updatedAt).getTime()) {
      throw new AppError("Homepage layout was updated by another user. Refresh and retry.", 409, "LAYOUT_CONFLICT");
    }

    const name = String(payload.name || layout.name).trim();
    const slug = String(payload.slug || layout.slug).trim().toLowerCase();
    const pageContext = normalizePageContext(payload.pageContext || payload.draft?.pageContext || layout.pageContext);
    const snapshot = normalizeSnapshot(payload.draft || {}, {
      name,
      slug,
      pageContext,
      seo: layout.draft?.seo,
      rows: layout.draft?.rows,
      layouts: layout.draft?.layouts,
      builder: layout.draft?.builder,
      notes: layout.draft?.notes,
    });

    await ensureUniqueSlug(slug, layout._id);
    await validateContainerReferences(snapshot, { allowMissing: true });
    assertNoVisualCollisions(snapshot.layouts, snapshot.builder);

    layout.name = name;
    layout.slug = slug;
    layout.isDefault = payload.isDefault !== undefined ? Boolean(payload.isDefault) : layout.isDefault;
    layout.pageContext = pageContext;
    layout.updatedBy = actorId;
    layout.draft = {
      ...layout.draft,
      ...snapshot,
      version: layout.draft?.version || layout.versionCounter || 0,
      savedAt: new Date(),
      savedBy: actorId,
    };

    await layout.save();

    if (layout.isDefault) {
      await ensureSingleDefault(layout._id, layout.pageContext);
    }

    await syncLayoutSidecars(layout._id, snapshot, { status: "draft", actorId });
    invalidateCache();
    return this.getLayoutById(layout._id);
  }

  async previewLayout(payload = {}) {
    const snapshot = normalizeSnapshot(payload.draft || {}, {
      name: payload.name,
      slug: payload.slug,
      pageContext: payload.pageContext,
    });
    const referenceState = await validateContainerReferences(snapshot, { allowMissing: true });
    assertNoVisualCollisions(snapshot.layouts, snapshot.builder);

    const rows = snapshot.layouts?.length
      ? await buildLayoutRowsFromLayouts(snapshot.layouts, snapshot.builder, {
          device: payload.device || "desktop",
          includeProducts: true,
          respectVisibility: true,
        })
      : await buildLayoutRowsFromRows(snapshot.rows || [], {
          device: payload.device || "desktop",
          includeProducts: true,
          respectVisibility: true,
        });

    return {
      layout: {
        name: snapshot.name || "Homepage Preview",
        slug: snapshot.slug || "",
        seo: snapshot.seo,
        builder: snapshot.builder,
      },
      rows,
      containers: flattenRows(rows),
      warnings: referenceState.missingIds.length
        ? [
            {
              code: "MISSING_CONTAINERS",
              message: "One or more containers referenced by the layout are missing or inactive.",
              containerIds: referenceState.missingIds,
            },
          ]
        : [],
    };
  }

  async publishLayout(id, actorId) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage layout id", 400, "INVALID_LAYOUT_ID");
    }

    const layout = await HomepageLayout.findById(id);
    if (!layout) {
      throw new AppError("Homepage layout not found", 404, "LAYOUT_NOT_FOUND");
    }

    const snapshot = normalizeSnapshot(layout.draft || {}, {
      name: layout.name,
      slug: layout.slug,
      pageContext: layout.pageContext,
      seo: layout.draft?.seo,
      rows: layout.draft?.rows,
      layouts: layout.draft?.layouts,
      builder: layout.draft?.builder,
      notes: layout.draft?.notes,
    });

    await validateContainerReferences(snapshot);
    assertNoVisualCollisions(snapshot.layouts, snapshot.builder);

    const nextVersion = Number(layout.versionCounter || 0) + 1;
    const now = new Date();
    const version = await HomepageLayoutVersion.create({
      layoutId: layout._id,
      version: nextVersion,
      status: "published",
      snapshot,
      createdBy: actorId,
      publishedAt: now,
    });

    layout.versionCounter = nextVersion;
    layout.status = "published";
    layout.isDefault = true;
    layout.activeVersionId = version._id;
    layout.publishedAt = now;
    layout.updatedBy = actorId;
    layout.publishedSnapshot = {
      ...snapshot,
      version: nextVersion,
      publishedAt: now,
      publishedBy: actorId,
    };
    layout.draft = {
      ...layout.draft,
      ...snapshot,
      version: nextVersion,
      savedAt: now,
      savedBy: actorId,
      publishedAt: now,
      publishedBy: actorId,
    };

    await layout.save();
    await ensureSingleDefault(layout._id, layout.pageContext);
    await syncLayoutSidecars(layout._id, snapshot, { status: "published", actorId });

    invalidateCache();
    return {
      layout: await this.getLayoutById(layout._id),
      publishedVersion: {
        _id: version._id,
        version: version.version,
        publishedAt: version.publishedAt,
      },
    };
  }

  async deleteLayout(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid homepage layout id", 400, "INVALID_LAYOUT_ID");
    }
    const deleted = await HomepageLayout.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new AppError("Homepage layout not found", 404, "LAYOUT_NOT_FOUND");
    }
    await HomepageLayoutVersion.deleteMany({ layoutId: deleted._id });
    await HomepageLayoutAssignment.deleteMany({ layoutDocumentId: deleted._id });
    await HomepageLayoutDraft.deleteOne({ layoutDocumentId: deleted._id });
    invalidateCache();
    return { _id: deleted._id };
  }

  async listVersions(layoutId) {
    if (!mongoose.isValidObjectId(layoutId)) {
      throw new AppError("Invalid homepage layout id", 400, "INVALID_LAYOUT_ID");
    }
    const versions = await HomepageLayoutVersion.find({ layoutId }).sort({ version: -1 }).lean();
    return versions.map((item) => ({
      _id: item._id,
      layoutId: item.layoutId,
      version: item.version,
      status: item.status,
      snapshot: item.snapshot,
      createdBy: item.createdBy,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      rollbackSourceVersion: item.rollbackSourceVersion,
    }));
  }

  async rollbackToVersion(layoutId, versionId, actorId) {
    if (!mongoose.isValidObjectId(layoutId) || !mongoose.isValidObjectId(versionId)) {
      throw new AppError("Invalid homepage layout version request", 400, "INVALID_LAYOUT_VERSION_ID");
    }

    const [layout, targetVersion] = await Promise.all([
      HomepageLayout.findById(layoutId),
      HomepageLayoutVersion.findOne({ _id: versionId, layoutId }).lean(),
    ]);

    if (!layout) {
      throw new AppError("Homepage layout not found", 404, "LAYOUT_NOT_FOUND");
    }
    if (!targetVersion) {
      throw new AppError("Homepage layout version not found", 404, "LAYOUT_VERSION_NOT_FOUND");
    }

    const snapshot = normalizeSnapshot(targetVersion.snapshot || {}, {
      name: layout.name,
      slug: layout.slug,
    });

    layout.draft = {
      ...layout.draft,
      ...snapshot,
      notes: `Rolled back from version ${targetVersion.version}`,
      savedAt: new Date(),
      savedBy: actorId,
    };
    layout.updatedBy = actorId;
    await layout.save();

    const published = await this.publishLayout(layout._id, actorId);
    await HomepageLayoutVersion.findByIdAndUpdate(published.publishedVersion._id, {
      $set: { status: "rolled_back", rollbackSourceVersion: targetVersion.version },
    });

    invalidateCache();
    return this.getLayoutById(layout._id);
  }

  async getPublicLayout({ device = "desktop" } = {}) {
    const cacheKey = `homepage-builder:public:GLOBAL_HOME:${device}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const layout = await HomepageLayout.findOne({
      isDefault: true,
      $or: [{ pageContext: "GLOBAL_HOME" }, { pageContext: { $exists: false } }],
      status: "published",
      publishedSnapshot: { $ne: null },
    }).lean();

    if (!layout?.publishedSnapshot) {
      return null;
    }

    const snapshot = normalizeSnapshot(layout.publishedSnapshot, {
      name: layout.name,
      slug: layout.slug,
    });
    const rows = snapshot.layouts?.length
      ? await buildLayoutRowsFromLayouts(snapshot.layouts || [], snapshot.builder, {
          device,
          includeProducts: true,
          respectVisibility: true,
        })
      : await buildLayoutRowsFromRows(snapshot.rows || [], {
          device,
          includeProducts: true,
          respectVisibility: true,
        });

    const result = {
      layout: {
        _id: layout._id,
        name: layout.name,
        slug: layout.slug,
        version: layout.publishedSnapshot.version || 0,
        pageContext: layout.pageContext || "GLOBAL_HOME",
        seo: normalizeSeo(snapshot.seo),
        builder: snapshot.builder,
        publishedAt: layout.publishedAt,
      },
      rows,
      containers: flattenRows(rows),
    };

    setCache(cacheKey, result);
    return result;
  }

}

const homepageLayoutService = new HomepageLayoutService();

module.exports = homepageLayoutService;
module.exports.__test = {
  normalizeSnapshot,
  layoutsToRows,
  resolveSlotRect,
  normalizeBuilderConfig,
  assertNoVisualCollisions,
};
