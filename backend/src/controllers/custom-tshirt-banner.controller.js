const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const CustomTShirtBanner = require("../models/CustomTShirtBanner");
const { uploadMany } = require("../utils/upload");
const { AppError } = require("../utils/AppError");
const { configureCloudinary } = require("../config/cloudinary");
const fs = require("fs");

const listPublicBanners = asyncHandler(async (req, res) => {
  const banners = await CustomTShirtBanner.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 });
  return ok(res, banners, "Banners loaded");
});

const listAdminBanners = asyncHandler(async (req, res) => {
  const banners = await CustomTShirtBanner.find().sort({ displayOrder: 1, createdAt: -1 }).populate("createdBy", "name email");
  return ok(res, banners, "Admin banners loaded");
});

const createBanner = asyncHandler(async (req, res) => {
  const { label } = req.body;
  if (!label) throw new AppError("Label is required", 400);

  let imageUrl = "";
  let publicId = "";

  if (req.files && req.files.length > 0) {
    const uploaded = await uploadMany(req.files, { folder: "custom_tshirt_banners" });
    if (uploaded && uploaded.length > 0) {
      imageUrl = uploaded[0].url;
      publicId = uploaded[0].publicId;
    }
  } else {
    throw new AppError("Image file is required", 400);
  }

  const banner = await CustomTShirtBanner.create({
    label,
    imageUrl,
    publicId,
    createdBy: req.user?.sub,
  });

  return ok(res, banner, "Banner created", 201);
});

const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await CustomTShirtBanner.findById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);

  // Attempt to delete from cloudinary if publicId exists
  if (banner.publicId) {
    const { enabled, cloudinary } = configureCloudinary();
    if (enabled) {
      try {
        await cloudinary.uploader.destroy(banner.publicId);
      } catch (err) {
        console.error("Cloudinary delete error:", err);
      }
    }
  } else if (banner.imageUrl && banner.imageUrl.startsWith("/uploads/")) {
     // Local file delete logic (optional but good practice)
     const filePath = require("path").join(process.cwd(), banner.imageUrl);
     if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
     }
  }

  await CustomTShirtBanner.findByIdAndDelete(req.params.id);

  return ok(res, null, "Banner deleted");
});

module.exports = {
  listPublicBanners,
  listAdminBanners,
  createBanner,
  deleteBanner,
};
