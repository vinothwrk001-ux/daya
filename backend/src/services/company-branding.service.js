const Joi = require("joi");
const CompanyBranding = require("../models/CompanyBranding");
const CompanyBrandingVersion = require("../models/CompanyBrandingVersion");
const auditService = require("./audit.service");
const { AppError } = require("../utils/AppError");
const { persistBrandingAsset } = require("./company-branding-image.service");

const CACHE_TTL_MS = Number(process.env.COMPANY_BRANDING_CACHE_MS || 15000);

const PUBLIC_CACHE = new Map();

const SLOT_FIELD_MAP = Object.freeze({
  primary_logo: "primaryLogo",
  dark_logo: "darkLogo",
  mobile_logo: "mobileLogo",
  favicon: "favicon",
  email_logo: "emailLogo",
  invoice_logo: "invoiceLogo",
  organization_logo: "seoBranding.organizationLogo",
});

const COLOR_DEFAULTS = Object.freeze({
  primaryColor: "#0f172a",
  secondaryColor: "#1e293b",
  accentColor: "#f97316",
  successColor: "#16a34a",
  warningColor: "#f59e0b",
  dangerColor: "#dc2626",
});

const DEFAULTS = Object.freeze({
  companyName: "UChooseMe",
  legalCompanyName: "GRM Commerce",
  tagline: "Premium marketplace experiences at enterprise scale.",
  supportEmail: "support@uchooseme.com",
  supportPhone: "+91 00000 00000",
  websiteUrl: "https://www.uchooseme.com",
});

function cacheKey(tenantType, tenantKey) {
  return `${tenantType}:${tenantKey}`;
}

function getCached(tenantType, tenantKey) {
  const entry = PUBLIC_CACHE.get(cacheKey(tenantType, tenantKey));
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    PUBLIC_CACHE.delete(cacheKey(tenantType, tenantKey));
    return null;
  }
  return entry.value;
}

function setCached(tenantType, tenantKey, value) {
  PUBLIC_CACHE.set(cacheKey(tenantType, tenantKey), {
    storedAt: Date.now(),
    value,
  });
}

function invalidateBrandingCache(tenantType = "platform", tenantKey = "default") {
  PUBLIC_CACHE.delete(cacheKey(tenantType, tenantKey));
  PUBLIC_CACHE.delete(cacheKey("platform", "default"));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanBoolean(value) {
  if (typeof value === "boolean") return value;
  return String(value || "").trim().toLowerCase() === "true";
}

function parseFooterConfig(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function normalizeFooterLink(link = {}) {
  return {
    label: cleanString(link.label),
    href: cleanString(link.href),
  };
}

function normalizeFooterSection(section = {}) {
  return {
    title: cleanString(section.title),
    description: cleanString(section.description),
    links: Array.isArray(section.links)
      ? section.links.slice(0, 8).map(normalizeFooterLink).filter((link) => link.label || link.href)
      : [],
  };
}

function normalizeFooterConfig(footer = {}) {
  const rawFooter = parseFooterConfig(footer) || {};
  const sections = Array.isArray(rawFooter.sections)
    ? rawFooter.sections.slice(0, 5).map(normalizeFooterSection).filter((section) => section.title || section.description || section.links.length)
    : [];
  const socialLinks = Array.isArray(rawFooter.socialLinks)
    ? rawFooter.socialLinks.slice(0, 10).map(normalizeFooterLink).filter((link) => link.label || link.href)
    : [];
  const legalLinks = Array.isArray(rawFooter.legalLinks)
    ? rawFooter.legalLinks.slice(0, 10).map(normalizeFooterLink).filter((link) => link.label || link.href)
    : [];
  return {
    enabled: cleanBoolean(rawFooter.enabled) !== false,
    theme: cleanString(rawFooter.theme) || "dark",
    backgroundColor: cleanString(rawFooter.backgroundColor) || "#0f172a",
    textColor: cleanString(rawFooter.textColor) || "#e2e8f0",
    linkColor: cleanString(rawFooter.linkColor) || "#60a5fa",
    sections,
    socialLinks,
    legalLinks,
    copyrightText: cleanString(rawFooter.copyrightText),
  };
}

function getMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

function resolveScope(input = {}) {
  return {
    tenantType: cleanString(input.tenantType || input.headers?.["x-tenant-type"] || input.query?.tenantType) || "platform",
    tenantKey: cleanString(input.tenantKey || input.headers?.["x-tenant-key"] || input.query?.tenantKey) || "default",
  };
}

function getNested(obj, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current ? current[key] : undefined), obj);
}

function setNested(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  let current = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    current[key] = current[key] || {};
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function removeNested(obj, path) {
  setNested(obj, path, {
    url: "",
    webpUrl: "",
    thumbnailUrl: "",
    originalName: "",
    mimeType: "",
    size: 0,
    width: 0,
    height: 0,
    checksum: "",
    altText: "",
    storageProvider: "local",
    variants: { original: {}, webp: {}, thumbnail: {} },
    updatedAt: new Date(),
  });
}

function buildBrandingPayload(payload = {}) {
  return {
    companyName: cleanString(payload.companyName),
    legalCompanyName: cleanString(payload.legalCompanyName),
    tagline: cleanString(payload.tagline),
    supportEmail: cleanString(payload.supportEmail).toLowerCase(),
    supportPhone: cleanString(payload.supportPhone),
    websiteUrl: cleanString(payload.websiteUrl),
    brandColors: {
      primaryColor: cleanString(payload.primaryColor || payload.brandColors?.primaryColor) || COLOR_DEFAULTS.primaryColor,
      secondaryColor: cleanString(payload.secondaryColor || payload.brandColors?.secondaryColor) || COLOR_DEFAULTS.secondaryColor,
      accentColor: cleanString(payload.accentColor || payload.brandColors?.accentColor) || COLOR_DEFAULTS.accentColor,
      successColor: cleanString(payload.successColor || payload.brandColors?.successColor) || COLOR_DEFAULTS.successColor,
      warningColor: cleanString(payload.warningColor || payload.brandColors?.warningColor) || COLOR_DEFAULTS.warningColor,
      dangerColor: cleanString(payload.dangerColor || payload.brandColors?.dangerColor) || COLOR_DEFAULTS.dangerColor,
    },
    seoBranding: {
      organizationName: cleanString(payload.organizationName || payload.seoBranding?.organizationName),
      organizationUrl: cleanString(payload.organizationUrl || payload.seoBranding?.organizationUrl),
    },
    footer: normalizeFooterConfig(payload.footer),
  };
}

function buildSchemaMarkup(branding) {
  const organizationName = branding?.seoBranding?.organizationName || branding?.companyName || DEFAULTS.companyName;
  const organizationUrl = branding?.seoBranding?.organizationUrl || branding?.websiteUrl || DEFAULTS.websiteUrl;
  const logoUrl =
    branding?.seoBranding?.organizationLogo?.webpUrl ||
    branding?.seoBranding?.organizationLogo?.url ||
    branding?.primaryLogo?.webpUrl ||
    branding?.primaryLogo?.url ||
    "";

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organizationName,
    url: organizationUrl,
    logo: logoUrl,
    contactPoint: branding?.supportEmail || branding?.supportPhone
      ? [
          {
            "@type": "ContactPoint",
            email: branding.supportEmail || undefined,
            telephone: branding.supportPhone || undefined,
            contactType: "customer support",
          },
        ]
      : [],
  };
}

function toPublicBranding(doc) {
  if (!doc) return null;
  const branding = doc.toObject ? doc.toObject() : { ...doc };
  const effectivePrimaryLogo = branding.primaryLogo?.webpUrl || branding.primaryLogo?.url || "";
  const effectiveDarkLogo = branding.darkLogo?.webpUrl || branding.darkLogo?.url || effectivePrimaryLogo;
  const effectiveMobileLogo = branding.mobileLogo?.webpUrl || branding.mobileLogo?.url || effectivePrimaryLogo;
  const effectiveFavicon = branding.favicon?.url || "";
  const emailLogo = branding.emailLogo?.webpUrl || branding.emailLogo?.url || effectivePrimaryLogo;
  const invoiceLogo = branding.invoiceLogo?.webpUrl || branding.invoiceLogo?.url || effectivePrimaryLogo;

  return {
    id: String(branding._id || ""),
    tenantType: branding.tenantType,
    tenantKey: branding.tenantKey,
    version: Number(branding.version || 1),
    companyName: branding.companyName || DEFAULTS.companyName,
    legalCompanyName: branding.legalCompanyName || DEFAULTS.legalCompanyName,
    tagline: branding.tagline || DEFAULTS.tagline,
    supportEmail: branding.supportEmail || DEFAULTS.supportEmail,
    supportPhone: branding.supportPhone || DEFAULTS.supportPhone,
    websiteUrl: branding.websiteUrl || DEFAULTS.websiteUrl,
    logos: {
      primary: effectivePrimaryLogo,
      dark: effectiveDarkLogo,
      mobile: effectiveMobileLogo,
      favicon: effectiveFavicon,
      email: emailLogo,
      invoice: invoiceLogo,
      organization:
        branding.seoBranding?.organizationLogo?.webpUrl ||
        branding.seoBranding?.organizationLogo?.url ||
        effectivePrimaryLogo,
    },
    assets: {
      primaryLogo: branding.primaryLogo || {},
      darkLogo: branding.darkLogo || {},
      mobileLogo: branding.mobileLogo || {},
      favicon: branding.favicon || {},
      emailLogo: branding.emailLogo || {},
      invoiceLogo: branding.invoiceLogo || {},
      organizationLogo: branding.seoBranding?.organizationLogo || {},
    },
    brandColors: {
      ...COLOR_DEFAULTS,
      ...(branding.brandColors || {}),
    },
    seoBranding: {
      organizationName: branding.seoBranding?.organizationName || branding.companyName || DEFAULTS.companyName,
      organizationUrl: branding.seoBranding?.organizationUrl || branding.websiteUrl || DEFAULTS.websiteUrl,
      schemaMarkup: buildSchemaMarkup(branding),
    },
    footer: branding.footer || {
      enabled: true,
      theme: "dark",
      backgroundColor: "#0f172a",
      textColor: "#e2e8f0",
      linkColor: "#60a5fa",
      sections: [],
      socialLinks: [],
      legalLinks: [],
      copyrightText: "",
    },
    cacheBuster: Number(branding.updatedAt ? new Date(branding.updatedAt).getTime() : Date.now()),
  };
}

async function ensureBranding(scope = {}, actor = {}) {
  const resolved = resolveScope(scope);
  let branding = await CompanyBranding.findOne(resolved);
  if (!branding) {
    branding = await CompanyBranding.create({
      ...resolved,
      ...DEFAULTS,
      brandColors: COLOR_DEFAULTS,
      seoBranding: {
        organizationName: DEFAULTS.companyName,
        organizationUrl: DEFAULTS.websiteUrl,
      },
      createdBy: String(actor?._id || actor?.sub || ""),
      updatedBy: String(actor?._id || actor?.sub || ""),
    });
  }
  return branding;
}

function summarizeChanges(previous, next) {
  const changed = [];
  if ((previous.companyName || "") !== (next.companyName || "")) changed.push("Company name updated");
  if ((previous.legalCompanyName || "") !== (next.legalCompanyName || "")) changed.push("Legal company name updated");
  if ((previous.tagline || "") !== (next.tagline || "")) changed.push("Tagline updated");
  if ((previous.supportEmail || "") !== (next.supportEmail || "")) changed.push("Support email updated");
  if ((previous.supportPhone || "") !== (next.supportPhone || "")) changed.push("Support phone updated");
  if ((previous.websiteUrl || "") !== (next.websiteUrl || "")) changed.push("Website URL updated");
  Object.entries(SLOT_FIELD_MAP).forEach(([slot, path]) => {
    const prevUrl = getNested(previous, path)?.url || "";
    const nextUrl = getNested(next, path)?.url || "";
    if (prevUrl !== nextUrl) changed.push(`${slot} changed`);
  });
  return changed;
}

async function recordVersion(branding, snapshot, { changedBy, changeType = "update", changeSummary = [], restoredFromVersion = null } = {}) {
  if (!branding?._id) return null;
  return CompanyBrandingVersion.create({
    brandingId: branding._id,
    tenantType: branding.tenantType,
    tenantKey: branding.tenantKey,
    versionNumber: Number(snapshot.version || branding.version || 1),
    snapshot,
    changedBy: String(changedBy || ""),
    changeType,
    changeSummary,
    restoredFromVersion,
  });
}

async function getPublicBranding(scope = {}) {
  const resolved = resolveScope(scope);
  const cached = getCached(resolved.tenantType, resolved.tenantKey);
  if (cached) return cached;
  const branding = await ensureBranding(resolved);
  const publicValue = toPublicBranding(branding);
  setCached(resolved.tenantType, resolved.tenantKey, publicValue);
  return publicValue;
}

async function getAdminBranding(scope = {}) {
  const branding = await ensureBranding(scope);
  const result = branding.toObject();
  result.schemaMarkupPreview = buildSchemaMarkup(result);
  return result;
}

async function saveBranding({ scope = {}, id = null, payload = {}, files = {}, actor = {}, meta = {} }) {
  const resolved = resolveScope(scope);
  const branding = id ? await CompanyBranding.findById(id) : await ensureBranding(resolved, actor);
  if (!branding) {
    throw new AppError("Branding configuration not found", 404, "NOT_FOUND");
  }

  const snapshotBefore = branding.toObject();
  const nextValues = buildBrandingPayload(payload);

  Object.assign(branding, nextValues, {
    tenantType: resolved.tenantType,
    tenantKey: resolved.tenantKey,
    updatedBy: String(actor?._id || actor?.sub || ""),
  });

  const uploadEntries = [
    ["primaryLogo", files.primaryLogo?.[0]],
    ["darkLogo", files.darkLogo?.[0]],
    ["mobileLogo", files.mobileLogo?.[0]],
    ["favicon", files.favicon?.[0]],
    ["emailLogo", files.emailLogo?.[0]],
    ["invoiceLogo", files.invoiceLogo?.[0]],
    ["seoBranding.organizationLogo", files.organizationLogo?.[0]],
  ];

  for (const [path, file] of uploadEntries) {
    if (!file) continue;
    const slot = Object.entries(SLOT_FIELD_MAP).find(([, value]) => value === path)?.[0] || path;
    const asset = await persistBrandingAsset(file, {
      slot,
      tenantType: branding.tenantType,
      tenantKey: branding.tenantKey,
    });
    setNested(branding, path, asset);
    await auditService.log({
      actor,
      action: getNested(snapshotBefore, path)?.url ? "branding.asset.replaced" : "branding.asset.uploaded",
      entityType: "CompanyBranding",
      entityId: String(branding._id || ""),
      metadata: { slot, previousUrl: getNested(snapshotBefore, path)?.url || "", nextUrl: asset.url || "" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }).catch(() => {});
  }

  for (const [slot, path] of Object.entries(SLOT_FIELD_MAP)) {
    const removeKey = `${slot}Removed`;
    if (cleanBoolean(payload[removeKey])) {
      const previousAsset = getNested(snapshotBefore, path);
      removeNested(branding, path);
      await auditService.log({
        actor,
        action: "branding.asset.deleted",
        entityType: "CompanyBranding",
        entityId: String(branding._id || ""),
        metadata: { slot, previousUrl: previousAsset?.url || "" },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }).catch(() => {});
    }
  }

  branding.version = Number(branding.version || 1) + 1;
  await branding.save();

  const snapshotAfter = branding.toObject();
  const changeSummary = summarizeChanges(snapshotBefore, snapshotAfter);
  await recordVersion(branding, snapshotBefore, {
    changedBy: branding.updatedBy,
    changeType: "update",
    changeSummary,
  });

  await auditService.log({
    actor,
    action: "branding.updated",
    entityType: "CompanyBranding",
    entityId: String(branding._id || ""),
    metadata: {
      tenantType: branding.tenantType,
      tenantKey: branding.tenantKey,
      version: branding.version,
      changes: changeSummary,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  }).catch(() => {});

  invalidateBrandingCache(branding.tenantType, branding.tenantKey);
  return await getAdminBranding({ tenantType: branding.tenantType, tenantKey: branding.tenantKey });
}

async function deleteLogo({ id, slot, actor = {}, meta = {} }) {
  const branding = await CompanyBranding.findById(id);
  if (!branding) throw new AppError("Branding configuration not found", 404, "NOT_FOUND");
  const path = SLOT_FIELD_MAP[slot];
  if (!path) {
    throw new AppError("Unknown branding asset slot", 400, "INVALID_SLOT");
  }
  const snapshotBefore = branding.toObject();
  const previousAsset = getNested(snapshotBefore, path);
  removeNested(branding, path);
  branding.version = Number(branding.version || 1) + 1;
  branding.updatedBy = String(actor?._id || actor?.sub || "");
  await branding.save();
  await recordVersion(branding, snapshotBefore, {
    changedBy: branding.updatedBy,
    changeType: "delete",
    changeSummary: [`${slot} deleted`],
  });
  await auditService.log({
    actor,
    action: "branding.asset.deleted",
    entityType: "CompanyBranding",
    entityId: String(branding._id || ""),
    metadata: { slot, previousUrl: previousAsset?.url || "" },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  }).catch(() => {});
  invalidateBrandingCache(branding.tenantType, branding.tenantKey);
  return await getAdminBranding({ tenantType: branding.tenantType, tenantKey: branding.tenantKey });
}

async function listVersions(brandingId) {
  const versions = await CompanyBrandingVersion.find({ brandingId }).sort({ versionNumber: -1, changedAt: -1 }).lean();
  return {
    versions: versions.map((item) => ({
      _id: item._id,
      versionNumber: item.versionNumber,
      changedBy: item.changedBy,
      changedAt: item.changedAt,
      changeType: item.changeType,
      changeSummary: item.changeSummary,
      rollbackAvailable: item.rollbackAvailable !== false,
      previousPrimaryLogo: item.snapshot?.primaryLogo?.url || "",
      newPrimaryLogo: item.snapshot?.primaryLogo?.webpUrl || item.snapshot?.primaryLogo?.url || "",
    })),
  };
}

async function rollbackBranding({ id, versionId, actor = {}, meta = {} }) {
  const branding = await CompanyBranding.findById(id);
  if (!branding) throw new AppError("Branding configuration not found", 404, "NOT_FOUND");
  const version = await CompanyBrandingVersion.findOne({ _id: versionId, brandingId: id }).lean();
  if (!version) throw new AppError("Branding version not found", 404, "NOT_FOUND");

  const snapshotBefore = branding.toObject();
  const snapshot = version.snapshot || {};
  delete snapshot._id;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;

  Object.assign(branding, snapshot, {
    version: Number(branding.version || 1) + 1,
    updatedBy: String(actor?._id || actor?.sub || ""),
  });
  await branding.save();

  await recordVersion(branding, snapshotBefore, {
    changedBy: branding.updatedBy,
    changeType: "restore",
    changeSummary: [`Rolled back to version ${version.versionNumber}`],
    restoredFromVersion: version.versionNumber,
  });

  await auditService.log({
    actor,
    action: "branding.restored",
    entityType: "CompanyBranding",
    entityId: String(branding._id || ""),
    metadata: { rollbackVersion: version.versionNumber },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  }).catch(() => {});

  invalidateBrandingCache(branding.tenantType, branding.tenantKey);
  return await getAdminBranding({ tenantType: branding.tenantType, tenantKey: branding.tenantKey });
}

function buildManifest({ branding, origin = "" }) {
  const base = branding || {};
  const iconUrl = base.assets?.favicon?.url || base.logos?.favicon || base.logos?.primary || "";
  const absoluteIcon = iconUrl && origin && !/^https?:\/\//i.test(iconUrl) ? `${origin}${iconUrl}` : iconUrl;
  return {
    name: base.companyName || DEFAULTS.companyName,
    short_name: base.companyName || DEFAULTS.companyName,
    start_url: "/",
    display: "standalone",
    background_color: base.brandColors?.secondaryColor || COLOR_DEFAULTS.secondaryColor,
    theme_color: base.brandColors?.primaryColor || COLOR_DEFAULTS.primaryColor,
    icons: absoluteIcon
      ? [
          { src: absoluteIcon, sizes: "64x64", type: "image/png", purpose: "any" },
          { src: absoluteIcon, sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: absoluteIcon, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ]
      : [],
  };
}

const footerLinkValidation = Joi.object({
  label: Joi.string().trim().max(80).allow(""),
  href: Joi.string().trim().uri({ allowRelative: true }).allow(""),
}).unknown(true);

const footerSectionValidation = Joi.object({
  title: Joi.string().trim().max(80).allow(""),
  description: Joi.string().trim().max(240).allow(""),
  links: Joi.array().items(footerLinkValidation).max(8).default([]),
}).unknown(true);

const brandingValidationSchema = Joi.object({
  companyName: Joi.string().trim().max(160).allow(""),
  legalCompanyName: Joi.string().trim().max(200).allow(""),
  tagline: Joi.string().trim().max(200).allow(""),
  supportEmail: Joi.string().trim().email({ tlds: { allow: false } }).allow(""),
  supportPhone: Joi.string().trim().max(40).allow(""),
  websiteUrl: Joi.string().trim().uri({ allowRelative: false }).allow(""),
  primaryColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  secondaryColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  accentColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  successColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  warningColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  dangerColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
  organizationName: Joi.string().trim().max(160).allow(""),
  organizationUrl: Joi.string().trim().uri({ allowRelative: false }).allow(""),
  footer: Joi.object({
    enabled: Joi.boolean().default(true),
    theme: Joi.string().trim().valid("dark", "light").allow(""),
    backgroundColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
    textColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
    linkColor: Joi.string().trim().pattern(/^#(?:[0-9a-fA-F]{3}){1,2}$/).allow(""),
    sections: Joi.array().items(footerSectionValidation).max(5).default([]),
    socialLinks: Joi.array().items(footerLinkValidation).max(10).default([]),
    legalLinks: Joi.array().items(footerLinkValidation).max(10).default([]),
    copyrightText: Joi.string().trim().max(200).allow(""),
  }).unknown(true).default(),
  tenantType: Joi.string().trim().max(80).allow(""),
  tenantKey: Joi.string().trim().max(120).allow(""),
}).unknown(true);

function normalizePayload(payload = {}) {
  const normalized = { ...payload };
  if (typeof normalized.footer === "string") {
    try {
      normalized.footer = JSON.parse(normalized.footer);
    } catch {
      normalized.footer = {};
    }
  }
  return normalized;
}

function validateBrandingPayload(payload = {}) {
  const normalized = normalizePayload(payload);
  const { error, value } = brandingValidationSchema.validate(normalized, { abortEarly: false });
  if (!error) return value;
  throw new AppError(
    "Please review the highlighted branding fields.",
    400,
    "VALIDATION_ERROR",
    {
      issues: error.details.map((detail) => ({
        path: detail.path,
        message: detail.message,
      })),
    }
  );
}

module.exports = {
  SLOT_FIELD_MAP,
  buildManifest,
  buildSchemaMarkup,
  deleteLogo,
  getAdminBranding,
  getMeta,
  getPublicBranding,
  invalidateBrandingCache,
  listVersions,
  resolveScope,
  rollbackBranding,
  saveBranding,
  toPublicBranding,
  validateBrandingPayload,
};
