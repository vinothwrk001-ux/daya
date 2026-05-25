const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  buildManifest,
  deleteLogo,
  getAdminBranding,
  getMeta,
  getPublicBranding,
  listVersions,
  resolveScope,
  rollbackBranding,
  saveBranding,
  validateBrandingPayload,
} = require("../services/company-branding.service");

const getAdminConfig = asyncHandler(async (req, res) => {
  const data = await getAdminBranding(resolveScope(req));
  return ok(res, data, "Company branding loaded");
});

const saveAdminConfig = asyncHandler(async (req, res) => {
  const payload = validateBrandingPayload(req.body || {});
  const data = await saveBranding({
    id: req.params.id || null,
    scope: resolveScope(req),
    payload,
    files: req.files || {},
    actor: req.user,
    meta: getMeta(req),
  });
  return ok(res, data, req.params.id ? "Company branding updated" : "Company branding saved");
});

const removeLogo = asyncHandler(async (req, res) => {
  const data = await deleteLogo({
    id: req.params.id,
    slot: String(req.query.slot || req.body?.slot || "").trim(),
    actor: req.user,
    meta: getMeta(req),
  });
  return ok(res, data, "Branding asset removed");
});

const getVersions = asyncHandler(async (req, res) => {
  const data = await listVersions(req.params.id);
  return ok(res, data, "Branding version history loaded");
});

const rollback = asyncHandler(async (req, res) => {
  const data = await rollbackBranding({
    id: req.params.id,
    versionId: req.params.versionId,
    actor: req.user,
    meta: getMeta(req),
  });
  return ok(res, data, "Branding restored");
});

const getPublicConfig = asyncHandler(async (req, res) => {
  const data = await getPublicBranding(resolveScope(req));
  res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  return ok(res, data, "Branding loaded");
});

const getManifest = asyncHandler(async (req, res) => {
  const branding = await getPublicBranding(resolveScope(req));
  const origin = `${req.protocol}://${req.get("host")}`;
  res.set("Content-Type", "application/manifest+json");
  res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  return res.status(200).send(JSON.stringify(buildManifest({ branding, origin })));
});

module.exports = {
  getAdminConfig,
  getManifest,
  getPublicConfig,
  getVersions,
  removeLogo,
  rollback,
  saveAdminConfig,
};
