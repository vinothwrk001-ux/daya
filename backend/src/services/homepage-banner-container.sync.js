const { HomepageBanner } = require("../models/HomepageBanner");
const { HomepageBannerContainer, defaultContainerSettings } = require("../models/HomepageBannerContainer");
const { HomepageContainer } = require("../models/HomepageContainer");
const homepageContainerService = require("./homepage-container.service");
const { logger } = require("../utils/logger");

async function resolveSyncActorId(meta = {}, fallbackDoc = {}) {
  if (meta.actor?.sub || meta.actor?._id) {
    return meta.actor.sub || meta.actor._id;
  }
  if (fallbackDoc.createdBy || fallbackDoc.updatedBy) {
    return fallbackDoc.createdBy || fallbackDoc.updatedBy;
  }

  try {
    const { User } = require("../models/User");
    const admin = await User.findOne({ role: { $in: ["admin", "super_admin"] } }).select("_id").lean();
    return admin?._id || null;
  } catch {
    return null;
  }
}

function buildContainerPayload(bannerContainer, bannerCount = 0) {
  const settings = { ...defaultContainerSettings, ...(bannerContainer.settings || {}) };
  const isActive = bannerContainer.status === "active" && bannerContainer.showOnHomepage !== false;

  return {
    title: bannerContainer.name,
    slug: `managed-banner-container-${bannerContainer.slug}`,
    description:
      bannerContainer.description ||
      `Managed homepage banner container with ${bannerCount} slide${bannerCount === 1 ? "" : "s"}`,
    containerType: "BANNER",
    status: isActive ? "ACTIVE" : "INACTIVE",
    priority: Number(bannerContainer.displayOrder || 0),
    config: {
      useManagedBanners: true,
      managedBannerScope: "container",
      homepageBannerContainerId: String(bannerContainer._id),
      homepageBannerId: "",
      managedBannerSlideCount: bannerCount,
      bannerImage: "",
      bannerMedia: [],
      heading: bannerContainer.name,
      subheading: bannerContainer.description || "",
      overlayOpacity: Number(bannerContainer.overlayOpacity || 0),
      textPosition: bannerContainer.textPosition || "left",
      autoSlide: settings.autoplay !== false,
      slideSpeed: Number(settings.autoplayIntervalMs || 5000),
      showArrows: settings.showArrows !== false,
      showDots: settings.showDots !== false,
    },
    presentation: {
      layout: {
        heightType: "auto",
        widthType: "full",
      },
    },
  };
}

async function cleanupLegacyPerBannerContainers(excludeBuilderId = null) {
  const legacyContainers = await HomepageContainer.find({
    containerType: "BANNER",
    "config.useManagedBanners": true,
    $or: [
      { "config.homepageBannerId": { $exists: true, $ne: "" } },
      { "config.managedBannerScope": "single" },
    ],
    ...(excludeBuilderId ? { _id: { $ne: excludeBuilderId } } : {}),
  }).lean();

  for (const legacy of legacyContainers) {
    try {
      await homepageContainerService.deleteContainer(legacy._id);
    } catch (error) {
      logger.warn("Failed to delete legacy per-banner container", {
        containerId: String(legacy._id),
        error: error?.message,
      });
    }
  }
}

async function deactivateLegacyPerBannerContainers(containerId, meta = {}) {
  await cleanupLegacyPerBannerContainers(containerId);
}

async function syncBannerContainerToBuilder(containerInput, meta = {}) {
  const container =
    containerInput?._id && containerInput?.slug
      ? containerInput
      : await HomepageBannerContainer.findById(containerInput).lean();

  if (!container) return null;

  const bannerCount = await HomepageBanner.countDocuments({
    containerId: container._id,
    showOnHomepage: true,
    status: "active",
  });

  const actorId = await resolveSyncActorId(meta, container);
  const payload = buildContainerPayload(container, bannerCount);

  let builderContainerId = container.builderContainerId;
  if (builderContainerId) {
    const existing = await HomepageContainer.findById(builderContainerId).lean();
    if (existing) {
      await homepageContainerService.updateContainer(builderContainerId, payload, actorId);
    } else {
      builderContainerId = null;
    }
  }

  if (!builderContainerId) {
    const bySlug = await HomepageContainer.findOne({ slug: payload.slug }).lean();
    if (bySlug) {
      builderContainerId = bySlug._id;
      await homepageContainerService.updateContainer(builderContainerId, payload, actorId);
    } else if (!actorId) {
      logger.warn("Skipping homepage banner container sync: no actor available", {
        containerId: String(container._id),
      });
      return null;
    } else {
      const created = await homepageContainerService.createContainer(payload, actorId);
      builderContainerId = created?._id || null;
    }
  }

  if (builderContainerId) {
    await HomepageBannerContainer.updateOne(
      { _id: container._id },
      {
        $set: {
          builderContainerId,
          publishedToBuilder: Boolean(builderContainerId),
          updatedBy: actorId || container.updatedBy || null,
        },
      }
    );
    await deactivateLegacyPerBannerContainers(builderContainerId, meta);
  }

  return builderContainerId;
}

async function deleteBannerContainerFromBuilder(containerId, meta = {}) {
  const container = await HomepageBannerContainer.findById(containerId).lean();
  if (!container?.builderContainerId) return null;

  try {
    await homepageContainerService.deleteContainer(container.builderContainerId);
  } catch (error) {
    logger.warn("Failed to delete banner container from builder library", {
      containerId: String(containerId),
      builderContainerId: String(container.builderContainerId),
      error: error?.message,
    });
  }

  return container.builderContainerId;
}

async function deactivateBannerContainerBuilder(containerId, meta = {}) {
  return deleteBannerContainerFromBuilder(containerId, meta);
}

async function ensureAllBannerBuilderContainers(meta = {}) {
  const containers = await HomepageBannerContainer.find({}).sort({ displayOrder: 1, createdAt: 1 }).lean();
  const actorId = await resolveSyncActorId(meta);

  for (const container of containers) {
    try {
      await syncBannerContainerToBuilder(container, { ...meta, actor: meta.actor || (actorId ? { sub: actorId, _id: actorId } : null) });
    } catch (error) {
      logger.warn("Failed to sync banner container to builder library", {
        containerId: String(container._id),
        error: error?.message,
      });
    }
  }

  await cleanupLegacyPerBannerContainers();
}

module.exports = {
  syncBannerContainerToBuilder,
  deactivateBannerContainerBuilder,
  deleteBannerContainerFromBuilder,
  buildContainerPayload,
  ensureAllBannerBuilderContainers,
  cleanupLegacyPerBannerContainers,
};
