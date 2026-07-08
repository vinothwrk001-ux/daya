const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../../utils/AppError");
const { uploadMany } = require("../../utils/upload");
const auditService = require("../../services/audit.service");
const notificationService = require("../../services/notification.service");
const { Product } = require("../../models/Product");
const { User } = require("../../models/User");
const {
  Reel,
  ReelLike,
  ReelComment,
  ReelSave,
  ReelShare,
  ReelView,
  ReelProductClick,
  ReelProductView,
  ReelProductWidgetOpen,
  ReelAttribution,
  ReelPurchaseConversion,
} = require("./models");
const {
  buildLinkedFromProductIds,
  normalizeLinkedProductsInput,
  validateLinkedProductIds,
  isProductLinkedToReel,
  populateReelProducts,
  enrichAdminLinkedProducts,
  resolveReelProductIds,
} = require("./reelProductHelpers");

const MIN_VIEW_SECONDS = 3;
const COMMENT_COOLDOWN_MS = 5000;

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
}

function hashIp(ip = "") {
  return crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 24);
}

function normalizeSessionId(sessionId) {
  const value = String(sessionId || "").trim();
  if (!value || value.length > 128) {
    throw new AppError("Valid sessionId is required", 400, "VALIDATION_ERROR");
  }
  return value;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function buildPublicFilter(options = {}) {
  const filter = {
    status: "published",
    visibility: "public",
    $or: [{ publishDate: { $lte: new Date() } }, { publishDate: null }],
  };
  if (options.showOnStorefront !== undefined) {
    filter.showOnStorefront = normalizeBoolean(options.showOnStorefront);
  }
  return filter;
}

async function enrichReelForUser(reel, userId) {
  if (!userId) {
    return { ...reel, liked: false, saved: false };
  }
  const [liked, saved] = await Promise.all([
    ReelLike.exists({ reelId: reel._id, userId }),
    ReelSave.exists({ reelId: reel._id, userId }),
  ]);
  return { ...reel, liked: Boolean(liked), saved: Boolean(saved) };
}

class ReelService {
  async uploadMedia(files = {}, { requireVideo = true } = {}) {
    const videoFile = files.video?.[0];
    const thumbnailFile = files.thumbnail?.[0];

    if (requireVideo && !videoFile) {
      throw new AppError("Video file is required", 400, "VALIDATION_ERROR");
    }

    let videoUpload = null;
    if (videoFile) {
      [videoUpload] = await uploadMany([videoFile], { folder: "reels/videos" });
    }

    let thumbnailUpload = null;
    if (thumbnailFile) {
      [thumbnailUpload] = await uploadMany([thumbnailFile], { folder: "reels/thumbnails" });
    }

    return {
      videoUrl: videoUpload?.url,
      thumbnailUrl: thumbnailUpload?.url || videoUpload?.url || "",
      cloudinaryPublicId: videoUpload?.publicId || "",
    };
  }

  async createReel(actor, payload, files, meta = {}) {
    const media = await this.uploadMedia(files);
    let linkedProducts = [];
    if (payload.linkedProducts) {
      linkedProducts = normalizeLinkedProductsInput(payload.linkedProducts);
      await validateLinkedProductIds(linkedProducts.map((item) => item.productId));
    } else {
      const associatedProducts = Array.isArray(payload.associatedProducts)
        ? payload.associatedProducts.filter((id) => mongoose.isValidObjectId(id))
        : [];
      if (associatedProducts.length) {
        await validateLinkedProductIds(associatedProducts);
        linkedProducts = buildLinkedFromProductIds(associatedProducts);
      }
    }

    const associatedProducts = linkedProducts.map((item) => item.productId);

    const reel = await Reel.create({
      title: payload.title,
      description: payload.description || "",
      videoUrl: media.videoUrl,
      thumbnailUrl: media.thumbnailUrl,
      cloudinaryPublicId: media.cloudinaryPublicId,
      category: payload.category || "",
      tags: Array.isArray(payload.tags) ? payload.tags : String(payload.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      musicName: payload.musicName || "",
      location: payload.location || "",
      status: payload.status || "draft",
      visibility: payload.visibility || "public",
      showOnStorefront: normalizeBoolean(payload.showOnStorefront),
      attributionWindowDays: Number(payload.attributionWindowDays || 30),
      publishDate: payload.publishDate ? new Date(payload.publishDate) : null,
      associatedProducts,
      linkedProducts,
      createdBy: actor.sub || actor._id,
    });

    await auditService.log({
      actor,
      action: "REEL_CREATED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { title: reel.title, status: reel.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (reel.status === "published") {
      await this.notifyReelPublished(reel);
    }

    return reel;
  }

  async updateReel(actor, reelId, payload, files, meta = {}) {
    const reel = await Reel.findById(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const oldStatus = reel.status;
    let mediaUpdate = {};

    if (files?.video?.[0] || files?.thumbnail?.[0]) {
      mediaUpdate = await this.uploadMedia(files, { requireVideo: false });
    }

    if (payload.linkedProducts) {
      const linkedProducts = normalizeLinkedProductsInput(payload.linkedProducts);
      await validateLinkedProductIds(linkedProducts.map((item) => item.productId));
      reel.linkedProducts = linkedProducts;
      reel.associatedProducts = linkedProducts.map((item) => item.productId);
    } else if (payload.associatedProducts) {
      const associatedProducts = Array.isArray(payload.associatedProducts)
        ? payload.associatedProducts.filter((id) => mongoose.isValidObjectId(id))
        : [];
      if (associatedProducts.length) {
        await validateLinkedProductIds(associatedProducts);
      }
      reel.linkedProducts = buildLinkedFromProductIds(associatedProducts);
      reel.associatedProducts = associatedProducts;
    }

    if (payload.title !== undefined) reel.title = payload.title;
    if (payload.description !== undefined) reel.description = payload.description;
    if (payload.category !== undefined) reel.category = payload.category;
    if (payload.musicName !== undefined) reel.musicName = payload.musicName;
    if (payload.location !== undefined) reel.location = payload.location;
    if (payload.tags !== undefined) {
      reel.tags = Array.isArray(payload.tags)
        ? payload.tags
        : String(payload.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (payload.status !== undefined) reel.status = payload.status;
    if (payload.visibility !== undefined) reel.visibility = payload.visibility;
    if (payload.attributionWindowDays !== undefined) {
      reel.attributionWindowDays = Number(payload.attributionWindowDays || 30);
    }
    if (payload.publishDate !== undefined) {
      reel.publishDate = payload.publishDate ? new Date(payload.publishDate) : null;
    }
    if (payload.showOnStorefront !== undefined) {
      reel.showOnStorefront = normalizeBoolean(payload.showOnStorefront);
    }
    if (mediaUpdate.videoUrl) reel.videoUrl = mediaUpdate.videoUrl;
    if (mediaUpdate.thumbnailUrl) reel.thumbnailUrl = mediaUpdate.thumbnailUrl;
    if (mediaUpdate.cloudinaryPublicId) reel.cloudinaryPublicId = mediaUpdate.cloudinaryPublicId;

    await reel.save();

    await auditService.log({
      actor,
      action: "REEL_UPDATED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { oldStatus, newStatus: reel.status, title: reel.title },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (oldStatus !== "published" && reel.status === "published") {
      await this.notifyReelPublished(reel);
    }

    return reel;
  }

  async deleteReel(actor, reelId, meta = {}) {
    const reel = await Reel.findByIdAndDelete(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    await Promise.all([
      ReelLike.deleteMany({ reelId }),
      ReelComment.deleteMany({ reelId }),
      ReelSave.deleteMany({ reelId }),
      ReelShare.deleteMany({ reelId }),
      ReelView.deleteMany({ reelId }),
      ReelProductClick.deleteMany({ reelId }),
      ReelProductView.deleteMany({ reelId }),
      ReelProductWidgetOpen.deleteMany({ reelId }),
      ReelAttribution.deleteMany({ reelId }),
    ]);

    await auditService.log({
      actor,
      action: "REEL_DELETED",
      entityType: "Reel",
      entityId: reelId,
      metadata: { title: reel.title },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { deleted: true };
  }

  async publishReel(actor, reelId, meta = {}) {
    const reel = await Reel.findById(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    reel.status = "published";
    if (!reel.publishDate) reel.publishDate = new Date();
    await reel.save();

    await auditService.log({
      actor,
      action: "REEL_STATUS_CHANGED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { status: "published" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.notifyReelPublished(reel);
    return reel;
  }

  async listPublic({ page = 1, limit = 12, sort = "latest", category, tag, showOnStorefront, userId } = {}) {
    const query = buildPublicFilter({ showOnStorefront });
    if (category) query.category = category;
    if (tag) query.tags = tag;

    const sortMap = {
      latest: { publishDate: -1, createdAt: -1 },
      trending: { viewsCount: -1, likesCount: -1 },
      popular: { likesCount: -1, sharesCount: -1 },
      recommended: { savesCount: -1, productClicksCount: -1 },
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Reel.find(query)
        .sort(sortMap[sort] || sortMap.latest)
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name")
        .lean(),
      Reel.countDocuments(query),
    ]);

    const enriched = await populateReelProducts(items);
    const withUserState = await Promise.all(enriched.map((reel) => enrichReelForUser(reel, userId)));

    return {
      reels: withUserState,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getPublicReel(reelId, userId) {
    asObjectId(reelId, "reelId");
    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() })
      .populate("createdBy", "name")
      .lean();
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const [enriched] = await populateReelProducts([reel]);
    return enrichReelForUser(enriched, userId);
  }

  async listAdmin({ page = 1, limit = 20, status, search } = {}) {
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { tags: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Reel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email")
        .populate("associatedProducts", "name sku price salePrice images")
        .lean(),
      Reel.countDocuments(query),
    ]);

    return {
      reels: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAdminReel(reelId) {
    const reel = await Reel.findById(reelId)
      .populate("createdBy", "name email")
      .populate("associatedProducts", "name sku price salePrice images")
      .lean();
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    const linkedProducts = await enrichAdminLinkedProducts(reel);
    return { ...reel, linkedProducts };
  }

  async trackView(reelId, { userId, sessionId, viewDuration = 0, videoDuration = 0, ipAddress } = {}) {
    asObjectId(reelId, "reelId");
    const session = normalizeSessionId(sessionId);
    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const duration = Number(viewDuration || 0);
    const total = Number(videoDuration || 0);
    const completionPercent = total > 0 ? (duration / total) * 100 : 0;
    const qualified = duration >= MIN_VIEW_SECONDS || completionPercent >= 50;

    if (!qualified) {
      return { tracked: false, qualified: false };
    }

    const existing = await ReelView.findOne({ reelId, sessionId: session }).lean();
    if (existing?.qualified) {
      return { tracked: false, duplicate: true, qualified: true };
    }

    const ipHash = hashIp(ipAddress);
    let uniqueUser = false;

    if (existing) {
      await ReelView.updateOne(
        { _id: existing._id },
        {
          $set: {
            viewDuration: duration,
            videoDuration: total,
            completionPercent,
            qualified: true,
            userId: userId || existing.userId || null,
          },
        }
      );
    } else {
      uniqueUser = !(await ReelView.exists({ reelId, userId: userId || null, qualified: true }));
      try {
        await ReelView.create({
          reelId,
          userId: userId || null,
          sessionId: session,
          viewDuration: duration,
          videoDuration: total,
          completionPercent,
          qualified: true,
          ipHash,
        });
      } catch (error) {
        if (error?.code === 11000) {
          return { tracked: false, duplicate: true, qualified: true };
        }
        throw error;
      }
    }

    await Reel.updateOne(
      { _id: reelId },
      {
        $inc: {
          viewsCount: 1,
          ...(uniqueUser || !existing ? { uniqueViewsCount: 1 } : {}),
        },
      }
    );

    return { tracked: true, qualified: true };
  }

  async likeReel(reelId, userId) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    asObjectId(reelId, "reelId");

    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    try {
      await ReelLike.create({ reelId, userId });
      await Reel.updateOne({ _id: reelId }, { $inc: { likesCount: 1 } });
      return { liked: true, likesCount: reel.likesCount + 1 };
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError("Already liked", 409, "DUPLICATE_LIKE");
      }
      throw error;
    }
  }

  async unlikeReel(reelId, userId) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const deleted = await ReelLike.findOneAndDelete({ reelId, userId });
    if (!deleted) throw new AppError("Like not found", 404, "NOT_FOUND");
    await Reel.updateOne({ _id: reelId }, { $inc: { likesCount: -1 } });
    const reel = await Reel.findById(reelId).select("likesCount").lean();
    return { liked: false, likesCount: Math.max(0, reel?.likesCount || 0) };
  }

  async addComment(reelId, userId, { comment, parentCommentId } = {}) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const text = String(comment || "").trim();
    if (!text) throw new AppError("Comment is required", 400, "VALIDATION_ERROR");

    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const recent = await ReelComment.findOne({
      userId,
      reelId,
      createdAt: { $gte: new Date(Date.now() - COMMENT_COOLDOWN_MS) },
    }).lean();
    if (recent) throw new AppError("Please wait before commenting again", 429, "RATE_LIMIT");

    if (parentCommentId) {
      const parent = await ReelComment.findOne({ _id: parentCommentId, reelId, isDeleted: false });
      if (!parent) throw new AppError("Parent comment not found", 404, "NOT_FOUND");
    }

    const doc = await ReelComment.create({
      reelId,
      userId,
      comment: text,
      parentCommentId: parentCommentId || null,
    });

    await Reel.updateOne({ _id: reelId }, { $inc: { commentsCount: 1 } });

    await notificationService.notifyOperations(
      {
        module: "MANAGEMENT",
        subModule: "REELS",
        type: "REEL_COMMENT",
        title: "New reel comment",
        message: `New comment on "${reel.title}"`,
        referenceId: String(reelId),
        meta: { reelId, commentId: doc._id },
      },
      "settings:read"
    );

    const populated = await ReelComment.findById(doc._id).populate("userId", "name").lean();
    return populated;
  }

  async listComments(reelId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const query = { reelId, isDeleted: false, parentCommentId: null };
    const [comments, total] = await Promise.all([
      ReelComment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name")
        .lean(),
      ReelComment.countDocuments(query),
    ]);

    const parentIds = comments.map((c) => c._id);
    const replies = parentIds.length
      ? await ReelComment.find({ parentCommentId: { $in: parentIds }, isDeleted: false })
          .sort({ createdAt: 1 })
          .populate("userId", "name")
          .lean()
      : [];

    const replyMap = replies.reduce((acc, reply) => {
      const key = String(reply.parentCommentId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(reply);
      return acc;
    }, {});

    return {
      comments: comments.map((comment) => ({
        ...comment,
        replies: replyMap[String(comment._id)] || [],
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async deleteComment(actor, reelId, commentId, meta = {}) {
    const comment = await ReelComment.findOne({ _id: commentId, reelId });
    if (!comment || comment.isDeleted) throw new AppError("Comment not found", 404, "NOT_FOUND");

    comment.isDeleted = true;
    comment.moderatedAt = new Date();
    await comment.save();
    await Reel.updateOne({ _id: reelId }, { $inc: { commentsCount: -1 } });

    await auditService.log({
      actor,
      action: "REEL_COMMENT_DELETED",
      entityType: "ReelComment",
      entityId: commentId,
      metadata: { reelId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { deleted: true };
  }

  async shareReel(reelId, { userId, platform, sessionId } = {}) {
    asObjectId(reelId, "reelId");
    const session = normalizeSessionId(sessionId || crypto.randomUUID());
    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const since = new Date(Date.now() - 30000);
    const recent = await ReelShare.findOne({
      reelId,
      sessionId: session,
      platform: platform || "other",
      createdAt: { $gte: since },
    }).lean();
    if (recent) return { shared: false, duplicate: true, sharesCount: reel.sharesCount };

    await ReelShare.create({
      reelId,
      userId: userId || null,
      platform: platform || "other",
      sessionId: session,
    });
    await Reel.updateOne({ _id: reelId }, { $inc: { sharesCount: 1 } });
    return { shared: true, sharesCount: reel.sharesCount + 1 };
  }

  async saveReel(reelId, userId) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    try {
      await ReelSave.create({ reelId, userId });
      await Reel.updateOne({ _id: reelId }, { $inc: { savesCount: 1 } });
      return { saved: true, savesCount: reel.savesCount + 1 };
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError("Already saved", 409, "DUPLICATE_SAVE");
      }
      throw error;
    }
  }

  async unsaveReel(reelId, userId) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const deleted = await ReelSave.findOneAndDelete({ reelId, userId });
    if (!deleted) throw new AppError("Save not found", 404, "NOT_FOUND");
    await Reel.updateOne({ _id: reelId }, { $inc: { savesCount: -1 } });
    const reel = await Reel.findById(reelId).select("savesCount").lean();
    return { saved: false, savesCount: Math.max(0, reel?.savesCount || 0) };
  }

  async listSavedReels(userId, { page = 1, limit = 12 } = {}) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const skip = (page - 1) * limit;
    const saves = await ReelSave.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const reelIds = saves.map((s) => s.reelId);
    const reels = await Reel.find({ _id: { $in: reelIds }, ...buildPublicFilter() })
      .populate("createdBy", "name")
      .lean();
    const reelMap = new Map(reels.map((r) => [String(r._id), r]));
    const ordered = reelIds.map((id) => reelMap.get(String(id))).filter(Boolean);
    const enriched = await populateReelProducts(ordered);
    return {
      reels: enriched.map((reel) => ({ ...reel, saved: true, liked: false })),
      pagination: { page, limit, total: await ReelSave.countDocuments({ userId }) },
    };
  }

  async trackProductClick(reelId, productId, { userId, sessionId } = {}) {
    asObjectId(reelId, "reelId");
    asObjectId(productId, "productId");
    const session = normalizeSessionId(sessionId);

    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    if (!isProductLinkedToReel(reel, productId)) {
      throw new AppError("Product not associated with this reel", 400, "VALIDATION_ERROR");
    }

    await ReelProductClick.create({
      reelId,
      productId,
      userId: userId || null,
      sessionId: session,
      clickedAt: new Date(),
    });
    await Reel.updateOne({ _id: reelId }, { $inc: { productClicksCount: 1 } });

    const windowStart = new Date(Date.now() - reel.attributionWindowDays * 24 * 60 * 60 * 1000);
    await ReelAttribution.findOneAndUpdate(
      { reelId, productId, sessionId: session, attributed: false, createdAt: { $gte: windowStart } },
      {
        $setOnInsert: {
          reelId,
          productId,
          userId: userId || null,
          sessionId: session,
          attributed: false,
        },
      },
      { upsert: true, new: true }
    );

    return {
      sessionId: session,
      reelId,
      productId,
      attributionWindowDays: reel.attributionWindowDays,
    };
  }

  async trackProductView(reelId, productId, { userId, sessionId } = {}) {
    asObjectId(reelId, "reelId");
    asObjectId(productId, "productId");
    const session = normalizeSessionId(sessionId);

    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    if (!isProductLinkedToReel(reel, productId)) {
      throw new AppError("Product not associated with this reel", 400, "VALIDATION_ERROR");
    }

    try {
      await ReelProductView.create({
        reelId,
        productId,
        userId: userId || null,
        sessionId: session,
        viewedAt: new Date(),
      });
      await Reel.updateOne({ _id: reelId }, { $inc: { productViewsCount: 1 } });
      return { tracked: true };
    } catch (error) {
      if (error?.code === 11000) {
        return { tracked: false, duplicate: true };
      }
      throw error;
    }
  }

  async deleteOwnComment(userId, reelId, commentId) {
    if (!userId) throw new AppError("Login required", 401, "AUTH_REQUIRED");
    const comment = await ReelComment.findOne({ _id: commentId, reelId, userId, isDeleted: false });
    if (!comment) throw new AppError("Comment not found", 404, "NOT_FOUND");

    comment.isDeleted = true;
    comment.moderatedAt = new Date();
    await comment.save();
    await Reel.updateOne({ _id: reelId }, { $inc: { commentsCount: -1 } });
    return { deleted: true };
  }

  async trackAddToCart({ reelId, productId, sessionId, userId } = {}) {
    if (!reelId || !productId || !sessionId) return { tracked: false };
    asObjectId(reelId, "reelId");
    asObjectId(productId, "productId");
    const session = normalizeSessionId(sessionId);

    const reel = await Reel.findById(reelId).select("attributionWindowDays").lean();
    if (!reel) return { tracked: false };

    const windowStart = new Date(Date.now() - reel.attributionWindowDays * 24 * 60 * 60 * 1000);
    const updated = await ReelAttribution.findOneAndUpdate(
      {
        reelId,
        productId,
        sessionId: session,
        attributed: false,
        createdAt: { $gte: windowStart },
        addToCartAt: { $exists: false },
      },
      { $set: { addToCartAt: new Date(), userId: userId || null } },
      { new: true }
    );

    if (updated) {
      await Reel.updateOne({ _id: reelId }, { $inc: { addToCartCount: 1 } });
      return { tracked: true };
    }
    return { tracked: false };
  }

  async processOrderAttribution(userId, orders = [], { sessionId } = {}) {
    if (!sessionId || !orders?.length) return [];

    const session = normalizeSessionId(sessionId);
    const results = [];

    for (const order of orders) {
      for (const item of order.items || []) {
        const productId = item.productId?._id || item.productId;
        if (!productId) continue;

        const attribution = await ReelAttribution.findOne({
          productId,
          sessionId: session,
          attributed: false,
        }).sort({ createdAt: -1 });

        if (!attribution) continue;

        const reel = await Reel.findById(attribution.reelId).lean();
        if (!reel) continue;

        const windowStart = new Date(Date.now() - reel.attributionWindowDays * 24 * 60 * 60 * 1000);
        if (attribution.createdAt < windowStart) continue;

        const revenue = Number(item.price || 0) * Number(item.quantity || 0);
        attribution.userId = userId || null;
        attribution.orderId = order._id;
        attribution.revenue = revenue;
        attribution.attributed = true;
        await attribution.save();

        await Reel.updateOne(
          { _id: reel._id },
          {
            $inc: {
              ordersCount: 1,
              revenueTotal: revenue,
            },
          }
        );

        await ReelPurchaseConversion.create({
          reelId: reel._id,
          productId,
          userId: userId || null,
          orderId: order._id,
          sessionId: session,
          revenue,
          commission: 0,
          attributedAt: new Date(),
        }).catch(() => null);

        results.push(attribution);

        if (reel.viewsCount > 1000 && reel.productClicksCount / Math.max(reel.viewsCount, 1) > 0.05) {
          await notificationService.notifyOperations(
            {
              module: "MANAGEMENT",
              subModule: "REELS",
              type: "HIGH_PERFORMING_REEL",
              title: "High performing reel",
              message: `"${reel.title}" is converting strongly`,
              referenceId: String(reel._id),
              meta: { reelId: reel._id, revenue },
            },
            "analytics:read"
          );
        }
      }
    }

    return results;
  }

  async getAnalyticsDashboard() {
    const [
      totalReels,
      publishedReels,
      viewAgg,
      likeAgg,
      commentAgg,
      shareAgg,
      saveAgg,
      clickAgg,
      productViewAgg,
      widgetOpenAgg,
      cartAgg,
      orderAgg,
      revenueAgg,
    ] = await Promise.all([
      Reel.countDocuments(),
      Reel.countDocuments({ status: "published" }),
      Reel.aggregate([{ $group: { _id: null, views: { $sum: "$viewsCount" }, uniqueViews: { $sum: "$uniqueViewsCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$likesCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$commentsCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$sharesCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$savesCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$productClicksCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$productViewsCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$productWidgetOpensCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$addToCartCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$ordersCount" } } }]),
      Reel.aggregate([{ $group: { _id: null, total: { $sum: "$revenueTotal" } } }]),
    ]);

    const views = viewAgg[0]?.views || 0;
    const uniqueViews = viewAgg[0]?.uniqueViews || 0;
    const productClicks = clickAgg[0]?.total || 0;
    const orders = orderAgg[0]?.total || 0;

    return {
      totalReels,
      publishedReels,
      totalViews: views,
      uniqueViews,
      totalLikes: likeAgg[0]?.total || 0,
      totalComments: commentAgg[0]?.total || 0,
      totalShares: shareAgg[0]?.total || 0,
      totalSaves: saveAgg[0]?.total || 0,
      productClicks,
      productViews: productViewAgg[0]?.total || 0,
      productWidgetOpens: widgetOpenAgg[0]?.total || 0,
      addToCart: cartAgg[0]?.total || 0,
      orders,
      revenue: revenueAgg[0]?.total || 0,
      ctr: views ? Number(((productClicks / views) * 100).toFixed(2)) : 0,
      conversionRate: productClicks ? Number(((orders / productClicks) * 100).toFixed(2)) : 0,
    };
  }

  async getAttributionDashboard({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const pipeline = [
      {
        $group: {
          _id: { reelId: "$reelId", productId: "$productId" },
          views: { $sum: 0 },
          clicks: { $sum: 0 },
          addToCart: { $sum: { $cond: [{ $ifNull: ["$addToCartAt", false] }, 1, 0] } },
          orders: { $sum: { $cond: ["$attributed", 1, 0] } },
          revenue: { $sum: { $cond: ["$attributed", "$revenue", 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const rows = await ReelAttribution.aggregate(pipeline);
    const totalGroups = await ReelAttribution.aggregate([
      { $group: { _id: { reelId: "$reelId", productId: "$productId" } } },
      { $count: "total" },
    ]);
    const total = totalGroups[0]?.total || 0;

    const reelIds = [...new Set(rows.map((r) => String(r._id.reelId)))];
    const productIds = [...new Set(rows.map((r) => String(r._id.productId)))];
    const [reels, products, clickStats, viewStats] = await Promise.all([
      Reel.find({ _id: { $in: reelIds } }).select("title viewsCount productClicksCount").lean(),
      Product.find({ _id: { $in: productIds } }).select("name sku price salePrice images").lean(),
      ReelProductClick.aggregate([
        { $match: { reelId: { $in: reelIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: { reelId: "$reelId", productId: "$productId" }, clicks: { $sum: 1 } } },
      ]),
      Reel.find({ _id: { $in: reelIds } }).select("_id viewsCount").lean(),
    ]);

    const reelMap = new Map(reels.map((r) => [String(r._id), r]));
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const clickMap = new Map(clickStats.map((c) => [`${c._id.reelId}:${c._id.productId}`, c.clicks]));
    const viewMap = new Map(viewStats.map((v) => [String(v._id), v.viewsCount]));

    return {
      rows: rows.map((row) => {
        const reelId = String(row._id.reelId);
        const productId = String(row._id.productId);
        const views = viewMap.get(reelId) || 0;
        const clicks = clickMap.get(`${reelId}:${productId}`) || 0;
        const conversion = clicks ? Number(((row.orders / clicks) * 100).toFixed(2)) : 0;
        return {
          reel: reelMap.get(reelId) || { _id: reelId },
          product: productMap.get(productId) || { _id: productId },
          views,
          clicks,
          addToCart: row.addToCart,
          orders: row.orders,
          revenue: row.revenue,
          conversionRate: conversion,
        };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getReelProducts(reelId, { admin = false } = {}) {
    asObjectId(reelId, "reelId");
    const filter = admin ? { _id: reelId } : { _id: reelId, ...buildPublicFilter() };
    const reel = await Reel.findOne(filter).lean();
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const [enriched] = await populateReelProducts([reel]);
    if (admin) {
      const linkedProducts = await enrichAdminLinkedProducts(reel);
      return {
        success: true,
        reelId: reel._id,
        products: enriched.products || [],
        linkedProducts,
      };
    }

    return {
      success: true,
      reelId: reel._id,
      products: enriched.linkedProducts || [],
      linkedProducts: enriched.linkedProducts || [],
    };
  }

  async setReelProducts(actor, reelId, payload = {}, meta = {}) {
    asObjectId(reelId, "reelId");
    const reel = await Reel.findById(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const linkedProducts = normalizeLinkedProductsInput(payload.linkedProducts || payload.products || []);
    await validateLinkedProductIds(linkedProducts.map((item) => item.productId));

    reel.linkedProducts = linkedProducts;
    reel.associatedProducts = linkedProducts.map((item) => item.productId);
    await reel.save();

    await auditService.log({
      actor,
      action: "REEL_PRODUCTS_UPDATED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { productCount: linkedProducts.length },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getReelProducts(reelId, { admin: true });
  }

  async addReelProducts(actor, reelId, payload = {}, meta = {}) {
    asObjectId(reelId, "reelId");
    const reel = await Reel.findById(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const incoming = normalizeLinkedProductsInput(payload.linkedProducts || payload.products || []);
    const existing = reel.linkedProducts?.length
      ? reel.linkedProducts
      : buildLinkedFromProductIds(reel.associatedProducts || []);

    const mergedMap = new Map(existing.map((item) => [String(item.productId), item]));
    incoming.forEach((item, index) => {
      mergedMap.set(String(item.productId), {
        ...item,
        sortOrder: item.sortOrder ?? existing.length + index,
      });
    });

    const linkedProducts = normalizeLinkedProductsInput([...mergedMap.values()]);
    reel.linkedProducts = linkedProducts;
    reel.associatedProducts = linkedProducts.map((item) => item.productId);
    await reel.save();

    await auditService.log({
      actor,
      action: "REEL_PRODUCTS_ADDED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { added: incoming.length, total: linkedProducts.length },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getReelProducts(reelId, { admin: true });
  }

  async removeReelProduct(actor, reelId, productId, meta = {}) {
    asObjectId(reelId, "reelId");
    asObjectId(productId, "productId");
    const reel = await Reel.findById(reelId);
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");

    const existing = reel.linkedProducts?.length
      ? reel.linkedProducts
      : buildLinkedFromProductIds(reel.associatedProducts || []);
    const linkedProducts = existing
      .filter((item) => String(item.productId) !== String(productId))
      .map((item, index) => ({ ...item.toObject?.() || item, sortOrder: index }));

    reel.linkedProducts = linkedProducts;
    reel.associatedProducts = linkedProducts.map((item) => item.productId);
    await reel.save();

    await auditService.log({
      actor,
      action: "REEL_PRODUCT_REMOVED",
      entityType: "Reel",
      entityId: reel._id,
      metadata: { productId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getReelProducts(reelId, { admin: true });
  }

  async trackProductWidgetOpen(reelId, { userId, sessionId } = {}) {
    asObjectId(reelId, "reelId");
    const session = normalizeSessionId(sessionId);

    const reel = await Reel.findOne({ _id: reelId, ...buildPublicFilter() });
    if (!reel) throw new AppError("Reel not found", 404, "NOT_FOUND");
    if (!resolveReelProductIds(reel).length) {
      throw new AppError("No products linked to this reel", 400, "VALIDATION_ERROR");
    }

    await ReelProductWidgetOpen.create({
      reelId,
      userId: userId || null,
      sessionId: session,
      openedAt: new Date(),
    });
    await Reel.updateOne({ _id: reelId }, { $inc: { productWidgetOpensCount: 1 } });

    return { tracked: true, reelId, sessionId: session };
  }

  async getReelPerformanceDashboard({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Reel.find({ status: { $in: ["published", "draft", "archived"] } })
        .sort({ viewsCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "title viewsCount productClicksCount productWidgetOpensCount addToCartCount ordersCount revenueTotal status"
        )
        .lean(),
      Reel.countDocuments(),
    ]);

    const rows = items.map((reel) => {
      const views = reel.viewsCount || 0;
      const clicks = reel.productClicksCount || 0;
      const widgetOpens = reel.productWidgetOpensCount || 0;
      const ctr = views ? Number(((clicks / views) * 100).toFixed(2)) : 0;
      return {
        reelId: reel._id,
        title: reel.title,
        status: reel.status,
        views,
        widgetOpens,
        productClicks: clicks,
        ctr,
        addToCart: reel.addToCartCount || 0,
        purchases: reel.ordersCount || 0,
        revenue: reel.revenueTotal || 0,
      };
    });

    return {
      rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async notifyReelPublished(reel) {
    const { UserNotification } = require("../../models/UserNotification");
    const users = await User.find({ role: "user", status: "active" }).select("_id").limit(100).lean();

    await UserNotification.insertMany(
      users.map((user) => ({
        userId: user._id,
        type: "SYSTEM",
        title: "New reel published",
        message: reel.title,
        entityType: "Reel",
        entityId: reel._id,
      })),
      { ordered: false }
    ).catch(() => null);
  }
}

module.exports = new ReelService();
