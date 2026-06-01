export const INFLUENCER_STEP_ONE_STORAGE_KEY = "grm_influencer_register_step_1";
export const INFLUENCER_STEP_ONE_SESSION_KEY = "grm_influencer_register_step_1_session";

export const influencerWizardSteps = [
  "Account Information",
  "Social Profiles",
  "Creator Profile",
  "Payment Details",
  "Verification",
  "Review & Submit",
];

export const initialInfluencerStepOneForm = {
  applicationId: "",
  firstName: "",
  lastName: "",
  email: "",
  mobile: "+91 ",
  username: "",
  password: "",
  confirmPassword: "",
  referralCode: "",
  termsAccepted: false,
  privacyAccepted: false,
  notificationsAccepted: true,
};

export function sanitizeInfluencerStepOneDraft(values = {}) {
  const safeValues = { ...values };
  delete safeValues.password;
  delete safeValues.confirmPassword;
  return {
    ...initialInfluencerStepOneForm,
    ...safeValues,
    password: "",
    confirmPassword: "",
  };
}

export function saveInfluencerStepOneDraft(values, storage = window.localStorage, session = window.sessionStorage) {
  const payload = {
    values: sanitizeInfluencerStepOneDraft(values),
    savedAt: new Date().toISOString(),
  };
  storage.setItem(INFLUENCER_STEP_ONE_STORAGE_KEY, JSON.stringify(payload));
  session.setItem(INFLUENCER_STEP_ONE_SESSION_KEY, JSON.stringify(payload));
  return payload;
}

export function loadInfluencerStepOneDraft(storage = window.localStorage, session = window.sessionStorage) {
  const raw = storage.getItem(INFLUENCER_STEP_ONE_STORAGE_KEY) || session.getItem(INFLUENCER_STEP_ONE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      values: sanitizeInfluencerStepOneDraft(parsed.values || {}),
      savedAt: parsed.savedAt || "",
    };
  } catch {
    return null;
  }
}

export function normalizeUsername(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizePhone(value = "") {
  const cleaned = String(value || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+91")) return `+91 ${cleaned.slice(3, 13)}`.trim();
  if (cleaned.startsWith("+")) return cleaned.replace(/^(\+\d{1,4})(\d{0,14}).*$/, "$1 $2").trim();
  return cleaned.slice(0, 15);
}

export function getPasswordStrength(password = "") {
  const value = String(password || "");
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (!value) return { score: 0, label: "Weak", percent: 0, tone: "bg-slate-300" };
  if (score <= 2) return { score, label: "Weak", percent: 25, tone: "bg-rose-500" };
  if (score === 3) return { score, label: "Medium", percent: 50, tone: "bg-amber-500" };
  if (score === 4) return { score, label: "Strong", percent: 75, tone: "bg-blue-500" };
  return { score, label: "Excellent", percent: 100, tone: "bg-emerald-500" };
}

export function validateInfluencerStepOne(values = {}, availability = {}) {
  const errors = {};
  const firstName = String(values.firstName || "").trim();
  const lastName = String(values.lastName || "").trim();
  const email = String(values.email || "").trim();
  const mobile = String(values.mobile || "").trim();
  const username = String(values.username || "").trim();
  const password = String(values.password || "");
  const confirmPassword = String(values.confirmPassword || "");

  if (firstName.length < 2) errors.firstName = "First name must be at least 2 characters.";
  if (firstName.length > 50) errors.firstName = "First name must be 50 characters or fewer.";
  if (lastName.length < 2) errors.lastName = "Last name must be at least 2 characters.";
  if (lastName.length > 50) errors.lastName = "Last name must be 50 characters or fewer.";

  if (!email) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  else if (availability.email === false) errors.email = "Email already registered.";

  if (!/^\+\d{1,4}\s?\d{7,14}$/.test(mobile)) errors.mobile = "Enter a valid phone number with country code.";

  if (!username) errors.username = "Username is required.";
  else if (!/^[A-Za-z0-9_]+$/.test(username)) errors.username = "Use letters, numbers, and underscores only.";
  else if (/\s/.test(username)) errors.username = "Username cannot contain spaces.";
  else if (availability.username === false) errors.username = "Username already registered.";

  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (password.length > 128) errors.password = "Password must be 128 characters or fewer.";
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(password)) {
    errors.password = "Use uppercase, lowercase, number, and special character.";
  }

  if (!confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  if (!values.termsAccepted) errors.termsAccepted = "Influencer Program Terms are required.";
  if (!values.privacyAccepted) errors.privacyAccepted = "Privacy Policy agreement is required.";

  return errors;
}
