const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const homepageContainerService = require("../services/homepage-container.service");

const listPublicContainers = asyncHandler(async (req, res) => {
  const containers = await homepageContainerService.listPublicContainers({
    device: req.query.device || "all",
    includeProducts: req.query.includeProducts !== "false",
  });
  return ok(res, containers, "Homepage containers retrieved");
});

const listContainerSchemas = asyncHandler(async (req, res) => {
  const result = homepageContainerService.getContainerSchemas();
  return ok(res, result, "Homepage container schemas retrieved");
});

const getContainerSchema = asyncHandler(async (req, res) => {
  const result = homepageContainerService.getContainerSchema(req.params.type);
  return ok(res, result, "Homepage container schema retrieved");
});

const getContainerProductsBySlug = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.getContainerProductsBySlug(req.params.slug, {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 24),
    device: req.query.device || "all",
  });
  return ok(res, result, "Homepage container products retrieved");
});

const listAdminContainers = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.listAdminContainers({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    search: req.query.search || "",
    status: req.query.status || "",
    containerType: req.query.containerType || "",
  });
  return ok(res, result, "Homepage containers retrieved");
});

const getAdminContainerById = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.getContainerById(req.params.id);
  return ok(res, result, "Homepage container retrieved");
});

const createAdminContainer = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.createContainer(req.body, req.user.sub);
  return ok(res, result, "Homepage container created", 201);
});

const updateAdminContainer = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.updateContainer(req.params.id, req.body, req.user.sub);
  return ok(res, result, "Homepage container updated");
});

const deleteAdminContainer = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.deleteContainer(req.params.id);
  return ok(res, result, "Homepage container deleted");
});

const reorderAdminContainers = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.reorderContainers(req.body.items, req.user.sub);
  return ok(res, result, "Homepage containers reordered");
});

const previewAdminContainer = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.previewContainer(req.body);
  return ok(res, result, "Homepage container preview generated");
});

const uploadAdminContainerMedia = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.uploadContainerMedia(req.files || []);
  return ok(res, result, "Homepage container media uploaded");
});

const trackPublicContainerEvent = asyncHandler(async (req, res) => {
  const result = await homepageContainerService.trackContainerEvent(req.params.id, req.body?.eventType, req.body || {});
  return ok(res, result, "Homepage container analytics tracked");
});

module.exports = {
  listPublicContainers,
  listContainerSchemas,
  getContainerSchema,
  getContainerProductsBySlug,
  listAdminContainers,
  getAdminContainerById,
  createAdminContainer,
  updateAdminContainer,
  deleteAdminContainer,
  reorderAdminContainers,
  previewAdminContainer,
  uploadAdminContainerMedia,
  trackPublicContainerEvent,
};
