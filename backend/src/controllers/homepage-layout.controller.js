const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const homepageLayoutService = require("../services/homepage-layout.service");

const getBuilderContainerSchema = asyncHandler(async (req, res) => {
  return ok(res, homepageLayoutService.getBuilderContainerSchema(req.params.type), "Homepage builder container schema retrieved");
});

const listContainerLibrary = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.getContainerLibrary(), "Homepage builder containers retrieved");
});

const listAdminLayouts = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.listLayouts(), "Homepage layouts retrieved");
});

const getAdminLayoutById = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.getLayoutById(req.params.id), "Homepage layout retrieved");
});

const createAdminLayout = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.createLayout(req.body, req.user.sub), "Homepage layout created", 201);
});

const updateAdminLayoutDraft = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.updateDraft(req.params.id, req.body, req.user.sub), "Homepage draft saved");
});

const previewAdminLayout = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.previewLayout(req.body), "Homepage layout preview generated");
});

const publishAdminLayout = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.publishLayout(req.params.id, req.user.sub), "Homepage layout published");
});

const deleteAdminLayout = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.deleteLayout(req.params.id), "Homepage layout deleted");
});

const listAdminLayoutVersions = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.listVersions(req.params.id), "Homepage layout versions retrieved");
});

const rollbackAdminLayoutVersion = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.rollbackToVersion(req.params.id, req.params.versionId, req.user.sub), "Homepage layout rolled back");
});

const uploadAdminLayoutMedia = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.uploadLayoutMedia(req.files || []), "Homepage builder media uploaded");
});

const getPublicLayout = asyncHandler(async (req, res) => {
  return ok(res, await homepageLayoutService.getPublicLayout({ device: req.query.device || "desktop" }), "Homepage layout retrieved");
});

module.exports = {
  getBuilderContainerSchema,
  listContainerLibrary,
  listAdminLayouts,
  getAdminLayoutById,
  createAdminLayout,
  updateAdminLayoutDraft,
  previewAdminLayout,
  publishAdminLayout,
  deleteAdminLayout,
  listAdminLayoutVersions,
  rollbackAdminLayoutVersion,
  uploadAdminLayoutMedia,
  getPublicLayout,
};
