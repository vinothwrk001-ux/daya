const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { uploadMany } = require("../utils/upload");
const vendorService = require("../services/vendor.service");

const step1 = asyncHandler(async (req, res) => {
  const vendor = await vendorService.saveStep1(req.user.sub, req.body);
  return ok(res, vendor, "Saved step 1");
});

const step2 = asyncHandler(async (req, res) => {
  const files = (req.files || []).map((f) => ({
    buffer: f.buffer,
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
  }));
  const vendor = await vendorService.saveStep2(req.user.sub, req.body, files);
  return ok(res, vendor, "Saved step 2");
});

const step3 = asyncHandler(async (req, res) => {
  const vendor = await vendorService.saveStep3(req.user.sub, req.body);
  return ok(res, vendor, "Saved step 3");
});

const step4 = asyncHandler(async (req, res) => {
  const files = (req.files || []).map((f) => ({
    buffer: f.buffer,
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
  }));
  const vendor = await vendorService.saveStep4AndSubmit(req.user.sub, req.body, files);
  return ok(res, vendor, "Submitted for approval");
});

const me = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getMe(req.user.sub);
  return ok(res, vendor, "OK");
});

const uploadStoreMedia = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError("Image file is required", 400, "FILE_REQUIRED");
  if (!String(file.mimetype || "").startsWith("image/")) {
    throw new AppError("Only image files are supported", 400, "FILE_TYPE");
  }

  const context = String(req.body?.context || "store").trim().toLowerCase();
  const folder = context === "banner" ? "vendor_store_banners" : "vendor_store_logos";
  const [uploaded] = await uploadMany([file], { folder });
  return ok(res, uploaded, "Store media uploaded");
});

module.exports = { step1, step2, step3, step4, me, uploadStoreMedia };

