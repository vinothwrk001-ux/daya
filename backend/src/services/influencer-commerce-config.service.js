const PlatformConfig = require("../models/PlatformConfig");

const CACHE_MS = Number(process.env.INFLUENCER_COMMERCE_CONFIG_CACHE_MS || 8000);

let cache = {
  fetchedAt: 0,
  value: true,
};

function coerceEnabled(doc) {
  if (!doc || doc.value === undefined || doc.value === null) return true;
  const v = doc.value;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v !== "false" && v !== "0";
  return Boolean(Number(v));
}

async function refreshFromDb() {
  let doc = await PlatformConfig.findOne({ key: "influencer_commerce_enabled" }).select("value").lean();
  if (!doc) {
    const created = await PlatformConfig.create({
      key: "influencer_commerce_enabled",
      value: true,
      description: "Master switch for influencer commerce, vendor campaign tools, reels, and attribution.",
      category: "feature",
      type: "boolean",
      isPublic: true,
    });
    doc = { value: created.value };
  }
  cache = { fetchedAt: Date.now(), value: coerceEnabled(doc) };
  return cache.value;
}

async function isInfluencerCommerceEnabled() {
  const fresh = cache.fetchedAt && Date.now() - cache.fetchedAt < CACHE_MS;
  if (fresh) return cache.value;
  return refreshFromDb();
}

function invalidateInfluencerCommerceConfigCache() {
  cache.fetchedAt = 0;
}

module.exports = {
  isInfluencerCommerceEnabled,
  invalidateInfluencerCommerceConfigCache,
  refreshFromDb,
};
