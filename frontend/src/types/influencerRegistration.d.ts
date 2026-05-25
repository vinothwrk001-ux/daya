export type InfluencerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "pending_documents"
  | "verification_in_progress"
  | "approved"
  | "rejected"
  | "suspended"
  | "requires_changes";

export interface InfluencerRegistrationStepOneValues {
  applicationId?: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  username: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  notificationsAccepted: boolean;
}

export interface InfluencerApplicationDraft {
  id: string;
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  username: string;
  referralCode?: string;
  status: InfluencerApplicationStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerRegistrationStepOneResponse {
  application: InfluencerApplicationDraft;
  nextStep: 2;
  nextPath: string;
}

export type InfluencerSocialVerificationStatus =
  | "draft"
  | "pending"
  | "verified"
  | "rejected"
  | "under_review"
  | "manual_review_required";

export interface InfluencerSocialAccount {
  id?: string;
  applicationId?: string;
  platform: string;
  platformLabel?: string;
  profileUrl: string;
  username?: string;
  channelName?: string;
  accountType?: "creator" | "business" | "personal" | "";
  followersCount?: number;
  subscribers?: number;
  engagementRate?: number;
  averageLikes?: number;
  averageComments?: number;
  averageViews?: number;
  contentCount?: number;
  accountAgeDays?: number;
  verificationBadge?: boolean;
  description?: string;
  verificationStatus: InfluencerSocialVerificationStatus;
  verificationCode?: string;
  manualProofSubmitted?: boolean;
}

export interface InfluencerSocialVerification {
  id: string;
  socialAccountId: string;
  applicationId: string;
  verificationMethod: "automatic" | "verification_code" | "screenshot";
  verificationCode?: string;
  screenshotPath?: string;
  status: InfluencerSocialVerificationStatus;
  reviewNotes?: string;
}

export interface InfluencerCreatorScore {
  score: number;
  level: string;
  followersScore: number;
  engagementScore: number;
  consistencyScore: number;
  diversityScore: number;
}

export interface InfluencerProfileInformationValues {
  applicationId?: string;
  profilePicture?: string;
  coverBanner?: string;
  displayName: string;
  shortBio: string;
  longBio?: string;
  primaryCategory: string;
  customCategory?: string;
  secondaryCategories: string[];
  languages: string[];
  country?: string;
  state?: string;
  city?: string;
  website?: string;
  contentNiche: string[];
  contentStyle: string[];
  storeName: string;
  storeSlug: string;
  metaTitle?: string;
  metaDescription?: string;
  socialSharingImage?: string;
}

export interface InfluencerBusinessInformationValues {
  applicationId?: string;
  country: string;
  state: string;
  city: string;
  address1: string;
  address2?: string;
  postalCode: string;
  businessType: string;
  customBusinessType?: string;
  gstNumber?: string;
  panNumber?: string;
  taxId?: string;
  businessRegistrationNumber?: string;
  legalName: string;
  businessName?: string;
  dateOfBirth: string;
  nationality: string;
}

export interface InfluencerPaymentInformationValues {
  applicationId?: string;
  country?: string;
  payoutMethod: "bank_transfer" | "upi" | "paypal" | "stripe_connect" | "wise" | "payoneer";
  accountHolderName?: string;
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifscCode?: string;
  swiftCode?: string;
  routingNumber?: string;
  upiId?: string;
  paypalEmail?: string;
  payoneerEmail?: string;
  agreements: {
    payoutPolicy: boolean;
    commissionTerms: boolean;
    taxCompliance: boolean;
  };
}

export interface InfluencerContentReviewValues {
  applicationId?: string;
  portfolioUrl?: string;
  portfolioDescription?: string;
  manualNiche?: string;
  brandCollaborations: Array<{
    brandName?: string;
    campaignName?: string;
    campaignType?: string;
    campaignDate?: string;
    campaignResults?: string;
  }>;
}

export interface InfluencerApplicationTimelineItem {
  stage: string;
  label: string;
  status: "completed" | "current" | "upcoming";
}
