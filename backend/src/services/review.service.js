const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { configureCloudinary } = require("../config/cloudinary");
const { AppError } = require("../utils/AppError");
const { ProductReview } = require("../models/ProductReview");
const { ProductReviewSummary } = require("../models/ProductReviewSummary");
const { ReviewReport, REVIEW_REPORT_REASONS } = require("../models/ReviewReport");
const { ReviewVote, REVIEW_VOTE_TYPES } = require("../models/ReviewVote");
const { Product } = require("../models/Product");
const { Order } = require("../models/Order");
const { User } = require("../models/User");
const { UserNotification } = require("../models/UserNotification");
const vendorRepo = require("../repositories/vendor.repository");
const auditService = require("./audit.service");
const notificationService = require("./notification.service");

const REVIEW_MEDIA_DIR = path.join(process.cwd(), "uploads", "reviews");
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const REVIEW_STATUS = ["pending", "approved", "rejected", "hidden", "deleted"];
const PUBLIC_STATUS = "approved";

function assertObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  }
}

function toObjectId(value) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

function normalizeString(value, maxLength = 2000) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError("Rating must be an integer from 1 to 5", 400, "VALIDATION_ERROR");
  }
  return rating;
}

function normalizePagination(query = {}) {
  return {
    page: Math.max(Number(query.page) || 1, 1),
    limit: Math.min(Math.max(Number(query.limit) || 10, 1), 50),
  };
}

function normalizeSort(query = {}) {
  const sortBy = String(query.sortBy || query.sort || "most_recent").toLowerCase();
  const sortMap = {
    most_recent: { createdAt: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    most_helpful: { helpfulCount: -1, createdAt: -1 },
    highest_rating: { rating: -1, createdAt: -1 },
    lowest_rating: { rating: 1, createdAt: -1 },
    verified_purchases: { verifiedPurchase: -1, createdAt: -1 },
    with_photos: { createdAt: -1 },
  };
  return sortMap[sortBy] || sortMap.most_recent;
}

function getOrderProductItem(order, productId) {
  const normalizedProductId = String(productId);
  return (order?.items || []).find((item) => String(item.productId?._id || item.productId) === normalizedProductId);
}

function isDelivered(order) {
  return String(order?.status || "").toLowerCase() === "delivered";
}

function createMediaName(originalName) {
  const ext = path.extname(originalName || "");
  return `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`;
}

async function uploadReviewFiles(files = []) {
  if (!files.length) return { images: [], videos: [] };

  const images = files.filter((file) => IMAGE_TYPES.has(file.mimetype));
  const videos = files.filter((file) => VIDEO_TYPES.has(file.mimetype));
  const unsupported = files.find((file) => !IMAGE_TYPES.has(file.mimetype) && !VIDEO_TYPES.has(file.mimetype));

  if (unsupported) {
    throw new AppError("Review media supports JPEG, PNG, WEBP, MP4, WEBM, and MOV only", 400, "FILE_TYPE");
  }
  if (images.length > 10) {
    throw new AppError("A review can include up to 10 images", 400, "FILE_LIMIT");
  }
  if (videos.length > 1) {
    throw new AppError("A review can include only one video", 400, "FILE_LIMIT");
  }
  if (videos.some((file) => file.size > 50 * 1024 * 1024)) {
    throw new AppError("Review video must be 50 MB or smaller", 400, "FILE_SIZE");
  }

  const { enabled, cloudinary } = configureCloudinary();
  const uploadOne = async (file) => {
    if (enabled) {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "reviews",
            resource_type: VIDEO_TYPES.has(file.mimetype) ? "video" : "image",
          },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(file.buffer);
      });

      return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
    }

    await fs.promises.mkdir(REVIEW_MEDIA_DIR, { recursive: true });
    const filename = createMediaName(file.originalname);
    await fs.promises.writeFile(path.join(REVIEW_MEDIA_DIR, filename), file.buffer);
    return {
      url: `/uploads/reviews/${filename}`,
      publicId: null,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  };

  return {
    images: await Promise.all(images.map(uploadOne)),
    videos: await Promise.all(videos.map(uploadOne)),
  };
}

async function notifySafely(task) {
  try {
    await task();
  } catch {
    // Notifications are best-effort so review mutations are not blocked by enum/config drift.
  }
}

async function resolveEligibleDeliveredOrder(customerId, productId, orderId) {
  const query = {
    userId: customerId,
    "items.productId": productId,
    isActive: { $ne: false },
  };
  if (orderId) query._id = orderId;

  const orders = await Order.find(query).sort({ createdAt: -1 }).select("_id sellerId status items.productId orderNumber").lean();
  const deliveredOrder = orders.find(isDelivered);
  if (!deliveredOrder) {
    throw new AppError("Only verified customers with delivered orders can review this product", 403, "REVIEW_NOT_ELIGIBLE");
  }
  if (!getOrderProductItem(deliveredOrder, productId)) {
    throw new AppError("Customer did not purchase this product in the selected order", 403, "REVIEW_NOT_ELIGIBLE");
  }
  return deliveredOrder;
}

function buildDistributionFromBreakdown(breakdown = {}, totalReviews = 0) {
  return Object.fromEntries(
    [5, 4, 3, 2, 1].map((rating) => [
      rating,
      {
        count: Number(breakdown[rating] || 0),
        percent: totalReviews ? Math.round((Number(breakdown[rating] || 0) / totalReviews) * 100) : 0,
      },
    ])
  );
}

async function refreshProductSummary(productId) {
  assertObjectId(productId, "productId");

  const aggregate = await ProductReview.aggregate([
    { $match: { productId: toObjectId(productId), status: PUBLIC_STATUS } },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]);

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalReviews = 0;
  let ratingSum = 0;

  for (const item of aggregate) {
    breakdown[item._id] = item.count;
    totalReviews += item.count;
    ratingSum += item._id * item.count;
  }

  return await ProductReviewSummary.findOneAndUpdate(
    { productId },
    {
      $set: {
        productId,
        averageRating: totalReviews ? Number((ratingSum / totalReviews).toFixed(1)) : 0,
        totalRatings: totalReviews,
        totalReviews,
        ratingBreakdown: breakdown,
        refreshedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function buildProductSummary(productId) {
  assertObjectId(productId, "productId");

  const [cachedSummary, media] = await Promise.all([
    ProductReviewSummary.findOne({ productId }).lean(),
    ProductReview.find({
      productId,
      status: PUBLIC_STATUS,
      $or: [{ images: { $ne: [] } }, { videos: { $ne: [] } }],
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .select("images videos")
      .lean(),
  ]);

  const summary = cachedSummary || (await refreshProductSummary(productId)).toObject();
  const totalReviews = Number(summary.totalReviews || 0);
  const breakdown = summary.ratingBreakdown || {};

  return {
    averageRating: Number(summary.averageRating || 0),
    totalRatings: Number(summary.totalRatings || 0),
    totalReviews,
    ratingBreakdown: breakdown,
    ratingDistribution: buildDistributionFromBreakdown(breakdown, totalReviews),
    media: media.flatMap((review) => [...(review.images || []), ...(review.videos || [])]).slice(0, 12),
  };
}

class ReviewService {
  async listProductReviews(productId, query = {}) {
    assertObjectId(productId, "productId");
    const { page, limit } = normalizePagination(query);
    const filter = { productId, status: PUBLIC_STATUS };

    if (query.rating) filter.rating = normalizeRating(query.rating);
    if (query.verifiedPurchase === "true") filter.verifiedPurchase = true;
    if (query.withPhotos === "true" || query.withMedia === "photos") filter.images = { $ne: [] };
    if (query.withVideos === "true" || query.withMedia === "videos") filter.videos = { $ne: [] };

    const [reviews, total, summary] = await Promise.all([
      ProductReview.find(filter)
        .populate("customerId", "name avatarUrl")
        .populate("vendorId", "shopName companyName")
        .sort(normalizeSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(filter),
      buildProductSummary(productId),
    ]);

    return {
      summary,
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSummaries(productIds = []) {
    const ids = [...new Set(productIds.map(String).filter(mongoose.isValidObjectId))].slice(0, 100);
    const entries = await Promise.all(ids.map(async (id) => [id, await buildProductSummary(id)]));
    return Object.fromEntries(entries);
  }

  async submitReview(customerId, payload = {}, files = [], meta = {}) {
    assertObjectId(payload.productId, "productId");
    if (payload.orderId) assertObjectId(payload.orderId, "orderId");

    const user = await User.findById(customerId).select("status role").lean();
    if (!user || user.role !== "user" || user.status !== "active") {
      throw new AppError("Blocked users and guests cannot submit reviews", 403, "REVIEW_FORBIDDEN");
    }

    const [product, deliveredOrder] = await Promise.all([
      Product.findById(payload.productId).select("_id sellerId name").lean(),
      resolveEligibleDeliveredOrder(customerId, payload.productId, payload.orderId),
    ]);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");

    const vendorId = deliveredOrder.sellerId || product.sellerId;
    if (!vendorId) throw new AppError("Vendor not found for reviewed product", 400, "INVALID_OPERATION");

    const duplicate = await ProductReview.findOne({
      productId: payload.productId,
      customerId,
      orderId: deliveredOrder._id,
      status: { $ne: "deleted" },
    }).select("_id");
    if (duplicate) {
      throw new AppError("Review already submitted for this product in this order", 409, "DUPLICATE_REVIEW");
    }

    const media = await uploadReviewFiles(files);
    const review = await ProductReview.create({
      productId: payload.productId,
      vendorId,
      customerId,
      orderId: deliveredOrder._id,
      rating: normalizeRating(payload.rating),
      title: normalizeString(payload.title, 160),
      review: normalizeString(payload.review || payload.comment, 2000),
      images: media.images,
      videos: media.videos,
      wouldRecommend:
        payload.wouldRecommend === true || payload.wouldRecommend === "yes"
          ? "yes"
          : payload.wouldRecommend === false || payload.wouldRecommend === "no"
            ? "no"
            : null,
      verifiedPurchase: true,
      status: "pending",
    });

    await auditService.log({
      actor: { sub: customerId, role: "user" },
      action: "review.created",
      entityType: "ProductReview",
      entityId: review._id,
      metadata: { productId: payload.productId, orderId: deliveredOrder._id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await notifySafely(() =>
      notificationService.notifyVendorAndOperations({
        vendorId,
        permissionKey: "reviews.read",
        module: "MANAGEMENT",
        subModule: "REVIEWS",
        type: "SYSTEM_ALERT",
        title: "New review submitted",
        message: `${product.name} received a new review pending moderation.`,
        referenceId: review._id,
      })
    );

    return review;
  }

  async updateReview(actor, reviewId, payload = {}, meta = {}) {
    assertObjectId(reviewId, "reviewId");
    const review = await ProductReview.findById(reviewId);
    if (!review || review.status === "deleted") throw new AppError("Review not found", 404, "NOT_FOUND");

    const role = actor?.role;
    if (role === "user") {
      if (String(review.customerId) !== String(actor.sub)) throw new AppError("Forbidden", 403, "FORBIDDEN");
      if (review.status !== "pending") throw new AppError("Only pending reviews can be edited by customers", 409, "REVIEW_LOCKED");
      if (payload.rating !== undefined) review.rating = normalizeRating(payload.rating);
      if (payload.title !== undefined) review.title = normalizeString(payload.title, 160);
      if (payload.review !== undefined || payload.comment !== undefined) review.review = normalizeString(payload.review || payload.comment, 2000);
    } else if (["admin", "super_admin", "support_admin"].includes(role)) {
      if (payload.status && REVIEW_STATUS.includes(payload.status)) {
        review.status = payload.status;
        review.moderatedBy = actor.sub;
        review.moderatedAt = new Date();
      }
      if (payload.rejectionReason !== undefined) review.rejectionReason = normalizeString(payload.rejectionReason, 500);
      if (payload.featured !== undefined) review.featured = Boolean(payload.featured);
    } else {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    await review.save();
    if (payload.status || payload.rating !== undefined) {
      await refreshProductSummary(review.productId);
    }
    await auditService.log({
      actor,
      action: "review.updated",
      entityType: "ProductReview",
      entityId: review._id,
      metadata: { fields: Object.keys(payload) },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (payload.status === "approved" || payload.status === "rejected") {
      await notifySafely(() =>
        UserNotification.create({
          userId: review.customerId,
          type: "SYSTEM",
          title: payload.status === "approved" ? "Review approved" : "Review rejected",
          message: payload.status === "approved" ? "Your review is now published." : "Your review was rejected by moderation.",
          entityType: "ProductReview",
          entityId: review._id,
        })
      );
    }

    return review;
  }

  async deleteReview(actor, reviewId, meta = {}) {
    assertObjectId(reviewId, "reviewId");
    const filter = { _id: reviewId, status: { $ne: "deleted" } };
    if (actor.role === "user") filter.customerId = actor.sub;
    if (actor.role === "vendor") {
      const vendor = await vendorRepo.findByUserId(actor.sub);
      filter.vendorId = vendor?._id;
    }

    const review = await ProductReview.findOneAndUpdate(
      filter,
      { $set: { status: "deleted", moderatedBy: actor.sub, moderatedAt: new Date() } },
      { new: true }
    );
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    await refreshProductSummary(review.productId);

    await auditService.log({
      actor,
      action: "review.deleted",
      entityType: "ProductReview",
      entityId: review._id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { _id: review._id };
  }

  async reply(actor, reviewId, payload = {}, meta = {}) {
    assertObjectId(reviewId, "reviewId");
    const vendor = await vendorRepo.findByUserId(actor.sub);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");

    const message = normalizeString(payload.message || payload.vendorReply, 1200);
    if (!message) throw new AppError("Vendor reply is required", 400, "VALIDATION_ERROR");

    const review = await ProductReview.findOneAndUpdate(
      { _id: reviewId, vendorId: vendor._id, status: { $ne: "deleted" } },
      { $set: { vendorReply: message, vendorReplyDate: new Date() } },
      { new: true }
    );
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    await auditService.log({
      actor,
      action: "review.vendor_replied",
      entityType: "ProductReview",
      entityId: review._id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await notifySafely(() =>
      UserNotification.create({
        userId: review.customerId,
        type: "SYSTEM",
        title: "Vendor replied to your review",
        message: "The vendor responded to your product review.",
        entityType: "ProductReview",
        entityId: review._id,
      })
    );

    return review;
  }

  async vote(customerId, reviewId, payload = {}) {
    assertObjectId(reviewId, "reviewId");
    const voteType = String(payload.voteType || "").toLowerCase();
    if (!REVIEW_VOTE_TYPES.includes(voteType)) throw new AppError("Invalid vote type", 400, "VALIDATION_ERROR");

    const review = await ProductReview.findOne({ _id: reviewId, status: PUBLIC_STATUS });
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    const existing = await ReviewVote.findOne({ reviewId, customerId });
    if (existing && existing.voteType === voteType) {
      return review;
    }

    if (existing) {
      await ProductReview.updateOne(
        { _id: reviewId },
        {
          $inc: {
            helpfulCount: existing.voteType === "helpful" ? -1 : voteType === "helpful" ? 1 : 0,
            notHelpfulCount: existing.voteType === "not_helpful" ? -1 : voteType === "not_helpful" ? 1 : 0,
          },
        }
      );
      existing.voteType = voteType;
      await existing.save();
    } else {
      await ReviewVote.create({ reviewId, customerId, voteType });
      await ProductReview.updateOne(
        { _id: reviewId },
        { $inc: voteType === "helpful" ? { helpfulCount: 1 } : { notHelpfulCount: 1 } }
      );
    }

    return await ProductReview.findById(reviewId);
  }

  async report(customerId, reviewId, payload = {}, meta = {}) {
    assertObjectId(reviewId, "reviewId");
    const reason = String(payload.reason || "").toLowerCase();
    if (!REVIEW_REPORT_REASONS.includes(reason)) throw new AppError("Invalid report reason", 400, "VALIDATION_ERROR");

    const review = await ProductReview.findOne({ _id: reviewId, status: { $ne: "deleted" } });
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    const existingReport = await ReviewReport.findOne({ reviewId, reportedBy: customerId }).select("_id").lean();
    const report = existingReport
      ? await ReviewReport.findById(existingReport._id)
      : await ReviewReport.create({
          reviewId,
          reportedBy: customerId,
          reason,
          description: normalizeString(payload.description, 1000),
          status: "open",
        });

    if (!existingReport) {
      await ProductReview.updateOne({ _id: reviewId }, { $inc: { reportCount: 1 } });
    }

    await auditService.log({
      actor: { sub: customerId, role: "user" },
      action: "review.reported",
      entityType: "ReviewReport",
      entityId: report._id,
      metadata: { reviewId, reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await notifySafely(() =>
      notificationService.notifyOperations(
        {
          module: "MANAGEMENT",
          subModule: "REVIEWS",
          type: "SYSTEM_ALERT",
          title: "Review reported",
          message: "A product review was reported for moderation.",
          referenceId: report._id,
        },
        "reviews.read"
      )
    );

    return report;
  }

  async listVendorReviews(userId, query = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
    const { page, limit } = normalizePagination(query);
    const filter = { vendorId: vendor._id, status: { $ne: "deleted" } };
    if (query.status) filter.status = query.status;
    if (query.rating) filter.rating = normalizeRating(query.rating);

    const [reviews, total] = await Promise.all([
      ProductReview.find(filter)
        .populate("productId", "name images")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(filter),
    ]);

    return { reviews, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async listAdminReviews(query = {}) {
    const { page, limit } = normalizePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.rating) filter.rating = normalizeRating(query.rating);
    if (query.vendorId) filter.vendorId = query.vendorId;
    if (query.productId) filter.productId = query.productId;

    const [reviews, total] = await Promise.all([
      ProductReview.find(filter)
        .populate("productId", "name images")
        .populate("vendorId", "shopName companyName")
        .populate("customerId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(filter),
    ]);

    return { reviews, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getAdminDashboard() {
    const [statusCounts, reportedReviews, ratingAgg, topRated, lowestRated, mostReviewed, recentReviews] = await Promise.all([
      ProductReview.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ProductReview.countDocuments({ reportCount: { $gt: 0 }, status: { $ne: "deleted" } }),
      ProductReview.aggregate([{ $match: { status: PUBLIC_STATUS } }, { $group: { _id: null, averageRating: { $avg: "$rating" }, total: { $sum: 1 } } }]),
      this.rankProducts({ direction: -1 }),
      this.rankProducts({ direction: 1 }),
      this.rankProducts({ byCount: true }),
      ProductReview.find({ status: { $ne: "deleted" } })
        .populate("productId", "name")
        .populate("vendorId", "shopName companyName")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const counts = Object.fromEntries(statusCounts.map((item) => [item._id, item.count]));
    return {
      metrics: {
        totalReviews: Object.values(counts).reduce((sum, value) => sum + value, 0),
        pendingReviews: counts.pending || 0,
        approvedReviews: counts.approved || 0,
        rejectedReviews: counts.rejected || 0,
        reportedReviews,
        averageRating: ratingAgg[0]?.averageRating ? Number(ratingAgg[0].averageRating.toFixed(1)) : 0,
      },
      topRatedProducts: topRated,
      lowestRatedProducts: lowestRated,
      mostReviewedProducts: mostReviewed,
      recentReviews,
    };
  }

  async rankProducts({ direction = -1, byCount = false } = {}) {
    const sort = byCount ? { reviewCount: -1 } : { averageRating: direction, reviewCount: -1 };
    return await ProductReview.aggregate([
      { $match: { status: PUBLIC_STATUS } },
      { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
      { $sort: sort },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: "$_id",
          productName: "$product.name",
          averageRating: { $round: ["$averageRating", 1] },
          reviewCount: 1,
        },
      },
    ]);
  }
}

module.exports = new ReviewService();
