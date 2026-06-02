const PlatformConfig = require("../models/PlatformConfig");
const { AppError } = require("../utils/AppError");

const SHIPPING_ZONE_CONFIG_KEY = "shipping_zone_matrix";
const CACHE_TTL_MS = 60 * 1000;
const ZONES = ["LOCAL", "REGIONAL", "REMOTE"];

let cachedZoneConfig = null;
let cachedAt = 0;

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePostalCode(value = "") {
  return String(value || "").trim();
}

function normalizeZoneEntry(entry = {}) {
  return {
    cities: Array.from(
      new Set((Array.isArray(entry.cities) ? entry.cities : []).map(normalizeToken).filter(Boolean))
    ),
    districts: Array.from(
      new Set((Array.isArray(entry.districts) ? entry.districts : []).map(normalizeToken).filter(Boolean))
    ),
    pincodes: Array.from(
      new Set((Array.isArray(entry.pincodes) ? entry.pincodes : []).map(normalizePostalCode).filter(Boolean))
    ),
  };
}

function normalizeStateConfig(stateConfig = {}) {
  const state = String(stateConfig.state || "").trim();
  if (!state) {
    throw new AppError("Each shipping zone state requires a state name", 400, "VALIDATION_ERROR");
  }

  const defaultZone = ZONES.includes(stateConfig.defaultZone) ? stateConfig.defaultZone : "REGIONAL";
  const zones = {};
  for (const zone of ZONES) {
    zones[zone] = normalizeZoneEntry(stateConfig.zones?.[zone]);
  }

  return {
    state,
    defaultZone,
    zones,
  };
}

function normalizeZoneConfigPayload(payload = {}) {
  const states = Array.isArray(payload.states) ? payload.states : [];
  if (states.length === 0) {
    throw new AppError("At least one state zone configuration is required", 400, "VALIDATION_ERROR");
  }

  const normalizedStates = states.map(normalizeStateConfig);
  const uniqueStates = new Set();
  for (const stateConfig of normalizedStates) {
    const key = normalizeToken(stateConfig.state);
    if (uniqueStates.has(key)) {
      throw new AppError(`Duplicate state mapping found for ${stateConfig.state}`, 400, "VALIDATION_ERROR");
    }
    uniqueStates.add(key);
  }

  return {
    states: normalizedStates,
  };
}

function buildDefaultZoneConfig() {
  return {
    states: [
      {
        state: "Tamil Nadu",
        defaultZone: "REGIONAL",
        zones: {
          LOCAL: { cities: [], districts: [], pincodes: [] },
          REGIONAL: { cities: [], districts: [], pincodes: [] },
          REMOTE: { cities: [], districts: [], pincodes: [] },
        },
      },
    ],
  };
}

function getMatchingState(zoneConfig, state) {
  const normalizedState = normalizeToken(state);
  return (
    zoneConfig.states.find((entry) => normalizeToken(entry.state) === normalizedState) ||
    zoneConfig.states.find((entry) => normalizeToken(entry.state) === "all states") ||
    null
  );
}

function resolveZoneFromMatrix(zoneConfig, address = {}) {
  if (!zoneConfig || !Array.isArray(zoneConfig.states) || zoneConfig.states.length === 0) {
    return { zone: "REGIONAL", matchedState: null, matchedOn: "fallback" };
  }

  const stateConfig = getMatchingState(zoneConfig, address.state);
  if (!stateConfig) {
    return { zone: "REGIONAL", matchedState: null, matchedOn: "fallback" };
  }

  const city = normalizeToken(address.city);
  const district = normalizeToken(address.district || address.city);
  const postalCode = normalizePostalCode(address.postalCode || address.pincode);

  for (const zone of ZONES) {
    const zoneEntry = stateConfig.zones?.[zone];
    if (!zoneEntry) continue;

    if (postalCode && zoneEntry.pincodes.includes(postalCode)) {
      return { zone, matchedState: stateConfig.state, matchedOn: "pincode" };
    }

    if (city && zoneEntry.cities.includes(city)) {
      return { zone, matchedState: stateConfig.state, matchedOn: "city" };
    }

    if (district && zoneEntry.districts.includes(district)) {
      return { zone, matchedState: stateConfig.state, matchedOn: "district" };
    }
  }

  return {
    zone: stateConfig.defaultZone || "REGIONAL",
    matchedState: stateConfig.state,
    matchedOn: "default",
  };
}

async function ensureZoneConfig() {
  const now = Date.now();
  if (cachedZoneConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedZoneConfig;
  }

  let config = await PlatformConfig.findOne({ key: SHIPPING_ZONE_CONFIG_KEY }).lean();
  if (!config) {
    const value = buildDefaultZoneConfig();
    await PlatformConfig.create({
      key: SHIPPING_ZONE_CONFIG_KEY,
      value,
      description: "Configurable state/zone location mapping for shipping calculations.",
      category: "shipping",
      type: "object",
    });
    config = { value };
  }

  cachedZoneConfig = normalizeZoneConfigPayload(config.value || buildDefaultZoneConfig());
  cachedAt = now;
  return cachedZoneConfig;
}

async function getZoneConfig() {
  return ensureZoneConfig();
}

async function updateZoneConfig(payload, updatedBy) {
  const normalized = normalizeZoneConfigPayload(payload);
  const update = {
    value: normalized,
    description: "Configurable state/zone location mapping for shipping calculations.",
    category: "shipping",
    type: "object",
  };
  if (updatedBy) {
    update.updatedBy = updatedBy;
  }

  await PlatformConfig.findOneAndUpdate(
    { key: SHIPPING_ZONE_CONFIG_KEY },
    { $set: update },
    { returnDocument: "after", upsert: true }
  );

  clearZoneConfigCache();
  return getZoneConfig();
}

function clearZoneConfigCache() {
  cachedZoneConfig = null;
  cachedAt = 0;
}

async function resolveZone(address = {}) {
  const zoneConfig = await ensureZoneConfig();
  return resolveZoneFromMatrix(zoneConfig, address);
}

module.exports = {
  SHIPPING_ZONE_CONFIG_KEY,
  ZONES,
  buildDefaultZoneConfig,
  clearZoneConfigCache,
  getZoneConfig,
  normalizeZoneConfigPayload,
  resolveZone,
  resolveZoneFromMatrix,
  updateZoneConfig,
};
