const mongoose = require("mongoose");
const { HomepageLayout } = require("../models/HomepageLayout");
const { HomepageLayoutVersion } = require("../models/HomepageLayoutVersion");
const { HomepageContainer } = require("../models/HomepageContainer");
const homepageContainerService = require("./homepage-container.service");
const { AppError } = require("../utils/AppError");
const { uploadMany } = require("../utils/upload");

const PUBLIC_CACHE_TTL_MS = 60 * 1000;
const responseCache = new Map();

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
    openGraphTitle: String(seo.openGraphTitle || "").trim(),
    openGraphDescription: String(seo.openGraphDescription || "").trim(),
    openGraphImage: String(seo.openGraphImage || "").trim(),
    canonicalUrl: String(seo.canonicalUrl || "").trim(),
    schemaMarkup: String(seo.schemaMarkup || "").trim(),
  };
}

function normalizeDeviceConfig(input = {}) {
  return {
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

function normalizeSnapshot(payload = {}, fallback = {}) {
  const fallbackRows = Array.isArray(fallback.rows)
    ? fallback.rows
    : convertLegacyContainersToRows(fallback.containers || []);
  const sourceRows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.containers)
      ? convertLegacyContainersToRows(payload.containers)
      : fallbackRows;

  return {
    name: String(payload.name || fallback.name || "").trim(),
    slug: String(payload.slug || fallback.slug || "").trim(),
    seo: normalizeSeo(payload.seo || fallback.seo),
    notes: String(payload.notes || fallback.notes || "").trim(),
    rows: sourceRows.map((row, index) => normalizeRow(row, index)).sort((a, b) => a.order - b.order),
  };
}

function toAdminLayout(layout) {
  return {
    _id: layout._id,
    name: layout.name,
    slug: layout.slug,
    status: layout.status,
    isDefault: Boolean(layout.isDefault),
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

function collectContainerIds(rows = []) {
  return rows.flatMap((row) =>
    (row.columns || []).flatMap((column) => (column.containers || []).map((instance) => instance.containerId))
  );
}

async function validateContainerReferences(snapshot) {
  const rawIds = collectContainerIds(snapshot.rows || []);
  const ids = rawIds.filter((item) => mongoose.isValidObjectId(item));
  if (ids.length !== rawIds.length) {
    throw new AppError("One or more homepage layout containers are invalid", 400, "INVALID_LAYOUT_CONTAINER");
  }

  const uniqueIds = [...new Set(ids.map(String))];
  const existing = await HomepageContainer.find({
    _id: { $in: uniqueIds },
    status: "ACTIVE",
  })
    .select("_id")
    .lean();

  if (existing.length !== uniqueIds.length) {
    throw new AppError(
      "One or more homepage layout containers do not exist or are not active",
      400,
      "LAYOUT_CONTAINER_NOT_FOUND"
    );
  }
}

async function ensureSingleDefault(layoutId) {
  await HomepageLayout.updateMany(
    { _id: { $ne: layoutId }, isDefault: true },
    { $set: { isDefault: false } }
  );
}

async function buildLayoutRows(rows = [], options = {}) {
  const ids = [...new Set(collectContainerIds(rows).filter(Boolean))];
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
    const snapshot = normalizeSnapshot(payload.draft || {}, { name, slug, rows: [] });
    await ensureUniqueSlug(slug);
    await validateContainerReferences(snapshot);

    const created = await HomepageLayout.create({
      name,
      slug,
      status: "draft",
      isDefault: Boolean(payload.isDefault),
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
      await ensureSingleDefault(created._id);
    }

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
    const snapshot = normalizeSnapshot(payload.draft || {}, {
      name,
      slug,
      seo: layout.draft?.seo,
      rows: layout.draft?.rows,
      notes: layout.draft?.notes,
    });

    await ensureUniqueSlug(slug, layout._id);
    await validateContainerReferences(snapshot);

    layout.name = name;
    layout.slug = slug;
    layout.isDefault = payload.isDefault !== undefined ? Boolean(payload.isDefault) : layout.isDefault;
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
      await ensureSingleDefault(layout._id);
    }

    invalidateCache();
    return this.getLayoutById(layout._id);
  }

  async previewLayout(payload = {}) {
    const snapshot = normalizeSnapshot(payload.draft || {}, {
      name: payload.name,
      slug: payload.slug,
    });
    await validateContainerReferences(snapshot);

    const rows = await buildLayoutRows(snapshot.rows, {
      device: payload.device || "desktop",
      includeProducts: true,
      respectVisibility: false,
    });

    return {
      layout: {
        name: snapshot.name || "Homepage Preview",
        slug: snapshot.slug || "",
        seo: snapshot.seo,
      },
      rows,
      containers: flattenRows(rows),
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
      seo: layout.draft?.seo,
      rows: layout.draft?.rows,
      notes: layout.draft?.notes,
    });

    await validateContainerReferences(snapshot);

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
    await ensureSingleDefault(layout._id);

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
    const cacheKey = `homepage-builder:public:${device}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const layout = await HomepageLayout.findOne({
      isDefault: true,
      status: "published",
      publishedSnapshot: { $ne: null },
    }).lean();

    if (!layout?.publishedSnapshot) {
      return null;
    }

    const rows = await buildLayoutRows(layout.publishedSnapshot.rows || [], {
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
        seo: normalizeSeo(layout.publishedSnapshot.seo),
        publishedAt: layout.publishedAt,
      },
      rows,
      containers: flattenRows(rows),
    };

    setCache(cacheKey, result);
    return result;
  }

  async uploadLayoutMedia(files = []) {
    return await uploadMany(files, { folder: "homepage_builder" });
  }
}

module.exports = new HomepageLayoutService();
