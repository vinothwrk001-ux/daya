const express = require("express");
const Joi = require("joi");
const multer = require("multer");
const { authOptional, authRequired, requireRole } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const controller = require("./controller");
const { INFLUENCER_CATEGORIES, INFLUENCER_STATES } = require("../shared/constants");

const router = express.Router();
const proofUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const documentFields = new Set(["gstCertificate", "businessRegistration", "taxRegistration", "addressProof", "taxCertificate"]);
    const allowed = documentFields.has(file.fieldname)
      ? ["application/pdf", "image/png", "image/jpeg", "image/webp"]
      : ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
});
const contentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    cb(null, true);
  },
  limits: { fileSize: 200 * 1024 * 1024, files: 20 },
});
const verificationUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
});
const collectionMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
});

const saveSchema = Joi.object({
  categories: Joi.array().items(Joi.string().valid(...INFLUENCER_CATEGORIES)).default([]),
  followers: Joi.number().min(0).default(0),
  bio: Joi.string().allow("").max(1200).default(""),
  socialHandles: Joi.object({
    instagram: Joi.string().allow("").default(""),
    youtube: Joi.string().allow("").default(""),
    website: Joi.string().allow("").default(""),
  }).default({}),
  submit: Joi.boolean().default(false),
});

const moderateSchema = Joi.object({
  state: Joi.string().valid(...INFLUENCER_STATES).required(),
  notes: Joi.string().allow("").max(1000).default(""),
});

const dashboardQuery = Joi.object({
  refresh: Joi.string().optional(),
  range: Joi.string().valid("today", "7d", "30d", "90d", "12m", "custom").optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  campaignId: Joi.string().allow("").optional(),
  productId: Joi.string().allow("").optional(),
  category: Joi.string().allow("").optional(),
  brand: Joi.string().allow("").optional(),
  marketplace: Joi.string().allow("").optional(),
  country: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

const earningsQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().valid("CREDIT", "DEBIT").optional(),
  source: Joi.string().valid("COMMISSION", "REVERSAL").optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

const collectionTypes = ["recommended_products", "tech_essentials", "fashion_picks", "creator_favorites", "trending_products", "custom", "featured", "seasonal", "campaign", "affiliate", "bundle", "brand"];
const collectionSchema = Joi.object({
  title: Joi.string().trim().max(140).required(),
  name: Joi.string().trim().max(140).allow("").optional(),
  slug: Joi.string().trim().max(120).allow("").optional(),
  description: Joi.string().allow("").max(1200).optional(),
  type: Joi.string().valid(...collectionTypes, "custom_collection", "featured_collection", "seasonal_collection", "campaign_collection", "affiliate_collection", "trending_collection", "bundle_collection", "brand_collection").default("custom"),
  tags: Joi.array().items(Joi.string().max(40)).default([]),
  productIds: Joi.array().items(Joi.string()).max(100).default([]),
  featured: Joi.boolean().optional(),
  status: Joi.string().valid("active", "published", "draft", "archived", "scheduled").default("draft"),
  layout: Joi.string().valid("grid", "list", "carousel", "masonry").optional(),
  coverImage: Joi.string().allow("").optional(),
  bannerImage: Joi.string().allow("").optional(),
  thumbnail: Joi.string().allow("").optional(),
  display: Joi.object({
    layout: Joi.string().valid("grid", "list", "carousel", "masonry").optional(),
    placement: Joi.array().items(Joi.string()).optional(),
    priority: Joi.number().min(0).optional(),
    pinned: Joi.boolean().optional(),
  }).optional(),
  visibility: Joi.object({
    audience: Joi.string().valid("public", "private", "followers_only", "subscribers_only", "campaign_members_only", "scheduled").optional(),
    locations: Joi.array().items(Joi.string()).optional(),
    startDate: Joi.date().iso().allow(null).optional(),
    endDate: Joi.date().iso().allow(null).optional(),
    timezone: Joi.string().allow("").optional(),
    rules: Joi.object().unknown(true).optional(),
  }).optional(),
  seo: Joi.object({
    metaTitle: Joi.string().allow("").max(160).optional(),
    metaDescription: Joi.string().allow("").max(300).optional(),
    canonicalUrl: Joi.string().allow("").optional(),
    openGraphImage: Joi.string().allow("").optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  seasonal: Joi.object({
    season: Joi.string().allow("").optional(),
    template: Joi.string().allow("").optional(),
    autoPublish: Joi.boolean().optional(),
    autoExpire: Joi.boolean().optional(),
  }).optional(),
});

const collectionListQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  status: Joi.string().valid("active", "published", "draft", "archived", "scheduled", "").optional(),
  type: Joi.string().allow("").optional(),
  featured: Joi.string().valid("true", "false").optional(),
  search: Joi.string().allow("").optional(),
});

const collectionAnalyticsQuery = collectionListQuery.keys({
  collectionId: Joi.string().allow("").optional(),
});

const collectionProductQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  search: Joi.string().allow("").optional(),
  category: Joi.string().allow("").optional(),
  vendor: Joi.string().allow("").optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  collectionId: Joi.string().allow("").optional(),
});

const collectionStatusSchema = Joi.object({
  status: Joi.string().valid("active", "published", "draft", "archived", "scheduled").optional(),
  featured: Joi.boolean().optional(),
  priority: Joi.number().min(0).optional(),
  visibility: Joi.object().unknown(true).optional(),
});

const collectionAssignmentSchema = Joi.object({
  mode: Joi.string().valid("add", "remove", "replace").default("add"),
  productIds: Joi.array().items(Joi.string()).max(100).default([]),
});

const storefrontBuilderSchema = Joi.object({
  name: Joi.string().trim().max(120).allow("").optional(),
  storeName: Joi.string().trim().max(120).allow("").optional(),
  slug: Joi.string().trim().max(120).allow("").optional(),
  banner: Joi.string().allow("").optional(),
  bannerImage: Joi.string().allow("").optional(),
  mobileBanner: Joi.string().allow("").optional(),
  profileImage: Joi.string().allow("").optional(),
  logo: Joi.string().allow("").optional(),
  description: Joi.string().allow("").max(1200).optional(),
  tagline: Joi.string().allow("").max(160).optional(),
  contact: Joi.object().unknown(true).optional(),
  theme: Joi.string().allow("").optional(),
  branding: Joi.object().unknown(true).optional(),
  hero: Joi.object().unknown(true).optional(),
  banners: Joi.object().unknown(true).optional(),
  homepage: Joi.object({
    sections: Joi.array().items(Joi.object().unknown(true)).optional(),
    draftSections: Joi.array().items(Joi.object().unknown(true)).optional(),
  }).unknown(true).optional(),
  featuredCollectionIds: Joi.array().items(Joi.string()).max(20).optional(),
  featuredProductIds: Joi.array().items(Joi.string()).max(40).optional(),
  featuredCategoryKeys: Joi.array().items(Joi.string()).max(20).optional(),
  socialLinks: Joi.alternatives().try(Joi.object().unknown(true), Joi.array().items(Joi.object().unknown(true))).optional(),
  categories: Joi.array().items(Joi.string()).max(20).optional(),
  seo: Joi.object().unknown(true).optional(),
  keywords: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid("draft", "active", "hidden", "archived", "inactive", "suspended").optional(),
  settings: Joi.object().unknown(true).optional(),
}).unknown(true);

const affiliateProductQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  search: Joi.string().allow("").optional(),
  category: Joi.string().allow("").optional(),
  brand: Joi.string().allow("").optional(),
  vendor: Joi.string().allow("").optional(),
  availability: Joi.string().valid("in_stock", "all").optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  minCommission: Joi.number().min(0).optional(),
  maxCommission: Joi.number().min(0).optional(),
  rating: Joi.number().min(0).max(5).optional(),
  mode: Joi.string().valid("promotion", "active_campaigns", "approved", "browse", "trending", "highest_commission", "new", "recommended", "saved").optional(),
  sort: Joi.string().valid("best_selling", "trending", "highest_rated", "highest_commission", "newest", "most_viewed").optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

const affiliateLinkBulkSchema = Joi.object({
  productId: Joi.string().allow("").optional(),
  productIds: Joi.array().items(Joi.string()).max(50).optional(),
  targetPath: Joi.string().allow("").optional(),
  utmSource: Joi.string().allow("").optional(),
  utmMedium: Joi.string().allow("").optional(),
  utmCampaign: Joi.string().allow("").optional(),
  utmContent: Joi.string().allow("").optional(),
  utmTerm: Joi.string().allow("").optional(),
});

const affiliateSaveSchema = Joi.object({
  saved: Joi.boolean().default(true),
});

const availabilityEmailQuery = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

const availabilityUsernameQuery = Joi.object({
  username: Joi.string().trim().lowercase().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required(),
});

const stepOneSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).allow("").optional(),
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().trim().lowercase().email().required(),
  mobile: Joi.string().trim().pattern(/^\+\d{1,4}\s?\d{7,14}$/).required().messages({
    "string.pattern.base": "Mobile number must include a country code, for example +91 9876543210",
  }),
  username: Joi.string().trim().lowercase().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required().messages({
    "string.pattern.base": "Username can only contain letters, numbers, and underscores",
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .required()
    .messages({
      "string.pattern.base": "Password must include uppercase, lowercase, number, and special character",
    }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Confirm password must match password",
  }),
  referralCode: Joi.string().trim().alphanum().max(40).allow("").default(""),
  termsAccepted: Joi.boolean().valid(true).required(),
  privacyAccepted: Joi.boolean().valid(true).required(),
  notificationsAccepted: Joi.boolean().default(false),
});

const optionalMetricNumber = Joi.number().min(0).empty("").default(0);
const optionalRateNumber = Joi.number().min(0).max(100).empty("").default(0);

const socialMetricSchema = Joi.object({
  subscribers: optionalMetricNumber,
  averageLikes: optionalMetricNumber,
  averageComments: optionalMetricNumber,
  averageViews: optionalMetricNumber,
  contentCount: optionalMetricNumber,
  accountAgeDays: optionalMetricNumber,
  verificationBadge: Joi.boolean().default(false),
}).default({});

const socialAccountSchema = Joi.object({
  platform: Joi.string().trim().lowercase().max(40).required(),
  platformLabel: Joi.string().trim().max(80).allow("").default(""),
  profileUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(500).required(),
  username: Joi.string().trim().max(100).allow("").default(""),
  channelName: Joi.string().trim().max(140).allow("").default(""),
  accountType: Joi.string().valid("creator", "business", "personal", "").allow("").default(""),
  followersCount: optionalMetricNumber,
  subscribers: optionalMetricNumber,
  engagementRate: optionalRateNumber,
  averageLikes: optionalMetricNumber,
  averageComments: optionalMetricNumber,
  averageViews: optionalMetricNumber,
  contentCount: optionalMetricNumber,
  accountAgeDays: optionalMetricNumber,
  verificationBadge: Joi.boolean().default(false),
  description: Joi.string().trim().max(500).allow("").default(""),
  verificationStatus: Joi.string().valid("draft", "pending", "verified", "rejected", "under_review", "manual_review_required").default("pending"),
  verificationCode: Joi.string().trim().max(80).allow("").default(""),
  manualProofSubmitted: Joi.boolean().default(false),
  metrics: socialMetricSchema,
});

const socialDraftSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  accounts: Joi.array().items(socialAccountSchema).min(1).max(25).required(),
});

const socialStatusQuery = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
});

const socialMetricsQuery = Joi.object({
  platform: Joi.string().trim().lowercase().max(40).required(),
  profileUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(500).required(),
});

const socialVerifySchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  platform: Joi.string().trim().lowercase().max(40).required(),
  verificationMethod: Joi.string().valid("automatic", "verification_code", "screenshot").default("verification_code"),
  verificationCode: Joi.string().trim().max(80).allow("").default(""),
});

const profileQuerySchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
});

const profileSlugQuerySchema = Joi.object({
  applicationId: Joi.string().trim().max(40).allow("").optional(),
  slug: Joi.string().trim().max(100).required(),
});

const profileSaveSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  profilePicture: Joi.string().trim().max(500).allow("").default(""),
  coverBanner: Joi.string().trim().max(500).allow("").default(""),
  displayName: Joi.string().trim().max(100).allow("").default(""),
  shortBio: Joi.string().trim().max(160).allow("").default(""),
  longBio: Joi.string().trim().max(2000).allow("").default(""),
  primaryCategory: Joi.string().trim().max(120).allow("").default(""),
  customCategory: Joi.string().trim().max(100).allow("").default(""),
  secondaryCategories: Joi.any().optional(),
  languages: Joi.any().optional(),
  country: Joi.string().trim().max(100).allow("").default(""),
  state: Joi.string().trim().max(100).allow("").default(""),
  city: Joi.string().trim().max(100).allow("").default(""),
  website: Joi.string().trim().uri({ scheme: ["http", "https"] }).allow("").default(""),
  contentNiche: Joi.any().optional(),
  contentStyle: Joi.any().optional(),
  storeName: Joi.string().trim().max(120).allow("").default(""),
  storeSlug: Joi.string().trim().max(100).allow("").default(""),
  metaTitle: Joi.string().trim().max(160).allow("").default(""),
  metaDescription: Joi.string().trim().max(300).allow("").default(""),
  socialSharingImage: Joi.string().trim().max(500).allow("").default(""),
  mediaTransforms: Joi.any().optional(),
});

const applicationQuerySchema = Joi.object({ applicationId: Joi.string().trim().max(40).required() });
const businessSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  country: Joi.string().trim().max(100).allow("").default(""),
  state: Joi.string().trim().max(100).allow("").default(""),
  city: Joi.string().trim().max(100).allow("").default(""),
  address1: Joi.string().trim().max(255).allow("").default(""),
  address2: Joi.string().trim().max(255).allow("").default(""),
  postalCode: Joi.string().trim().max(30).allow("").default(""),
  businessType: Joi.string().trim().max(80).allow("").default(""),
  customBusinessType: Joi.string().trim().max(100).allow("").default(""),
  gstNumber: Joi.string().trim().max(20).allow("").default(""),
  panNumber: Joi.string().trim().max(20).allow("").default(""),
  taxId: Joi.string().trim().max(80).allow("").default(""),
  businessRegistrationNumber: Joi.string().trim().max(100).allow("").default(""),
  legalName: Joi.string().trim().max(140).allow("").default(""),
  businessName: Joi.string().trim().max(140).allow("").default(""),
  dateOfBirth: Joi.string().trim().allow("").default(""),
  nationality: Joi.string().trim().max(100).allow("").default(""),
});

const paymentSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  country: Joi.string().trim().max(100).allow("").default(""),
  payoutMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "payoneer").required(),
  accountHolderName: Joi.string().trim().max(140).allow("").default(""),
  bankName: Joi.string().trim().max(140).allow("").default(""),
  branchName: Joi.string().trim().max(140).allow("").default(""),
  accountNumber: Joi.string().trim().max(40).allow("").default(""),
  confirmAccountNumber: Joi.string().trim().max(40).allow("").default(""),
  ifscCode: Joi.string().trim().max(20).allow("").default(""),
  swiftCode: Joi.string().trim().max(20).allow("").default(""),
  routingNumber: Joi.string().trim().max(30).allow("").default(""),
  upiId: Joi.string().trim().max(120).allow("").default(""),
  paypalEmail: Joi.string().trim().max(160).allow("").default(""),
  payoneerEmail: Joi.string().trim().max(160).allow("").default(""),
  agreements: Joi.any().optional(),
});

const contentReviewSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  portfolioUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).allow("").default(""),
  portfolioDescription: Joi.string().trim().max(1000).allow("").default(""),
  manualNiche: Joi.string().trim().max(80).allow("").default(""),
  brandCollaborations: Joi.any().optional(),
});

const reviewDecisionSchema = Joi.object({
  decision: Joi.string().valid("approve", "reject", "request_changes", "suspend", "request_documents", "note").required(),
  comments: Joi.string().trim().max(2000).allow("").default(""),
  stepKey: Joi.string().trim().valid("account_information", "social_verification", "profile_information", "business_information", "payment_information", "content_review").allow("").default(""),
  stepDecision: Joi.string().trim().valid("approved", "rejected", "changes_requested").allow("").default(""),
});
const approveSchema = Joi.object({
  applicationId: Joi.string().trim().max(40).required(),
  comments: Joi.string().trim().max(2000).allow("").default("Approved"),
});

const affiliateLinkSchema = Joi.object({
  targetType: Joi.string().valid("product", "collection", "campaign", "storefront", "custom").default("product"),
  targetPath: Joi.string().trim().max(600).allow("").default(""),
  url: Joi.string().trim().max(600).allow("").default(""),
  productId: Joi.string().allow("").optional(),
  campaignId: Joi.string().allow("").optional(),
});

const applicationListQuerySchema = Joi.object({
  status: Joi.string().trim().max(40).allow("").optional(),
  score: Joi.string().valid("high", "low", "").allow("").optional(),
  sort: Joi.string().valid("newest", "oldest").default("newest"),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const verificationQuerySchema = Joi.object({
  category: Joi.string().valid("identity", "tax", "bank", "compliance", "supporting", "content").allow("").optional(),
  status: Joi.string().allow("").optional(),
});

const verificationDocumentSchema = Joi.object({
  category: Joi.string().valid("identity", "tax", "bank", "compliance", "supporting").default("identity"),
  documentType: Joi.string().trim().max(80).default("identity_document"),
  documentNumber: Joi.string().trim().max(120).allow("").default(""),
  countryOfIssue: Joi.string().trim().max(100).allow("").default(""),
  country: Joi.string().trim().max(100).allow("").default(""),
  issueDate: Joi.date().iso().allow("", null).optional(),
  expiryDate: Joi.date().iso().allow("", null).optional(),
  side: Joi.string().trim().max(40).allow("").default(""),
});

const verificationTaxSchema = Joi.object({
  taxType: Joi.string().trim().max(80).allow("").default(""),
  taxNumber: Joi.string().trim().max(120).allow("").default(""),
  taxId: Joi.string().trim().max(120).allow("").default(""),
  panNumber: Joi.string().trim().max(20).allow("").default(""),
  gstNumber: Joi.string().trim().max(20).allow("").default(""),
  legalName: Joi.string().trim().max(140).allow("").default(""),
  businessName: Joi.string().trim().max(140).allow("").default(""),
  registeredAddress: Joi.string().trim().max(255).allow("").default(""),
  address1: Joi.string().trim().max(255).allow("").default(""),
  country: Joi.string().trim().max(100).allow("").default("IN"),
  state: Joi.string().trim().max(100).allow("").default(""),
  city: Joi.string().trim().max(100).allow("").default(""),
  postalCode: Joi.string().trim().max(30).allow("").default(""),
  businessType: Joi.string().trim().max(80).allow("").default("individual_creator"),
  businessRegistrationNumber: Joi.string().trim().max(100).allow("").default(""),
  dateOfBirth: Joi.date().iso().allow("", null).optional(),
  nationality: Joi.string().trim().max(100).allow("").default(""),
});

const verificationBankSchema = Joi.object({
  paymentMethod: Joi.string().valid("bank_transfer", "upi", "paypal", "stripe_connect", "wise", "manual").default("bank_transfer"),
  accountHolderName: Joi.string().trim().max(160).allow("", null),
  bankName: Joi.string().trim().max(160).allow("", null),
  branchName: Joi.string().trim().max(160).allow("", null),
  accountNumber: Joi.string().trim().max(40).allow("", null),
  ifscCode: Joi.string().trim().max(20).allow("", null),
  swiftCode: Joi.string().trim().max(20).allow("", null),
  iban: Joi.string().trim().max(60).allow("", null),
  routingNumber: Joi.string().trim().max(30).allow("", null),
  upiId: Joi.string().trim().max(160).allow("", null),
  paypalEmail: Joi.string().email().allow("", null),
  country: Joi.string().trim().max(100).allow("").default(""),
  currency: Joi.string().trim().max(10).allow("").default("INR"),
});

const profileSettingsSchema = Joi.object().unknown(true);
const servicePackageSchema = Joi.object({
  id: Joi.string().allow("").optional(),
  _id: Joi.string().allow("").optional(),
  packageName: Joi.string().trim().max(160).allow("").optional(),
  name: Joi.string().trim().max(160).allow("").optional(),
  label: Joi.string().trim().max(160).allow("").optional(),
  quantity: Joi.number().integer().min(1).default(1),
  price: Joi.number().min(0).default(0),
  currency: Joi.string().trim().max(8).default("INR"),
  deliveryDays: Joi.number().integer().min(0).default(0),
  deliveryLabel: Joi.string().trim().max(120).allow("").optional(),
  revisionCount: Joi.number().integer().min(0).default(0),
  description: Joi.string().trim().max(1200).allow("").default(""),
  status: Joi.string().valid("draft", "active", "inactive", "archived").default("active"),
  metadata: Joi.object().unknown(true).default({}),
}).unknown(true);
const serviceItemSchema = Joi.object({
  id: Joi.string().allow("").optional(),
  _id: Joi.string().allow("").optional(),
  serviceTypeId: Joi.string().allow("").optional(),
  serviceTypeKey: Joi.string().trim().max(120).allow("").optional(),
  serviceType: Joi.string().trim().max(120).allow("").optional(),
  key: Joi.string().trim().max(120).allow("").optional(),
  serviceName: Joi.string().trim().max(160).allow("").optional(),
  name: Joi.string().trim().max(160).allow("").optional(),
  serviceCategory: Joi.string().trim().max(120).allow("").optional(),
  category: Joi.string().trim().max(120).allow("").optional(),
  price: Joi.number().min(0).default(0),
  currency: Joi.string().trim().max(8).default("INR"),
  deliveryDays: Joi.number().integer().min(0).default(0),
  deliveryLabel: Joi.string().trim().max(120).allow("").optional(),
  revisionCount: Joi.number().integer().min(0).default(0),
  minimumNoticePeriod: Joi.number().integer().min(0).default(0),
  minNoticePeriod: Joi.number().integer().min(0).optional(),
  contentApprovalRequired: Joi.boolean().default(false),
  brandApprovalRequired: Joi.boolean().default(false),
  approvalRequired: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
  description: Joi.string().trim().max(1200).allow("").default(""),
  status: Joi.string().valid("draft", "active", "inactive", "archived").default("active"),
  packages: Joi.array().items(servicePackageSchema).max(50).optional(),
  metadata: Joi.object().unknown(true).default({}),
}).unknown(true);
const servicesSchema = Joi.object({
  replace: Joi.boolean().optional(),
  services: Joi.array().items(serviceItemSchema).max(100).default([]),
}).unknown(true);
const requirementsSchema = Joi.object({
  minimumBudget: Joi.number().min(0).default(0),
  minimumAttributionDays: Joi.number().integer().min(0).optional(),
  minimumAttributionWindow: Joi.number().integer().min(0).optional(),
  productRequired: Joi.boolean().default(false),
  sampleRequired: Joi.boolean().default(false),
  productReturnRequired: Joi.boolean().default(false),
  shippingRequired: Joi.boolean().default(false),
  brandGuidelinesRequired: Joi.boolean().default(false),
  creativeApprovalRequired: Joi.boolean().default(false),
  contentApprovalRequired: Joi.boolean().default(false),
  approvalRequired: Joi.boolean().optional(),
  languages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  categories: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  preferredCategories: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  targetAudience: Joi.string().trim().max(1200).allow("").default(""),
  deliveryTime: Joi.string().trim().max(160).allow("").default(""),
  communicationPreferences: Joi.string().trim().max(1200).allow("").default(""),
  location: Joi.object().unknown(true).optional(),
  shippingAddress: Joi.alternatives().try(Joi.object().unknown(true), Joi.string().allow("")).optional(),
  notes: Joi.string().trim().max(2000).allow("").default(""),
  customFields: Joi.object().unknown(true).default({}),
}).unknown(true);
const settingsPasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
const publicStorefrontQuery = Joi.object({
  tab: Joi.string().valid("storefront", "posts", "reels", "collections", "about").optional(),
  filter: Joi.string().allow("").optional(),
  sort: Joi.string().allow("").optional(),
  search: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(60).optional(),
});
const publicEventSchema = Joi.object({
  eventType: Joi.string().allow("").optional(),
  surface: Joi.string().allow("").optional(),
  anonymousId: Joi.string().allow("").optional(),
  productId: Joi.string().allow("").optional(),
  collectionId: Joi.string().allow("").optional(),
  reelId: Joi.string().allow("").optional(),
  postId: Joi.string().allow("").optional(),
  metadata: Joi.object().unknown(true).default({}),
});
const publicNewsletterSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  source: Joi.string().allow("").optional(),
});

router.get("/register/check-email", validate(availabilityEmailQuery, "query"), controller.checkEmail);
router.get("/register/check-username", validate(availabilityUsernameQuery, "query"), controller.checkUsername);
router.post("/register/save-draft", validate(stepOneSchema), controller.saveDraft);
router.post("/register/step-1", validate(stepOneSchema), controller.registerStepOne);
router.post("/social", validate(socialDraftSchema), controller.saveSocialDraft);
router.post("/social/save-draft", validate(socialDraftSchema), controller.saveSocialDraft);
router.get("/social/fetch-metrics", validate(socialMetricsQuery, "query"), controller.fetchSocialMetrics);
router.post("/social/verify", proofUpload.array("screenshots", 1), validate(socialVerifySchema), controller.verifySocial);
router.get("/social/status", validate(socialStatusQuery, "query"), controller.socialStatus);
router.get("/profile/check-slug", validate(profileSlugQuerySchema, "query"), controller.checkProfileSlug);
router.get("/profile/draft", validate(profileQuerySchema, "query"), controller.getProfileDraft);
router.post("/profile/save-draft", proofUpload.fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "coverBanner", maxCount: 1 },
  { name: "socialSharingImage", maxCount: 1 },
]), validate(profileSaveSchema), controller.saveProfileDraft);
router.post("/profile", proofUpload.fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "coverBanner", maxCount: 1 },
  { name: "socialSharingImage", maxCount: 1 },
]), validate(profileSaveSchema), controller.saveProfileStep);
router.get("/countries", controller.countries);
router.get("/commission-settings", controller.commissionSettings);
router.get("/business", validate(applicationQuerySchema, "query"), controller.getBusiness);
router.post("/business/save-draft", proofUpload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "businessRegistration", maxCount: 1 },
  { name: "taxRegistration", maxCount: 1 },
  { name: "addressProof", maxCount: 1 },
]), validate(businessSchema), controller.saveBusinessDraft);
router.post("/business", proofUpload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "businessRegistration", maxCount: 1 },
  { name: "taxRegistration", maxCount: 1 },
  { name: "addressProof", maxCount: 1 },
]), validate(businessSchema), controller.saveBusiness);
router.put("/business", proofUpload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "businessRegistration", maxCount: 1 },
  { name: "taxRegistration", maxCount: 1 },
  { name: "addressProof", maxCount: 1 },
]), validate(businessSchema), controller.saveBusiness);
router.get("/payment", validate(applicationQuerySchema, "query"), controller.getPayment);
router.post("/payment/save-draft", validate(paymentSchema), controller.savePaymentDraft);
router.post("/payment", validate(paymentSchema), controller.savePayment);
router.put("/payment", validate(paymentSchema), controller.savePayment);
router.post("/content-review", contentUpload.fields([
  { name: "sampleContent", maxCount: 12 },
  { name: "brandProofs", maxCount: 5 },
  { name: "identityDocuments", maxCount: 3 },
]), validate(contentReviewSchema), controller.saveContentReview);
router.post("/submit", contentUpload.fields([
  { name: "sampleContent", maxCount: 12 },
  { name: "brandProofs", maxCount: 5 },
  { name: "identityDocuments", maxCount: 3 },
]), validate(contentReviewSchema), controller.submitApplication);
router.get("/application-status", validate(applicationQuerySchema, "query"), controller.applicationStatus);
router.get("/application-status/:applicationId", controller.applicationStatus);
router.get("/application/:applicationId", controller.applicationStatus);
router.get("/storefront", authOptional, controller.storefront);
router.get("/public/:username", authOptional, validate(publicStorefrontQuery, "query"), controller.storefront);
router.get("/public/:username/:tab", authOptional, validate(publicStorefrontQuery, "query"), controller.storefront);
router.post("/public/:username/follow", authRequired, validate(Joi.object({ source: Joi.string().allow("").default("storefront") })), controller.followPublic);
router.delete("/public/:username/follow", authRequired, controller.unfollowPublic);
router.post("/public/:username/newsletter", validate(publicNewsletterSchema), controller.subscribePublicNewsletter);
router.post("/public/:username/events", authOptional, validate(publicEventSchema), controller.trackPublicEvent);
router.get("/storefront-builder", authRequired, requireRole("influencer"), controller.getStorefrontBuilder);
router.put("/storefront-builder", authRequired, requireRole("influencer"), validate(storefrontBuilderSchema), controller.updateStorefrontBuilder);
router.post("/storefront-builder/preview", authRequired, requireRole("influencer"), validate(storefrontBuilderSchema), controller.previewStorefrontBuilder);
router.get("/affiliate-products", authRequired, requireRole("influencer"), validate(affiliateProductQuery, "query"), controller.listAffiliateProducts);
router.get("/affiliate-products/recommended", authRequired, requireRole("influencer"), validate(affiliateProductQuery, "query"), controller.recommendedAffiliateProducts);
router.get("/affiliate-products/saved", authRequired, requireRole("influencer"), validate(affiliateProductQuery, "query"), controller.savedAffiliateProducts);
router.get("/affiliate-products/analytics", authRequired, requireRole("influencer"), validate(affiliateProductQuery, "query"), controller.affiliateProductAnalytics);
router.patch("/affiliate-products/:productId/save", authRequired, requireRole("influencer"), validate(affiliateSaveSchema), controller.saveAffiliateProduct);
router.post("/affiliate-products/links", authRequired, requireRole("influencer"), validate(affiliateLinkBulkSchema), controller.generateAffiliateProductLinks);
router.post(
  "/collections/media",
  authRequired,
  requireRole("influencer"),
  collectionMediaUpload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  controller.uploadCollectionMedia
);
router.get("/collections/products", authRequired, requireRole("influencer"), validate(collectionProductQuery, "query"), controller.collectionProducts);
router.get("/collections/analytics", authRequired, requireRole("influencer"), validate(collectionAnalyticsQuery, "query"), controller.collectionAnalytics);
router.get("/collections", authRequired, requireRole("influencer"), validate(collectionListQuery, "query"), controller.listCollections);
router.post("/collections", authRequired, requireRole("influencer"), validate(collectionSchema), controller.createCollection);
router.get("/collections/:id", authRequired, requireRole("influencer"), controller.getCollection);
router.put("/collections/:id", authRequired, requireRole("influencer"), validate(collectionSchema), controller.updateCollection);
router.patch("/collections/:id/status", authRequired, requireRole("influencer"), validate(collectionStatusSchema), controller.updateCollectionStatus);
router.delete("/collections/:id", authRequired, requireRole("influencer"), controller.deleteCollection);
router.post("/collections/:id/products", authRequired, requireRole("influencer"), validate(collectionAssignmentSchema), controller.assignCollectionProducts);
router.post("/register", authRequired, requireRole("influencer", "user"), validate(saveSchema), controller.register);
router.get("/profile", authRequired, requireRole("influencer"), controller.profile);
router.put("/profile", authRequired, requireRole("influencer"), validate(saveSchema), controller.update);
router.get("/commerce-profile", authRequired, requireRole("influencer"), controller.commerceProfile);
router.get("/services", authRequired, requireRole("influencer"), controller.commerceProfile);
router.put("/services", authRequired, requireRole("influencer"), validate(servicesSchema), controller.saveServices);
router.get("/requirements", authRequired, requireRole("influencer"), controller.commerceProfile);
router.put("/requirements", authRequired, requireRole("influencer"), validate(requirementsSchema), controller.saveRequirements);
router.post("/generate-affiliate-link", authRequired, requireRole("influencer"), validate(affiliateLinkSchema), controller.generateAffiliateLink);
router.get("/dashboard", authRequired, requireRole("influencer"), validate(dashboardQuery, "query"), controller.dashboard);
router.get("/earnings", authRequired, requireRole("influencer"), validate(earningsQuery, "query"), controller.earnings);
router.get("/verification", authRequired, requireRole("influencer"), validate(verificationQuerySchema, "query"), controller.verificationCenter);
router.get("/profile-settings", authRequired, requireRole("influencer"), controller.profileSettings);
router.patch("/profile-settings/:section", authRequired, requireRole("influencer"), validate(profileSettingsSchema), controller.updateProfileSettings);
router.get("/profile-settings/security/sessions", authRequired, requireRole("influencer"), controller.settingsSessions);
router.delete("/profile-settings/security/sessions/:id", authRequired, requireRole("influencer"), controller.settingsRevokeSession);
router.post("/profile-settings/security/change-password", authRequired, requireRole("influencer"), validate(settingsPasswordSchema), controller.settingsChangePassword);
router.post("/verification/documents", authRequired, requireRole("influencer"), verificationUpload.array("documents", 6), validate(verificationDocumentSchema), controller.uploadVerificationDocuments);
router.post("/verification/tax", authRequired, requireRole("influencer"), proofUpload.fields([
  { name: "taxCertificate", maxCount: 1 },
  { name: "gstCertificate", maxCount: 1 },
  { name: "businessRegistration", maxCount: 1 },
  { name: "taxRegistration", maxCount: 1 },
  { name: "addressProof", maxCount: 1 },
]), validate(verificationTaxSchema), controller.saveVerificationTax);
router.post("/verification/bank", authRequired, requireRole("influencer"), validate(verificationBankSchema), controller.saveVerificationBank);
router.get("/list", authOptional, controller.list);
router.get("/admin/list", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.list);
router.get("/admin/applications", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(applicationListQuerySchema, "query"), controller.adminApplications);
router.get("/admin/application/:applicationId", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.adminApplication);
router.patch("/admin/application/:applicationId/review", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(reviewDecisionSchema), controller.reviewApplication);
router.post("/approve", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(approveSchema), controller.approveApplication);
router.patch("/admin/:id/status", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(moderateSchema), controller.moderate);

module.exports = router;
