const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const {
  createFromPreset,
  createTheme,
  deleteTheme,
  duplicateTheme,
  ensureDefaultTheme,
  getActorLabel,
  getPublicTheme,
  getThemeById,
  listThemes,
  listVersions,
  previewTheme,
  publishTheme,
  resolveScope,
  rollbackTheme,
  scheduleTheme,
  updateTheme,
} = require("./service");

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || "",
  };
}

const listAdminThemes = asyncHandler(async (req, res) => {
  const scope = resolveScope(req);
  await ensureDefaultTheme(scope);
  const data = await listThemes(scope);
  return ok(res, data, "Themes loaded");
});

const getAdminTheme = asyncHandler(async (req, res) => {
  const data = await getThemeById(req.params.id);
  return ok(res, data, "Theme loaded");
});

const createAdminTheme = asyncHandler(async (req, res) => {
  const scope = resolveScope(req);
  const data = await createTheme({
    scope,
    payload: req.body || {},
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme created");
});

const updateAdminTheme = asyncHandler(async (req, res) => {
  const data = await updateTheme({
    id: req.params.id,
    payload: req.body || {},
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme updated");
});

const duplicateAdminTheme = asyncHandler(async (req, res) => {
  const data = await duplicateTheme({
    id: req.params.id,
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme duplicated");
});

const publishAdminTheme = asyncHandler(async (req, res) => {
  const data = await publishTheme({
    id: req.params.id,
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme published");
});

const scheduleAdminTheme = asyncHandler(async (req, res) => {
  const data = await scheduleTheme({
    id: req.params.id,
    schedule: req.body?.schedule || req.body || {},
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme scheduled");
});

const rollbackAdminTheme = asyncHandler(async (req, res) => {
  const data = await rollbackTheme({
    id: req.params.id,
    versionId: req.params.versionId,
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme rolled back");
});

const getAdminVersions = asyncHandler(async (req, res) => {
  const data = await listVersions(req.params.id);
  return ok(res, data, "Theme version history loaded");
});

const removeAdminTheme = asyncHandler(async (req, res) => {
  const data = await deleteTheme({
    id: req.params.id,
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Theme deleted");
});

const createPresetTheme = asyncHandler(async (req, res) => {
  const scope = resolveScope(req);
  const data = await createFromPreset({
    presetKey: req.params.presetKey,
    scope,
    actor: getActorLabel(req.user),
    meta: getMeta(req),
  });
  return ok(res, data, "Preset theme created");
});

const previewAdminTheme = asyncHandler(async (req, res) => {
  const theme = await getThemeById(req.params.id);
  const data = previewTheme(theme, {
    pageKey: req.query.pageKey,
    sectionKey: req.query.sectionKey,
    componentKey: req.query.componentKey,
    breakpoint: req.query.breakpoint || "desktop",
  });
  return ok(res, data, "Theme preview generated");
});

const getPublicThemeConfig = asyncHandler(async (req, res) => {
  const scope = resolveScope(req);
  await ensureDefaultTheme(scope);
  const data = await getPublicTheme(scope);
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return ok(res, data, "Active theme loaded");
});

module.exports = {
  createAdminTheme,
  createPresetTheme,
  duplicateAdminTheme,
  getAdminTheme,
  getAdminVersions,
  getPublicThemeConfig,
  listAdminThemes,
  previewAdminTheme,
  publishAdminTheme,
  removeAdminTheme,
  rollbackAdminTheme,
  scheduleAdminTheme,
  updateAdminTheme,
};
