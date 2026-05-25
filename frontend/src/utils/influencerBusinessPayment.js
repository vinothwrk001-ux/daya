export const INFLUENCER_STEP_FOUR_STORAGE_KEY = "grm_influencer_register_step_4";
export const INFLUENCER_STEP_FIVE_STORAGE_KEY = "grm_influencer_register_step_5";

export const businessTypes = [
  { value: "individual_creator", label: "Individual Creator" },
  { value: "freelancer", label: "Freelancer" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "private_limited", label: "Private Limited" },
  { value: "llp", label: "LLP" },
  { value: "agency", label: "Agency" },
  { value: "brand_representative", label: "Brand Representative" },
  { value: "other", label: "Other" },
];

export const payoutMethods = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe_connect", label: "Stripe Connect" },
  { value: "wise", label: "Wise" },
  { value: "payoneer", label: "Payoneer" },
];

export const initialInfluencerBusinessForm = {
  applicationId: "",
  country: "IN",
  state: "",
  city: "",
  address1: "",
  address2: "",
  postalCode: "",
  businessType: "individual_creator",
  customBusinessType: "",
  gstNumber: "",
  panNumber: "",
  taxId: "",
  businessRegistrationNumber: "",
  legalName: "",
  businessName: "",
  dateOfBirth: "",
  nationality: "Indian",
};

export const initialInfluencerPaymentForm = {
  applicationId: "",
  country: "IN",
  payoutMethod: "bank_transfer",
  accountNumberMask: "",
  accountHolderName: "",
  bankName: "",
  branchName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  swiftCode: "",
  routingNumber: "",
  upiId: "",
  paypalEmail: "",
  payoneerEmail: "",
  agreements: {
    payoutPolicy: false,
    commissionTerms: false,
    taxCompliance: false,
  },
};

function saveDraft(key, values, storage = window.localStorage) {
  const safeValues = { ...values };
  Object.keys(safeValues).forEach((keyName) => {
    if (keyName.endsWith("File")) delete safeValues[keyName];
  });
  const payload = { values: safeValues, savedAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(payload));
  return payload;
}

function loadDraft(key, storage = window.localStorage) {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveInfluencerBusinessDraftLocal(values, storage) {
  return saveDraft(INFLUENCER_STEP_FOUR_STORAGE_KEY, values, storage);
}

export function loadInfluencerBusinessDraft(storage) {
  return loadDraft(INFLUENCER_STEP_FOUR_STORAGE_KEY, storage);
}

export function saveInfluencerPaymentDraftLocal(values, storage) {
  const safeValues = { ...values, accountNumber: "", confirmAccountNumber: "" };
  return saveDraft(INFLUENCER_STEP_FIVE_STORAGE_KEY, safeValues, storage);
}

export function loadInfluencerPaymentDraft(storage) {
  return loadDraft(INFLUENCER_STEP_FIVE_STORAGE_KEY, storage);
}

export function validateGst(value = "") {
  return !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value).trim().toUpperCase());
}

export function validatePan(value = "") {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).trim().toUpperCase());
}

export function validateUpi(value = "") {
  return /^[\w.-]+@[\w.-]+$/.test(String(value).trim());
}

export function validateEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function validateIfsc(value = "") {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value).trim().toUpperCase());
}

export function validateBusinessInformation(values = {}) {
  const errors = {};
  ["country", "state", "city", "address1", "postalCode", "businessType", "legalName", "dateOfBirth", "nationality"].forEach((field) => {
    if (!String(values[field] || "").trim()) errors[field] = "This field is required.";
  });
  if (values.businessType === "other" && !String(values.customBusinessType || "").trim()) errors.customBusinessType = "Enter your business type.";
  if (String(values.address1 || "").length > 255) errors.address1 = "Address line 1 must be 255 characters or fewer.";
  if (String(values.address2 || "").length > 255) errors.address2 = "Address line 2 must be 255 characters or fewer.";
  if (values.country === "IN") {
    if (!validatePan(values.panNumber)) errors.panNumber = "Enter a valid PAN number, for example ABCDE1234F.";
    if (!validateGst(values.gstNumber)) errors.gstNumber = "Enter a valid GST number.";
  } else if (!String(values.taxId || "").trim()) {
    errors.taxId = "Tax ID is required for this country.";
  }
  return errors;
}

export function validatePaymentInformation(values = {}) {
  const errors = {};
  if (!values.payoutMethod) errors.payoutMethod = "Choose a payout method.";
  if (values.payoutMethod === "bank_transfer") {
    const accountNumber = String(values.accountNumber || "").replace(/[\s-]/g, "");
    const confirmAccountNumber = String(values.confirmAccountNumber || "").replace(/[\s-]/g, "");
    const hasSavedAccount = Boolean(values.accountNumberMask && !accountNumber && !confirmAccountNumber);
    if (!String(values.accountHolderName || "").trim()) errors.accountHolderName = "Account holder name is required.";
    if (!String(values.bankName || "").trim()) errors.bankName = "Bank name is required.";
    if (!hasSavedAccount) {
      if (!accountNumber) errors.accountNumber = "Account number is required.";
      if (accountNumber !== confirmAccountNumber) errors.confirmAccountNumber = "Account numbers must match.";
    }
    if (values.country === "IN" && !validateIfsc(values.ifscCode)) errors.ifscCode = "Enter a valid IFSC code.";
    if (values.country !== "IN" && !String(values.swiftCode || "").trim()) errors.swiftCode = "SWIFT code is required.";
  }
  if (values.payoutMethod === "upi" && !validateUpi(values.upiId)) errors.upiId = "Enter a valid UPI ID, for example creator@okaxis.";
  if (values.payoutMethod === "paypal" && !validateEmail(values.paypalEmail)) errors.paypalEmail = "Enter a valid PayPal email.";
  if (values.payoutMethod === "payoneer" && !validateEmail(values.payoneerEmail)) errors.payoneerEmail = "Enter a valid Payoneer email.";
  if (!values.agreements?.payoutPolicy) errors.payoutPolicy = "Payout policy agreement is required.";
  if (!values.agreements?.commissionTerms) errors.commissionTerms = "Commission terms agreement is required.";
  if (!values.agreements?.taxCompliance) errors.taxCompliance = "Tax compliance agreement is required.";
  return errors;
}

export function calculateCommissionPreview(price, commissionPercentage) {
  const productPrice = Math.max(0, Number(price || 0));
  const rate = Math.max(0, Number(commissionPercentage || 0));
  return Math.round(productPrice * rate) / 100;
}
