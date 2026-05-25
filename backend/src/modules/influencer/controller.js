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
const storefront = asyncHandler(async (req, res) => ok(res, await influencerService.getStorefront({ slug: req.query.slug, userId: req.user?.sub }), "Influencer storefront loaded"));
const generateAffiliateLink = asyncHandler(async (req, res) => ok(res, await influencerService.generateAffiliateLink(req.user.sub, req.body), "Affiliate link generated", 201));
const analytics = asyncHandler(async (req, res) => ok(res, await influencerService.getAnalytics(req.user.sub), "Influencer analytics loaded"));
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
const list = asyncHandler(async (req, res) => ok(res, await influencerService.list(req.query), "Influencers loaded"));
const moderate = asyncHandler(async (req, res) => ok(res, await influencerService.moderate(req.params.id, req.body), "Influencer status updated"));
const dashboard = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerDashboard(req.user.sub), "Influencer dashboard loaded")
);
const earnings = asyncHandler(async (req, res) =>
  ok(res, await commissionService.getInfluencerEarnings(req.user.sub, req.query), "Influencer earnings loaded")
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
  generateAffiliateLink,
  analytics,
  registerStepOne,
  register,
  profile,
  update,
  list,
  moderate,
  dashboard,
  earnings,
};
