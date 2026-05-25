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
    const documentFields = new Set(["gstCertificate", "businessRegistration", "taxRegistration", "addressProof"]);
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
});

const earningsQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().valid("CREDIT", "DEBIT").optional(),
  source: Joi.string().valid("COMMISSION", "REVERSAL").optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
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
});

const applicationListQuerySchema = Joi.object({
  status: Joi.string().trim().max(40).allow("").optional(),
  score: Joi.string().valid("high", "low", "").allow("").optional(),
  sort: Joi.string().valid("newest", "oldest").default("newest"),
  limit: Joi.number().integer().min(1).max(100).optional(),
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
router.post("/register", authRequired, requireRole("influencer", "user"), validate(saveSchema), controller.register);
router.get("/profile", authRequired, requireRole("influencer"), controller.profile);
router.put("/profile", authRequired, requireRole("influencer"), validate(saveSchema), controller.update);
router.get("/activation/welcome", authRequired, requireRole("influencer"), controller.activationWelcome);
router.post("/generate-affiliate-link", authRequired, requireRole("influencer"), validate(affiliateLinkSchema), controller.generateAffiliateLink);
router.get("/analytics", authRequired, requireRole("influencer"), controller.analytics);
router.get("/dashboard", authRequired, requireRole("influencer"), validate(dashboardQuery, "query"), controller.dashboard);
router.get("/earnings", authRequired, requireRole("influencer"), validate(earningsQuery, "query"), controller.earnings);
router.get("/list", controller.list);
router.get("/admin/list", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.list);
router.get("/admin/applications", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(applicationListQuerySchema, "query"), controller.adminApplications);
router.get("/admin/application/:applicationId", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), controller.adminApplication);
router.patch("/admin/application/:applicationId/review", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(reviewDecisionSchema), controller.reviewApplication);
router.post("/approve", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(approveSchema), controller.approveApplication);
router.patch("/admin/:id/status", authRequired, requireRole("admin", "super_admin", "support_admin", "finance_admin"), validate(moderateSchema), controller.moderate);

module.exports = router;
