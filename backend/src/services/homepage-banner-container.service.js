const { HomepageBannerContainer, defaultContainerSettings, CONTAINER_STATUS } = require("../models/HomepageBannerContainer");
const { HomepageBanner } = require("../models/HomepageBanner");
const { HomepageBannerCategory } = require("../models/HomepageBannerCategory");
const { AppError } = require("../utils/AppError");
const { generateSlug } = require("../utils/slug");
const auditService = require("./audit.service");
const redisCache = require("../modules/recommendation/cache");
const {
  syncBannerContainerToBuilder,
  deleteBannerContainerFromBuilder,
} = require("./homepage-banner-container.sync");

const CACHE_KEY = "homepage:banners:public";

async function invalidateCache() {
  await redisCache.del(CACHE_KEY);
  await redisCache.clearByPrefixes(["homepage:banners:"]);
}

async function ensureUniqueSlug(slug, excludeId) {
  const existing = await HomepageBannerContainer.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError("Banner container slug already exists", 409, "CONFLICT");
  }
}

async function ensureDefaultContainer(meta = {}) {
  let container = await HomepageBannerContainer.findOne({}).sort({ displayOrder: 1, createdAt: 1 });
  if (!container) {
    container = await HomepageBannerContainer.create({
      name: "Homepage Hero",
      slug: "homepage-hero",
      description: "Primary homepage hero banner carousel",
      status: "active",
      displayOrder: 0,
      showOnHomepage: true,
      settings: { ...defaultContainerSettings },
      createdBy: meta.actor?.sub || meta.actor?._id || null,
      updatedBy: meta.actor?.sub || meta.actor?._id || null,
    });
  }

  await HomepageBanner.updateMany(
    { $or: [{ containerId: null }, { containerId: { $exists: false } }] },
    { $set: { containerId: container._id } }
  );

  return container;
}

function serializeContainer(container, bannerCount = 0) {
  return {
    id: container._id,
    _id: container._id,
    name: container.name,
    slug: container.slug,
    description: container.description,
    status: container.status,
    displayOrder: container.displayOrder,
    showOnHomepage: container.showOnHomepage,
    publishedToBuilder: Boolean(container.publishedToBuilder),
    builderContainerId: container.builderContainerId,
    overlayOpacity: Number(container.overlayOpacity || 0),
    textPosition: container.textPosition || "left",
    settings: { ...defaultContainerSettings, ...(container.settings || {}) },
    bannerCount,
    createdAt: container.createdAt,
    updatedAt: container.updatedAt,
  };
}

async function listAdminContainers() {
  await ensureDefaultContainer();
  const containers = await HomepageBannerContainer.find({}).sort({ displayOrder: 1, createdAt: 1 }).lean();
  const counts = await HomepageBanner.aggregate([
    { $group: { _id: "$containerId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));
  return containers.map((container) => serializeContainer(container, countMap.get(String(container._id)) || 0));
}

async function getAdminContainerById(containerId) {
  const container = await HomepageBannerContainer.findById(containerId).lean();
  if (!container) throw new AppError("Banner container not found", 404, "NOT_FOUND");
  const bannerCount = await HomepageBanner.countDocuments({ containerId });
  return serializeContainer(container, bannerCount);
}

async function createContainer(payload, meta = {}) {
  const slug = generateSlug(payload.slug || payload.name);
  await ensureUniqueSlug(slug);

  const container = await HomepageBannerContainer.create({
    name: String(payload.name).trim(),
    slug,
    description: String(payload.description || "").trim(),
    status: payload.status || "active",
    displayOrder: Number(payload.displayOrder || 0),
    showOnHomepage: payload.showOnHomepage !== false,
    overlayOpacity: Math.min(1, Math.max(0, Number(payload.overlayOpacity || 0))),
    textPosition: payload.textPosition || "left",
    settings: { ...defaultContainerSettings, ...(payload.settings || {}) },
    createdBy: meta.actor?.sub || meta.actor?._id || null,
    updatedBy: meta.actor?.sub || meta.actor?._id || null,
  });

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CONTAINER_CREATED",
    entityType: "HomepageBannerContainer",
    entityId: container._id,
    metadata: { name: container.name, slug: container.slug },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  await syncBannerContainerToBuilder(container, meta);
  await invalidateCache();

  return getAdminContainerById(container._id);
}

async function updateContainer(containerId, payload, meta = {}) {
  const container = await HomepageBannerContainer.findById(containerId);
  if (!container) throw new AppError("Banner container not found", 404, "NOT_FOUND");

  if (payload.slug || payload.name) {
    const slug = generateSlug(payload.slug || payload.name || container.name);
    await ensureUniqueSlug(slug, container._id);
    container.slug = slug;
  }
  if (payload.name !== undefined) container.name = String(payload.name).trim();
  if (payload.description !== undefined) container.description = String(payload.description || "").trim();
  if (payload.status !== undefined) container.status = payload.status;
  if (payload.displayOrder !== undefined) container.displayOrder = Number(payload.displayOrder || 0);
  if (payload.showOnHomepage !== undefined) container.showOnHomepage = Boolean(payload.showOnHomepage);
  if (payload.overlayOpacity !== undefined) {
    container.overlayOpacity = Math.min(1, Math.max(0, Number(payload.overlayOpacity || 0)));
  }
  if (payload.textPosition !== undefined) container.textPosition = payload.textPosition;
  if (payload.settings !== undefined) {
    container.settings = { ...defaultContainerSettings, ...(container.settings || {}), ...(payload.settings || {}) };
    container.markModified("settings");
  }
  container.updatedBy = meta.actor?.sub || meta.actor?._id || null;
  await container.save();

  await invalidateCache();
  await syncBannerContainerToBuilder(container, meta);
  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CONTAINER_UPDATED",
    entityType: "HomepageBannerContainer",
    entityId: container._id,
    metadata: payload,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminContainerById(container._id);
}

async function deleteContainer(containerId, meta = {}) {
  const container = await HomepageBannerContainer.findById(containerId);
  if (!container) throw new AppError("Banner container not found", 404, "NOT_FOUND");

  const totalContainers = await HomepageBannerContainer.countDocuments({});
  if (totalContainers <= 1) {
    throw new AppError("At least one banner container must remain", 400, "VALIDATION_ERROR");
  }

  const banners = await HomepageBanner.find({ containerId }).select("_id").lean();
  if (banners.length) {
    const bannerIds = banners.map((item) => item._id);
    await HomepageBannerCategory.deleteMany({ bannerId: { $in: bannerIds } });
    await HomepageBanner.deleteMany({ containerId });
  }

  await deleteBannerContainerFromBuilder(containerId, meta);
  await container.deleteOne();
  await invalidateCache();

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CONTAINER_DELETED",
    entityType: "HomepageBannerContainer",
    entityId: containerId,
    metadata: { name: container.name, deletedBannerCount: banners.length },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { deleted: true, deletedBannerCount: banners.length };
}

async function reorderContainers(items = [], meta = {}) {
  await Promise.all(
    items.map((item) =>
      HomepageBannerContainer.updateOne(
        { _id: item.id },
        {
          $set: {
            displayOrder: Number(item.displayOrder || 0),
            updatedBy: meta.actor?.sub || meta.actor?._id || null,
          },
        }
      )
    )
  );
  await invalidateCache();
  return listAdminContainers();
}

async function publishContainer(containerId, meta = {}) {
  const container = await HomepageBannerContainer.findById(containerId);
  if (!container) throw new AppError("Banner container not found", 404, "NOT_FOUND");

  const builderContainerId = await syncBannerContainerToBuilder(container, meta);
  await invalidateCache();

  await auditService.log({
    actor: meta.actor,
    action: "HOMEPAGE_BANNER_CONTAINER_PUBLISHED",
    entityType: "HomepageBannerContainer",
    entityId: containerId,
    metadata: { builderContainerId },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return getAdminContainerById(containerId);
}

async function resolvePublicContainer(containerId) {
  if (containerId) {
    const container = await HomepageBannerContainer.findOne({
      _id: containerId,
      showOnHomepage: true,
      status: "active",
    }).lean();
    if (container) return container;
  }

  return HomepageBannerContainer.findOne({ showOnHomepage: true, status: "active" })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();
}

module.exports = {
  ensureDefaultContainer,
  listAdminContainers,
  getAdminContainerById,
  createContainer,
  updateContainer,
  deleteContainer,
  reorderContainers,
  publishContainer,
  resolvePublicContainer,
  serializeContainer,
  invalidateContainerCache: invalidateCache,
};
