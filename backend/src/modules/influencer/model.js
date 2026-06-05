const mongoose = require("mongoose");
const { INFLUENCER_CATEGORIES, INFLUENCER_STATES } = require("../shared/constants");

const influencerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    categories: {
      type: [{ type: String, enum: INFLUENCER_CATEGORIES }],
      default: [],
    },
    state: {
      type: String,
      enum: INFLUENCER_STATES,
      default: "draft",
      index: true,
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    followers: { type: Number, min: 0, default: 0 },
    verified: { type: Boolean, default: false, index: true },
    influencerCode: { type: String, trim: true, unique: true, sparse: true, index: true },
    permissions: {
      dashboard: { type: Boolean, default: false },
      storefront: { type: Boolean, default: false },
      affiliateLinks: { type: Boolean, default: false },
      collections: { type: Boolean, default: false },
      wallet: { type: Boolean, default: false },
      campaigns: { type: Boolean, default: false },
    },
    activation: {
      activatedAt: { type: Date },
      checklist: {
        bannerUploaded: { type: Boolean, default: false },
        profilePhotoUploaded: { type: Boolean, default: false },
        bioCompleted: { type: Boolean, default: false },
        firstCollectionCreated: { type: Boolean, default: false },
        firstAffiliateLinkGenerated: { type: Boolean, default: false },
        storefrontShared: { type: Boolean, default: false },
      },
    },
    bio: { type: String, trim: true, maxlength: 1200, default: "" },
    socialHandles: {
      instagram: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
    },
    profilePicture: { type: String, trim: true, default: "" },
    coverBanner: { type: String, trim: true, default: "" },
    displayName: { type: String, trim: true, maxlength: 100, default: "" },
    shortBio: { type: String, trim: true, maxlength: 160, default: "" },
    longBio: { type: String, trim: true, maxlength: 2000, default: "" },
    primaryCategory: { type: String, trim: true, default: "" },
    customCategory: { type: String, trim: true, maxlength: 100, default: "" },
    secondaryCategories: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    location: {
      country: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
    },
    website: { type: String, trim: true, default: "" },
    contentNiche: { type: [String], default: [] },
    contentStyle: { type: [String], default: [] },
    storeName: { type: String, trim: true, maxlength: 120, default: "" },
    storeSlug: { type: String, trim: true, lowercase: true },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      socialSharingImage: { type: String, trim: true, default: "" },
    },
    stats: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      sales: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
    },
    preferences: {
      autoWithdraw: { type: Boolean, default: false },
      minimumPayoutThreshold: { type: Number, min: 0, default: 500 },
      currencyPreference: { type: String, trim: true, default: "INR" },
      themeMode: { type: String, enum: ["light", "dark", "system"], default: "system" },
    },
    privacy: {
      profileVisibility: { type: String, enum: ["public", "followers_only", "private"], default: "public", index: true },
      showBio: { type: Boolean, default: true },
      showFollowersCount: { type: Boolean, default: true },
      showStorefront: { type: Boolean, default: true },
      showCollections: { type: Boolean, default: true },
      showProducts: { type: Boolean, default: true },
      showCampaignHistory: { type: Boolean, default: false },
      profileIndexing: { type: Boolean, default: true },
      searchVisibility: { type: Boolean, default: true },
      analyticsSharing: { type: Boolean, default: true },
      marketingPreferences: { type: Boolean, default: false },
    },
    connectedAccounts: {
      type: [
        {
          provider: { type: String, trim: true, lowercase: true, index: true },
          accountName: { type: String, trim: true, default: "" },
          status: { type: String, enum: ["connected", "disconnected", "expired", "reauthorize_required"], default: "connected" },
          connectedAt: { type: Date, default: Date.now },
          tokenExpiresAt: { type: Date },
          scopes: { type: [String], default: [] },
          metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
    },
    moderation: {
      submittedAt: { type: Date },
      verifiedAt: { type: Date },
      suspendedAt: { type: Date },
      notes: { type: String, trim: true, default: "" },
    },
  },
  {
    timestamps: true,
    collection: "influencer_profiles",
  }
);

const influencerApplicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    mobile: { type: String, required: true, trim: true, maxlength: 30 },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      minlength: 3,
      maxlength: 30,
    },
    passwordHash: { type: String, required: true, select: false },
    referralCode: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    status: {
      type: String,
      enum: ["draft", "submitted", "under_review", "pending_documents", "verification_in_progress", "approved", "rejected", "suspended", "requires_changes"],
      default: "draft",
      index: true,
    },
    currentStep: { type: Number, min: 1, max: 6, default: 1 },
    applicationNumber: { type: String, trim: true, unique: true, sparse: true, index: true },
    creatorScore: { type: Number, min: 0, max: 100, default: 0 },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    reviewNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    reviewStage: {
      type: String,
      enum: ["draft", "submitted", "identity_verification", "social_verification", "content_evaluation", "manual_review", "final_decision"],
      default: "draft",
      index: true,
    },
    contentReview: {
      portfolioUrl: { type: String, trim: true, default: "" },
      portfolioDescription: { type: String, trim: true, maxlength: 1000, default: "" },
      detectedNiche: { type: String, trim: true, default: "" },
      manualNiche: { type: String, trim: true, default: "" },
      brandCollaborations: {
        type: [
          {
            brandName: { type: String, trim: true, maxlength: 120, default: "" },
            campaignName: { type: String, trim: true, maxlength: 160, default: "" },
            campaignType: { type: String, trim: true, maxlength: 80, default: "" },
            campaignDate: { type: String, trim: true, default: "" },
            campaignResults: { type: String, trim: true, maxlength: 500, default: "" },
            proofPath: { type: String, trim: true, default: "" },
          },
        ],
        default: [],
      },
      qualityScores: {
        contentQuality: { type: Number, min: 0, max: 100, default: 0 },
        audienceQuality: { type: Number, min: 0, max: 100, default: 0 },
        engagement: { type: Number, min: 0, max: 100, default: 0 },
        profileCompleteness: { type: Number, min: 0, max: 100, default: 0 },
        verification: { type: Number, min: 0, max: 100, default: 0 },
        overall: { type: Number, min: 0, max: 100, default: 0 },
        level: { type: String, trim: true, default: "Starter Creator" },
      },
      aiReview: {
        status: { type: String, enum: ["not_started", "queued", "passed", "flagged", "manual_review_required"], default: "not_started" },
        flags: { type: [String], default: [] },
      },
    },
    termsAccepted: { type: Boolean, default: false },
    privacyAccepted: { type: Boolean, default: false },
    notificationsAccepted: { type: Boolean, default: false },
    draftMeta: {
      userAgent: { type: String, trim: true, default: "" },
      ipAddress: { type: String, trim: true, default: "" },
      lastSavedAt: { type: Date },
    },
    profileDraft: {
      profilePicture: { type: String, trim: true, default: "" },
      coverBanner: { type: String, trim: true, default: "" },
      displayName: { type: String, trim: true, maxlength: 100, default: "" },
      shortBio: { type: String, trim: true, maxlength: 160, default: "" },
      longBio: { type: String, trim: true, maxlength: 2000, default: "" },
      primaryCategory: { type: String, trim: true, default: "" },
      customCategory: { type: String, trim: true, maxlength: 100, default: "" },
      secondaryCategories: { type: [String], default: [] },
      languages: { type: [String], default: [] },
      country: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      contentNiche: { type: [String], default: [] },
      contentStyle: { type: [String], default: [] },
      storeName: { type: String, trim: true, maxlength: 120, default: "" },
      storeSlug: { type: String, trim: true, lowercase: true, default: "" },
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      socialSharingImage: { type: String, trim: true, default: "" },
      mediaTransforms: {
        profilePicture: {
          zoom: { type: Number, min: 1, max: 3, default: 1 },
          rotation: { type: Number, min: -360, max: 360, default: 0 },
        },
        coverBanner: {
          zoom: { type: Number, min: 1, max: 3, default: 1 },
          rotation: { type: Number, min: -360, max: 360, default: 0 },
        },
      },
    },
  },
  {
    timestamps: true,
    collection: "influencer_applications",
  }
);

const socialMetricsSchema = new mongoose.Schema(
  {
    subscribers: { type: Number, min: 0, default: 0 },
    averageLikes: { type: Number, min: 0, default: 0 },
    averageComments: { type: Number, min: 0, default: 0 },
    averageViews: { type: Number, min: 0, default: 0 },
    contentCount: { type: Number, min: 0, default: 0 },
    accountAgeDays: { type: Number, min: 0, default: 0 },
    verificationBadge: { type: Boolean, default: false },
  },
  { _id: false }
);

const influencerSocialAccountSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, trim: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    platform: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      index: true,
    },
    platformLabel: { type: String, trim: true, maxlength: 80, default: "" },
    profileUrl: { type: String, required: true, trim: true, maxlength: 500 },
    username: { type: String, trim: true, maxlength: 100, default: "" },
    channelName: { type: String, trim: true, maxlength: 140, default: "" },
    accountType: { type: String, enum: ["creator", "business", "personal", ""], default: "" },
    followersCount: { type: Number, min: 0, default: 0 },
    engagementRate: { type: Number, min: 0, max: 100, default: 0 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    metrics: { type: socialMetricsSchema, default: () => ({}) },
    verificationStatus: {
      type: String,
      enum: ["draft", "pending", "verified", "rejected", "under_review", "manual_review_required"],
      default: "draft",
      index: true,
    },
    verifiedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "influencer_social_accounts",
  }
);

const influencerSocialVerificationSchema = new mongoose.Schema(
  {
    socialAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InfluencerSocialAccount",
      required: true,
      index: true,
    },
    applicationId: { type: String, required: true, trim: true, index: true },
    verificationMethod: {
      type: String,
      enum: ["automatic", "verification_code", "screenshot"],
      required: true,
    },
    verificationCode: { type: String, trim: true, maxlength: 80, default: "" },
    screenshotPath: { type: String, trim: true, default: "" },
    screenshotMeta: {
      originalName: { type: String, trim: true, default: "" },
      mimeType: { type: String, trim: true, default: "" },
      size: { type: Number, min: 0, default: 0 },
    },
    status: {
      type: String,
      enum: ["draft", "pending", "verified", "rejected", "under_review", "manual_review_required"],
      default: "pending",
      index: true,
    },
    reviewNotes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  {
    timestamps: true,
    collection: "influencer_social_verifications",
  }
);

const influencerBusinessProfileSchema = new mongoose.Schema(
  {
    applicationId: { type: String, trim: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    country: { type: String, trim: true, required: true },
    state: { type: String, trim: true, required: true },
    city: { type: String, trim: true, required: true },
    address1: { type: String, trim: true, maxlength: 255, required: true },
    address2: { type: String, trim: true, maxlength: 255, default: "" },
    postalCode: { type: String, trim: true, required: true },
    businessType: { type: String, trim: true, required: true },
    customBusinessType: { type: String, trim: true, maxlength: 100, default: "" },
    gstNumberEncrypted: { type: String, trim: true, default: "" },
    panNumberEncrypted: { type: String, trim: true, default: "" },
    taxIdEncrypted: { type: String, trim: true, default: "" },
    businessRegistrationNumber: { type: String, trim: true, default: "" },
    legalName: { type: String, trim: true, required: true },
    businessName: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, required: true },
    nationality: { type: String, trim: true, required: true },
    documents: {
      gstCertificate: { type: String, trim: true, default: "" },
      businessRegistration: { type: String, trim: true, default: "" },
      taxRegistration: { type: String, trim: true, default: "" },
      addressProof: { type: String, trim: true, default: "" },
    },
    status: { type: String, enum: ["draft", "pending", "verified", "rejected"], default: "draft", index: true },
  },
  { timestamps: true, collection: "influencer_business_profiles" }
);

const influencerPaymentProfileSchema = new mongoose.Schema(
  {
    applicationId: { type: String, trim: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    payoutMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "paypal", "stripe_connect", "wise", "payoneer"],
      required: true,
      index: true,
    },
    accountHolderName: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    accountNumberEncrypted: { type: String, trim: true, default: "" },
    accountNumberMask: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, uppercase: true, default: "" },
    swiftCode: { type: String, trim: true, uppercase: true, default: "" },
    routingNumber: { type: String, trim: true, default: "" },
    upiIdEncrypted: { type: String, trim: true, default: "" },
    paypalEmailEncrypted: { type: String, trim: true, default: "" },
    payoneerEmailEncrypted: { type: String, trim: true, default: "" },
    agreements: {
      payoutPolicy: { type: Boolean, default: false },
      commissionTerms: { type: Boolean, default: false },
      taxCompliance: { type: Boolean, default: false },
    },
    commissionSnapshot: {
      commissionPercentage: { type: Number, min: 0, default: 10 },
      commissionModel: { type: String, trim: true, default: "Per Sale" },
      minimumPayoutThreshold: { type: Number, min: 0, default: 500 },
      payoutSchedule: { type: String, trim: true, default: "Monthly" },
      currency: { type: String, trim: true, default: "INR" },
    },
    status: { type: String, enum: ["draft", "pending", "verified", "rejected"], default: "draft", index: true },
  },
  { timestamps: true, collection: "influencer_payment_profiles" }
);

const influencerApplicationDocumentSchema = new mongoose.Schema(
  {
    applicationId: { type: String, trim: true, index: true },
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    category: {
      type: String,
      enum: ["identity", "tax", "bank", "compliance", "supporting", "content"],
      default: "supporting",
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        "sample_content",
        "brand_collaboration",
        "identity_document",
        "passport",
        "national_id",
        "driver_license",
        "residence_permit",
        "voter_id",
        "business_registration",
        "company_incorporation",
        "pan",
        "gst",
        "tin",
        "vat",
        "ssn",
        "ein",
        "tax_certificate",
        "bank_statement",
        "cancelled_cheque",
        "address_proof",
        "supporting_document",
      ],
      required: true,
      index: true,
    },
    documentNumberEncrypted: { type: String, trim: true, default: "" },
    countryOfIssue: { type: String, trim: true, default: "" },
    issueDate: { type: Date },
    expiryDate: { type: Date, index: true },
    side: { type: String, enum: ["front", "back", "selfie", "supporting", ""], default: "" },
    filePath: { type: String, required: true, trim: true },
    privateDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: "PrivateDocument", index: true },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["draft", "pending", "under_verification", "verified", "rejected", "expired", "manual_review_required"],
      default: "pending",
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String, trim: true, maxlength: 1000, default: "" },
    ocr: {
      status: { type: String, enum: ["not_started", "queued", "completed", "failed"], default: "not_started" },
      extractedText: { type: String, trim: true, maxlength: 4000, default: "" },
    },
  },
  { timestamps: true, collection: "influencer_application_documents" }
);

const influencerApplicationReviewSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, trim: true, index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    decision: {
      type: String,
      enum: ["submitted", "approve", "reject", "request_changes", "suspend", "request_documents", "note"],
      required: true,
      index: true,
    },
    comments: { type: String, trim: true, maxlength: 2000, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "influencer_application_reviews" }
);

const influencerBadgeSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    badgeType: { type: String, enum: ["blue_verified", "gold_verified", "creator_verified"], default: "creator_verified", index: true },
    label: { type: String, trim: true, default: "Verified Influencer" },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    issuedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
  },
  { timestamps: true, collection: "influencer_badges" }
);

const influencerStorefrontSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, unique: true, index: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    banner: { type: String, trim: true, default: "" },
    mobileBanner: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    logo: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, maxlength: 1200, default: "" },
    tagline: { type: String, trim: true, maxlength: 160, default: "" },
    contact: {
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      language: { type: String, trim: true, default: "en" },
      currency: { type: String, trim: true, default: "INR" },
    },
    theme: { type: String, trim: true, default: "creator-default" },
    branding: {
      preset: { type: String, trim: true, default: "modern" },
      primaryColor: { type: String, trim: true, default: "#4f46e5" },
      secondaryColor: { type: String, trim: true, default: "#06b6d4" },
      accentColor: { type: String, trim: true, default: "#22c55e" },
      backgroundColor: { type: String, trim: true, default: "#f8fafc" },
      buttonStyle: { type: String, enum: ["rounded", "pill", "square"], default: "rounded" },
      typography: { type: String, trim: true, default: "system" },
      cardStyle: { type: String, enum: ["flat", "bordered", "elevated"], default: "bordered" },
      borderRadius: { type: Number, min: 0, max: 32, default: 16 },
    },
    hero: {
      type: { type: String, enum: ["single", "carousel", "video"], default: "single" },
      backgroundImage: { type: String, trim: true, default: "" },
      headline: { type: String, trim: true, maxlength: 140, default: "" },
      subheadline: { type: String, trim: true, maxlength: 260, default: "" },
      ctaText: { type: String, trim: true, maxlength: 80, default: "" },
      ctaUrl: { type: String, trim: true, default: "" },
      textAlignment: { type: String, enum: ["left", "center", "right"], default: "left" },
      overlayColor: { type: String, trim: true, default: "rgba(15,23,42,0.45)" },
      height: { type: String, enum: ["compact", "standard", "tall"], default: "standard" },
      startDate: { type: Date },
      endDate: { type: Date },
    },
    banners: {
      main: { type: mongoose.Schema.Types.Mixed, default: {} },
      promotional: { type: mongoose.Schema.Types.Mixed, default: {} },
      campaign: { type: mongoose.Schema.Types.Mixed, default: {} },
      seasonal: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    homepage: {
      sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
      draftSections: { type: [mongoose.Schema.Types.Mixed], default: [] },
      updatedAt: { type: Date },
    },
    featuredCollectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCollection" }],
    featuredProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    featuredCategoryKeys: { type: [String], default: [] },
    socialLinks: { type: mongoose.Schema.Types.Mixed, default: {} },
    categories: { type: [String], default: [] },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      keywords: { type: [String], default: [] },
      canonicalUrl: { type: String, trim: true, default: "" },
      openGraphTitle: { type: String, trim: true, maxlength: 160, default: "" },
      openGraphDescription: { type: String, trim: true, maxlength: 300, default: "" },
      openGraphImage: { type: String, trim: true, default: "" },
    },
    analytics: {
      views: { type: Number, min: 0, default: 0 },
      uniqueVisitors: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      conversionRate: { type: Number, min: 0, default: 0 },
    },
    status: { type: String, enum: ["draft", "active", "hidden", "archived", "inactive", "suspended"], default: "active", index: true },
    settings: {
      featuredProductsEnabled: { type: Boolean, default: true },
      collectionsEnabled: { type: Boolean, default: true },
      reviewsEnabled: { type: Boolean, default: true },
      analyticsSummaryEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: "influencer_storefronts" }
);

const influencerAffiliateSettingSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, unique: true, index: true },
    trackingCode: { type: String, required: true, trim: true, unique: true, index: true },
    commissionType: { type: String, enum: ["percentage", "fixed", "hybrid"], default: "percentage" },
    commissionRate: { type: Number, min: 0, default: 10 },
    fixedAmount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active", index: true },
  },
  { timestamps: true, collection: "influencer_affiliate_settings" }
);

const influencerProductAssignmentSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    status: {
      type: String,
      enum: ["assigned", "accepted", "approved", "active", "paused", "removed", "rejected"],
      default: "assigned",
      index: true,
    },
    source: {
      type: String,
      enum: ["vendor_campaign", "campaign_application", "influencer_acceptance", "admin_manual"],
      default: "vendor_campaign",
      index: true,
    },
    assignedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    approvedAt: { type: Date },
    removedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "influencer_product_assignments" }
);

const affiliateLinkSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", index: true },
    affiliateCode: { type: String, required: true, trim: true, index: true },
    targetPath: { type: String, trim: true, default: "" },
    affiliateUrl: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "disabled"], default: "active", index: true },
    generatedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "affiliate_links" }
);

const influencerCollectionSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1200, default: "" },
    type: {
      type: String,
      enum: ["recommended_products", "tech_essentials", "fashion_picks", "creator_favorites", "trending_products", "custom", "featured", "seasonal", "campaign", "affiliate", "bundle", "brand"],
      default: "custom",
      index: true,
    },
    tags: { type: [String], default: [] },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    productOrder: {
      type: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, position: { type: Number, min: 0, default: 0 }, pinned: { type: Boolean, default: false } }],
      default: [],
    },
    media: {
      coverImage: { type: String, trim: true, default: "" },
      bannerImage: { type: String, trim: true, default: "" },
      thumbnail: { type: String, trim: true, default: "" },
    },
    display: {
      layout: { type: String, enum: ["grid", "list", "carousel", "masonry"], default: "grid" },
      placement: { type: [String], default: ["storefront_homepage"] },
      priority: { type: Number, min: 0, default: 0 },
      pinned: { type: Boolean, default: false },
    },
    visibility: {
      audience: { type: String, enum: ["public", "private", "followers_only", "subscribers_only", "campaign_members_only", "scheduled"], default: "public", index: true },
      locations: { type: [String], default: ["storefront_homepage"] },
      startDate: { type: Date },
      endDate: { type: Date },
      timezone: { type: String, trim: true, default: "UTC" },
      rules: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      canonicalUrl: { type: String, trim: true, default: "" },
      openGraphImage: { type: String, trim: true, default: "" },
      keywords: { type: [String], default: [] },
    },
    seasonal: {
      season: { type: String, trim: true, default: "" },
      template: { type: String, trim: true, default: "" },
      autoPublish: { type: Boolean, default: false },
      autoExpire: { type: Boolean, default: false },
    },
    analytics: {
      views: { type: Number, min: 0, default: 0 },
      uniqueVisitors: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
      shares: { type: Number, min: 0, default: 0 },
      saves: { type: Number, min: 0, default: 0 },
    },
    featured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["active", "draft", "archived", "scheduled"], default: "active", index: true },
  },
  { timestamps: true, collection: "influencer_collections" }
);

const influencerActivationAuditSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", index: true },
    applicationId: { type: String, trim: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: ["success", "failed", "info"], default: "success", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "influencer_activation_audits" }
);

const influencerFollowerSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    notificationEnabled: { type: Boolean, default: true, index: true },
    source: { type: String, trim: true, maxlength: 80, default: "storefront" },
    followedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "influencer_followers" }
);

const influencerPostSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    collectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCollection" }],
    caption: { type: String, trim: true, maxlength: 1200, default: "" },
    media: {
      type: [
        {
          url: { type: String, trim: true, required: true },
          type: { type: String, enum: ["image", "video"], default: "image" },
          altText: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
    tags: { type: [String], default: [] },
    visibility: { type: String, enum: ["draft", "published", "private", "archived"], default: "draft", index: true },
    publishedAt: { type: Date, index: true },
    metrics: {
      views: { type: Number, min: 0, default: 0 },
      likes: { type: Number, min: 0, default: 0 },
      comments: { type: Number, min: 0, default: 0 },
      shares: { type: Number, min: 0, default: 0 },
      saves: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      orders: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
    },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 160, default: "" },
      metaDescription: { type: String, trim: true, maxlength: 300, default: "" },
      openGraphImage: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true, collection: "influencer_posts" }
);

const influencerNewsletterSubscriptionSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    source: { type: String, trim: true, maxlength: 80, default: "storefront" },
    status: { type: String, enum: ["active", "unsubscribed"], default: "active", index: true },
    subscribedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "influencer_newsletter_subscriptions" }
);

const influencerStorefrontEventSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerProfile", required: true, index: true },
    storefrontId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerStorefront", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    anonymousId: { type: String, trim: true, index: true, default: "" },
    eventType: {
      type: String,
      enum: [
        "profile_view",
        "storefront_view",
        "product_view",
        "wishlist",
        "checkout_started",
        "order_completed",
        "order_cancelled",
        "refund",
        "commission_approved",
        "commission_paid",
        "product_click",
        "add_to_cart",
        "purchase",
        "collection_view",
        "reel_view",
        "post_view",
        "post_engagement",
        "social_click",
        "newsletter_subscribe",
        "follow",
        "unfollow",
        "carousel_view",
        "carousel_navigation",
        "share",
        "search",
        "profile_report",
        "profile_block",
      ],
      required: true,
      index: true,
    },
    surface: { type: String, trim: true, default: "influencer-storefront", index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerCollection", index: true },
    reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "InfluencerPost", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "influencer_storefront_events" }
);

influencerProfileSchema.index({ state: 1, verified: 1, followers: -1 });
influencerProfileSchema.index({ categories: 1, rating: -1 });
influencerProfileSchema.index({ storeSlug: 1 }, { unique: true, sparse: true });
influencerApplicationSchema.index({ status: 1, updatedAt: -1 });
influencerApplicationSchema.index({ "profileDraft.storeSlug": 1 }, { sparse: true });
influencerSocialAccountSchema.index({ applicationId: 1, platform: 1 }, { unique: true });
influencerSocialAccountSchema.index({ applicationId: 1, profileUrl: 1 }, { unique: true });
influencerSocialVerificationSchema.index({ status: 1, updatedAt: -1 });
influencerBusinessProfileSchema.index({ applicationId: 1 }, { unique: true, sparse: true });
influencerPaymentProfileSchema.index({ applicationId: 1 }, { unique: true, sparse: true });
influencerApplicationDocumentSchema.index({ applicationId: 1, documentType: 1, createdAt: -1 });
influencerApplicationDocumentSchema.index({ influencerId: 1, category: 1, status: 1, createdAt: -1 });
influencerApplicationReviewSchema.index({ applicationId: 1, createdAt: -1 });
influencerBadgeSchema.index({ influencerId: 1, status: 1 });
influencerStorefrontSchema.index({ influencerId: 1, status: 1 });
influencerStorefrontSchema.index({ status: 1, updatedAt: -1 });
influencerProductAssignmentSchema.index({ influencerId: 1, productId: 1, campaignId: 1 }, { unique: true });
influencerProductAssignmentSchema.index({ influencerId: 1, status: 1, updatedAt: -1 });
affiliateLinkSchema.index({ influencerId: 1, productId: 1, campaignId: 1 });
influencerCollectionSchema.index({ influencerId: 1, slug: 1 }, { unique: true });
influencerCollectionSchema.index({ influencerId: 1, status: 1, featured: 1, "display.priority": -1 });
influencerCollectionSchema.index({ influencerId: 1, type: 1, status: 1 });
influencerActivationAuditSchema.index({ action: 1, createdAt: -1 });
influencerFollowerSchema.index({ influencerId: 1, customerId: 1 }, { unique: true });
influencerFollowerSchema.index({ customerId: 1, followedAt: -1 });
influencerPostSchema.index({ influencerId: 1, visibility: 1, publishedAt: -1 });
influencerPostSchema.index({ caption: "text", tags: "text" });
influencerNewsletterSubscriptionSchema.index({ influencerId: 1, email: 1 }, { unique: true });
influencerStorefrontEventSchema.index({ influencerId: 1, eventType: 1, createdAt: -1 });

module.exports = {
  InfluencerProfile:
    mongoose.models.InfluencerProfile ||
    mongoose.model("InfluencerProfile", influencerProfileSchema),
  InfluencerApplication:
    mongoose.models.InfluencerApplication ||
    mongoose.model("InfluencerApplication", influencerApplicationSchema),
  InfluencerSocialAccount:
    mongoose.models.InfluencerSocialAccount ||
    mongoose.model("InfluencerSocialAccount", influencerSocialAccountSchema),
  InfluencerSocialVerification:
    mongoose.models.InfluencerSocialVerification ||
    mongoose.model("InfluencerSocialVerification", influencerSocialVerificationSchema),
  InfluencerBusinessProfile:
    mongoose.models.InfluencerBusinessProfile ||
    mongoose.model("InfluencerBusinessProfile", influencerBusinessProfileSchema),
  InfluencerPaymentProfile:
    mongoose.models.InfluencerPaymentProfile ||
    mongoose.model("InfluencerPaymentProfile", influencerPaymentProfileSchema),
  InfluencerApplicationDocument:
    mongoose.models.InfluencerApplicationDocument ||
    mongoose.model("InfluencerApplicationDocument", influencerApplicationDocumentSchema),
  InfluencerApplicationReview:
    mongoose.models.InfluencerApplicationReview ||
    mongoose.model("InfluencerApplicationReview", influencerApplicationReviewSchema),
  InfluencerBadge:
    mongoose.models.InfluencerBadge ||
    mongoose.model("InfluencerBadge", influencerBadgeSchema),
  InfluencerStorefront:
    mongoose.models.InfluencerStorefront ||
    mongoose.model("InfluencerStorefront", influencerStorefrontSchema),
  InfluencerAffiliateSetting:
    mongoose.models.InfluencerAffiliateSetting ||
    mongoose.model("InfluencerAffiliateSetting", influencerAffiliateSettingSchema),
  InfluencerProductAssignment:
    mongoose.models.InfluencerProductAssignment ||
    mongoose.model("InfluencerProductAssignment", influencerProductAssignmentSchema),
  AffiliateLink:
    mongoose.models.AffiliateLink ||
    mongoose.model("AffiliateLink", affiliateLinkSchema),
  InfluencerCollection:
    mongoose.models.InfluencerCollection ||
    mongoose.model("InfluencerCollection", influencerCollectionSchema),
  InfluencerActivationAudit:
    mongoose.models.InfluencerActivationAudit ||
    mongoose.model("InfluencerActivationAudit", influencerActivationAuditSchema),
  InfluencerFollower:
    mongoose.models.InfluencerFollower ||
    mongoose.model("InfluencerFollower", influencerFollowerSchema),
  InfluencerPost:
    mongoose.models.InfluencerPost ||
    mongoose.model("InfluencerPost", influencerPostSchema),
  InfluencerNewsletterSubscription:
    mongoose.models.InfluencerNewsletterSubscription ||
    mongoose.model("InfluencerNewsletterSubscription", influencerNewsletterSubscriptionSchema),
  InfluencerStorefrontEvent:
    mongoose.models.InfluencerStorefrontEvent ||
    mongoose.model("InfluencerStorefrontEvent", influencerStorefrontEventSchema),
};
