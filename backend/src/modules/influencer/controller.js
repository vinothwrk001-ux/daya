const { ok } = require("../../utils/apiResponse");
const { asyncHandler } = require("../../utils/asyncHandler");
const influencerService = require("./service");
const commissionService = require("../commission/service");

const checkEmail = asyncHandler(async (req, res) =>
  ok(res, await influencerService.checkEmail(req.query.email), "Email availability checked")
);
const checkUsername = asyncHandler(async (req, res) =>
  ok(res, await influencerService.checkUsername(req.query.username), "Username availability checked")
);
const saveDraft = asyncHandler(async (req, res) =>
  ok(
    res,
    await influencerService.saveStepOneDraft(req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    }),
    "Influencer registration draft saved"
  )
);
const saveSocialDraft = asyncHandler(async (req, res) =>
  ok(res, await influencerService.saveSocialDraft(req.body), "Influencer social draft saved")
);
const fetchSocialMetrics = asyncHandler(async (req, res) =>
  ok(res, await influencerService.fetchSocialMetrics(req.query), "Influencer social metrics checked")
);
const verifySocial = asyncHandler(async (req, res) =>
  ok(res, await influencerService.verifySocial(req.body, req.files || []), "Influencer social verification saved", 201)
);
const socialStatus = asyncHandler(async (req, res) =>
  ok(res, await influencerService.getSocialStatus(req.query.applicationId), "Influencer social status loaded")
);
const checkProfileSlug = asyncHandler(async (req, res) =>
  ok(res, await influencerService.checkProfileSlug(req.query.slug, req.query.applicationId), "Influencer profile slug checked")
);
const getProfileDraft = asyncHandler(async (req, res) =>
  ok(res, await influencerService.getProfileDraft(req.query.applicationId), "Influencer profile draft loaded")
);
const saveProfileDraft = asyncHandler(async (req, res) =>
  ok(res, await influencerService.saveProfileDraft(req.body, req.files || [], { submit: false }), "Influencer profile draft saved")
);
const saveProfileStep = asyncHandler(async (req, res) =>
  ok(res, await influencerService.saveProfileDraft(req.body, req.files || [], { submit: true }), "Influencer profile information saved", 201)
);
const countries = asyncHandler(async (_req, res) => ok(res, influencerService.getCountryMaster(), "Country master loaded"));
const commissionSettings = asyncHandler(async (_req, res) => ok(res, influencerService.getCommissionSettings(), "Commission settings loaded"));
const getBusiness = asyncHandler(async (req, res) => ok(res, await influencerService.getBusiness(req.query.applicationId), "Influencer business loaded"));
const saveBusinessDraft = asyncHandler(async (req, res) => ok(res, await influencerService.saveBusiness(req.body, req.files || [], { submit: false }), "Influencer business draft saved"));
const saveBusiness = asyncHandler(async (req, res) => ok(res, await influencerService.saveBusiness(req.body, req.files || [], { submit: true }), "Influencer business saved", 201));
const getPayment = asyncHandler(async (req, res) => ok(res, await influencerService.getPayment(req.query.applicationId), "Influencer payment loaded"));
const savePaymentDraft = asyncHandler(async (req, res) => ok(res, await influencerService.savePayment(req.body, { submit: false }), "Influencer payment draft saved"));
const savePayment = asyncHandler(async (req, res) => ok(res, await influencerService.savePayment(req.body, { submit: true }), "Influencer payment saved", 201));
const saveContentReview = asyncHandler(async (req, res) => ok(res, await influencerService.saveContentReview(req.body, req.files || [], { submit: false }), "Influencer content review draft saved"));
const submitApplication = asyncHandler(async (req, res) => ok(res, await influencerService.saveContentReview(req.body, req.files || [], { submit: true }), "Influencer application submitted", 201));
const applicationStatus = asyncHandler(async (req, res) => ok(res, await influencerService.getApplicationStatus(req.query.applicationId || req.params.applicationId), "Influencer application status loaded"));
const adminApplications = asyncHandler(async (req, res) => ok(res, await influencerService.listApplications(req.query), "Influencer applications loaded"));
const adminApplication = asyncHandler(async (req, res) => ok(res, await influencerService.getApplicationReview(req.params.applicationId), "Influencer application loaded"));
const reviewApplication = asyncHandler(async (req, res) => ok(res, await influencerService.reviewApplication(req.params.applicationId, req.body, req.user?.sub), "Influencer application reviewed"));
const approveApplication = asyncHandler(async (req, res) => ok(res, await influencerService.reviewApplication(req.body.applicationId, { decision: "approve", comments: req.body.comments || "Approved" }, req.user?.sub), "Influencer approved and activated", 201));
const activationWelcome = asyncHandler(async (req, res) => ok(res, await influencerService.getWelcomeForUser(req.user.sub), "Influencer activation loaded"));
const storefront = asyncHandler(async (req, res) => ok(res, await influencerService.getStorefront({
  slug: req.query.slug || req.params.username,
  username: req.params.username,
  userId: req.user?.sub,
  tab: req.params.tab || req.query.tab || "storefront",
  filter: req.query.filter || req.query.sort || "",
  search: req.query.search || "",
  page: req.query.page,
  limit: req.query.limit,
}), "Influencer storefront loaded"));
const followPublic = asyncHandler(async (req, res) => ok(res, await influencerService.followPublicStorefront(req.params.username, req.user?.sub, req.body.source), "Influencer followed"));
const unfollowPublic = asyncHandler(async (req, res) => ok(res, await influencerService.unfollowPublicStorefront(req.params.username, req.user?.sub), "Influencer unfollowed"));
const subscribePublicNewsletter = asyncHandler(async (req, res) => ok(res, await influencerService.subscribePublicNewsletter(req.params.username, req.body), "Newsletter subscription saved", 201));
const trackPublicEvent = asyncHandler(async (req, res) => ok(res, await influencerService.trackPublicEvent(req.params.username, req.user?.sub, req.body), "Influencer event tracked", 201));
const getStorefrontBuilder = asyncHandler(async (req, res) => ok(res, await influencerService.getStorefrontBuilder(req.user.sub), "Storefront builder loaded"));
const updateStorefrontBuilder = asyncHandler(async (req, res) => ok(res, await influencerService.updateStorefrontBuilder(req.user.sub, req.body), "Storefront builder saved"));
const previewStorefrontBuilder = asyncHandler(async (req, res) => ok(res, await influencerService.previewStorefrontBuilder(req.user.sub, req.body), "Storefront preview generated"));
const generateAffiliateLink = asyncHandler(async (req, res) => ok(res, await influencerService.generateAffiliateLink(req.user.sub, req.body), "Affiliate link generated", 201));
const listAffiliateProducts = asyncHandler(async (req, res) => ok(res, await influencerService.listAffiliateProducts(req.user.sub, req.query), "Affiliate products loaded"));
const recommendedAffiliateProducts = asyncHandler(async (req, res) => ok(res, await influencerService.listRecommendedAffiliateProducts(req.user.sub, req.query), "Recommended affiliate products loaded"));
const savedAffiliateProducts = asyncHandler(async (req, res) => ok(res, await influencerService.listSavedAffiliateProducts(req.user.sub, req.query), "Saved affiliate products loaded"));
const saveAffiliateProduct = asyncHandler(async (req, res) => ok(res, await influencerService.saveAffiliateProduct(req.user.sub, req.params.productId, req.body.saved !== false), "Affiliate product saved"));
const generateAffiliateProductLinks = asyncHandler(async (req, res) => ok(res, await influencerService.generateAffiliateProductLinks(req.user.sub, req.body), "Affiliate product links generated", 201));
const affiliateProductAnalytics = asyncHandler(async (req, res) => ok(res, await influencerService.getAffiliateProductAnalytics(req.user.sub, req.query), "Affiliate product analytics loaded"));
const analytics = asyncHandler(async (req, res) => ok(res, await influencerService.getAnalytics(req.user.sub), "Influencer analytics loaded"));
const listCollections = asyncHandler(async (req, res) => ok(res, await influencerService.listCollections(req.user.sub, req.query), "Influencer collections loaded"));
const getCollection = asyncHandler(async (req, res) => ok(res, await influencerService.getCollection(req.user.sub, req.params.id), "Influencer collection loaded"));
const createCollection = asyncHandler(async (req, res) => ok(res, await influencerService.saveCollection(req.user.sub, req.body), "Influencer collection created", 201));
const updateCollection = asyncHandler(async (req, res) => ok(res, await influencerService.saveCollection(req.user.sub, req.body, req.params.id), "Influencer collection updated"));
const updateCollectionStatus = asyncHandler(async (req, res) => ok(res, await influencerService.updateCollectionStatus(req.user.sub, req.params.id, req.body), "Influencer collection status updated"));
const assignCollectionProducts = asyncHandler(async (req, res) => ok(res, await influencerService.assignCollectionProducts(req.user.sub, req.params.id, req.body), "Influencer collection products updated"));
const collectionAnalytics = asyncHandler(async (req, res) => ok(res, await influencerService.getCollectionAnalytics(req.user.sub, req.query), "Influencer collection analytics loaded"));
const collectionProducts = asyncHandler(async (req, res) => ok(res, await influencerService.listCollectionProducts(req.user.sub, req.query), "Collection product catalog loaded"));
const registerStepOne = asyncHandler(async (req, res) =>
  ok(
    res,
    await influencerService.registerStepOne(req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    }),
    "Influencer registration step 1 saved",
    201
  )
);
const register = asyncHandler(async (req, res) => ok(res, await influencerService.register(req.user.sub, req.body), "Influencer profile saved"));
const profile = asyncHandler(async (req, res) => ok(res, await influencerService.getProfile(req.user.sub), "Influencer profile loaded"));
const update = asyncHandler(async (req, res) => ok(res, await influencerService.updateProfile(req.user.sub, req.body), "Influencer profile updated"));
const list = asyncHandler(async (req, res) => ok(res, await influencerService.list(req.query, req.user?.sub), "Influencers loaded"));
const moderate = asyncHandler(async (req, res) => ok(res, await influencerService.moderate(req.params.id, req.body), "Influencer status updated"));
const dashboard = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerDashboard(req.user.sub, req.query), "Influencer dashboard loaded")
);
const earnings = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerEarnings(req.user.sub, req.query), "Influencer earnings loaded")
);
const verificationCenter = asyncHandler(async (req, res) =>
  ok(res, await influencerService.getVerificationCenter(req.user.sub, req.query), "Influencer verification loaded")
);
const profileSettings = asyncHandler(async (req, res) =>
  ok(res, await influencerService.getProfileSettings(req.user.sub), "Influencer profile settings loaded")
);
const updateProfileSettings = asyncHandler(async (req, res) =>
  ok(
    res,
    await influencerService.updateProfileSettings(req.user.sub, req.params.section, req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Influencer profile settings saved"
  )
);
const settingsSessions = asyncHandler(async (req, res) => ok(res, await require("../../services/user.service").listSessions(req.user.sub), "Sessions loaded"));
const settingsRevokeSession = asyncHandler(async (req, res) =>
  ok(
    res,
    await require("../../services/user.service").revokeSession(req.user.sub, req.params.id, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Session revoked"
  )
);
const settingsChangePassword = asyncHandler(async (req, res) =>
  ok(
    res,
    await require("../../services/user.service").changePassword(req.user.sub, req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Password changed"
  )
);
const uploadVerificationDocuments = asyncHandler(async (req, res) =>
  ok(res, await influencerService.uploadVerificationDocuments(req.user.sub, req.body, req.files || []), "Verification documents uploaded", 201)
);
const saveVerificationTax = asyncHandler(async (req, res) =>
  ok(res, await influencerService.saveVerificationTax(req.user.sub, req.body, req.files || []), "Tax information submitted")
);
const saveVerificationBank = asyncHandler(async (req, res) =>
  ok(
    res,
    await commissionService.upsertInfluencerPayoutAccount(req.user.sub, req.body, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }),
    "Bank information submitted"
  )
);

module.exports = {
  checkEmail,
  checkUsername,
  saveDraft,
  saveSocialDraft,
  fetchSocialMetrics,
  verifySocial,
  socialStatus,
  checkProfileSlug,
  getProfileDraft,
  saveProfileDraft,
  saveProfileStep,
  countries,
  commissionSettings,
  getBusiness,
  saveBusinessDraft,
  saveBusiness,
  getPayment,
  savePaymentDraft,
  savePayment,
  saveContentReview,
  submitApplication,
  applicationStatus,
  adminApplications,
  adminApplication,
  reviewApplication,
  approveApplication,
  activationWelcome,
  storefront,
  followPublic,
  unfollowPublic,
  subscribePublicNewsletter,
  trackPublicEvent,
  getStorefrontBuilder,
  updateStorefrontBuilder,
  previewStorefrontBuilder,
  generateAffiliateLink,
  listAffiliateProducts,
  recommendedAffiliateProducts,
  savedAffiliateProducts,
  saveAffiliateProduct,
  generateAffiliateProductLinks,
  affiliateProductAnalytics,
  analytics,
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  updateCollectionStatus,
  assignCollectionProducts,
  collectionAnalytics,
  collectionProducts,
  registerStepOne,
  register,
  profile,
  update,
  list,
  moderate,
  dashboard,
  earnings,
  verificationCenter,
  profileSettings,
  updateProfileSettings,
  settingsSessions,
  settingsRevokeSession,
  settingsChangePassword,
  uploadVerificationDocuments,
  saveVerificationTax,
  saveVerificationBank,
};
