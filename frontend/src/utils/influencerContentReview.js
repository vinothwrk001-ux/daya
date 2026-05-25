export const INFLUENCER_STEP_SIX_STORAGE_KEY = "grm_influencer_register_step_6";

export const contentNiches = ["Technology", "Fashion", "Gaming", "Beauty", "Fitness", "Education", "Lifestyle", "Travel", "Food", "Business", "Other"];

export const initialInfluencerContentReviewForm = {
  applicationId: "",
  portfolioUrl: "",
  portfolioDescription: "",
  manualNiche: "",
  brandCollaborations: [],
};

export function saveInfluencerContentReviewDraftLocal(values, storage = window.localStorage) {
  const payload = {
    values,
    savedAt: new Date().toISOString(),
  };
  storage.setItem(INFLUENCER_STEP_SIX_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadInfluencerContentReviewDraft(storage = window.localStorage) {
  const raw = storage.getItem(INFLUENCER_STEP_SIX_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateContentReview(values = {}, files = {}, existingDocuments = []) {
  const errors = {};
  const sampleCount = (files.sampleContentFiles || []).length + existingDocuments.filter((item) => item.documentType === "sample_content").length;
  const identityCount = (files.identityDocumentFiles || []).length + existingDocuments.filter((item) => item.documentType === "identity_document").length;
  if (sampleCount < 3) errors.sampleContent = "Upload at least 3 sample content files.";
  if (identityCount < 1) errors.identityDocuments = "Upload at least one identity document.";
  if (values.portfolioUrl) {
    try {
      new URL(values.portfolioUrl);
    } catch {
      errors.portfolioUrl = "Enter a valid portfolio URL.";
    }
  }
  if (String(values.portfolioDescription || "").length > 1000) errors.portfolioDescription = "Portfolio description must be 1000 characters or fewer.";
  return errors;
}

export function getScoreLevel(score = 0) {
  const value = Number(score || 0);
  if (value >= 80) return "Gold Creator";
  if (value >= 60) return "Silver Creator";
  if (value >= 40) return "Rising Creator";
  return "Starter Creator";
}
