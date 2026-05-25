import { api } from "./api";

export async function checkInfluencerEmail(email) {
  const { data } = await api.get("/api/influencer/register/check-email", { params: { email } });
  return data;
}

export async function checkInfluencerUsername(username) {
  const { data } = await api.get("/api/influencer/register/check-username", { params: { username } });
  return data;
}

export async function saveInfluencerRegistrationDraft(payload) {
  const { data } = await api.post("/api/influencer/register/save-draft", payload);
  return data;
}

export async function submitInfluencerRegistrationStepOne(payload) {
  const { data } = await api.post("/api/influencer/register/step-1", payload);
  return data;
}

export async function saveInfluencerSocialDraft(payload) {
  const { data } = await api.post("/api/influencer/social/save-draft", payload);
  return data;
}

export async function getInfluencerSocialStatus(applicationId) {
  const { data } = await api.get("/api/influencer/social/status", { params: { applicationId } });
  return data;
}

export async function fetchInfluencerSocialMetrics(platform, profileUrl) {
  const { data } = await api.get("/api/influencer/social/fetch-metrics", { params: { platform, profileUrl } });
  return data;
}

export async function verifyInfluencerSocialAccount(payload, proofFile) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (proofFile) formData.append("screenshots", proofFile);
  const { data } = await api.post("/api/influencer/social/verify", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

function profileFormData(payload) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (["profilePictureFile", "coverBannerFile", "socialSharingImageFile"].includes(key)) return;
    if (Array.isArray(value) || (value && typeof value === "object")) {
      formData.append(key, JSON.stringify(value));
    } else if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  if (payload.profilePictureFile) formData.append("profilePicture", payload.profilePictureFile);
  if (payload.coverBannerFile) formData.append("coverBanner", payload.coverBannerFile);
  if (payload.socialSharingImageFile) formData.append("socialSharingImage", payload.socialSharingImageFile);
  return formData;
}

export async function getInfluencerProfileDraft(applicationId) {
  const { data } = await api.get("/api/influencer/profile/draft", { params: { applicationId } });
  return data;
}

export async function checkInfluencerProfileSlug(slug, applicationId = "") {
  const { data } = await api.get("/api/influencer/profile/check-slug", { params: { slug, applicationId } });
  return data;
}

export async function saveInfluencerProfileDraft(payload) {
  const { data } = await api.post("/api/influencer/profile/save-draft", profileFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitInfluencerProfileInformation(payload) {
  const { data } = await api.post("/api/influencer/profile", profileFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

function businessFormData(payload) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (key.endsWith("File")) return;
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (payload.gstCertificateFile) formData.append("gstCertificate", payload.gstCertificateFile);
  if (payload.businessRegistrationFile) formData.append("businessRegistration", payload.businessRegistrationFile);
  if (payload.taxRegistrationFile) formData.append("taxRegistration", payload.taxRegistrationFile);
  if (payload.addressProofFile) formData.append("addressProof", payload.addressProofFile);
  return formData;
}

export async function getInfluencerCountries() {
  const { data } = await api.get("/api/influencer/countries");
  return data;
}

export async function getInfluencerCommissionSettings() {
  const { data } = await api.get("/api/influencer/commission-settings");
  return data;
}

export async function getInfluencerBusiness(applicationId) {
  const { data } = await api.get("/api/influencer/business", { params: { applicationId } });
  return data;
}

export async function saveInfluencerBusinessDraft(payload) {
  const { data } = await api.post("/api/influencer/business/save-draft", businessFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitInfluencerBusiness(payload) {
  const { data } = await api.post("/api/influencer/business", businessFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getInfluencerPayment(applicationId) {
  const { data } = await api.get("/api/influencer/payment", { params: { applicationId } });
  return data;
}

export async function saveInfluencerPaymentDraft(payload) {
  const { data } = await api.post("/api/influencer/payment/save-draft", payload);
  return data;
}

export async function submitInfluencerPayment(payload) {
  const { data } = await api.post("/api/influencer/payment", payload);
  return data;
}

function contentReviewFormData(payload) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (["sampleContentFiles", "brandProofFiles", "identityDocumentFiles"].includes(key)) return;
    if (Array.isArray(value) || (value && typeof value === "object")) {
      formData.append(key, JSON.stringify(value));
    } else if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  (payload.sampleContentFiles || []).forEach((file) => formData.append("sampleContent", file));
  (payload.brandProofFiles || []).forEach((file) => formData.append("brandProofs", file));
  (payload.identityDocumentFiles || []).forEach((file) => formData.append("identityDocuments", file));
  return formData;
}

export async function saveInfluencerContentReview(payload) {
  const { data } = await api.post("/api/influencer/content-review", contentReviewFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitInfluencerApplication(payload) {
  const { data } = await api.post("/api/influencer/submit", contentReviewFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getInfluencerApplicationStatus(applicationId) {
  const { data } = await api.get("/api/influencer/application-status", { params: { applicationId } });
  return data;
}
