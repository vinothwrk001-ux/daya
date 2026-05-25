const express = require("express");
const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { isInfluencerCommerceEnabled } = require("../services/influencer-commerce-config.service");
const companyBrandingController = require("../controllers/company-branding.controller");
const { Vendor } = require("../models/Vendor");
const { Product } = require("../models/Product");
const { ProductReview } = require("../models/ProductReview");
const { VendorFollower } = require("../models/VendorFollower");

const router = express.Router();

router.get(
  "/features",
  asyncHandler(async (_req, res) => {
    const influencerCommerceEnabled = await isInfluencerCommerceEnabled();
    return ok(res, { influencerCommerceEnabled }, "OK");
  })
);

router.get("/branding", companyBrandingController.getPublicConfig);
router.get("/branding/manifest.webmanifest", companyBrandingController.getManifest);

// Get all vendors for public stores listing
router.get(
  "/vendors",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const vendors = await Vendor.find({
      storeSlug: { $exists: true, $ne: "" },
      isStoreVisible: { $ne: false },
      status: { $ne: "rejected" },
    })
      .select("_id shopName companyName logoUrl bannerUrl storeSlug storeDescription rating ratings status verified createdAt")
      .sort({ status: 1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const vendorIds = vendors.map((vendor) => vendor._id);
    const [productCounts, followerCounts, reviewStats, previewProducts] = await Promise.all([
      Product.aggregate([
        { $match: { sellerId: { $in: vendorIds }, status: "APPROVED", isActive: true } },
        { $group: { _id: "$sellerId", count: { $sum: 1 } } },
      ]),
      VendorFollower.aggregate([
        { $match: { vendorId: { $in: vendorIds } } },
        { $group: { _id: "$vendorId", count: { $sum: 1 } } },
      ]),
      ProductReview.aggregate([
        { $match: { vendorId: { $in: vendorIds }, status: "approved" } },
        { $group: { _id: "$vendorId", averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      ]),
      Product.find({ sellerId: { $in: vendorIds }, status: "APPROVED", isActive: true })
        .select("_id name images thumbnail sellerId")
        .sort({ "analytics.salesCount": -1, createdAt: -1 })
        .lean(),
    ]);

    const countByVendor = new Map(productCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    const followersByVendor = new Map(followerCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    const reviewsByVendor = new Map(reviewStats.map((item) => [String(item._id), item]));
    const previewsByVendor = new Map();

    for (const product of previewProducts) {
      const key = String(product.sellerId);
      const current = previewsByVendor.get(key) || [];
      if (current.length >= 4) continue;
      current.push({
        _id: product._id,
        name: product.name,
        imageUrl: product.images?.[0]?.url || product.thumbnail || "",
      });
      previewsByVendor.set(key, current);
    }

    const enriched = vendors.map((vendor) => {
      const key = String(vendor._id);
      const reviews = reviewsByVendor.get(key) || {};
      return {
        ...vendor,
        vendorName: vendor.shopName || vendor.companyName || "Store",
        verified: vendor.status === "approved",
        rating: Number(reviews.averageRating || vendor.rating || vendor.ratings?.averageRating || 0),
        totalReviews: Number(reviews.totalReviews || vendor.ratings?.totalReviews || 0),
        followersCount: followersByVendor.get(key) || 0,
        productsCount: countByVendor.get(key) || 0,
        previewProducts: previewsByVendor.get(key) || [],
      };
    });

    return ok(res, enriched, "OK");
  })
);

module.exports = router;
