const mongoose = require("mongoose");
const { HomepageBanner } = require("../models/HomepageBanner");
const { HomepageContainer } = require("../models/HomepageContainer");
const homepageContainerService = require("./homepage-container.service");
const { logger } = require("../utils/logger");

async function resolveSyncActorId(meta = {}, banner = {}) {
  if (meta.actor?.sub || meta.actor?._id) {
    return meta.actor.sub || meta.actor._id;
  }
  if (banner.createdBy || banner.updatedBy) {
    return banner.createdBy || banner.updatedBy;
  }

  try {
    const { User } = require("../models/User");
    const admin = await User.findOne({ role: { $in: ["admin", "super_admin"] } }).select("_id").lean();
    return admin?._id || null;
  } catch {
    return null;
  }
}

function buildContainerPayload(banner) {
  const isActive = banner.status === "active";

  return {
    title: banner.name,
    slug: `managed-banner-${banner.slug}`,
    description: banner.description || `Managed homepage banner: ${banner.title || banner.name}`,
    containerType: "BANNER",
    status: isActive ? "ACTIVE" : "INACTIVE",
    priority: Number(banner.displayOrder || 0),
    config: {
      useManagedBanners: true,
      homepageBannerId: String(banner._id),
      managedBannerScope: "single",
      bannerImage: "",
      bannerMedia: [],
      heading: banner.title || banner.name,
      subheading: banner.subtitle || "",
      ctaButton: banner.ctaText || "Shop now",
      ctaUrl: banner.ctaUrl || "",
    },
    presentation: {
      layout: {
        heightType: "custom",
        customHeight: 1080,
        widthType: "full",
      },
    },
  };
}

async function syncBannerToBuilderContainer(bannerInput, meta = {}) {
  const banner =
    bannerInput?._id && bannerInput?.slug
      ? bannerInput
      : await HomepageBanner.findById(bannerInput).lean();

  if (!banner) return null;

  const actorId = await resolveSyncActorId(meta, banner);
  const payload = buildContainerPayload(banner);
  const existing = await HomepageContainer.findOne({
    "config.homepageBannerId": String(banner._id),
  }).lean();

  if (existing) {
    await homepageContainerService.updateContainer(existing._id, payload, actorId);
    return existing._id;
  }

  if (!actorId) {
    logger.warn("Skipping homepage banner container sync: no actor available", {
      bannerId: String(banner._id),
    });
    return null;
  }

  const created = await homepageContainerService.createContainer(payload, actorId);
  return created?._id || null;
}

async function deactivateBannerBuilderContainer(bannerId, meta = {}) {
  const existing = await HomepageContainer.findOne({
    "config.homepageBannerId": String(bannerId),
  }).lean();

  if (!existing) return null;

  const actorId = await resolveSyncActorId(meta);
  await homepageContainerService.updateContainer(
    existing._id,
    { status: "INACTIVE", title: existing.title },
    actorId
  );
  return existing._id;
}

async function ensureAllBannerBuilderContainers() {
  const banners = await HomepageBanner.find({}).sort({ displayOrder: 1, createdAt: 1 }).lean();
  const results = [];

  for (const banner of banners) {
    try {
      const containerId = await syncBannerToBuilderContainer(banner);
      if (containerId) results.push({ bannerId: String(banner._id), containerId: String(containerId) });
    } catch (error) {
      logger.warn("Failed to sync homepage banner container", {
        bannerId: String(banner._id),
        error: error?.message,
      });
    }
  }

  return results;
}

module.exports = {
  syncBannerToBuilderContainer,
  deactivateBannerBuilderContainer,
  ensureAllBannerBuilderContainers,
};
