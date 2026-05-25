export const INFLUENCER_STEP_THREE_STORAGE_KEY = "grm_influencer_register_step_3";

export const defaultLanguages = ["English", "Tamil", "Hindi", "Arabic", "French", "German", "Spanish"];
export const defaultContentNiches = [
  "Product Reviews",
  "Tech Reviews",
  "Fashion Tips",
  "Fitness Content",
  "Gaming",
  "Tutorials",
  "Lifestyle",
  "Unboxing",
  "Marketplace Deals",
];
export const defaultContentStyles = [
  "Video Creator",
  "Blogger",
  "Photographer",
  "Streamer",
  "Educator",
  "Reviewer",
  "Influencer",
  "Affiliate Marketer",
];

export const initialInfluencerProfileForm = {
  applicationId: "",
  profilePicture: "",
  coverBanner: "",
  displayName: "",
  shortBio: "",
  longBio: "",
  primaryCategory: "",
  customCategory: "",
  secondaryCategories: [],
  languages: ["English"],
  country: "",
  state: "",
  city: "",
  website: "",
  contentNiche: [],
  contentStyle: [],
  storeName: "",
  storeSlug: "",
  metaTitle: "",
  metaDescription: "",
  socialSharingImage: "",
  mediaTransforms: {
    profilePicture: { zoom: 1, rotation: 0 },
    coverBanner: { zoom: 1, rotation: 0 },
  },
};

export function slugifyInfluencer(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function saveInfluencerProfileDraft(values, storage = window.localStorage) {
  const safeValues = { ...values };
  delete safeValues.profilePictureFile;
  delete safeValues.coverBannerFile;
  delete safeValues.socialSharingImageFile;
  const payload = { values: safeValues, savedAt: new Date().toISOString() };
  storage.setItem(INFLUENCER_STEP_THREE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadInfluencerProfileDraft(storage = window.localStorage) {
  const raw = storage.getItem(INFLUENCER_STEP_THREE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateInfluencerProfile(values = {}, { slugAvailable = true } = {}) {
  const errors = {};
  if (!values.profilePicture && !values.profilePictureFile) errors.profilePicture = "Profile picture is required.";
  if (!values.coverBanner && !values.coverBannerFile) errors.coverBanner = "Cover banner is required.";
  if (String(values.displayName || "").trim().length < 3) errors.displayName = "Display name must be at least 3 characters.";
  if (String(values.displayName || "").trim().length > 100) errors.displayName = "Display name must be 100 characters or fewer.";
  if (String(values.shortBio || "").trim().length < 20) errors.shortBio = "Short bio must be at least 20 characters.";
  if (String(values.shortBio || "").trim().length > 160) errors.shortBio = "Short bio must be 160 characters or fewer.";
  if (!values.primaryCategory) errors.primaryCategory = "Primary category is required.";
  if (values.primaryCategory === "other" && !String(values.customCategory || "").trim()) errors.customCategory = "Custom category is required.";
  if ((values.secondaryCategories || []).length > 5) errors.secondaryCategories = "Choose up to 5 secondary categories.";
  if (values.website) {
    try {
      new URL(values.website);
    } catch {
      errors.website = "Enter a valid website URL.";
    }
  }
  if (!values.storeSlug) errors.storeSlug = "Influencer URL slug is required.";
  if (slugAvailable === false) errors.storeSlug = "Influencer URL slug is already in use.";
  return errors;
}
