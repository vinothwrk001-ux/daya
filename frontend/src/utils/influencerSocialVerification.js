export const INFLUENCER_STEP_TWO_STORAGE_KEY = "grm_influencer_register_step_2";

export const socialPlatforms = [
  { key: "instagram", label: "Instagram", required: true, urlLabel: "Instagram Profile URL", minFollowers: 1000 },
  { key: "youtube", label: "YouTube", required: true, urlLabel: "Channel URL", minFollowers: 500 },
  { key: "tiktok", label: "TikTok", urlLabel: "TikTok URL", minFollowers: 1000 },
  { key: "facebook", label: "Facebook", urlLabel: "Facebook Page URL" },
  { key: "twitter_x", label: "Twitter/X", urlLabel: "Profile URL" },
  { key: "linkedin", label: "LinkedIn", urlLabel: "Profile URL" },
  { key: "pinterest", label: "Pinterest", urlLabel: "Profile URL" },
  { key: "telegram", label: "Telegram", urlLabel: "Channel URL" },
  { key: "snapchat", label: "Snapchat", urlLabel: "Profile URL" },
  { key: "twitch", label: "Twitch", urlLabel: "Channel URL" },
  { key: "other", label: "Other", urlLabel: "Profile URL" },
];

export const defaultSocialAccounts = [
  createSocialAccount("instagram"),
  createSocialAccount("youtube"),
  createSocialAccount("tiktok"),
];

export function createSocialAccount(platform = "other") {
  const definition = socialPlatforms.find((item) => item.key === platform) || socialPlatforms.at(-1);
  return {
    clientId: `${platform}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platform,
    platformLabel: definition.label,
    profileUrl: "",
    username: "",
    channelName: "",
    accountType: platform === "instagram" ? "creator" : "",
    followersCount: "",
    subscribers: "",
    engagementRate: "",
    averageLikes: "",
    averageComments: "",
    averageViews: "",
    contentCount: "",
    accountAgeDays: "",
    verificationBadge: false,
    description: "",
    verificationStatus: "pending",
    verificationCode: "",
    manualProofSubmitted: false,
    proofFileName: "",
  };
}

export function generateOwnershipCode() {
  return `INFLUENCER-GRM-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function normalizePlatformKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
}

export function saveSocialVerificationDraft(values, storage = window.localStorage) {
  const safeValues = {
    ...values,
    accounts: (values.accounts || []).map((account) => {
      const safeAccount = { ...account };
      delete safeAccount.proofFile;
      return safeAccount;
    }),
  };
  const payload = { values: safeValues, savedAt: new Date().toISOString() };
  storage.setItem(INFLUENCER_STEP_TWO_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadSocialVerificationDraft(storage = window.localStorage) {
  const raw = storage.getItem(INFLUENCER_STEP_TWO_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateSocialVerification(values = {}, { requireVerification = true } = {}) {
  const accounts = Array.isArray(values.accounts) ? values.accounts : [];
  const errors = {};
  const seenPlatforms = new Set();
  const seenUrls = new Set();

  accounts.forEach((account, index) => {
    const key = account.clientId || index;
    const platform = normalizePlatformKey(account.platform);
    const url = String(account.profileUrl || "").trim();
    const entryErrors = {};

    if (!platform) entryErrors.platform = "Platform is required.";
    if (!url) entryErrors.profileUrl = "Profile URL is required.";
    else {
      try {
        new URL(url);
      } catch {
        entryErrors.profileUrl = "Enter a valid profile URL.";
      }
    }
    if (platform && seenPlatforms.has(platform)) entryErrors.platform = "Duplicate platform entries are not allowed.";
    if (url && seenUrls.has(url)) entryErrors.profileUrl = "Duplicate profile URLs are not allowed.";
    if (requireVerification && !account.verificationCode && !account.manualProofSubmitted && account.verificationStatus !== "verified") {
      entryErrors.verification = "Generate a code or upload proof before verification.";
    }

    seenPlatforms.add(platform);
    seenUrls.add(url);
    if (Object.keys(entryErrors).length) errors[key] = entryErrors;
  });

  if (!accounts.length) errors.form = "Add at least one social profile.";
  return errors;
}

export function calculateCreatorScore(accounts = []) {
  const active = accounts.filter((account) => account.profileUrl);
  const totalFollowers = active.reduce((sum, account) => sum + Number(account.followersCount || account.subscribers || 0), 0);
  const averageEngagement = active.length
    ? active.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / active.length
    : 0;
  const contentTotal = active.reduce((sum, account) => sum + Number(account.contentCount || 0), 0);
  const followersScore = Math.min(35, Math.round(Math.log10(totalFollowers + 1) * 8));
  const engagementScore = Math.min(30, Math.round(averageEngagement * 6));
  const consistencyScore = Math.min(20, Math.round(contentTotal / 10));
  const diversityScore = Math.min(15, active.length * 4);
  const score = Math.min(100, followersScore + engagementScore + consistencyScore + diversityScore);
  const level = score >= 80 ? "Gold Creator" : score >= 60 ? "Silver Creator" : score >= 40 ? "Rising Creator" : "Starter Creator";
  return { score, level, followersScore, engagementScore, consistencyScore, diversityScore };
}

export function canContinueSocialVerification(accounts = []) {
  return accounts.some((account) =>
    ["verified", "under_review", "manual_review_required"].includes(account.verificationStatus) || account.manualProofSubmitted
  );
}
