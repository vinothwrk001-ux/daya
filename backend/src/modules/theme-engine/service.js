const ThemeConfiguration = require("../../models/ThemeConfiguration");
const ThemeConfigurationVersion = require("../../models/ThemeConfigurationVersion");
const auditService = require("../../services/audit.service");
const { AppError } = require("../../utils/AppError");
const { getPresetList, getPresetTheme } = require("./presets");
const { getRegistry, PAGE_KEYS, SECTION_KEYS, COMPONENT_KEYS } = require("./registry");
const { createGlobalTheme, deepClone } = require("./tokens");
const { sanitizeThemeLayer, sanitizeThemeMap } = require("./validators");

const CACHE_TTL_MS = Number(process.env.THEME_ENGINE_CACHE_MS || 30000);
const PUBLIC_CACHE = new Map();

const PAGE_KEY_SET = new Set(PAGE_KEYS);
const SECTION_KEY_SET = new Set(SECTION_KEYS);
const COMPONENT_KEY_SET = new Set(COMPONENT_KEYS);

function cacheKey(tenantType, tenantKey) {
  return `theme:${tenantType}:${tenantKey}`;
}

function getCached(tenantType, tenantKey) {
  const entry = PUBLIC_CACHE.get(cacheKey(tenantType, tenantKey));
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    PUBLIC_CACHE.delete(cacheKey(tenantType, tenantKey));
    return null;
  }
  return entry.value;
}

function setCached(tenantType, tenantKey, value) {
  PUBLIC_CACHE.set(cacheKey(tenantType, tenantKey), { storedAt: Date.now(), value });
}

function invalidateThemeCache(tenantType = "platform", tenantKey = "default") {
  PUBLIC_CACHE.delete(cacheKey(tenantType, tenantKey));
}

function resolveScope(req) {
  return {
    tenantType: String(req.query?.tenantType || "platform").trim() || "platform",
    tenantKey: String(req.query?.tenantKey || "default").trim() || "default",
  };
}

function getActorLabel(user) {
  if (!user) return "system";
  return user.email || user.name || user._id?.toString() || "admin";
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object") {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

function resolveEffectiveTheme(config, { pageKey, sectionKey, componentKey, breakpoint = "desktop" } = {}) {
  if (!config) return createGlobalTheme();
  let merged = deepClone(config.globalTheme || createGlobalTheme());

  const breakpointTheme =
    breakpoint === "mobile"
      ? config.mobileTheme
      : breakpoint === "tablet"
        ? config.tabletTheme
        : config.desktopTheme;
  merged = deepMerge(merged, breakpointTheme || {});

  if (pageKey && config.pageThemes?.[pageKey]) {
    merged = deepMerge(merged, config.pageThemes[pageKey]);
  }
  if (sectionKey && config.sectionThemes?.[sectionKey]) {
    merged = deepMerge(merged, config.sectionThemes[sectionKey]);
  }
  if (componentKey && config.componentThemes?.[componentKey]) {
    merged = deepMerge(merged, config.componentThemes[componentKey]);
  }

  return merged;
}

function resolveInputColors(colors = {}) {
  const defaults = createGlobalTheme().colors;
  const textPrimary = colors.textPrimary || defaults.textPrimary;
  const isLightText = /^#(fff|ffffff|fefefe|fafafa)/i.test(String(textPrimary).trim()) || /^rgba?\(\s*255\s*,/i.test(String(textPrimary).trim());

  return {
    inputText: colors.inputText || (isLightText ? colors.secondary || "#111111" : textPrimary),
    inputBackground: colors.inputBackground || "#ffffff",
    inputPlaceholder: colors.inputPlaceholder || (isLightText ? "#64748b" : colors.textSecondary || "#64748b"),
  };
}

function themeToCssVariables(theme) {
  const colors = { ...createGlobalTheme().colors, ...(theme?.colors || {}) };
  const typography = theme?.typography || {};
  const spacing = theme?.spacing || {};
  const radius = theme?.radius || {};
  const shadows = theme?.shadows || {};
  const animation = theme?.animation || {};
  const inputColors = resolveInputColors(colors);

  return {
    "--color-primary": colors.primary || "#e53935",
    "--color-primary-hover": colors.secondary || "#111111",
    "--color-secondary": colors.secondary || "#111111",
    "--color-accent": colors.accent || "#f97316",
    "--color-background": colors.background || "#ffffff",
    "--color-surface": colors.surface || "#ffffff",
    "--color-surface-secondary": colors.surface || "#f5f5f5",
    "--color-card": colors.card || "#ffffff",
    "--color-border": colors.border || "#e5e5e5",
    "--color-text-primary": colors.textPrimary || "#111111",
    "--color-text-secondary": colors.textSecondary || "#555555",
    "--color-success": colors.success || "#16a34a",
    "--color-warning": colors.warning || "#f59e0b",
    "--color-danger": colors.danger || "#dc2626",
    "--color-info": colors.info || "#2563eb",
    "--color-input-text": inputColors.inputText,
    "--color-input-background": inputColors.inputBackground,
    "--color-input-placeholder": inputColors.inputPlaceholder,
    "--font-family": typography.fontFamily || '"Manrope", sans-serif',
    "--font-heading": typography.headingFont || typography.fontFamily || '"Space Grotesk", sans-serif',
    "--font-body": typography.bodyFont || typography.fontFamily || '"Manrope", sans-serif',
    "--font-button": typography.buttonFont || typography.fontFamily || '"Manrope", sans-serif',
    "--container-width": spacing.containerWidth || "1280px",
    "--section-padding": spacing.sectionPadding || "4rem",
    "--card-padding": spacing.cardPadding || "1.25rem",
    "--button-padding": spacing.buttonPadding || "0.75rem 1.5rem",
    "--input-padding": spacing.inputPadding || "0.75rem 1rem",
    "--grid-spacing": spacing.gridSpacing || "1.5rem",
    "--radius-card": radius.card || "12px",
    "--radius-button": radius.button || "9999px",
    "--radius-input": radius.input || "12px",
    "--radius-modal": radius.modal || "16px",
    "--radius-drawer": radius.drawer || "16px 0 0 16px",
    "--radius-container": radius.container || "16px",
    "--radius-small": radius.input || "8px",
    "--radius-medium": radius.card || "12px",
    "--radius-large": radius.container || "16px",
    "--shadow-card": shadows.card || "0 8px 24px -20px rgba(17, 17, 17, 0.42)",
    "--shadow-hover": shadows.hover || "0 22px 60px -38px rgba(17, 17, 17, 0.45)",
    "--shadow-modal": shadows.modal || "0 32px 100px -48px rgba(17, 17, 17, 0.5)",
    "--shadow-button": shadows.button || "0 4px 14px -6px rgba(17, 17, 17, 0.35)",
    "--shadow-dropdown": shadows.dropdown || "0 12px 40px -16px rgba(17, 17, 17, 0.4)",
    "--shadow-small": shadows.card || "0 8px 24px -20px rgba(17, 17, 17, 0.42)",
    "--shadow-medium": shadows.hover || "0 22px 60px -38px rgba(17, 17, 17, 0.45)",
    "--shadow-large": shadows.modal || "0 32px 100px -48px rgba(17, 17, 17, 0.5)",
    "--transition-standard": animation.transitionSpeed || "300ms ease",
    "--animation-hover": animation.hoverDuration || "200ms",
    "--animation-page": animation.pageAnimation || "fade 400ms ease",
    "--animation-card": animation.cardAnimation || "translateY 300ms ease",
    "--animation-button": animation.buttonAnimation || "scale 150ms ease",
    "--animation-modal": animation.modalAnimation || "fade 250ms ease",
    "--animation-reels": animation.reelsAnimation || "slide 350ms ease",
    "--commerce-accent": colors.primary || "#e53935",
    "--commerce-accent-warm": colors.accent || "#f97316",
  };
}

function serializeTheme(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : doc;
  return {
    ...plain,
    effectiveTheme: resolveEffectiveTheme(plain),
    cssVariables: themeToCssVariables(resolveEffectiveTheme(plain)),
  };
}

function normalizePayload(payload = {}) {
  const name = String(payload.name || "").trim();
  if (!name) throw new AppError("Theme name is required", 400);

  return {
    name: name.slice(0, 120),
    description: String(payload.description || "").trim().slice(0, 500),
    themeType: String(payload.themeType || "custom").trim().slice(0, 64),
    status: ["draft", "published", "scheduled", "archived"].includes(payload.status) ? payload.status : "draft",
    globalTheme: sanitizeThemeLayer(payload.globalTheme || createGlobalTheme()),
    pageThemes: sanitizeThemeMap(payload.pageThemes, PAGE_KEY_SET),
    sectionThemes: sanitizeThemeMap(payload.sectionThemes, SECTION_KEY_SET),
    componentThemes: sanitizeThemeMap(payload.componentThemes, COMPONENT_KEY_SET),
    mobileTheme: sanitizeThemeLayer(payload.mobileTheme || {}),
    tabletTheme: sanitizeThemeLayer(payload.tabletTheme || {}),
    desktopTheme: sanitizeThemeLayer(payload.desktopTheme || {}),
    schedule: {
      enabled: Boolean(payload.schedule?.enabled),
      startAt: payload.schedule?.startAt ? new Date(payload.schedule.startAt) : null,
      endAt: payload.schedule?.endAt ? new Date(payload.schedule.endAt) : null,
      timezone: String(payload.schedule?.timezone || "UTC").trim().slice(0, 64),
    },
  };
}

async function createVersionSnapshot(theme, actor, changeType = "update", changeSummary = []) {
  await ThemeConfigurationVersion.create({
    themeId: theme._id,
    tenantType: theme.tenantType,
    tenantKey: theme.tenantKey,
    versionNumber: theme.version,
    snapshot: deepClone(theme),
    changedBy: actor,
    changeType,
    changeSummary,
    publishedAt: theme.publishedAt || null,
  });
}

async function findActiveTheme(scope) {
  const now = new Date();
  const scheduled = await ThemeConfiguration.findOne({
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    status: "scheduled",
    "schedule.enabled": true,
    "schedule.startAt": { $lte: now },
    $or: [{ "schedule.endAt": null }, { "schedule.endAt": { $gte: now } }],
  })
    .sort({ "schedule.startAt": -1 })
    .lean();

  if (scheduled) return scheduled;

  const active = await ThemeConfiguration.findOne({
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    isActive: true,
    status: "published",
  }).lean();

  if (active) return active;

  return ThemeConfiguration.findOne({
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    isDefault: true,
  }).lean();
}

async function getPublicTheme(scope = { tenantType: "platform", tenantKey: "default" }) {
  const cached = getCached(scope.tenantType, scope.tenantKey);
  if (cached) return cached;

  let theme = await findActiveTheme(scope);
  if (!theme) {
    theme = {
      name: "Default Platform Theme",
      themeType: "default",
      globalTheme: createGlobalTheme(),
      pageThemes: {},
      sectionThemes: {},
      componentThemes: {},
      mobileTheme: {},
      tabletTheme: {},
      desktopTheme: {},
    };
  }

  const payload = {
    themeId: theme._id?.toString() || null,
    name: theme.name,
    themeType: theme.themeType,
    globalTheme: theme.globalTheme || createGlobalTheme(),
    pageThemes: theme.pageThemes || {},
    sectionThemes: theme.sectionThemes || {},
    componentThemes: theme.componentThemes || {},
    mobileTheme: theme.mobileTheme || {},
    tabletTheme: theme.tabletTheme || {},
    desktopTheme: theme.desktopTheme || {},
    cssVariables: themeToCssVariables(resolveEffectiveTheme(theme)),
    registry: getRegistry(),
  };

  setCached(scope.tenantType, scope.tenantKey, payload);
  return payload;
}

async function listThemes(scope) {
  const themes = await ThemeConfiguration.find({
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
  })
    .sort({ isActive: -1, isDefault: -1, updatedAt: -1 })
    .lean();

  return {
    themes: themes.map((theme) => ({
      _id: theme._id,
      name: theme.name,
      description: theme.description,
      themeType: theme.themeType,
      isActive: theme.isActive,
      isDefault: theme.isDefault,
      status: theme.status,
      version: theme.version,
      schedule: theme.schedule,
      publishedAt: theme.publishedAt,
      updatedAt: theme.updatedAt,
      createdAt: theme.createdAt,
    })),
    presets: getPresetList(),
    registry: getRegistry(),
  };
}

async function getThemeById(id) {
  const theme = await ThemeConfiguration.findById(id).lean();
  if (!theme) throw new AppError("Theme not found", 404);
  return serializeTheme(theme);
}

async function createTheme({ scope, payload, actor, meta }) {
  const normalized = normalizePayload(payload);
  const theme = await ThemeConfiguration.create({
    ...normalized,
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    createdBy: actor,
    updatedBy: actor,
    isActive: false,
    isDefault: false,
    version: 1,
  });

  await createVersionSnapshot(theme, actor, "create", ["Theme created"]);
  await auditService.log({
    action: "theme.create",
    entityType: "ThemeConfiguration",
    entityId: theme._id.toString(),
    actor,
    metadata: { name: theme.name, themeType: theme.themeType },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  }).catch(() => {});

  invalidateThemeCache(scope.tenantType, scope.tenantKey);
  return serializeTheme(theme);
}

async function updateTheme({ id, payload, actor, meta }) {
  const theme = await ThemeConfiguration.findById(id);
  if (!theme) throw new AppError("Theme not found", 404);

  const normalized = normalizePayload({ ...theme.toObject(), ...payload, name: payload.name || theme.name });
  theme.name = normalized.name;
  theme.description = normalized.description;
  theme.themeType = normalized.themeType;
  theme.status = normalized.status;
  theme.globalTheme = normalized.globalTheme;
  theme.pageThemes = normalized.pageThemes;
  theme.sectionThemes = normalized.sectionThemes;
  theme.componentThemes = normalized.componentThemes;
  theme.mobileTheme = normalized.mobileTheme;
  theme.tabletTheme = normalized.tabletTheme;
  theme.desktopTheme = normalized.desktopTheme;
  theme.schedule = normalized.schedule;
  theme.version += 1;
  theme.updatedBy = actor;
  await theme.save();

  await createVersionSnapshot(theme, actor, "update", ["Theme updated"]);
  await auditService.log({
    action: "theme.update",
    entityType: "ThemeConfiguration",
    entityId: theme._id.toString(),
    actor,
    metadata: { name: theme.name, version: theme.version },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  }).catch(() => {});

  invalidateThemeCache(theme.tenantType, theme.tenantKey);
  return serializeTheme(theme);
}

async function duplicateTheme({ id, actor, meta }) {
  const source = await ThemeConfiguration.findById(id).lean();
  if (!source) throw new AppError("Theme not found", 404);

  const copy = await ThemeConfiguration.create({
    name: `${source.name} (Copy)`,
    description: source.description,
    themeType: source.themeType,
    status: "draft",
    globalTheme: source.globalTheme,
    pageThemes: source.pageThemes,
    sectionThemes: source.sectionThemes,
    componentThemes: source.componentThemes,
    mobileTheme: source.mobileTheme,
    tabletTheme: source.tabletTheme,
    desktopTheme: source.desktopTheme,
    schedule: { enabled: false, startAt: null, endAt: null, timezone: "UTC" },
    clonedFrom: source._id,
    tenantType: source.tenantType,
    tenantKey: source.tenantKey,
    createdBy: actor,
    updatedBy: actor,
    version: 1,
  });

  await createVersionSnapshot(copy, actor, "duplicate", [`Duplicated from ${source.name}`]);
  invalidateThemeCache(source.tenantType, source.tenantKey);
  return serializeTheme(copy);
}

async function publishTheme({ id, actor, meta }) {
  const theme = await ThemeConfiguration.findById(id);
  if (!theme) throw new AppError("Theme not found", 404);

  await ThemeConfiguration.updateMany(
    { tenantType: theme.tenantType, tenantKey: theme.tenantKey, _id: { $ne: theme._id } },
    { $set: { isActive: false } }
  );

  theme.isActive = true;
  theme.status = "published";
  theme.publishedAt = new Date();
  theme.version += 1;
  theme.updatedBy = actor;
  await theme.save();

  await createVersionSnapshot(theme, actor, "publish", ["Theme published"]);
  await auditService.log({
    action: "theme.publish",
    entityType: "ThemeConfiguration",
    entityId: theme._id.toString(),
    actor,
    metadata: { name: theme.name, version: theme.version },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  }).catch(() => {});

  invalidateThemeCache(theme.tenantType, theme.tenantKey);
  return serializeTheme(theme);
}

async function scheduleTheme({ id, schedule, actor, meta }) {
  const theme = await ThemeConfiguration.findById(id);
  if (!theme) throw new AppError("Theme not found", 404);

  theme.schedule = {
    enabled: Boolean(schedule?.enabled),
    startAt: schedule?.startAt ? new Date(schedule.startAt) : null,
    endAt: schedule?.endAt ? new Date(schedule.endAt) : null,
    timezone: String(schedule?.timezone || "UTC").trim().slice(0, 64),
  };
  theme.status = theme.schedule.enabled ? "scheduled" : theme.status;
  theme.version += 1;
  theme.updatedBy = actor;
  await theme.save();

  await createVersionSnapshot(theme, actor, "schedule", ["Theme schedule updated"]);
  invalidateThemeCache(theme.tenantType, theme.tenantKey);
  return serializeTheme(theme);
}

async function rollbackTheme({ id, versionId, actor, meta }) {
  const theme = await ThemeConfiguration.findById(id);
  if (!theme) throw new AppError("Theme not found", 404);

  const version = await ThemeConfigurationVersion.findOne({ _id: versionId, themeId: id }).lean();
  if (!version?.snapshot) throw new AppError("Theme version not found", 404);

  const snapshot = version.snapshot;
  theme.name = snapshot.name || theme.name;
  theme.description = snapshot.description || "";
  theme.themeType = snapshot.themeType || theme.themeType;
  theme.globalTheme = snapshot.globalTheme || createGlobalTheme();
  theme.pageThemes = snapshot.pageThemes || {};
  theme.sectionThemes = snapshot.sectionThemes || {};
  theme.componentThemes = snapshot.componentThemes || {};
  theme.mobileTheme = snapshot.mobileTheme || {};
  theme.tabletTheme = snapshot.tabletTheme || {};
  theme.desktopTheme = snapshot.desktopTheme || {};
  theme.schedule = snapshot.schedule || { enabled: false, startAt: null, endAt: null, timezone: "UTC" };
  theme.version += 1;
  theme.updatedBy = actor;
  await theme.save();

  await createVersionSnapshot(theme, actor, "rollback", [`Rolled back to version ${version.versionNumber}`]);
  await auditService.log({
    action: "theme.rollback",
    entityType: "ThemeConfiguration",
    entityId: theme._id.toString(),
    actor,
    metadata: { name: theme.name, version: theme.version, rollbackVersion: version.versionNumber },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  }).catch(() => {});

  invalidateThemeCache(theme.tenantType, theme.tenantKey);
  return serializeTheme(theme);
}

async function listVersions(id) {
  const theme = await ThemeConfiguration.findById(id).select("_id name version").lean();
  if (!theme) throw new AppError("Theme not found", 404);

  const versions = await ThemeConfigurationVersion.find({ themeId: id })
    .sort({ versionNumber: -1 })
    .select("_id versionNumber changedBy changeType changeSummary changedAt publishedAt rollbackAvailable")
    .lean();

  return { theme, versions };
}

async function deleteTheme({ id, actor, meta }) {
  const theme = await ThemeConfiguration.findById(id);
  if (!theme) throw new AppError("Theme not found", 404);
  if (theme.isActive || theme.isDefault) {
    throw new AppError("Cannot delete active or default theme", 400);
  }

  await ThemeConfigurationVersion.deleteMany({ themeId: id });
  await theme.deleteOne();

  await auditService.log({
    action: "theme.delete",
    entityType: "ThemeConfiguration",
    entityId: id,
    actor,
    metadata: { name: theme.name },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  }).catch(() => {});

  invalidateThemeCache(theme.tenantType, theme.tenantKey);
  return { deleted: true };
}

async function createFromPreset({ presetKey, scope, actor, meta }) {
  const preset = getPresetTheme(presetKey);
  if (!preset) throw new AppError("Preset theme not found", 404);

  return createTheme({
    scope,
    payload: {
      name: preset.name,
      themeType: preset.themeType,
      globalTheme: preset.globalTheme,
      status: "draft",
    },
    actor,
    meta,
  });
}

async function ensureDefaultTheme(scope) {
  const existing = await ThemeConfiguration.findOne({
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    isDefault: true,
  }).lean();

  if (existing) return existing;

  const preset = getPresetTheme("premium-ecommerce");
  const theme = await ThemeConfiguration.create({
    name: preset?.name || "Default Platform Theme",
    description: "Auto-seeded default theme",
    themeType: preset?.themeType || "premium-ecommerce",
    status: "published",
    isActive: true,
    isDefault: true,
    globalTheme: preset?.globalTheme || createGlobalTheme(),
    tenantType: scope.tenantType,
    tenantKey: scope.tenantKey,
    createdBy: "system",
    updatedBy: "system",
    publishedAt: new Date(),
    version: 1,
  });

  return theme.toObject();
}

function previewTheme(config, options = {}) {
  const effective = resolveEffectiveTheme(config, options);
  return {
    effectiveTheme: effective,
    cssVariables: themeToCssVariables(effective),
  };
}

module.exports = {
  createFromPreset,
  createTheme,
  deleteTheme,
  duplicateTheme,
  ensureDefaultTheme,
  getPublicTheme,
  getThemeById,
  listThemes,
  listVersions,
  previewTheme,
  publishTheme,
  resolveEffectiveTheme,
  resolveScope,
  rollbackTheme,
  scheduleTheme,
  themeToCssVariables,
  updateTheme,
  getActorLabel,
};
