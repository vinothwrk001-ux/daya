const userRepo = require("../../repositories/user.repository");
const userService = require("../../services/user.service");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto");
const { AppError } = require("../../utils/AppError");
const { uploadMany } = require("../../utils/upload");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { InfluencerWallet, CommissionRecord, InfluencerPayoutAccount } = require("../commission/models");
const { Product } = require("../../models/Product");
const commissionRuleService = require("../../services/commission-rule.service");
const homepageLayoutService = require("../../services/homepage-layout.service");
const {
  InfluencerApplication,
  InfluencerProfile,
  InfluencerBusinessProfile,
  InfluencerPaymentProfile,
  InfluencerApplicationDocument,
  InfluencerApplicationReview,
  InfluencerBadge,
  InfluencerStorefront,
  InfluencerAffiliateSetting,
  InfluencerCollection,
  InfluencerActivationAudit,
  InfluencerSocialAccount,
  InfluencerSocialVerification,
} = require("./model");

const DEFAULT_SOCIAL_REQUIREMENTS = {
  instagram: { minFollowers: 1000, minEngagementRate: 2 },
  youtube: { minFollowers: 500, minEngagementRate: 2 },
  tiktok: { minFollowers: 1000, minEngagementRate: 2 },
  default: { minFollowers: 0, minEngagementRate: 0 },
};
const DEFAULT_COMMISSION_SETTINGS = {
  commissionPercentage: Number(process.env.INFLUENCER_DEFAULT_COMMISSION_PERCENT || 10),
  commissionModel: process.env.INFLUENCER_DEFAULT_COMMISSION_MODEL || "Per Sale",
  minimumPayoutThreshold: Number(process.env.INFLUENCER_MIN_PAYOUT_THRESHOLD || 500),
  payoutSchedule: process.env.INFLUENCER_PAYOUT_SCHEDULE || "Monthly",
  currency: process.env.DEFAULT_CURRENCY || "INR",
};

const COUNTRY_MASTER = [
  { code: "IN", name: "India", states: [{ name: "Tamil Nadu", cities: ["Coimbatore", "Chennai", "Madurai"] }, { name: "Karnataka", cities: ["Bengaluru", "Mysuru"] }, { name: "Maharashtra", cities: ["Mumbai", "Pune"] }] },
  { code: "US", name: "United States", states: [{ name: "California", cities: ["Los Angeles", "San Francisco"] }, { name: "New York", cities: ["New York"] }] },
  { code: "AE", name: "United Arab Emirates", states: [{ name: "Dubai", cities: ["Dubai"] }, { name: "Abu Dhabi", cities: ["Abu Dhabi"] }] },
  { code: "GB", name: "United Kingdom", states: [{ name: "England", cities: ["London", "Manchester"] }] },
];

function cleanString(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return cleanString(value).toLowerCase();
}

function normalizeUsername(value = "") {
  return cleanString(value).toLowerCase();
}

function sanitizeApplication(application) {
  if (!application) return null;
  return {
    id: application._id,
    applicationId: application.applicationId,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    mobile: application.mobile,
    username: application.username,
    referralCode: application.referralCode || "",
    status: application.status,
    currentStep: application.currentStep,
    applicationNumber: application.applicationNumber || "",
    reviewStage: application.reviewStage || "",
    creatorScore: application.creatorScore || 0,
    submittedAt: application.submittedAt || null,
    reviewedAt: application.reviewedAt || null,
    approvedAt: application.approvedAt || null,
    rejectedAt: application.rejectedAt || null,
    reviewNotes: application.reviewNotes || "",
    profileDraft: application.profileDraft || {},
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function sanitizeSocialAccount(account) {
  if (!account) return null;
  return {
    id: account._id,
    applicationId: account.applicationId,
    influencerId: account.influencerId || null,
    platform: account.platform,
    platformLabel: account.platformLabel || "",
    profileUrl: account.profileUrl,
    username: account.username || "",
    channelName: account.channelName || "",
    accountType: account.accountType || "",
    followersCount: Number(account.followersCount || 0),
    engagementRate: Number(account.engagementRate || 0),
    description: account.description || "",
    metrics: account.metrics || {},
    verificationStatus: account.verificationStatus,
    verifiedAt: account.verifiedAt || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function sanitizeVerification(verification) {
  if (!verification) return null;
  return {
    id: verification._id,
    socialAccountId: verification.socialAccountId,
    applicationId: verification.applicationId,
    verificationMethod: verification.verificationMethod,
    verificationCode: verification.verificationCode || "",
    screenshotPath: verification.screenshotPath || "",
    status: verification.status,
    reviewNotes: verification.reviewNotes || "",
    createdAt: verification.createdAt,
    updatedAt: verification.updatedAt,
  };
}

function normalizePlatform(value = "") {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 40);
}

function normalizeUrl(value = "") {
  const input = cleanString(value);
  if (!input) return "";
  try {
    const url = new URL(input);
    url.hash = "";
    return url.toString();
  } catch {
    return input;
  }
}

function extractSocialUsername(platform, profileUrl = "") {
  try {
    const url = new URL(profileUrl);
    const parts = url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    if (platform === "instagram") return (parts[0] || "").replace(/^@/, "");
    if (platform === "youtube") return (parts[0] === "@" ? parts[1] : parts[0] || "").replace(/^@/, "");
    return (parts[0] || "").replace(/^@/, "");
  } catch {
    return "";
  }
}

function makeVerificationCode(applicationId, platform) {
  const seed = `${applicationId}:${platform}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`;
  const suffix = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 4).toUpperCase();
  return `INFLUENCER-GRM-${suffix}`;
}

function calculateCreatorScore(accounts = []) {
  const activeAccounts = accounts.filter((account) => account.profileUrl);
  const totalFollowers = activeAccounts.reduce((sum, account) => sum + Number(account.followersCount || 0), 0);
  const averageEngagement = activeAccounts.length
    ? activeAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / activeAccounts.length
    : 0;
  const contentTotal = activeAccounts.reduce((sum, account) => sum + Number(account.metrics?.contentCount || 0), 0);
  const followersScore = Math.min(35, Math.round(Math.log10(totalFollowers + 1) * 8));
  const engagementScore = Math.min(30, Math.round(averageEngagement * 6));
  const consistencyScore = Math.min(20, Math.round(contentTotal / 10));
  const diversityScore = Math.min(15, activeAccounts.length * 4);
  const score = Math.min(100, followersScore + engagementScore + consistencyScore + diversityScore);
  const level = score >= 80 ? "Gold Creator" : score >= 60 ? "Silver Creator" : score >= 40 ? "Rising Creator" : "Starter Creator";
  return { score, level, followersScore, engagementScore, consistencyScore, diversityScore };
}

function calculateApplicationScore({ application, socialAccounts = [], business, payment, sampleCount = 0, identityCount = 0 } = {}) {
  const verifiedSocial = socialAccounts.filter((account) => ["verified", "under_review", "manual_review_required"].includes(account.verificationStatus));
  const totalFollowers = socialAccounts.reduce((sum, account) => sum + Number(account.followersCount || 0), 0);
  const averageEngagement = socialAccounts.length
    ? socialAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / socialAccounts.length
    : 0;
  const contentQuality = Math.min(100, 45 + sampleCount * 12);
  const audienceQuality = Math.min(100, Math.round(Math.log10(totalFollowers + 1) * 18));
  const engagement = Math.min(100, Math.round(averageEngagement * 12));
  const requiredProfileFields = ["profilePicture", "coverBanner", "displayName", "shortBio", "primaryCategory", "storeSlug"];
  const profileCompleteness = Math.round(
    (requiredProfileFields.filter((field) => application?.profileDraft?.[field]).length / requiredProfileFields.length) * 100
  );
  const verification = Math.min(100, (verifiedSocial.length ? 40 : 0) + (business ? 20 : 0) + (payment ? 20 : 0) + (identityCount ? 20 : 0));
  const overall = Math.round((contentQuality * 0.25) + (audienceQuality * 0.2) + (engagement * 0.2) + (profileCompleteness * 0.2) + (verification * 0.15));
  const level = overall >= 80 ? "Gold Creator" : overall >= 60 ? "Silver Creator" : overall >= 40 ? "Rising Creator" : "Starter Creator";
  return { contentQuality, audienceQuality, engagement, profileCompleteness, verification, overall, level };
}

function parseList(value, max = 20) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean).slice(0, max);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(cleanString).filter(Boolean).slice(0, max);
  } catch {
    // fall through to comma split
  }
  return value.split(",").map(cleanString).filter(Boolean).slice(0, max);
}

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function slugify(value = "") {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCollectionType(value = "custom") {
  const next = cleanString(value).toLowerCase();
  const map = {
    custom_collection: "custom",
    featured_collection: "featured",
    seasonal_collection: "seasonal",
    campaign_collection: "campaign",
    affiliate_collection: "affiliate",
    trending_collection: "trending_products",
    bundle_collection: "bundle",
    brand_collection: "brand",
  };
  return map[next] || next || "custom";
}

function normalizeTags(value = []) {
  return Array.from(new Set((Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => cleanString(item).toLowerCase())
    .filter(Boolean)
    .slice(0, 20)));
}

function productImage(product = {}) {
  const first = Array.isArray(product.images) ? product.images[0] : null;
  return product.thumbnail || (typeof first === "string" ? first : first?.url) || "";
}

function collectionAnalyticsSnapshot(collection = {}) {
  const analytics = collection.analytics || {};
  const clicks = Number(analytics.clicks || 0);
  const views = Number(analytics.views || 0);
  const orders = Number(analytics.orders || 0);
  return {
    views,
    uniqueVisitors: Number(analytics.uniqueVisitors || 0),
    clicks,
    ctr: views ? Number(((clicks / views) * 100).toFixed(2)) : 0,
    orders,
    revenue: Number(analytics.revenue || 0),
    commission: Number(analytics.commission || 0),
    conversionRate: clicks ? Number(((orders / clicks) * 100).toFixed(2)) : 0,
    shares: Number(analytics.shares || 0),
    saves: Number(analytics.saves || 0),
  };
}

function defaultHomepageSections(storefront = {}) {
  return [
    { id: "hero", type: "hero", title: "Hero Banner", visible: true, layout: "banner", priority: 1, config: storefront.hero || {} },
    { id: "featured-products", type: "featured_products", title: "Featured Products", visible: true, layout: "grid", priority: 2, config: {} },
    { id: "featured-collections", type: "featured_collections", title: "Featured Collections", visible: true, layout: "carousel", priority: 3, config: {} },
    { id: "categories", type: "categories", title: "Categories", visible: true, layout: "grid", priority: 4, config: {} },
    { id: "videos", type: "videos", title: "Videos Section", visible: true, layout: "carousel", priority: 5, config: {} },
  ];
}

function storefrontSeoScore(storefront = {}) {
  const seo = storefront.seo || {};
  const checks = [
    Boolean(seo.metaTitle || storefront.name),
    Boolean(seo.metaDescription || storefront.description),
    Boolean(seo.openGraphImage || storefront.banner),
    Array.isArray(seo.keywords) && seo.keywords.length > 0,
    Boolean(storefront.slug),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeSocialLinks(value = {}) {
  if (Array.isArray(value)) {
    return value.reduce((acc, row) => {
      if (row?.platform) acc[cleanString(row.platform).toLowerCase()] = { url: cleanString(row.url || row.profileUrl), visible: row.visible !== false };
      return acc;
    }, {});
  }
  return Object.entries(value || {}).reduce((acc, [platform, link]) => {
    acc[platform] = typeof link === "string" ? { url: cleanString(link), visible: true } : { url: cleanString(link?.url || link?.profileUrl), visible: link?.visible !== false };
    return acc;
  }, {});
}

function sanitizeStorefrontPayload(payload = {}, fallback = {}) {
  return {
    name: cleanString(payload.name || payload.storeName || fallback.name).slice(0, 120),
    slug: slugify(payload.slug || fallback.slug || payload.name || fallback.name || "store"),
    banner: cleanString(payload.banner || payload.bannerImage || fallback.banner),
    mobileBanner: cleanString(payload.mobileBanner || fallback.mobileBanner),
    profileImage: cleanString(payload.profileImage || fallback.profileImage),
    logo: cleanString(payload.logo || fallback.logo),
    description: cleanString(payload.description || fallback.description).slice(0, 1200),
    tagline: cleanString(payload.tagline || fallback.tagline).slice(0, 160),
    contact: { ...(fallback.contact || {}), ...(payload.contact || {}) },
    theme: cleanString(payload.theme || fallback.theme || "creator-default"),
    branding: { ...(fallback.branding || {}), ...(payload.branding || {}) },
    hero: { ...(fallback.hero || {}), ...(payload.hero || {}) },
    banners: { ...(fallback.banners || {}), ...(payload.banners || {}) },
    homepage: {
      ...(fallback.homepage || {}),
      ...(payload.homepage || {}),
      sections: Array.isArray(payload.homepage?.sections) ? payload.homepage.sections : fallback.homepage?.sections || defaultHomepageSections(fallback),
      draftSections: Array.isArray(payload.homepage?.draftSections) ? payload.homepage.draftSections : fallback.homepage?.draftSections || [],
      updatedAt: new Date(),
    },
    featuredCollectionIds: Array.isArray(payload.featuredCollectionIds) ? payload.featuredCollectionIds.filter(Boolean).slice(0, 20) : fallback.featuredCollectionIds || [],
    featuredProductIds: Array.isArray(payload.featuredProductIds) ? payload.featuredProductIds.filter(Boolean).slice(0, 40) : fallback.featuredProductIds || [],
    featuredCategoryKeys: Array.isArray(payload.featuredCategoryKeys) ? payload.featuredCategoryKeys.map(cleanString).filter(Boolean).slice(0, 20) : fallback.featuredCategoryKeys || [],
    socialLinks: payload.socialLinks ? normalizeSocialLinks(payload.socialLinks) : fallback.socialLinks || {},
    categories: Array.isArray(payload.categories) ? payload.categories.map(cleanString).filter(Boolean).slice(0, 20) : fallback.categories || [],
    seo: {
      ...(fallback.seo || {}),
      ...(payload.seo || {}),
      keywords: normalizeTags(payload.seo?.keywords || payload.keywords || fallback.seo?.keywords || []),
    },
    status: payload.status || fallback.status || "draft",
    settings: { ...(fallback.settings || {}), ...(payload.settings || {}) },
  };
}

function escapeRegex(value = "") {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function enrichAffiliateProduct(product = {}, profile = null) {
  const price = Number(product.discountPrice || product.price || 0);
  let commission = { commissionValue: 0, commissionAmount: 0, commissionType: "percentage" };
  try {
    commission = await commissionRuleService.calculateForOrderItem({
      productId: product._id,
      vendorId: product.sellerId?._id || product.sellerId,
      categoryId: product.categoryId,
      subtotal: price,
    });
  } catch {
    commission = {
      commissionType: "percentage",
      commissionValue: profile?.affiliate?.commissionRate || 0,
      commissionAmount: Number(((price * Number(profile?.affiliate?.commissionRate || 0)) / 100).toFixed(2)),
    };
  }
  const views = Number(product.analytics?.views || 0);
  const sales = Number(product.analytics?.salesCount || 0);
  const revenue = Number(product.analytics?.totalRevenue || 0);
  return {
    id: String(product._id),
    _id: product._id,
    name: product.name,
    sku: product.SKU,
    image: productImage(product),
    brand: product.sellerId?.shopName || product.sellerId?.companyName || "",
    vendor: product.sellerId?.shopName || product.sellerId?.companyName || "",
    category: product.category,
    categoryId: product.categoryId,
    price: Number(product.price || 0),
    salePrice: price,
    commissionRate: Number(commission.commissionValue || 0),
    commissionType: commission.commissionType,
    commissionAmount: Number(commission.commissionAmount || 0),
    rating: Number(product.ratings?.averageRating || 0),
    reviewsCount: Number(product.ratings?.totalReviews || 0),
    salesVolume: sales,
    views,
    revenue,
    conversionRate: views ? Number(((sales / views) * 100).toFixed(2)) : 0,
    stockStatus: Number(product.stock || 0) > 0 ? "In Stock" : "Out of Stock",
    stock: Number(product.stock || 0),
    status: product.status,
    createdAt: product.createdAt,
    recommendationScore: product.recommendationScore || 0,
    trendScore: Number((views * 0.2 + sales * 3 + revenue * 0.01).toFixed(2)),
  };
}

function encryptionKey() {
  return crypto.createHash("sha256").update(process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-influencer-key").digest();
}

function encryptSensitive(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function maskAccount(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  return `${"X".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function sanitizeBusinessPayload(payload = {}, uploaded = {}) {
  return {
    country: cleanString(payload.country),
    state: cleanString(payload.state),
    city: cleanString(payload.city),
    address1: cleanString(payload.address1),
    address2: cleanString(payload.address2),
    postalCode: cleanString(payload.postalCode),
    businessType: cleanString(payload.businessType),
    customBusinessType: cleanString(payload.customBusinessType),
    gstNumber: cleanString(payload.gstNumber).toUpperCase(),
    panNumber: cleanString(payload.panNumber).toUpperCase(),
    taxId: cleanString(payload.taxId),
    businessRegistrationNumber: cleanString(payload.businessRegistrationNumber),
    legalName: cleanString(payload.legalName),
    businessName: cleanString(payload.businessName),
    dateOfBirth: cleanString(payload.dateOfBirth),
    nationality: cleanString(payload.nationality),
    documents: uploaded,
  };
}

function validateBusiness(payload = {}) {
  const required = ["country", "state", "city", "address1", "postalCode", "businessType", "legalName", "dateOfBirth", "nationality"];
  for (const field of required) {
    if (!payload[field]) throw new AppError(`${field} is required`, 400, "VALIDATION_ERROR");
  }
  if (payload.businessType === "other" && !payload.customBusinessType) throw new AppError("Custom business type is required", 400, "VALIDATION_ERROR");
  if (payload.country === "IN") {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(payload.panNumber)) throw new AppError("Valid PAN number is required for India", 400, "VALIDATION_ERROR");
    if (payload.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(payload.gstNumber)) throw new AppError("GST number format is invalid", 400, "VALIDATION_ERROR");
  } else if (!payload.taxId) {
    throw new AppError("Tax ID is required for selected country", 400, "VALIDATION_ERROR");
  }
}

function sanitizePaymentPayload(payload = {}) {
  return {
    payoutMethod: cleanString(payload.payoutMethod),
    accountHolderName: cleanString(payload.accountHolderName),
    bankName: cleanString(payload.bankName),
    branchName: cleanString(payload.branchName),
    accountNumber: cleanString(payload.accountNumber).replace(/[\s-]/g, ""),
    confirmAccountNumber: cleanString(payload.confirmAccountNumber).replace(/[\s-]/g, ""),
    ifscCode: cleanString(payload.ifscCode).toUpperCase(),
    swiftCode: cleanString(payload.swiftCode).toUpperCase(),
    routingNumber: cleanString(payload.routingNumber),
    upiId: cleanString(payload.upiId),
    paypalEmail: cleanString(payload.paypalEmail).toLowerCase(),
    payoneerEmail: cleanString(payload.payoneerEmail).toLowerCase(),
    agreements: parseJsonObject(payload.agreements, payload.agreements || {}),
    country: cleanString(payload.country),
  };
}

function validatePayment(payload = {}, existingPayment = null) {
  if (!payload.payoutMethod) throw new AppError("Payout method is required", 400, "VALIDATION_ERROR");
  if (payload.payoutMethod === "bank_transfer") {
    const hasSavedAccount = Boolean(existingPayment?.accountNumberEncrypted && !payload.accountNumber && !payload.confirmAccountNumber);
    if (!payload.accountHolderName || !payload.bankName || (!payload.accountNumber && !hasSavedAccount)) throw new AppError("Bank account details are required", 400, "VALIDATION_ERROR");
    if (!hasSavedAccount && payload.accountNumber !== payload.confirmAccountNumber) throw new AppError("Account numbers must match", 400, "VALIDATION_ERROR");
    if (payload.country === "IN" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payload.ifscCode)) throw new AppError("IFSC code is invalid", 400, "VALIDATION_ERROR");
    if (payload.country !== "IN" && !payload.swiftCode) throw new AppError("SWIFT code is required for international transfers", 400, "VALIDATION_ERROR");
  }
  if (payload.payoutMethod === "upi" && !/^[\w.-]+@[\w.-]+$/.test(payload.upiId)) throw new AppError("UPI ID is invalid", 400, "VALIDATION_ERROR");
  if (payload.payoutMethod === "paypal" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.paypalEmail)) throw new AppError("PayPal email is invalid", 400, "VALIDATION_ERROR");
  if (payload.payoutMethod === "payoneer" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.payoneerEmail)) throw new AppError("Payoneer email is invalid", 400, "VALIDATION_ERROR");
  if (!payload.agreements?.payoutPolicy || !payload.agreements?.commissionTerms || !payload.agreements?.taxCompliance) {
    throw new AppError("Payment agreements are required", 400, "VALIDATION_ERROR");
  }
}

function sanitizeProfileDraftPayload(payload = {}, uploaded = {}) {
  const mediaTransforms = parseJsonObject(payload.mediaTransforms);
  const displayName = cleanString(payload.displayName);
  const storeName = cleanString(payload.storeName) || displayName;
  return {
    profilePicture: uploaded.profilePicture || cleanString(payload.profilePicture),
    coverBanner: uploaded.coverBanner || cleanString(payload.coverBanner),
    displayName,
    shortBio: cleanString(payload.shortBio),
    longBio: cleanString(payload.longBio),
    primaryCategory: cleanString(payload.primaryCategory),
    customCategory: cleanString(payload.customCategory),
    secondaryCategories: parseList(payload.secondaryCategories, 5),
    languages: parseList(payload.languages, 12),
    country: cleanString(payload.country),
    state: cleanString(payload.state),
    city: cleanString(payload.city),
    website: cleanString(payload.website),
    contentNiche: parseList(payload.contentNiche, 12),
    contentStyle: parseList(payload.contentStyle, 12),
    storeName,
    storeSlug: slugify(payload.storeSlug || storeName),
    metaTitle: cleanString(payload.metaTitle),
    metaDescription: cleanString(payload.metaDescription),
    socialSharingImage: uploaded.socialSharingImage || cleanString(payload.socialSharingImage),
    mediaTransforms: {
      profilePicture: {
        zoom: Number(mediaTransforms?.profilePicture?.zoom || 1),
        rotation: Number(mediaTransforms?.profilePicture?.rotation || 0),
      },
      coverBanner: {
        zoom: Number(mediaTransforms?.coverBanner?.zoom || 1),
        rotation: Number(mediaTransforms?.coverBanner?.rotation || 0),
      },
    },
  };
}

function sanitizeProfileDraft(application) {
  const draft = application?.profileDraft || {};
  return {
    applicationId: application?.applicationId,
    currentStep: application?.currentStep,
    profile: {
      profilePicture: draft.profilePicture || "",
      coverBanner: draft.coverBanner || "",
      displayName: draft.displayName || "",
      shortBio: draft.shortBio || "",
      longBio: draft.longBio || "",
      primaryCategory: draft.primaryCategory || "",
      customCategory: draft.customCategory || "",
      secondaryCategories: draft.secondaryCategories || [],
      languages: draft.languages || [],
      country: draft.country || "",
      state: draft.state || "",
      city: draft.city || "",
      website: draft.website || "",
      contentNiche: draft.contentNiche || [],
      contentStyle: draft.contentStyle || [],
      storeName: draft.storeName || "",
      storeSlug: draft.storeSlug || "",
      metaTitle: draft.metaTitle || "",
      metaDescription: draft.metaDescription || "",
      socialSharingImage: draft.socialSharingImage || "",
      mediaTransforms: draft.mediaTransforms || {},
    },
    updatedAt: application?.updatedAt,
  };
}

function validateProfileForContinue(profile = {}) {
  if (!profile.profilePicture) throw new AppError("Profile picture is required", 400, "VALIDATION_ERROR");
  if (!profile.coverBanner) throw new AppError("Cover banner is required", 400, "VALIDATION_ERROR");
  if (profile.displayName.length < 3 || profile.displayName.length > 100) {
    throw new AppError("Display name must be between 3 and 100 characters", 400, "VALIDATION_ERROR");
  }
  if (profile.shortBio.length < 20 || profile.shortBio.length > 160) {
    throw new AppError("Short bio must be between 20 and 160 characters", 400, "VALIDATION_ERROR");
  }
  if (!profile.primaryCategory) throw new AppError("Primary category is required", 400, "VALIDATION_ERROR");
  if (profile.primaryCategory === "other" && !profile.customCategory) {
    throw new AppError("Custom category is required", 400, "VALIDATION_ERROR");
  }
  if (!profile.storeSlug) throw new AppError("Influencer URL slug is required", 400, "VALIDATION_ERROR");
}

function validateSocialPayload(accounts = []) {
  const errors = [];
  const seenPlatforms = new Set();
  const seenUrls = new Set();
  for (const [index, account] of accounts.entries()) {
    const platform = normalizePlatform(account.platform);
    const url = normalizeUrl(account.profileUrl);
    if (!platform) errors.push(`Social profile ${index + 1} requires a platform.`);
    if (!url) errors.push(`${account.platformLabel || platform || "Profile"} URL is required.`);
    try {
      if (url) new URL(url);
    } catch {
      errors.push(`${account.platformLabel || platform || "Profile"} URL must be valid.`);
    }
    if (platform && seenPlatforms.has(platform)) errors.push(`Duplicate platform entry: ${account.platformLabel || platform}.`);
    if (url && seenUrls.has(url)) errors.push(`Duplicate profile URL: ${url}.`);
    seenPlatforms.add(platform);
    seenUrls.add(url);
  }
  if (errors.length) throw new AppError(errors[0], 400, "VALIDATION_ERROR", { issues: errors });
}

function generateApplicationId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `INF-${date}-${suffix}`;
}

function generateApplicationNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(4).readUInt32BE(0).toString().padStart(10, "0").slice(0, 8);
  return `INF-${year}-${suffix}`;
}

function generateInfluencerCode() {
  return `INF${crypto.randomBytes(4).readUInt32BE(0).toString().padStart(10, "0").slice(0, 8)}`;
}

function generateTrackingCode(username = "") {
  const base = slugify(username || "creator").replace(/-/g, "").slice(0, 12) || "creator";
  return `${base}${crypto.randomBytes(2).toString("hex")}`.toLowerCase();
}

async function ensureUniqueInfluencerCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInfluencerCode();
    const exists = await InfluencerProfile.exists({ influencerCode: code });
    if (!exists) return code;
  }
  throw new AppError("Could not generate a unique influencer code", 409, "INFLUENCER_CODE_COLLISION");
}

async function ensureUniqueStoreSlug(baseSlug, userId = null) {
  const base = slugify(baseSlug || "creator") || `creator-${crypto.randomBytes(3).toString("hex")}`;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [profile, storefront] = await Promise.all([
      InfluencerProfile.findOne({ storeSlug: slug, ...(userId ? { userId: { $ne: userId } } : {}) }).select("_id").lean(),
      InfluencerStorefront.findOne({ slug }).select("_id influencerId").lean(),
    ]);
    if (!profile && !storefront) return slug;
  }
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

async function ensureUniqueTrackingCode(username = "") {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateTrackingCode(username);
    const exists = await InfluencerAffiliateSetting.exists({ trackingCode: code });
    if (!exists) return code;
  }
  return `${slugify(username || "creator").replace(/-/g, "").slice(0, 10)}${crypto.randomBytes(5).toString("hex")}`;
}

async function writeActivationAudit(payload = {}) {
  try {
    await InfluencerActivationAudit.create(payload);
  } catch {
    // Audit writes should not break idempotent activation retries.
  }
}

async function findApplicationForProfile(profile) {
  const email = normalizeEmail(profile?.userId?.email || "");
  if (!email) return null;
  return await InfluencerApplication.findOne({ email }).sort({ createdAt: -1 }).lean();
}

function normalizeVerificationStatus(status = "") {
  const value = cleanString(status).toLowerCase();
  if (["verified", "approved", "active"].includes(value)) return "verified";
  if (["rejected", "suspended"].includes(value)) return "rejected";
  if (["pending", "submitted", "under_review", "verification_in_progress", "pending_documents", "manual_review_required"].includes(value)) return "pending";
  return value || "not_submitted";
}

function documentCategoryFor(type = "") {
  const value = cleanString(type).toLowerCase();
  if (["pan", "gst", "tin", "vat", "ssn", "ein", "tax_certificate"].includes(value)) return "tax";
  if (["bank_statement", "cancelled_cheque"].includes(value)) return "bank";
  if (["sample_content", "brand_collaboration"].includes(value)) return "content";
  if (["address_proof", "supporting_document"].includes(value)) return "supporting";
  return "identity";
}

function presentDocument(document = {}) {
  return {
    id: String(document._id),
    _id: document._id,
    name: document.originalName || document.documentType,
    documentName: document.originalName || document.documentType,
    category: document.category || documentCategoryFor(document.documentType),
    documentType: document.documentType,
    filePath: document.filePath,
    mimeType: document.mimeType,
    size: Number(document.size || 0),
    status: document.status,
    uploadDate: document.createdAt || document.submittedAt,
    submittedAt: document.submittedAt || document.createdAt,
    verificationDate: document.verifiedAt || document.reviewedAt,
    expiryDate: document.expiryDate,
    countryOfIssue: document.countryOfIssue || "",
    side: document.side || "",
    reviewNotes: document.reviewNotes || "",
    ocr: document.ocr || {},
  };
}

function verificationScore({ profile, business, payment, payoutAccount, documents = [] }) {
  const checks = [
    Boolean(profile?.verified || ["verified", "active"].includes(profile?.state)),
    documents.some((doc) => doc.category === "identity" && ["verified", "pending", "manual_review_required", "under_verification"].includes(doc.status)),
    Boolean(business && business.status !== "draft"),
    Boolean((payment && payment.status !== "draft") || payoutAccount),
    Boolean(profile?.bio || profile?.displayName),
  ];
  const percentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const level = percentage >= 90 ? "Premium Verified" : percentage >= 75 ? "Advanced Verified" : percentage >= 50 ? "Verified" : "Basic";
  return { percentage, level, eligible: percentage >= 75 };
}

function profileCompletionScore({ user, profile, storefront, socialAccounts = [], payoutAccount }) {
  const checks = [
    Boolean(user?.name),
    Boolean(user?.email),
    Boolean(user?.phone),
    Boolean(user?.avatarUrl || profile?.profilePicture),
    Boolean(profile?.displayName),
    Boolean(profile?.bio || profile?.shortBio || profile?.longBio),
    Boolean(profile?.categories?.length || profile?.primaryCategory),
    Boolean(profile?.website || profile?.socialHandles?.website),
    Boolean(socialAccounts.length),
    Boolean(storefront?.name || profile?.storeName),
    Boolean(storefront?.banner || profile?.coverBanner),
    Boolean(payoutAccount),
    Boolean(profile?.verified),
  ];
  const percentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missing = [
    !user?.avatarUrl && !profile?.profilePicture ? "Profile photo" : "",
    !profile?.displayName ? "Display name" : "",
    !profile?.bio && !profile?.shortBio ? "Profile bio" : "",
    !socialAccounts.length ? "Social account" : "",
    !storefront?.name && !profile?.storeName ? "Store branding" : "",
    !payoutAccount ? "Payment method" : "",
  ].filter(Boolean);
  return { percentage, missing };
}

function presentSocialAccount(account = {}) {
  return {
    id: String(account._id),
    platform: account.platform,
    platformLabel: account.platformLabel || account.platform,
    handle: account.username || account.channelName || "",
    profileUrl: account.profileUrl,
    followers: Number(account.followersCount || 0),
    engagementRate: Number(account.engagementRate || 0),
    verificationStatus: account.verificationStatus,
    connectedStatus: account.profileUrl ? "connected" : "disconnected",
    updatedAt: account.updatedAt,
  };
}

function detectContentNiche(application = {}, socialAccounts = []) {
  const text = [
    application.profileDraft?.primaryCategory,
    application.profileDraft?.customCategory,
    ...(application.profileDraft?.contentNiche || []),
    ...(socialAccounts.map((account) => `${account.platform} ${account.description || ""}`)),
  ].join(" ").toLowerCase();
  const niches = ["technology", "fashion", "gaming", "beauty", "fitness", "education", "lifestyle", "travel", "food", "business"];
  return niches.find((niche) => text.includes(niche)) || "other";
}

async function isEmailTaken(email, excludeApplicationId = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  const [user, application] = await Promise.all([
    userRepo.findByEmail(normalizedEmail),
    InfluencerApplication.findOne({
      email: normalizedEmail,
      ...(excludeApplicationId ? { applicationId: { $ne: excludeApplicationId } } : {}),
    }).lean(),
  ]);
  return Boolean(user || application);
}

async function isUsernameTaken(username, excludeApplicationId = "") {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return false;
  const application = await InfluencerApplication.findOne({
    username: normalizedUsername,
    ...(excludeApplicationId ? { applicationId: { $ne: excludeApplicationId } } : {}),
  }).lean();
  return Boolean(application);
}

async function getProfileByUserId(userId) {
  return await InfluencerProfile.findOne({ userId }).populate("userId", "name email phone role").exec();
}

class InfluencerService {
  async checkEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new AppError("Email is required", 400, "VALIDATION_ERROR");
    const available = !(await isEmailTaken(normalizedEmail));
    return {
      email: normalizedEmail,
      available,
      message: available ? "Available" : "Already registered",
    };
  }

  async checkUsername(username) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) throw new AppError("Username is required", 400, "VALIDATION_ERROR");
    const available = !(await isUsernameTaken(normalizedUsername));
    return {
      username: normalizedUsername,
      available,
      message: available ? "Available" : "Already registered",
    };
  }

  async saveStepOneDraft(payload = {}, meta = {}) {
    const normalizedEmail = normalizeEmail(payload.email);
    const normalizedUsername = normalizeUsername(payload.username);
    const applicationId = cleanString(payload.applicationId) || generateApplicationId();

    const [emailTaken, usernameTaken] = await Promise.all([
      isEmailTaken(normalizedEmail, applicationId),
      isUsernameTaken(normalizedUsername, applicationId),
    ]);
    if (emailTaken) throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    if (usernameTaken) throw new AppError("Username already registered", 409, "USERNAME_EXISTS");

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const application = await InfluencerApplication.findOneAndUpdate(
      { applicationId },
      {
        $set: {
          applicationId,
          firstName: cleanString(payload.firstName),
          lastName: cleanString(payload.lastName),
          email: normalizedEmail,
          mobile: cleanString(payload.mobile),
          username: normalizedUsername,
          passwordHash,
          referralCode: cleanString(payload.referralCode).toUpperCase(),
          status: "draft",
          currentStep: 1,
          termsAccepted: Boolean(payload.termsAccepted),
          privacyAccepted: Boolean(payload.privacyAccepted),
          notificationsAccepted: Boolean(payload.notificationsAccepted),
          "draftMeta.userAgent": cleanString(meta.userAgent),
          "draftMeta.ipAddress": cleanString(meta.ipAddress),
          "draftMeta.lastSavedAt": new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return {
      application: sanitizeApplication(application),
      nextStep: 2,
      nextPath: "/influencer/register/social-verification",
    };
  }

  async registerStepOne(payload = {}, meta = {}) {
    return this.saveStepOneDraft(payload, meta);
  }

  async saveSocialDraft(payload = {}) {
    const applicationId = cleanString(payload.applicationId);
    if (!applicationId) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId });
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");

    const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    validateSocialPayload(accounts);

    const savedAccounts = [];
    for (const account of accounts) {
      const platform = normalizePlatform(account.platform);
      const profileUrl = normalizeUrl(account.profileUrl);
      const verificationStatus = account.manualProofSubmitted ? "under_review" : account.verificationStatus || "pending";
      const saved = await InfluencerSocialAccount.findOneAndUpdate(
        { applicationId, platform },
        {
          $set: {
            applicationId,
            platform,
            platformLabel: cleanString(account.platformLabel || account.platform),
            profileUrl,
            username: cleanString(account.username),
            channelName: cleanString(account.channelName),
            accountType: cleanString(account.accountType).toLowerCase(),
            followersCount: Number(account.followersCount || account.subscribers || 0),
            engagementRate: Number(account.engagementRate || 0),
            description: cleanString(account.description),
            metrics: {
              subscribers: Number(account.metrics?.subscribers || account.subscribers || 0),
              averageLikes: Number(account.metrics?.averageLikes || account.averageLikes || 0),
              averageComments: Number(account.metrics?.averageComments || account.averageComments || 0),
              averageViews: Number(account.metrics?.averageViews || account.averageViews || 0),
              contentCount: Number(account.metrics?.contentCount || account.contentCount || 0),
              accountAgeDays: Number(account.metrics?.accountAgeDays || account.accountAgeDays || 0),
              verificationBadge: Boolean(account.metrics?.verificationBadge || account.verificationBadge),
            },
            verificationStatus,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      savedAccounts.push(saved);

      if (account.verificationCode || account.manualProofSubmitted) {
        await InfluencerSocialVerification.findOneAndUpdate(
          { socialAccountId: saved._id, verificationMethod: account.manualProofSubmitted ? "screenshot" : "verification_code" },
          {
            $set: {
              applicationId,
              socialAccountId: saved._id,
              verificationMethod: account.manualProofSubmitted ? "screenshot" : "verification_code",
              verificationCode: account.verificationCode || makeVerificationCode(applicationId, platform),
              status: account.manualProofSubmitted ? "under_review" : "pending",
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );
      }
    }

    await InfluencerApplication.findOneAndUpdate({ applicationId }, { $set: { currentStep: Math.max(application.currentStep || 1, 2), "draftMeta.lastSavedAt": new Date() } });
    const plainAccounts = savedAccounts.map((account) => account.toObject());
    return {
      applicationId,
      accounts: plainAccounts.map(sanitizeSocialAccount),
      creatorScore: calculateCreatorScore(plainAccounts),
      requirements: DEFAULT_SOCIAL_REQUIREMENTS,
    };
  }

  async fetchSocialMetrics(payload = {}) {
    const platform = normalizePlatform(payload.platform);
    const profileUrl = normalizeUrl(payload.profileUrl);
    if (!platform || !profileUrl) throw new AppError("Platform and profile URL are required", 400, "VALIDATION_ERROR");

    const username = extractSocialUsername(platform, profileUrl);
    if (!username) throw new AppError("Could not detect username from profile URL", 400, "VALIDATION_ERROR");

    if (platform === "instagram") {
      const accessToken = process.env.META_GRAPH_ACCESS_TOKEN || process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
      const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (!accessToken || !businessAccountId) {
        return {
          platform,
          profileUrl,
          username,
          available: false,
          source: "manual_fallback",
          message: "Instagram auto-fetch requires Meta Graph API credentials. Enter followers manually or upload proof.",
        };
      }

      try {
        const fields = `business_discovery.username(${username}){username,name,followers_count,media_count}`;
        const response = await axios.get(`https://graph.facebook.com/v19.0/${businessAccountId}`, {
          params: { fields, access_token: accessToken },
          timeout: 8000,
        });
        const discovery = response.data?.business_discovery || {};
        return {
          platform,
          profileUrl,
          username: discovery.username || username,
          channelName: discovery.name || "",
          followersCount: Number(discovery.followers_count || 0),
          contentCount: Number(discovery.media_count || 0),
          engagementRate: 0,
          available: true,
          source: "meta_graph",
          message: "Instagram metrics fetched.",
        };
      } catch (err) {
        return {
          platform,
          profileUrl,
          username,
          available: false,
          source: "meta_graph",
          message: err?.response?.data?.error?.message || "Instagram metrics could not be fetched. Enter followers manually or upload proof.",
        };
      }
    }

    return {
      platform,
      profileUrl,
      username,
      available: false,
      source: "manual_fallback",
      message: "Automatic fetching for this platform is not configured yet.",
    };
  }

  async verifySocial(payload = {}, files = []) {
    const applicationId = cleanString(payload.applicationId);
    const platform = normalizePlatform(payload.platform);
    if (!applicationId || !platform) throw new AppError("Application id and platform are required", 400, "VALIDATION_ERROR");

    const account = await InfluencerSocialAccount.findOne({ applicationId, platform });
    if (!account) throw new AppError("Social account not found", 404, "NOT_FOUND");

    const method = cleanString(payload.verificationMethod || "verification_code");
    const uploaded = files?.length ? await uploadMany(files.slice(0, 1), { folder: "influencer-verifications" }) : [];
    const screenshot = uploaded[0] || null;
    const verificationCode = cleanString(payload.verificationCode) || makeVerificationCode(applicationId, platform);
    const status = method === "screenshot" || screenshot ? "under_review" : "pending";

    const verification = await InfluencerSocialVerification.create({
      applicationId,
      socialAccountId: account._id,
      verificationMethod: screenshot ? "screenshot" : method,
      verificationCode,
      screenshotPath: screenshot?.url || "",
      screenshotMeta: screenshot
        ? {
            originalName: screenshot.originalName,
            mimeType: screenshot.mimeType,
            size: screenshot.size,
          }
        : {},
      status,
    });

    account.verificationStatus = status;
    await account.save();

    return {
      account: sanitizeSocialAccount(account),
      verification: sanitizeVerification(verification),
    };
  }

  async getSocialStatus(applicationId) {
    const id = cleanString(applicationId);
    if (!id) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const accounts = await InfluencerSocialAccount.find({ applicationId: id }).sort({ createdAt: 1 }).lean();
    const verifications = await InfluencerSocialVerification.find({ applicationId: id }).sort({ createdAt: -1 }).lean();
    return {
      applicationId: id,
      accounts: accounts.map(sanitizeSocialAccount),
      verifications: verifications.map(sanitizeVerification),
      creatorScore: calculateCreatorScore(accounts),
      requirements: DEFAULT_SOCIAL_REQUIREMENTS,
      canContinue: accounts.some((account) => account.verificationStatus === "verified" || account.verificationStatus === "under_review"),
    };
  }

  async checkProfileSlug(slug, applicationId = "") {
    const normalized = slugify(slug);
    if (!normalized) throw new AppError("Store slug is required", 400, "VALIDATION_ERROR");
    const [profile, application] = await Promise.all([
      InfluencerProfile.findOne({ storeSlug: normalized }).select("_id").lean(),
      InfluencerApplication.findOne({
        "profileDraft.storeSlug": normalized,
        ...(applicationId ? { applicationId: { $ne: applicationId } } : {}),
      }).select("_id").lean(),
    ]);
    return {
      slug: normalized,
      available: !profile && !application,
      message: !profile && !application ? "Available" : "Already in use",
    };
  }

  async getProfileDraft(applicationId) {
    const id = cleanString(applicationId);
    if (!id) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId: id }).lean();
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    return sanitizeProfileDraft(application);
  }

  async saveProfileDraft(payload = {}, files = [], { submit = false } = {}) {
    const applicationId = cleanString(payload.applicationId);
    if (!applicationId) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId });
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");

    const groupedFiles = {};
    const fileList = Array.isArray(files)
      ? files
      : Object.values(files || {}).flatMap((entry) => (Array.isArray(entry) ? entry : [entry]).filter(Boolean));
    for (const file of fileList) {
      groupedFiles[file.fieldname] = file;
    }
    const uploaded = {};
    for (const field of ["profilePicture", "coverBanner", "socialSharingImage"]) {
      if (groupedFiles[field]) {
        const [asset] = await uploadMany([groupedFiles[field]], { folder: "influencer-profile" });
        uploaded[field] = asset?.url || "";
      }
    }

    const profile = sanitizeProfileDraftPayload(payload, uploaded);
    if (submit) validateProfileForContinue(profile);
    if (profile.storeSlug) {
      const slugStatus = await this.checkProfileSlug(profile.storeSlug, applicationId);
      if (!slugStatus.available) throw new AppError("Influencer URL slug already in use", 409, "SLUG_EXISTS");
    }

    const updated = await InfluencerApplication.findOneAndUpdate(
      { applicationId },
      {
        $set: {
          profileDraft: profile,
          currentStep: Math.max(Number(application.currentStep || 1), 3),
          "draftMeta.lastSavedAt": new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    return {
      ...sanitizeProfileDraft(updated),
      nextStep: 4,
      nextPath: "/influencer/register/business-information",
    };
  }

  getCountryMaster() {
    return COUNTRY_MASTER;
  }

  getCommissionSettings() {
    return DEFAULT_COMMISSION_SETTINGS;
  }

  async saveBusiness(payload = {}, files = [], { submit = false } = {}) {
    const applicationId = cleanString(payload.applicationId);
    if (!applicationId) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId });
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    const fileList = Array.isArray(files) ? files : Object.values(files || {}).flatMap((entry) => Array.isArray(entry) ? entry : [entry].filter(Boolean));
    const uploaded = {};
    for (const file of fileList) {
      const [asset] = await uploadMany([file], { folder: "influencer-business-documents" });
      uploaded[file.fieldname] = asset?.url || "";
    }
    const business = sanitizeBusinessPayload(payload, uploaded);
    if (submit) validateBusiness(business);

    const saved = await InfluencerBusinessProfile.findOneAndUpdate(
      { applicationId },
      {
        $set: {
          applicationId,
          country: business.country,
          state: business.state,
          city: business.city,
          address1: business.address1,
          address2: business.address2,
          postalCode: business.postalCode,
          businessType: business.businessType,
          customBusinessType: business.customBusinessType,
          gstNumberEncrypted: encryptSensitive(business.gstNumber),
          panNumberEncrypted: encryptSensitive(business.panNumber),
          taxIdEncrypted: encryptSensitive(business.taxId),
          businessRegistrationNumber: business.businessRegistrationNumber,
          legalName: business.legalName,
          businessName: business.businessName,
          dateOfBirth: business.dateOfBirth || undefined,
          nationality: business.nationality,
          documents: { ...(business.documents || {}) },
          status: submit ? "pending" : "draft",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: submit }
    ).lean();
    await InfluencerApplication.updateOne({ applicationId }, { $set: { currentStep: Math.max(Number(application.currentStep || 1), 4), "draftMeta.lastSavedAt": new Date() } });
    return { applicationId, business: saved, nextStep: 5, nextPath: "/influencer/register/payment-commission" };
  }

  async getBusiness(applicationId) {
    const id = cleanString(applicationId);
    if (!id) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    return { applicationId: id, business: await InfluencerBusinessProfile.findOne({ applicationId: id }).lean() };
  }

  async savePayment(payload = {}, { submit = false } = {}) {
    const applicationId = cleanString(payload.applicationId);
    if (!applicationId) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId });
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    const existingPayment = await InfluencerPaymentProfile.findOne({ applicationId }).lean();
    const payment = sanitizePaymentPayload(payload);
    if (submit) validatePayment(payment, existingPayment);
    const accountUpdate = payment.accountNumber
      ? {
          accountNumberEncrypted: encryptSensitive(payment.accountNumber),
          accountNumberMask: maskAccount(payment.accountNumber),
        }
      : {
          accountNumberEncrypted: existingPayment?.accountNumberEncrypted || "",
          accountNumberMask: existingPayment?.accountNumberMask || "",
        };

    const saved = await InfluencerPaymentProfile.findOneAndUpdate(
      { applicationId },
      {
        $set: {
          applicationId,
          payoutMethod: payment.payoutMethod || "bank_transfer",
          accountHolderName: payment.accountHolderName,
          bankName: payment.bankName,
          branchName: payment.branchName,
          ...accountUpdate,
          ifscCode: payment.ifscCode,
          swiftCode: payment.swiftCode,
          routingNumber: payment.routingNumber,
          upiIdEncrypted: encryptSensitive(payment.upiId),
          paypalEmailEncrypted: encryptSensitive(payment.paypalEmail),
          payoneerEmailEncrypted: encryptSensitive(payment.payoneerEmail),
          agreements: payment.agreements,
          commissionSnapshot: DEFAULT_COMMISSION_SETTINGS,
          status: submit ? "pending" : "draft",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: submit }
    ).lean();
    await InfluencerApplication.updateOne({ applicationId }, { $set: { currentStep: Math.max(Number(application.currentStep || 1), 5), "draftMeta.lastSavedAt": new Date() } });
    return { applicationId, payment: saved, commission: DEFAULT_COMMISSION_SETTINGS, nextStep: 6, nextPath: "/influencer/register/content-review" };
  }

  async getPayment(applicationId) {
    const id = cleanString(applicationId);
    if (!id) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const payment = await InfluencerPaymentProfile.findOne({ applicationId: id }).lean();
    return { applicationId: id, payment, commission: DEFAULT_COMMISSION_SETTINGS };
  }

  async saveContentReview(payload = {}, files = [], { submit = false } = {}) {
    const applicationId = cleanString(payload.applicationId);
    if (!applicationId) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const application = await InfluencerApplication.findOne({ applicationId });
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    if (["submitted", "under_review", "approved"].includes(application.status) && submit) {
      throw new AppError("Application has already been submitted", 400, "INVALID_STATE");
    }

    const fileList = Array.isArray(files) ? files : Object.values(files || {}).flatMap((entry) => (Array.isArray(entry) ? entry : [entry].filter(Boolean)));
    const uploadedDocuments = [];
    for (const file of fileList) {
      const documentType = file.fieldname === "identityDocuments" ? "identity_document" : file.fieldname === "brandProofs" ? "brand_collaboration" : "sample_content";
      const [asset] = await uploadMany([file], { folder: "influencer-application-review" });
      if (asset?.url) {
        uploadedDocuments.push({
          applicationId,
          documentType,
          filePath: asset.url,
          originalName: file.originalname || "",
          mimeType: file.mimetype || "",
          size: Number(file.size || 0),
          status: documentType === "identity_document" ? "manual_review_required" : "pending",
          ocr: documentType === "identity_document" ? { status: "queued" } : { status: "not_started" },
        });
      }
    }
    if (uploadedDocuments.length) await InfluencerApplicationDocument.insertMany(uploadedDocuments);

    const [socialAccounts, business, payment, documents] = await Promise.all([
      InfluencerSocialAccount.find({ applicationId }).lean(),
      InfluencerBusinessProfile.findOne({ applicationId }).lean(),
      InfluencerPaymentProfile.findOne({ applicationId }).lean(),
      InfluencerApplicationDocument.find({ applicationId }).lean(),
    ]);
    const sampleCount = documents.filter((document) => document.documentType === "sample_content").length;
    const identityCount = documents.filter((document) => document.documentType === "identity_document").length;
    const brandCollaborations = parseJsonArray(payload.brandCollaborations, [])
      .map((item) => ({
        brandName: cleanString(item.brandName).slice(0, 120),
        campaignName: cleanString(item.campaignName).slice(0, 160),
        campaignType: cleanString(item.campaignType).slice(0, 80),
        campaignDate: cleanString(item.campaignDate),
        campaignResults: cleanString(item.campaignResults).slice(0, 500),
      }))
      .filter((item) => item.brandName || item.campaignName);
    const detectedNiche = detectContentNiche(application, socialAccounts);
    const qualityScores = calculateApplicationScore({ application, socialAccounts, business, payment, sampleCount, identityCount });

    if (submit) {
      const missing = [];
      if (!application.profileDraft?.profilePicture || !application.profileDraft?.coverBanner || !application.profileDraft?.displayName) missing.push("Profile information");
      if (!socialAccounts.some((account) => ["verified", "under_review", "manual_review_required"].includes(account.verificationStatus))) missing.push("Social verification");
      if (!business || business.status === "draft") missing.push("Business information");
      if (!payment || payment.status === "draft") missing.push("Payment information");
      if (sampleCount < 3) missing.push("At least 3 sample content uploads");
      if (!identityCount) missing.push("Identity document");
      if (missing.length) throw new AppError(`Complete required sections: ${missing.join(", ")}`, 400, "VALIDATION_ERROR", { missing });
    }

    const update = {
      currentStep: 6,
      "draftMeta.lastSavedAt": new Date(),
      creatorScore: qualityScores.overall,
      "contentReview.portfolioUrl": cleanString(payload.portfolioUrl),
      "contentReview.portfolioDescription": cleanString(payload.portfolioDescription).slice(0, 1000),
      "contentReview.detectedNiche": detectedNiche,
      "contentReview.manualNiche": cleanString(payload.manualNiche),
      "contentReview.brandCollaborations": brandCollaborations,
      "contentReview.qualityScores": qualityScores,
      "contentReview.aiReview.status": submit ? "queued" : "not_started",
    };
    if (submit) {
      update.status = "submitted";
      update.reviewStage = "submitted";
      update.submittedAt = new Date();
      update.applicationNumber = application.applicationNumber || generateApplicationNumber();
    }
    const saved = await InfluencerApplication.findOneAndUpdate({ applicationId }, { $set: update }, { new: true }).lean();
    if (submit) {
      await InfluencerApplicationReview.create({
        applicationId,
        decision: "submitted",
        comments: "Application submitted for influencer review.",
        metadata: { creatorScore: qualityScores.overall },
      });
    }
    return await this.getApplicationStatus(applicationId);
  }

  async getApplicationStatus(applicationId) {
    const id = cleanString(applicationId);
    if (!id) throw new AppError("Application id is required", 400, "VALIDATION_ERROR");
    const [application, socialAccounts, business, payment, documents, reviews] = await Promise.all([
      InfluencerApplication.findOne({ applicationId: id }).lean(),
      InfluencerSocialAccount.find({ applicationId: id }).lean(),
      InfluencerBusinessProfile.findOne({ applicationId: id }).lean(),
      InfluencerPaymentProfile.findOne({ applicationId: id }).lean(),
      InfluencerApplicationDocument.find({ applicationId: id }).sort({ createdAt: -1 }).lean(),
      InfluencerApplicationReview.find({ applicationId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    const stages = ["submitted", "identity_verification", "social_verification", "content_evaluation", "manual_review", "final_decision"];
    const currentIndex = Math.max(0, stages.indexOf(application.reviewStage || "submitted"));
    const registrationSteps = [
      { key: "account_information", label: "Account Information" },
      { key: "social_verification", label: "Social Verification" },
      { key: "profile_information", label: "Profile Information" },
      { key: "business_information", label: "Business Information" },
      { key: "payment_information", label: "Payment Information" },
      { key: "content_review", label: "Content Review" },
    ];
    const stepReviews = reviews.filter((review) => review.metadata?.reviewType === "registration_step");
    return {
      application: sanitizeApplication(application),
      applicationNumber: application.applicationNumber || application.applicationId,
      status: application.status,
      reviewStage: application.reviewStage,
      submittedAt: application.submittedAt,
      estimatedReviewTime: "24-48 Hours",
      creatorScore: application.creatorScore || application.contentReview?.qualityScores?.overall || 0,
      qualityScores: application.contentReview?.qualityScores || {},
      contentReview: application.contentReview || {},
      socialAccounts: socialAccounts.map(sanitizeSocialAccount),
      business: business ? {
        status: business.status,
        country: business.country,
        state: business.state,
        city: business.city,
        address1: business.address1,
        address2: business.address2,
        postalCode: business.postalCode,
        businessType: business.businessType,
        customBusinessType: business.customBusinessType,
        businessRegistrationNumber: business.businessRegistrationNumber,
        legalName: business.legalName,
        businessName: business.businessName,
        dateOfBirth: business.dateOfBirth,
        nationality: business.nationality,
        documents: business.documents || {},
      } : null,
      payment: payment ? {
        status: payment.status,
        payoutMethod: payment.payoutMethod,
        accountHolderName: payment.accountHolderName,
        bankName: payment.bankName,
        branchName: payment.branchName,
        accountNumberMask: payment.accountNumberMask,
        ifscCode: payment.ifscCode,
        swiftCode: payment.swiftCode,
        routingNumber: payment.routingNumber,
        commissionSnapshot: payment.commissionSnapshot || {},
      } : null,
      documents,
      reviews,
      timeline: stages.map((stage, index) => ({
        stage,
        label: stage.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
        status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
      })),
      stepTimeline: registrationSteps.map((step, index) => {
        const review = stepReviews.find((item) => item.metadata?.stepKey === step.key);
        return {
          ...step,
          status: review?.metadata?.stepDecision || (Number(application.currentStep || 1) > index + 1 ? "completed" : index + 1 === Number(application.currentStep || 1) ? "current" : "upcoming"),
          comments: review?.comments || "",
          reviewedAt: review?.createdAt || null,
        };
      }),
    };
  }

  async listApplications(query = {}) {
    const filters = {};
    if (query.status && query.status !== "all") filters.status = query.status;
    if (query.score === "high") filters.creatorScore = { $gte: 75 };
    if (query.score === "low") filters.creatorScore = { $lt: 50 };
    const sort = query.sort === "oldest" ? { submittedAt: 1, updatedAt: 1 } : { submittedAt: -1, updatedAt: -1 };
    return await InfluencerApplication.find(filters).sort(sort).limit(Math.min(Number(query.limit || 50), 100)).lean();
  }

  async getApplicationReview(applicationId) {
    return await this.getApplicationStatus(applicationId);
  }

  async reviewApplication(applicationId, payload = {}, reviewerId) {
    const id = cleanString(applicationId);
    const decision = cleanString(payload.decision);
    const comments = cleanString(payload.comments);
    const stepKey = cleanString(payload.stepKey);
    const stepDecision = cleanString(payload.stepDecision);
    const application = await InfluencerApplication.findOne({ applicationId: id }).select("+passwordHash");
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    if (application.status === "approved") {
      if (decision === "approve") {
        await this.activateApprovedApplication(id, { reviewerId, comments });
        return await this.getApplicationStatus(id);
      }
      if (!["note", "reject", "suspend"].includes(decision)) {
        throw new AppError("Application is already approved", 409, "APPLICATION_ALREADY_APPROVED");
      }
    }
    if (["rejected", "suspended"].includes(application.status) && decision === "approve") {
      throw new AppError("This application cannot be approved from its current status", 409, "INVALID_APPLICATION_STATE");
    }
    const statusMap = {
      approve: "approved",
      reject: "rejected",
      request_changes: "requires_changes",
      suspend: "suspended",
      request_documents: "pending_documents",
      note: application.status,
    };
    const nextStatus = statusMap[decision];
    if (!nextStatus) throw new AppError("Invalid review decision", 400, "VALIDATION_ERROR");

    const update = {
      status: nextStatus,
      reviewStage: decision === "note" ? application.reviewStage : decision === "approve" || decision === "reject" ? "final_decision" : "manual_review",
      reviewedAt: new Date(),
      reviewNotes: comments || application.reviewNotes || "",
    };
    if (decision === "approve") update.approvedAt = new Date();
    if (decision === "reject") update.rejectedAt = new Date();

    const updated = await InfluencerApplication.findOneAndUpdate({ applicationId: id }, { $set: update }, { new: true });
    await InfluencerApplicationReview.create({
      applicationId: id,
      reviewerId,
      decision,
      comments,
      metadata: {
        previousStatus: application.status,
        nextStatus,
        ...(stepKey && stepDecision ? { reviewType: "registration_step", stepKey, stepDecision } : {}),
      },
    });

    if (decision === "approve") await this.activateApprovedApplication(id, { reviewerId, comments });
    if (["reject", "suspend"].includes(decision) && application.status === "approved") await this.revokeApprovedInfluencer(id, { reviewerId, comments, decision });

    return await this.getApplicationStatus(id);
  }

  async revokeApprovedInfluencer(applicationId, { reviewerId = null, comments = "", decision = "reject" } = {}) {
    const application = await InfluencerApplication.findOne({ applicationId }).lean();
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    const user = await userRepo.findByEmail(application.email);
    if (!user) return null;
    const profile = await InfluencerProfile.findOne({ userId: user._id });
    if (!profile) return null;

    await InfluencerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          state: "suspended",
          verified: false,
          permissions: {
            dashboard: false,
            storefront: false,
            affiliateLinks: false,
            collections: false,
            analytics: false,
            wallet: false,
            campaigns: false,
          },
          "moderation.notes": comments,
        },
      }
    );
    await Promise.all([
      InfluencerBadge.updateMany({ influencerId: profile._id, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } }),
      InfluencerStorefront.updateOne({ influencerId: profile._id }, { $set: { status: "suspended" } }),
      InfluencerAffiliateSetting.updateOne({ influencerId: profile._id }, { $set: { status: "suspended" } }),
      InfluencerWallet.updateOne({ influencerId: profile._id }, { $set: { status: "suspended" } }),
    ]);

    const remainingRoles = Array.from(new Set([user.role, ...(user.roles || [])].filter(Boolean))).filter((role) => role !== "influencer");
    await userRepo.updateById(user._id, {
      role: user.role === "influencer" ? remainingRoles[0] || "user" : user.role,
      roles: remainingRoles.length ? remainingRoles : ["user"],
    });
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: decision === "suspend" ? "INFLUENCER_SUSPENDED" : "INFLUENCER_REVOKED", status: "success", metadata: { comments } });
    return profile;
  }

  async activateApprovedApplication(applicationId, { reviewerId = null, comments = "" } = {}) {
    const application = await InfluencerApplication.findOne({ applicationId }).select("+passwordHash");
    if (!application) throw new AppError("Influencer application not found", 404, "NOT_FOUND");
    if (application.status !== "approved") throw new AppError("Application must be approved before activation", 400, "INVALID_STATE");
    const profileDraft = application.profileDraft || {};
    const now = new Date();

    const [emailUser, phoneUser] = await Promise.all([
      userRepo.findByEmail(application.email),
      userRepo.findByPhone(application.mobile),
    ]);
    if (emailUser && phoneUser && String(emailUser._id) !== String(phoneUser._id)) {
      throw new AppError("Application email and mobile belong to different existing accounts. Request changes before approval.", 409, "ACCOUNT_CONFLICT");
    }
    let user = emailUser || phoneUser;
    if (!user) {
      user = await userRepo.createUser({
        name: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
        phone: application.mobile,
        password: application.passwordHash,
        role: "influencer",
        roles: ["influencer"],
        status: "active",
      });
      await writeActivationAudit({ applicationId, actorId: reviewerId, action: "ACCOUNT_CREATED", status: "success", metadata: { userId: user._id } });
    } else if (!user.email && application.email) {
      user = await userRepo.updateById(user._id, { email: application.email });
    } else if (![user.role, ...(user.roles || [])].includes("influencer")) {
      user = await userRepo.updateById(user._id, { roles: Array.from(new Set([user.role, ...(user.roles || []), "influencer"].filter(Boolean))), status: "active" });
      await writeActivationAudit({ applicationId, actorId: reviewerId, action: "INFLUENCER_ACCESS_ASSIGNED", status: "success", metadata: { userId: user._id, primaryRolePreserved: user.role } });
    }

    const existingProfile = await InfluencerProfile.findOne({ userId: user._id }).lean();
    const influencerCode = existingProfile?.influencerCode || await ensureUniqueInfluencerCode();
    const storeSlug = existingProfile?.storeSlug || await ensureUniqueStoreSlug(profileDraft.storeSlug || profileDraft.displayName || application.username, user._id);
    const profile = await InfluencerProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          state: "active",
          verified: true,
          influencerCode,
          followers: 0,
          permissions: {
            dashboard: true,
            storefront: true,
            affiliateLinks: true,
            collections: true,
            analytics: true,
            wallet: true,
            campaigns: true,
          },
          profilePicture: profileDraft.profilePicture || "",
          coverBanner: profileDraft.coverBanner || "",
          displayName: profileDraft.displayName || `${application.firstName} ${application.lastName}`.trim(),
          shortBio: profileDraft.shortBio || "",
          longBio: profileDraft.longBio || "",
          primaryCategory: profileDraft.primaryCategory || "",
          customCategory: profileDraft.customCategory || "",
          secondaryCategories: profileDraft.secondaryCategories || [],
          languages: profileDraft.languages || [],
          location: { country: profileDraft.country || "", state: profileDraft.state || "", city: profileDraft.city || "" },
          website: profileDraft.website || "",
          contentNiche: profileDraft.contentNiche || [],
          contentStyle: profileDraft.contentStyle || [],
          storeName: profileDraft.storeName || profileDraft.displayName || "",
          storeSlug,
          seo: {
            metaTitle: profileDraft.metaTitle || "",
            metaDescription: profileDraft.metaDescription || "",
            socialSharingImage: profileDraft.socialSharingImage || "",
          },
          "activation.activatedAt": now,
          "activation.checklist.bannerUploaded": Boolean(profileDraft.coverBanner),
          "activation.checklist.profilePhotoUploaded": Boolean(profileDraft.profilePicture),
          "activation.checklist.bioCompleted": Boolean(profileDraft.shortBio),
          "moderation.submittedAt": application.submittedAt,
          "moderation.verifiedAt": now,
          "moderation.notes": comments,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: "PROFILE_ACTIVATED", status: "success", metadata: { influencerCode } });

    const badgeType = Number(application.creatorScore || 0) >= 80 ? "gold_verified" : "creator_verified";
    await InfluencerBadge.findOneAndUpdate(
      { influencerId: profile._id, status: "active" },
      { $setOnInsert: { influencerId: profile._id, badgeType, label: badgeType === "gold_verified" ? "Gold Verified Creator" : "Verified Influencer", issuedAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: "BADGE_ISSUED", status: "success", metadata: { badgeType } });

    await InfluencerStorefront.findOneAndUpdate(
      { influencerId: profile._id },
      {
        $set: {
          influencerId: profile._id,
          slug: storeSlug,
          name: profile.storeName || profile.displayName,
          banner: profile.coverBanner || "",
          profileImage: profile.profilePicture || "",
          description: profile.shortBio || profile.longBio || "",
          socialLinks: application.contentReview?.portfolioUrl ? { portfolio: application.contentReview.portfolioUrl } : {},
          categories: [profile.primaryCategory, ...(profile.secondaryCategories || [])].filter(Boolean),
          status: "active",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: "STOREFRONT_CREATED", status: "success", metadata: { slug: storeSlug } });

    const existingAffiliate = await InfluencerAffiliateSetting.findOne({ influencerId: profile._id }).lean();
    const trackingCode = existingAffiliate?.trackingCode || await ensureUniqueTrackingCode(application.username);
    await InfluencerAffiliateSetting.findOneAndUpdate(
      { influencerId: profile._id },
      {
        $setOnInsert: {
          influencerId: profile._id,
          trackingCode,
          commissionType: "percentage",
          commissionRate: DEFAULT_COMMISSION_SETTINGS.commissionPercentage,
          status: "active",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: "AFFILIATE_ENABLED", status: "success", metadata: { trackingCode } });

    await InfluencerCollection.findOneAndUpdate(
      { influencerId: profile._id, slug: "creator-favorites" },
      { $setOnInsert: { influencerId: profile._id, title: "Creator Favorites", slug: "creator-favorites", type: "creator_favorites", featured: true, status: "active" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await InfluencerWallet.findOneAndUpdate({ influencerId: profile._id }, { $setOnInsert: { influencerId: profile._id, status: "active" }, $set: { status: "active" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: reviewerId, action: "WALLET_ACTIVATED", status: "success" });

    await InfluencerApplication.updateOne({ applicationId }, { $set: { approvedAt: application.approvedAt || now, reviewStage: "final_decision" } });
    await emitDomainEvent(INFLUENCER_EVENTS.INFLUENCER_ACTIVATED, { influencerId: profile._id, userId: user._id, applicationId });
    return await this.getActivationWelcome(profile._id);
  }

  async getActivationWelcome(influencerId) {
    const [profile, badge, storefront, affiliate, wallet, collections] = await Promise.all([
      InfluencerProfile.findById(influencerId).lean(),
      InfluencerBadge.findOne({ influencerId, status: "active" }).lean(),
      InfluencerStorefront.findOne({ influencerId }).lean(),
      InfluencerAffiliateSetting.findOne({ influencerId }).lean(),
      InfluencerWallet.findOne({ influencerId }).lean(),
      InfluencerCollection.find({ influencerId, status: "active" }).lean(),
    ]);
    const checklist = profile?.activation?.checklist || {};
    const checks = [
      checklist.bannerUploaded,
      checklist.profilePhotoUploaded,
      checklist.bioCompleted,
      checklist.firstCollectionCreated || collections.length > 0,
      checklist.firstAffiliateLinkGenerated,
      checklist.storefrontShared,
    ];
    return {
      profile,
      badge,
      storefront,
      affiliate,
      wallet,
      collections,
      checklist,
      completionPercentage: Math.round((checks.filter(Boolean).length / checks.length) * 100),
      capabilities: {
        badgeActivated: Boolean(badge),
        storefrontCreated: Boolean(storefront),
        affiliateLinksEnabled: Boolean(affiliate),
        productCollectionsEnabled: true,
        commissionWalletActivated: Boolean(wallet),
        analyticsDashboardEnabled: true,
      },
    };
  }

  async register(userId, payload = {}) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
    if (user.role !== "influencer") {
      await userRepo.updateById(userId, { role: "influencer" });
    }

    const nextState = payload.submit ? "submitted" : "draft";
    const profile = await InfluencerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          categories: payload.categories || [],
          followers: Number(payload.followers || 0),
          bio: payload.bio || "",
          socialHandles: payload.socialHandles || {},
          state: nextState,
          ...(payload.submit ? { "moderation.submittedAt": new Date() } : {}),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).populate("userId", "name email phone role");

    return profile;
  }

  async getProfile(userId) {
    const profile = await getProfileByUserId(userId);
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");
    return profile;
  }

  async getWelcomeForUser(userId) {
    const profile = await this.getProfile(userId);
    return await this.getActivationWelcome(profile._id);
  }

  async getStorefrontBuilder(userId) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.storefront) throw new AppError("Storefront builder is not enabled", 403, "FORBIDDEN");
    let storefront = await InfluencerStorefront.findOne({ influencerId: profile._id })
      .populate("featuredCollectionIds", "title slug media analytics productIds featured status")
      .populate("featuredProductIds", "name images thumbnail category price discountPrice ratings analytics status")
      .lean();
    if (!storefront) {
      const baseName = profile.storeName || profile.displayName || profile.userId?.name || "Creator Store";
      storefront = await InfluencerStorefront.create({
        influencerId: profile._id,
        slug: await ensureUniqueStoreSlug(profile.storeSlug || baseName),
        name: baseName,
        banner: profile.coverBanner || "",
        profileImage: profile.profilePicture || "",
        description: profile.longBio || profile.bio || "",
        tagline: profile.shortBio || "",
        categories: profile.contentNiche || profile.categories || [],
        socialLinks: profile.socialHandles || {},
        status: "draft",
        homepage: { sections: defaultHomepageSections({}), updatedAt: new Date() },
      });
      storefront = storefront.toObject();
    }
    const [collections, products] = await Promise.all([
      InfluencerCollection.find({ influencerId: profile._id, status: { $in: ["active", "scheduled", "draft"] } })
        .select("title slug media analytics productIds featured status type")
        .sort({ featured: -1, updatedAt: -1 })
        .limit(50)
        .lean(),
      Product.find({ status: "APPROVED", isActive: true })
        .select("name images thumbnail category price discountPrice ratings analytics status")
        .sort({ "analytics.salesCount": -1, createdAt: -1 })
        .limit(80)
        .lean(),
    ]);
    return {
      profile,
      storefront: {
        ...storefront,
        homepage: {
          ...(storefront.homepage || {}),
          sections: storefront.homepage?.sections?.length ? storefront.homepage.sections : defaultHomepageSections(storefront),
        },
        seoHealthScore: storefrontSeoScore(storefront),
      },
      collections: collections.map((collection) => ({ ...collection, productsCount: collection.productIds?.length || 0 })),
      products: products.map((product) => ({
        ...product,
        image: productImage(product),
        price: product.discountPrice || product.price,
      })),
      previewUrl: `/influencer/${storefront.slug}`,
    };
  }

  async updateStorefrontBuilder(userId, payload = {}) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.storefront) throw new AppError("Storefront builder is not enabled", 403, "FORBIDDEN");
    const existing = await InfluencerStorefront.findOne({ influencerId: profile._id }).lean();
    const next = sanitizeStorefrontPayload(payload, existing || {});
    if (next.slug) {
      const collision = await InfluencerStorefront.findOne({ slug: next.slug, influencerId: { $ne: profile._id } }).select("_id").lean();
      if (collision) throw new AppError("Store slug already exists", 409, "STORE_SLUG_EXISTS");
    }
    const storefront = await InfluencerStorefront.findOneAndUpdate(
      { influencerId: profile._id },
      { $set: next, $setOnInsert: { influencerId: profile._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    await InfluencerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          storeName: storefront.name,
          storeSlug: storefront.slug,
          coverBanner: storefront.banner || profile.coverBanner,
          profilePicture: storefront.profileImage || profile.profilePicture,
          shortBio: storefront.tagline || profile.shortBio,
          longBio: storefront.description || profile.longBio,
          socialHandles: Object.fromEntries(Object.entries(storefront.socialLinks || {}).map(([key, value]) => [key, value?.url || value])),
          "activation.checklist.storefrontShared": storefront.status === "active",
        },
      }
    );
    await writeActivationAudit({
      influencerId: profile._id,
      actorId: profile.userId,
      action: storefront.status === "active" ? "STOREFRONT_PUBLISHED" : "STOREFRONT_UPDATED",
      status: "success",
      metadata: { storefrontId: storefront._id, slug: storefront.slug, status: storefront.status },
    });
    return await this.getStorefrontBuilder(userId);
  }

  async previewStorefrontBuilder(userId, payload = {}) {
    const builder = await this.getStorefrontBuilder(userId);
    const storefront = sanitizeStorefrontPayload(payload, builder.storefront || {});
    return {
      ...builder,
      storefront: {
        ...builder.storefront,
        ...storefront,
        seoHealthScore: storefrontSeoScore(storefront),
      },
      previewUrl: `/influencer/${storefront.slug || builder.storefront.slug}`,
    };
  }

  async getSavedProductsCollection(profile) {
    return await InfluencerCollection.findOneAndUpdate(
      { influencerId: profile._id, slug: "saved-products" },
      {
        $setOnInsert: {
          influencerId: profile._id,
          title: "Saved Products",
          slug: "saved-products",
          type: "affiliate",
          status: "draft",
          visibility: { audience: "private", locations: [] },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async listAffiliateProducts(userId, query = {}) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.affiliateLinks) throw new AppError("Affiliate products are not enabled", 403, "FORBIDDEN");
    const affiliate = await InfluencerAffiliateSetting.findOne({ influencerId: profile._id }).lean();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;
    const filter = { status: "APPROVED", isActive: true };
    if (query.category) filter.category = cleanString(query.category);
    if (query.vendor) filter.sellerId = query.vendor;
    if (query.availability === "in_stock") filter.stock = { $gt: 0 };
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ name: re }, { SKU: re }, { category: re }, { tags: re }];
    }
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }
    if (query.mode === "new") {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 45);
      filter.createdAt = { $gte: since };
    }
    const sortMap = {
      best_selling: { "analytics.salesCount": -1, createdAt: -1 },
      trending: { "analytics.views": -1, "analytics.salesCount": -1 },
      highest_rated: { "ratings.averageRating": -1, "ratings.totalReviews": -1 },
      newest: { createdAt: -1 },
      most_viewed: { "analytics.views": -1 },
    };
    const sort = sortMap[query.sort] || (query.mode === "new" ? sortMap.newest : sortMap.best_selling);
    const [items, total, savedCollection] = await Promise.all([
      Product.find(filter)
        .populate("sellerId", "shopName companyName")
        .select("name SKU category categoryId tags price discountPrice currency stock status isActive images thumbnail sellerId analytics ratings createdAt")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      this.getSavedProductsCollection(profile),
    ]);
    let rows = await Promise.all(items.map((product) => enrichAffiliateProduct(product, { affiliate })));
    if (query.mode === "highest_commission" || query.sort === "highest_commission") rows = rows.sort((a, b) => b.commissionAmount - a.commissionAmount);
    const saved = new Set((savedCollection.productIds || []).map(String));
    return {
      items: rows.map((row) => ({ ...row, saved: saved.has(String(row._id)) })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listRecommendedAffiliateProducts(userId, query = {}) {
    const profile = await this.getProfile(userId);
    const recommendationService = require("../recommendation/service");
    const recommended = await recommendationService.getHomeRecommendations(profile.userId?._id || profile.userId || userId, { limit: query.limit || 12 });
    const productIds = [
      ...(recommended.personalized?.items || []),
      ...(recommended.trending?.items || []),
      ...(recommended.featured?.items || []),
    ].map((product) => product._id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds }, status: "APPROVED", isActive: true })
      .populate("sellerId", "shopName companyName")
      .lean();
    const rows = await Promise.all(products.map((product) => enrichAffiliateProduct(product)));
    return { items: rows.map((row, index) => ({ ...row, recommendationScore: Number((100 - index * 3).toFixed(2)), expectedConversion: row.conversionRate, commissionPotential: row.commissionAmount })), page: 1, limit: rows.length, total: rows.length, totalPages: 1 };
  }

  async listSavedAffiliateProducts(userId, query = {}) {
    const profile = await this.getProfile(userId);
    const collection = await this.getSavedProductsCollection(profile);
    const products = await Product.find({ _id: { $in: collection.productIds || [] }, status: "APPROVED", isActive: true })
      .populate("sellerId", "shopName companyName")
      .lean();
    const rows = await Promise.all(products.map((product) => enrichAffiliateProduct(product)));
    return { collectionId: collection._id, items: rows.map((row) => ({ ...row, saved: true })), page: 1, limit: rows.length, total: rows.length, totalPages: 1 };
  }

  async saveAffiliateProduct(userId, productId, saved = true) {
    const profile = await this.getProfile(userId);
    const collection = await this.getSavedProductsCollection(profile);
    const ids = new Set((collection.productIds || []).map(String));
    if (saved) ids.add(String(productId));
    else ids.delete(String(productId));
    collection.productIds = Array.from(ids);
    collection.productOrder = collection.productIds.map((id, index) => ({ productId: id, position: index, pinned: false }));
    await collection.save();
    await writeActivationAudit({ influencerId: profile._id, actorId: profile.userId, action: saved ? "AFFILIATE_PRODUCT_SAVED" : "AFFILIATE_PRODUCT_UNSAVED", status: "success", metadata: { productId } });
    return await this.listSavedAffiliateProducts(userId);
  }

  async generateAffiliateProductLinks(userId, payload = {}) {
    const productIds = Array.isArray(payload.productIds) ? payload.productIds.filter(Boolean).slice(0, 50) : payload.productId ? [payload.productId] : [];
    const links = [];
    for (const productId of productIds) {
      const product = await Product.findById(productId).select("_id slug productNumber").lean();
      if (!product) continue;
      const targetPath = payload.targetPath || `/product/${product.slug || product.productNumber || product._id}`;
      const generated = await this.generateAffiliateLink(userId, {
        targetType: "product",
        targetPath,
      });
      const params = new URLSearchParams();
      if (payload.utmSource) params.set("utm_source", payload.utmSource);
      if (payload.utmMedium) params.set("utm_medium", payload.utmMedium);
      if (payload.utmCampaign) params.set("utm_campaign", payload.utmCampaign);
      if (payload.utmContent) params.set("utm_content", payload.utmContent);
      if (payload.utmTerm) params.set("utm_term", payload.utmTerm);
      const suffix = params.toString() ? `${generated.trackingUrl.includes("?") ? "&" : "?"}${params.toString()}` : "";
      links.push({ productId, originalUrl: targetPath, affiliateUrl: `${generated.trackingUrl}${suffix}`, shortLink: `${generated.trackingUrl}${suffix}`, qrValue: `${generated.trackingUrl}${suffix}` });
    }
    return { links };
  }

  async getAffiliateProductAnalytics(userId, query = {}) {
    const profile = await this.getProfile(userId);
    const match = { influencerId: profile._id };
    if (query.from || query.to) {
      match.createdAt = {};
      if (query.from) match.createdAt.$gte = new Date(query.from);
      if (query.to) match.createdAt.$lte = new Date(query.to);
    }
    const rows = await CommissionRecord.find(match)
      .populate({ path: "orderId", select: "items totalAmount createdAt status" })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const productMap = new Map();
    for (const record of rows) {
      for (const item of record.orderId?.items || []) {
        const id = String(item.productId);
        const current = productMap.get(id) || { productId: id, orders: 0, revenue: 0, commission: 0, clicks: 0 };
        current.orders += 1;
        current.revenue += Number(item.price || 0) * Number(item.quantity || 1);
        current.commission += Number(record.influencerShare || 0);
        productMap.set(id, current);
      }
    }
    const productIds = [...productMap.keys()];
    const products = await Product.find({ _id: { $in: productIds } }).select("name category sellerId images thumbnail analytics").populate("sellerId", "shopName companyName").lean();
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const productPerformance = [...productMap.values()].map((row) => {
      const product = productById.get(row.productId) || {};
      const clicks = Number(product.analytics?.views || 0);
      return {
        ...row,
        name: product.name || "Product",
        category: product.category || "",
        vendor: product.sellerId?.shopName || product.sellerId?.companyName || "",
        image: productImage(product),
        clicks,
        conversionRate: clicks ? Number(((row.orders / clicks) * 100).toFixed(2)) : 0,
        epc: clicks ? Number((row.commission / clicks).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.commission - a.commission);
    const totals = productPerformance.reduce((acc, row) => {
      acc.orders += row.orders;
      acc.revenue += row.revenue;
      acc.commission += row.commission;
      acc.clicks += row.clicks;
      return acc;
    }, { orders: 0, revenue: 0, commission: 0, clicks: 0 });
    totals.conversionRate = totals.clicks ? Number(((totals.orders / totals.clicks) * 100).toFixed(2)) : 0;
    totals.epc = totals.clicks ? Number((totals.commission / totals.clicks).toFixed(2)) : 0;
    return { totals, productPerformance, trend: [] };
  }

  async listCollectionProducts(userId, query = {}) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.collections) throw new AppError("Collections are not enabled", 403, "FORBIDDEN");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;
    const filter = { status: "APPROVED", isActive: true };
    if (query.category) filter.category = cleanString(query.category);
    if (query.vendor) filter.sellerId = query.vendor;
    if (query.search) {
      const search = new RegExp(cleanString(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: search }, { SKU: search }, { category: search }, { tags: search }];
    }
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }
    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate("sellerId", "shopName companyName")
        .select("name SKU category tags price discountPrice currency stock status isActive images thumbnail sellerId analytics ratings")
        .sort({ "analytics.salesCount": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);
    const collection = query.collectionId
      ? await InfluencerCollection.findOne({ _id: query.collectionId, influencerId: profile._id }).select("productIds").lean()
      : null;
    const assigned = new Set((collection?.productIds || []).map(String));
    return {
      items: items.map((product) => ({
        id: String(product._id),
        name: product.name,
        image: productImage(product),
        brand: product.sellerId?.shopName || product.sellerId?.companyName || "",
        category: product.category,
        price: product.discountPrice || product.price,
        basePrice: product.price,
        commission: 0,
        status: product.status,
        stock: product.stock,
        rating: product.ratings?.averageRating || 0,
        assigned: assigned.has(String(product._id)),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listCollections(userId, query = {}) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.collections) throw new AppError("Collections are not enabled", 403, "FORBIDDEN");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;
    const filter = { influencerId: profile._id };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = normalizeCollectionType(query.type);
    if (query.featured === "true") filter.featured = true;
    if (query.search) {
      const search = new RegExp(cleanString(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: search }, { slug: search }, { tags: search }, { description: search }];
    }
    const [items, total] = await Promise.all([
      InfluencerCollection.find(filter)
        .populate("productIds", "name images thumbnail category price discountPrice analytics ratings")
        .sort({ featured: -1, "display.priority": -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InfluencerCollection.countDocuments(filter),
    ]);
    return {
      items: items.map((collection) => ({
        ...collection,
        productsCount: collection.productIds?.length || 0,
        analyticsSummary: collectionAnalyticsSnapshot(collection),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getCollection(userId, collectionId) {
    const profile = await this.getProfile(userId);
    const collection = await InfluencerCollection.findOne({ _id: collectionId, influencerId: profile._id })
      .populate("productIds", "name SKU images thumbnail category price discountPrice currency stock status analytics ratings")
      .lean();
    if (!collection) throw new AppError("Collection not found", 404, "NOT_FOUND");
    return { ...collection, productsCount: collection.productIds?.length || 0, analyticsSummary: collectionAnalyticsSnapshot(collection) };
  }

  async saveCollection(userId, payload = {}, collectionId = null) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.collections) throw new AppError("Collections are not enabled", 403, "FORBIDDEN");
    const title = cleanString(payload.title || payload.name);
    if (!title) throw new AppError("Collection name is required", 400, "VALIDATION_ERROR");
    const nextSlug = slugify(payload.slug || title);
    const existing = await InfluencerCollection.findOne({
      influencerId: profile._id,
      slug: nextSlug,
      ...(collectionId ? { _id: { $ne: collectionId } } : {}),
    }).lean();
    if (existing) throw new AppError("Collection slug already exists", 409, "DUPLICATE_SLUG");
    const productIds = Array.isArray(payload.productIds) ? payload.productIds.filter(Boolean).slice(0, 100) : [];
    if (payload.status === "active" && productIds.length < 1) {
      throw new AppError("Published collections require at least one product", 400, "MINIMUM_PRODUCTS_REQUIRED");
    }
    const type = normalizeCollectionType(payload.type);
    const update = {
      influencerId: profile._id,
      title,
      slug: nextSlug,
      description: cleanString(payload.description).slice(0, 1200),
      type,
      tags: normalizeTags(payload.tags),
      productIds,
      productOrder: productIds.map((productId, index) => ({ productId, position: index, pinned: false })),
      featured: Boolean(payload.featured) || type === "featured",
      status: payload.status || "draft",
      media: {
        coverImage: cleanString(payload.coverImage || payload.media?.coverImage),
        bannerImage: cleanString(payload.bannerImage || payload.media?.bannerImage),
        thumbnail: cleanString(payload.thumbnail || payload.media?.thumbnail),
      },
      display: {
        layout: payload.display?.layout || payload.layout || "grid",
        placement: Array.isArray(payload.display?.placement) ? payload.display.placement : ["storefront_homepage"],
        priority: Number(payload.display?.priority || payload.priority || 0),
        pinned: Boolean(payload.display?.pinned || payload.pinned),
      },
      visibility: {
        audience: payload.visibility?.audience || payload.audience || "public",
        locations: Array.isArray(payload.visibility?.locations) ? payload.visibility.locations : ["storefront_homepage"],
        startDate: payload.visibility?.startDate || payload.startDate || undefined,
        endDate: payload.visibility?.endDate || payload.endDate || undefined,
        timezone: payload.visibility?.timezone || payload.timezone || "UTC",
        rules: payload.visibility?.rules || {},
      },
      seo: {
        metaTitle: cleanString(payload.seo?.metaTitle || payload.metaTitle).slice(0, 160),
        metaDescription: cleanString(payload.seo?.metaDescription || payload.metaDescription).slice(0, 300),
        canonicalUrl: cleanString(payload.seo?.canonicalUrl || payload.canonicalUrl),
        openGraphImage: cleanString(payload.seo?.openGraphImage || payload.openGraphImage),
        keywords: normalizeTags(payload.seo?.keywords || payload.keywords),
      },
      seasonal: {
        season: cleanString(payload.seasonal?.season || payload.season),
        template: cleanString(payload.seasonal?.template || payload.template),
        autoPublish: Boolean(payload.seasonal?.autoPublish || payload.autoPublish),
        autoExpire: Boolean(payload.seasonal?.autoExpire || payload.autoExpire),
      },
    };
    const collection = collectionId
      ? await InfluencerCollection.findOneAndUpdate({ _id: collectionId, influencerId: profile._id }, { $set: update }, { new: true, runValidators: true })
      : await InfluencerCollection.create(update);
    if (!collection) throw new AppError("Collection not found", 404, "NOT_FOUND");
    await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { "activation.checklist.firstCollectionCreated": true } });
    await writeActivationAudit({
      influencerId: profile._id,
      actorId: profile.userId,
      action: collectionId ? "COLLECTION_UPDATED" : "COLLECTION_CREATED",
      status: "success",
      metadata: { collectionId: collection._id, slug: collection.slug, status: collection.status },
    });
    return await this.getCollection(userId, collection._id);
  }

  async updateCollectionStatus(userId, collectionId, payload = {}) {
    const profile = await this.getProfile(userId);
    const update = {};
    if (payload.status) update.status = payload.status;
    if (payload.featured !== undefined) update.featured = Boolean(payload.featured);
    if (payload.priority !== undefined) update["display.priority"] = Number(payload.priority || 0);
    if (payload.visibility) Object.keys(payload.visibility).forEach((key) => { update[`visibility.${key}`] = payload.visibility[key]; });
    const collection = await InfluencerCollection.findOneAndUpdate({ _id: collectionId, influencerId: profile._id }, { $set: update }, { new: true, runValidators: true });
    if (!collection) throw new AppError("Collection not found", 404, "NOT_FOUND");
    await writeActivationAudit({ influencerId: profile._id, actorId: profile.userId, action: "COLLECTION_VISIBILITY_UPDATED", status: "success", metadata: { collectionId, update } });
    return collection;
  }

  async assignCollectionProducts(userId, collectionId, payload = {}) {
    const profile = await this.getProfile(userId);
    const collection = await InfluencerCollection.findOne({ _id: collectionId, influencerId: profile._id });
    if (!collection) throw new AppError("Collection not found", 404, "NOT_FOUND");
    const current = new Set((collection.productIds || []).map(String));
    const incoming = (Array.isArray(payload.productIds) ? payload.productIds : []).filter(Boolean).map(String);
    if (payload.mode === "remove") incoming.forEach((id) => current.delete(id));
    else if (payload.mode === "replace") {
      current.clear();
      incoming.forEach((id) => current.add(id));
    } else incoming.forEach((id) => current.add(id));
    const productIds = Array.from(current).slice(0, 100);
    collection.productIds = productIds;
    collection.productOrder = productIds.map((productId, index) => ({ productId, position: index, pinned: false }));
    await collection.save();
    await writeActivationAudit({ influencerId: profile._id, actorId: profile.userId, action: "COLLECTION_PRODUCTS_UPDATED", status: "success", metadata: { collectionId, mode: payload.mode || "add", productIds: incoming } });
    return await this.getCollection(userId, collectionId);
  }

  async getCollectionAnalytics(userId, query = {}) {
    const profile = await this.getProfile(userId);
    const filter = { influencerId: profile._id };
    if (query.collectionId) filter._id = query.collectionId;
    if (query.type) filter.type = normalizeCollectionType(query.type);
    const collections = await InfluencerCollection.find(filter).populate("productIds", "name analytics price discountPrice").lean();
    const totals = collections.reduce((acc, collection) => {
      const row = collectionAnalyticsSnapshot(collection);
      Object.keys(row).forEach((key) => { acc[key] = Number(acc[key] || 0) + Number(row[key] || 0); });
      return acc;
    }, {});
    const productIds = collections.flatMap((collection) => collection.productIds || []).map((product) => product._id || product);
    const commissionRows = productIds.length
      ? await CommissionRecord.aggregate([
          { $match: { influencerId: profile._id } },
          { $group: { _id: "$state", revenue: { $sum: "$gross" }, commission: { $sum: "$influencerShare" }, orders: { $sum: 1 } } },
        ])
      : [];
    const trend = Array.from({ length: 14 }).map((_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (13 - index));
      return { date: date.toISOString().slice(0, 10), views: 0, clicks: 0, revenue: 0, conversion: 0 };
    });
    return {
      totals,
      collections: collections.map((collection) => ({ id: collection._id, title: collection.title, productsCount: collection.productIds?.length || 0, ...collectionAnalyticsSnapshot(collection) })),
      productPerformance: collections.flatMap((collection) => (collection.productIds || []).map((product) => ({
        id: String(product._id),
        collectionId: String(collection._id),
        name: product.name,
        revenue: Number(product.analytics?.totalRevenue || 0),
        orders: Number(product.analytics?.salesCount || 0),
        views: Number(product.analytics?.views || 0),
      }))).slice(0, 20),
      commissionRows,
      trend,
    };
  }

  async getStorefront({ slug = "", userId = "" } = {}) {
    let storefront;
    if (slug) {
      storefront = await InfluencerStorefront.findOne({ slug: slugify(slug), status: "active" })
        .populate("featuredProductIds", "name images thumbnail category price discountPrice ratings analytics status")
        .populate("featuredCollectionIds", "title slug media analytics productIds featured status")
        .lean();
    }
    if (!storefront && userId) {
      const profile = await this.getProfile(userId);
      storefront = await InfluencerStorefront.findOne({ influencerId: profile._id })
        .populate("featuredProductIds", "name images thumbnail category price discountPrice ratings analytics status")
        .populate("featuredCollectionIds", "title slug media analytics productIds featured status")
        .lean();
    }
    if (!storefront) throw new AppError("Influencer storefront not found", 404, "NOT_FOUND");
    const [profile, badge, collections, homepageLayout] = await Promise.all([
      InfluencerProfile.findById(storefront.influencerId).lean(),
      InfluencerBadge.findOne({ influencerId: storefront.influencerId, status: "active" }).lean(),
      InfluencerCollection.find({
        influencerId: storefront.influencerId,
        status: "active",
        "visibility.audience": { $in: ["public", "scheduled"] },
        $and: [
          { $or: [{ "visibility.startDate": { $exists: false } }, { "visibility.startDate": null }, { "visibility.startDate": { $lte: new Date() } }] },
          { $or: [{ "visibility.endDate": { $exists: false } }, { "visibility.endDate": null }, { "visibility.endDate": { $gte: new Date() } }] },
        ],
      })
        .populate("productIds", "name images thumbnail category price discountPrice ratings analytics")
        .sort({ featured: -1, "display.priority": -1, updatedAt: -1 })
        .limit(12)
        .lean(),
      homepageLayoutService.getSharedInfluencerLayout({ device: "desktop" }).catch(() => null),
    ]);
    return { storefront, profile, badge, collections, homepageLayout, containers: homepageLayout?.containers || [], route: `/influencer/${storefront.slug}` };
  }

  async generateAffiliateLink(userId, payload = {}) {
    const profile = await this.getProfile(userId);
    if (!profile.permissions?.affiliateLinks) throw new AppError("Affiliate links are not enabled", 403, "FORBIDDEN");
    const affiliate = await InfluencerAffiliateSetting.findOne({ influencerId: profile._id, status: "active" }).lean();
    if (!affiliate) throw new AppError("Affiliate settings are not active", 400, "AFFILIATE_NOT_ACTIVE");
    const targetType = cleanString(payload.targetType || "product");
    const targetPath = cleanString(payload.targetPath || payload.url || "");
    if (!targetPath) throw new AppError("Target path is required", 400, "VALIDATION_ERROR");
    const normalizedPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
    const trackingUrl = `/ref/${affiliate.trackingCode}${normalizedPath}`;
    await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { "activation.checklist.firstAffiliateLinkGenerated": true } });
    await writeActivationAudit({ influencerId: profile._id, action: "AFFILIATE_LINK_GENERATED", status: "success", metadata: { targetType, targetPath: normalizedPath, trackingUrl } });
    return { trackingCode: affiliate.trackingCode, targetType, targetPath: normalizedPath, trackingUrl };
  }

  async getAnalytics(userId) {
    const profile = await this.getProfile(userId);
    const [wallet, storefront, collections, productCount] = await Promise.all([
      InfluencerWallet.findOne({ influencerId: profile._id }).lean(),
      InfluencerStorefront.findOne({ influencerId: profile._id }).lean(),
      InfluencerCollection.find({ influencerId: profile._id, status: "active" }).lean(),
      Product.countDocuments({ status: "active" }).catch(() => 0),
    ]);
    return {
      profileVisits: Number(profile.stats?.views || 0),
      storeViews: Number(profile.stats?.views || 0),
      followers: Number(profile.followers || 0),
      affiliateClicks: Number(profile.stats?.clicks || 0),
      orders: Number(profile.stats?.sales || 0),
      revenueGenerated: Number(profile.stats?.revenue || 0),
      conversionRate: profile.stats?.clicks ? Number(((profile.stats.sales || 0) / profile.stats.clicks) * 100).toFixed(2) : 0,
      averageOrderValue: profile.stats?.sales ? Number((profile.stats.revenue || 0) / profile.stats.sales).toFixed(2) : 0,
      commissionEarned: Number(wallet?.totalEarnings || 0),
      storefront,
      collections,
      activeProductCatalogSize: productCount,
    };
  }

  async getProfileSettings(userId) {
    const profile = await this.getProfile(userId);
    const user = profile.userId;
    const [storefront, socialAccounts, payoutAccount, sessions, activity] = await Promise.all([
      InfluencerStorefront.findOne({ influencerId: profile._id }).lean(),
      InfluencerSocialAccount.find({ influencerId: profile._id }).sort({ updatedAt: -1 }).lean(),
      InfluencerPayoutAccount.findOne({ influencerId: profile._id, isActive: true, isDefault: true }).sort({ createdAt: -1 }).lean(),
      userService.listSessions(userId).catch(() => []),
      userService.getActivity(userId, { limit: 12 }).catch(() => []),
    ]);
    const completion = profileCompletionScore({ user, profile, storefront, socialAccounts, payoutAccount });
    return {
      personalInformation: {
        profilePhoto: user?.avatarUrl || profile.profilePicture || "",
        fullName: user?.name || "",
        displayName: profile.displayName || "",
        username: profile.storeSlug || "",
        email: user?.email || "",
        phone: user?.phone || "",
        dateOfBirth: "",
        gender: "",
        country: profile.location?.country || "",
        state: profile.location?.state || "",
        city: profile.location?.city || "",
        language: user?.preferences?.language || "en",
        timezone: user?.preferences?.timezone || "Asia/Kolkata",
        headline: profile.shortBio || "",
        biography: profile.longBio || profile.bio || "",
        expertiseCategories: profile.categories || profile.secondaryCategories || [],
        interests: profile.contentNiche || [],
        websiteUrl: profile.website || profile.socialHandles?.website || "",
        profileCompletionScore: completion.percentage,
        missingInformation: completion.missing,
        verificationStatus: profile.verified ? "verified" : profile.state,
        accountStatus: user?.status || "active",
      },
      socialAccounts: socialAccounts.map(presentSocialAccount),
      storeBranding: {
        storeName: storefront?.name || profile.storeName || "",
        storeLogo: storefront?.logo || "",
        storeBanner: storefront?.banner || profile.coverBanner || "",
        tagline: storefront?.tagline || profile.shortBio || "",
        brandDescription: storefront?.description || profile.longBio || profile.bio || "",
        primaryColor: storefront?.branding?.primaryColor || "#4f46e5",
        secondaryColor: storefront?.branding?.secondaryColor || "#06b6d4",
        accentColor: storefront?.branding?.accentColor || "#22c55e",
        themeSelection: storefront?.branding?.preset || storefront?.theme || "modern",
        headingFont: storefront?.branding?.headingFont || "system",
        bodyFont: storefront?.branding?.bodyFont || "system",
        previewUrl: storefront?.slug ? `/influencer/${storefront.slug}` : "",
      },
      paymentSettings: {
        defaultPaymentMethod: payoutAccount?.paymentMethod || "bank_transfer",
        defaultBankAccount: payoutAccount?.bankName || payoutAccount?.paypalEmail || "",
        payoutPreferences: profile.preferences || {},
        taxStatus: "managed_in_documents_verification",
        payoutAccountStatus: payoutAccount?.verificationStatus || "not_submitted",
      },
      notificationSettings: user?.preferences?.notificationPreferences || {},
      securitySettings: {
        twoFactorEnabled: Boolean(user?.preferences?.security?.twoFactorEnabled),
        lastLogin: sessions?.[0]?.lastUsedAt || sessions?.[0]?.createdAt || null,
        activeSessions: sessions || [],
        deviceHistory: sessions || [],
        suspiciousActivityAlerts: [],
      },
      privacySettings: profile.privacy || {},
      connectedAccounts: profile.connectedAccounts || [],
      accountPreferences: {
        language: user?.preferences?.language || "en",
        timezone: user?.preferences?.timezone || "Asia/Kolkata",
        currency: user?.preferences?.currency || profile.preferences?.currencyPreference || "INR",
        dateFormat: user?.preferences?.dateFormat || "DD/MM/YYYY",
        themeMode: profile.preferences?.themeMode || user?.preferences?.theme || "system",
        displayMode: user?.preferences?.displayMode || "expanded",
      },
      analytics: {
        profileViews: Number(profile.stats?.views || 0),
        storeVisits: Number(profile.stats?.views || storefront?.analytics?.views || 0),
        followerGrowth: Number(profile.followers || 0),
        engagementRate: socialAccounts.length
          ? Number((socialAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / socialAccounts.length).toFixed(2))
          : 0,
      },
      activity,
    };
  }

  async updateProfileSettings(userId, section, payload = {}, meta = {}) {
    const profile = await this.getProfile(userId);
    const user = profile.userId;
    const cleanSection = cleanString(section || "personal");
    if (cleanSection === "personal") {
      const userUpdate = {};
      if (payload.fullName !== undefined) userUpdate.name = cleanString(payload.fullName).slice(0, 120);
      if (payload.email !== undefined) userUpdate.email = normalizeEmail(payload.email);
      if (payload.phone !== undefined) userUpdate.phone = cleanString(payload.phone);
      if (payload.profilePhoto !== undefined) userUpdate.avatarUrl = cleanString(payload.profilePhoto);
      if (payload.language !== undefined) userUpdate["preferences.language"] = cleanString(payload.language || "en");
      if (payload.timezone !== undefined) userUpdate["preferences.timezone"] = cleanString(payload.timezone || "Asia/Kolkata");
      if (Object.keys(userUpdate).length) await userRepo.updateById(user._id || userId, userUpdate);
      const profileUpdate = {};
      if (payload.displayName !== undefined) profileUpdate.displayName = cleanString(payload.displayName).slice(0, 100);
      if (payload.headline !== undefined) profileUpdate.shortBio = cleanString(payload.headline).slice(0, 160);
      if (payload.biography !== undefined) {
        profileUpdate.bio = cleanString(payload.biography).slice(0, 1200);
        profileUpdate.longBio = cleanString(payload.biography).slice(0, 2000);
      }
      if (payload.country !== undefined) profileUpdate["location.country"] = cleanString(payload.country);
      if (payload.state !== undefined) profileUpdate["location.state"] = cleanString(payload.state);
      if (payload.city !== undefined) profileUpdate["location.city"] = cleanString(payload.city);
      if (payload.websiteUrl !== undefined) {
        profileUpdate.website = cleanString(payload.websiteUrl);
        profileUpdate["socialHandles.website"] = cleanString(payload.websiteUrl);
      }
      if (Array.isArray(payload.expertiseCategories)) profileUpdate.categories = payload.expertiseCategories.slice(0, 12);
      if (Array.isArray(payload.interests)) profileUpdate.contentNiche = payload.interests.slice(0, 20);
      if (Object.keys(profileUpdate).length) await InfluencerProfile.updateOne({ _id: profile._id }, { $set: profileUpdate });
    }

    if (cleanSection === "social") {
      const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
      for (const account of accounts) {
        const platform = normalizePlatform(account.platform);
        if (!platform) continue;
        await InfluencerSocialAccount.findOneAndUpdate(
          { influencerId: profile._id, platform },
          {
            $set: {
              applicationId: account.applicationId || `profile-${profile._id}`,
              influencerId: profile._id,
              platform,
              platformLabel: account.platformLabel || platform,
              profileUrl: normalizeUrl(account.profileUrl || account.url || ""),
              username: cleanString(account.handle || account.username),
              channelName: cleanString(account.channelName || account.handle),
              followersCount: Number(account.followers || account.followersCount || 0),
              engagementRate: Number(account.engagementRate || 0),
              verificationStatus: account.verificationStatus || "pending",
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    if (cleanSection === "branding") {
      const existing = await this.getStorefrontBuilder(userId).catch(() => null);
      await this.updateStorefrontBuilder(userId, {
        ...(existing?.storefront || {}),
        name: payload.storeName,
        logo: payload.storeLogo,
        banner: payload.storeBanner,
        tagline: payload.tagline,
        description: payload.brandDescription,
        branding: {
          ...(existing?.storefront?.branding || {}),
          primaryColor: payload.primaryColor,
          secondaryColor: payload.secondaryColor,
          accentColor: payload.accentColor,
          preset: payload.themeSelection,
          headingFont: payload.headingFont,
          bodyFont: payload.bodyFont,
        },
      });
    }

    if (cleanSection === "payment") {
      const update = {};
      if (payload.autoWithdraw !== undefined) update["preferences.autoWithdraw"] = Boolean(payload.autoWithdraw);
      if (payload.minimumPayoutThreshold !== undefined) update["preferences.minimumPayoutThreshold"] = Number(payload.minimumPayoutThreshold || 0);
      if (payload.currencyPreference !== undefined) update["preferences.currencyPreference"] = cleanString(payload.currencyPreference || "INR");
      if (Object.keys(update).length) await InfluencerProfile.updateOne({ _id: profile._id }, { $set: update });
    }

    if (cleanSection === "notifications") {
      await userRepo.updateById(user._id || userId, {
        "preferences.notificationPreferences": {
          ...(user.preferences?.notificationPreferences || {}),
          ...(payload || {}),
        },
      });
    }

    if (cleanSection === "privacy") {
      await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { privacy: { ...(profile.privacy?.toObject?.() || profile.privacy || {}), ...(payload || {}) } } });
    }

    if (cleanSection === "preferences") {
      const userUpdate = {};
      ["language", "timezone", "currency", "dateFormat", "displayMode"].forEach((key) => {
        if (payload[key] !== undefined) userUpdate[`preferences.${key}`] = payload[key];
      });
      if (payload.themeMode !== undefined) {
        userUpdate["preferences.theme"] = payload.themeMode === "dark" ? "dark" : "light";
        await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { "preferences.themeMode": payload.themeMode } });
      }
      if (Object.keys(userUpdate).length) await userRepo.updateById(user._id || userId, userUpdate);
    }

    if (cleanSection === "connected") {
      const provider = normalizePlatform(payload.provider);
      if (!provider) throw new AppError("Provider is required", 400, "VALIDATION_ERROR");
      const current = (profile.connectedAccounts || []).filter((account) => account.provider !== provider);
      if (payload.action === "disconnect") {
        await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { connectedAccounts: current } });
      } else {
        current.push({
          provider,
          accountName: cleanString(payload.accountName || provider),
          status: "connected",
          connectedAt: new Date(),
          tokenExpiresAt: payload.tokenExpiresAt || undefined,
          scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
          metadata: payload.metadata || {},
        });
        await InfluencerProfile.updateOne({ _id: profile._id }, { $set: { connectedAccounts: current } });
      }
    }

    await writeActivationAudit({
      influencerId: profile._id,
      actorId: user._id || userId,
      action: `PROFILE_SETTINGS_${cleanSection.toUpperCase()}_UPDATED`,
      status: "success",
      metadata: { keys: Object.keys(payload || {}) },
    });
    return await this.getProfileSettings(userId);
  }

  async getVerificationCenter(userId, query = {}) {
    const profile = await this.getProfile(userId);
    const application = await findApplicationForProfile(profile);
    const applicationId = application?.applicationId || "";
    const documentFilter = {
      $or: [
        { influencerId: profile._id },
        ...(applicationId ? [{ applicationId }] : []),
      ],
    };
    if (query.category) documentFilter.category = query.category;
    if (query.status) documentFilter.status = query.status;

    const [business, payment, payoutAccount, documents, reviews, audits] = await Promise.all([
      InfluencerBusinessProfile.findOne({
        $or: [
          { influencerId: profile._id },
          ...(applicationId ? [{ applicationId }] : []),
        ],
      }).lean(),
      InfluencerPaymentProfile.findOne({
        $or: [
          { influencerId: profile._id },
          ...(applicationId ? [{ applicationId }] : []),
        ],
      }).lean(),
      InfluencerPayoutAccount.findOne({ influencerId: profile._id, isActive: true, isDefault: true }).sort({ createdAt: -1 }).lean(),
      InfluencerApplicationDocument.find(documentFilter).sort({ createdAt: -1 }).limit(100).lean(),
      applicationId ? InfluencerApplicationReview.find({ applicationId }).populate("reviewerId", "name email role").sort({ createdAt: -1 }).limit(50).lean() : [],
      InfluencerActivationAudit.find({ influencerId: profile._id, action: /VERIFICATION|DOCUMENT|TAX|BANK|PAYOUT|PROFILE|ACCOUNT/ }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    const presentedDocuments = documents.map(presentDocument);
    const score = verificationScore({ profile, business, payment, payoutAccount, documents });
    const identityStatus = normalizeVerificationStatus(
      documents.find((doc) => doc.category === "identity" && doc.status === "verified")?.status ||
      documents.find((doc) => doc.category === "identity")?.status
    );
    const taxStatus = normalizeVerificationStatus(business?.status || documents.find((doc) => doc.category === "tax")?.status);
    const bankStatus = normalizeVerificationStatus(payoutAccount?.verificationStatus || payment?.status);
    const profileStatus = normalizeVerificationStatus(profile.verified ? "verified" : profile.state);

    const requiredDocuments = [
      !documents.some((doc) => doc.category === "identity") ? "Identity document" : "",
      !business || business.status === "draft" ? "Tax information" : "",
      !payoutAccount && !payment ? "Bank information" : "",
    ].filter(Boolean);

    const approvalHistory = [
      ...reviews.map((review) => ({
        id: String(review._id),
        submissionDate: review.createdAt,
        documentType: review.metadata?.documentType || review.stepKey || "Application",
        verificationType: "Admin review",
        reviewer: review.reviewerId?.name || review.reviewerId?.email || "Reviewer",
        status: review.decision,
        decisionDate: review.createdAt,
        comments: review.comments || "",
      })),
      ...audits.map((audit) => ({
        id: String(audit._id),
        submissionDate: audit.createdAt,
        documentType: audit.metadata?.documentType || "Verification",
        verificationType: audit.action,
        reviewer: "System",
        status: audit.status,
        decisionDate: audit.createdAt,
        comments: audit.metadata?.comments || "",
      })),
    ].sort((a, b) => new Date(b.submissionDate || 0) - new Date(a.submissionDate || 0));

    return {
      applicationId,
      profile: {
        id: profile._id,
        state: profile.state,
        verified: profile.verified,
        displayName: profile.displayName || profile.userId?.name || "",
        email: profile.userId?.email || "",
      },
      verificationStatus: {
        overall: score.eligible ? "eligible" : requiredDocuments.length ? "action_required" : "pending_review",
        profile: profileStatus,
        identity: identityStatus,
        tax: taxStatus,
        bank: bankStatus,
        compliance: score.eligible ? "verified" : "pending",
        score: score.percentage,
        level: score.level,
        eligibilityStatus: score.eligible ? "Eligible" : "Incomplete",
        pendingActions: requiredDocuments,
        requiredDocuments,
        alerts: presentedDocuments.filter((doc) => doc.expiryDate && new Date(doc.expiryDate) < new Date()).map((doc) => `${doc.documentName} has expired`),
      },
      identityDocuments: presentedDocuments.filter((doc) => doc.category === "identity"),
      taxInformation: {
        country: business?.country || profile.location?.country || "",
        legalName: business?.legalName || "",
        businessName: business?.businessName || "",
        taxResidencyStatus: business?.status || "not_submitted",
        status: taxStatus,
        documents: presentedDocuments.filter((doc) => doc.category === "tax"),
        lastUpdated: business?.updatedAt,
      },
      bankInformation: {
        accountHolderName: payoutAccount?.accountHolderName || payment?.accountHolderName || "",
        bankName: payoutAccount?.bankName || payment?.bankName || "",
        accountNumberMasked: payoutAccount?.accountNumber ? "" : payment?.accountNumberMask || "",
        ifscCode: payoutAccount?.ifscCode || payment?.ifscCode || "",
        swiftCode: payment?.swiftCode || "",
        routingNumber: payment?.routingNumber || "",
        paymentMethod: payoutAccount?.paymentMethod || payment?.payoutMethod || "",
        defaultAccount: Boolean(payoutAccount?.isDefault),
        verificationStatus: payoutAccount?.verificationStatus || payment?.status || "not_submitted",
        documents: presentedDocuments.filter((doc) => doc.category === "bank"),
      },
      uploadedDocuments: presentedDocuments,
      approvalHistory,
      compliance: {
        kyc: identityStatus,
        aml: "not_configured",
        fraud: "not_configured",
        sanctions: "not_configured",
        riskScore: Math.max(0, 100 - score.percentage),
        requiredActions: requiredDocuments,
      },
    };
  }

  async uploadVerificationDocuments(userId, payload = {}, files = []) {
    const profile = await this.getProfile(userId);
    const application = await findApplicationForProfile(profile);
    const applicationId = application?.applicationId || "";
    const fileList = Array.isArray(files) ? files : Object.values(files || {}).flatMap((entry) => (Array.isArray(entry) ? entry : [entry].filter(Boolean)));
    if (!fileList.length) throw new AppError("At least one document file is required", 400, "DOCUMENT_REQUIRED");
    const documentType = cleanString(payload.documentType || "identity_document").toLowerCase();
    const category = cleanString(payload.category || documentCategoryFor(documentType));
    const uploaded = await uploadMany(fileList, { folder: `influencer-verification/${profile._id}` });
    const documents = uploaded.map((asset, index) => ({
      applicationId,
      influencerId: profile._id,
      category,
      documentType,
      documentNumberEncrypted: encryptSensitive(payload.documentNumber),
      countryOfIssue: cleanString(payload.countryOfIssue || payload.country),
      issueDate: payload.issueDate || undefined,
      expiryDate: payload.expiryDate || undefined,
      side: fileList[index]?.fieldname || payload.side || "",
      filePath: asset.url,
      originalName: asset.originalName || fileList[index]?.originalname || "",
      mimeType: asset.mimeType || fileList[index]?.mimetype || "",
      size: Number(asset.size || fileList[index]?.size || 0),
      status: "pending",
      submittedAt: new Date(),
      ocr: ["identity", "tax"].includes(category) ? { status: "queued" } : { status: "not_started" },
    }));
    const saved = await InfluencerApplicationDocument.insertMany(documents);
    await writeActivationAudit({
      applicationId,
      influencerId: profile._id,
      actorId: profile.userId?._id || profile.userId,
      action: "VERIFICATION_DOCUMENT_UPLOADED",
      status: "success",
      metadata: { documentType, category, count: saved.length },
    });
    return { documents: saved.map(presentDocument), verification: await this.getVerificationCenter(userId) };
  }

  async saveVerificationTax(userId, payload = {}, files = []) {
    const profile = await this.getProfile(userId);
    const application = await findApplicationForProfile(profile);
    const applicationId = application?.applicationId || `profile-${profile._id}`;
    const fileList = Array.isArray(files) ? files : Object.values(files || {}).flatMap((entry) => (Array.isArray(entry) ? entry : [entry].filter(Boolean)));
    const uploaded = {};
    for (const file of fileList) {
      const [asset] = await uploadMany([file], { folder: `influencer-tax/${profile._id}` });
      uploaded[file.fieldname] = asset?.url || "";
    }
    const update = {
      applicationId,
      influencerId: profile._id,
      country: cleanString(payload.country || profile.location?.country || "IN"),
      state: cleanString(payload.state || profile.location?.state || "Not set"),
      city: cleanString(payload.city || profile.location?.city || "Not set"),
      address1: cleanString(payload.registeredAddress || payload.address1 || "Not set"),
      postalCode: cleanString(payload.postalCode || "000000"),
      businessType: cleanString(payload.businessType || "individual_creator"),
      legalName: cleanString(payload.legalName || profile.displayName || profile.userId?.name || "Creator"),
      businessName: cleanString(payload.businessName || profile.storeName || ""),
      dateOfBirth: payload.dateOfBirth || new Date("1990-01-01"),
      nationality: cleanString(payload.nationality || payload.country || "IN"),
      gstNumberEncrypted: encryptSensitive(payload.gstNumber),
      panNumberEncrypted: encryptSensitive(payload.panNumber),
      taxIdEncrypted: encryptSensitive(payload.taxNumber || payload.taxId),
      businessRegistrationNumber: cleanString(payload.businessRegistrationNumber),
      documents: {
        gstCertificate: uploaded.gstCertificate || uploaded.taxCertificate || "",
        businessRegistration: uploaded.businessRegistration || "",
        taxRegistration: uploaded.taxRegistration || "",
        addressProof: uploaded.addressProof || "",
      },
      status: "pending",
    };
    const saved = await InfluencerBusinessProfile.findOneAndUpdate(
      { $or: [{ influencerId: profile._id }, { applicationId }] },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    await writeActivationAudit({ applicationId, influencerId: profile._id, actorId: profile.userId?._id || profile.userId, action: "TAX_INFORMATION_SUBMITTED", status: "success", metadata: { country: saved.country } });
    return { taxInformation: saved, verification: await this.getVerificationCenter(userId) };
  }

  async getProfileById(profileId) {
    const profile = await InfluencerProfile.findById(profileId).populate("userId", "name email phone role").exec();
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");
    return profile;
  }

  async updateProfile(userId, payload = {}) {
    const profile = await this.getProfile(userId);
    if (["verified", "active", "suspended"].includes(profile.state) && payload.submit) {
      throw new AppError("Verified profiles cannot be re-submitted", 400, "INVALID_STATE");
    }

    return await InfluencerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(payload.categories ? { categories: payload.categories } : {}),
          ...(payload.followers !== undefined ? { followers: Number(payload.followers || 0) } : {}),
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.socialHandles ? { socialHandles: payload.socialHandles } : {}),
          ...(payload.submit ? { state: "submitted", "moderation.submittedAt": new Date() } : {}),
        },
      },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone role");
  }

  async list(query = {}) {
    const filters = {};
    if (query.state) filters.state = query.state;
    if (query.category) filters.categories = query.category;
    if (query.verified !== undefined) filters.verified = query.verified === "true";

    return await InfluencerProfile.find(filters)
      .populate("userId", "name email phone")
      .sort({ verified: -1, followers: -1, createdAt: -1 })
      .lean();
  }

  async moderate(profileId, payload = {}) {
    const profile = await InfluencerProfile.findById(profileId);
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");

    const update = {
      verified: payload.state === "verified" || payload.state === "active",
      state: payload.state,
      "moderation.notes": payload.notes || profile.moderation?.notes || "",
    };

    if (payload.state === "verified" || payload.state === "active") {
      update["moderation.verifiedAt"] = new Date();
    }
    if (payload.state === "suspended") {
      update["moderation.suspendedAt"] = new Date();
    }

    const updated = await InfluencerProfile.findByIdAndUpdate(profileId, { $set: update }, { new: true }).populate(
      "userId",
      "name email phone role"
    );

    if (payload.state === "active") {
      await emitDomainEvent(INFLUENCER_EVENTS.INFLUENCER_ACTIVATED, {
        influencerId: updated._id,
        userId: updated.userId?._id || updated.userId,
      });
    }

    return updated;
  }
}

module.exports = new InfluencerService();
