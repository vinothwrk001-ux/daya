const { AppError } = require("../utils/AppError");

const FALLBACK_PAYMENT_MODELS = [
  { key: "fixed", label: "Fixed Payment" },
  { key: "commission", label: "Commission Model" },
  { key: "hybrid", label: "Hybrid Model" },
  { key: "free_product", label: "Free Product Promotion" },
];

const FALLBACK_CAMPAIGN_TYPES = [
  { key: "affiliate", label: "Affiliate Campaign", allowedPaymentModels: ["commission", "hybrid"] },
  { key: "sponsored", label: "Sponsored Campaign", allowedPaymentModels: ["fixed", "hybrid"] },
  { key: "ugc", label: "UGC Campaign", allowedPaymentModels: ["fixed", "free_product"] },
  { key: "video", label: "Video Campaign", allowedPaymentModels: ["fixed", "hybrid", "free_product"] },
  { key: "live_commerce", label: "Live Commerce Campaign", allowedPaymentModels: ["commission", "hybrid"] },
  { key: "brand_ambassador", label: "Brand Ambassador Program", allowedPaymentModels: ["fixed", "hybrid"] },
  { key: "custom", label: "Custom Campaign", allowedPaymentModels: ["fixed", "commission", "hybrid", "free_product"] },
];

const FALLBACK_FIELD_MATRIX = {
  fixed: [
    { fieldName: "fixedFee", label: "Fixed Amount", fieldType: "currency", required: true },
    { fieldName: "currency", label: "Currency", fieldType: "select", required: true, defaultValue: "INR" },
    { fieldName: "milestonePayment", label: "Milestone Payment", fieldType: "boolean" },
    { fieldName: "selectedServices", label: "Deliverables", fieldType: "service_selector" },
    { fieldName: "paymentSchedule", label: "Payment Schedule", fieldType: "textarea" },
  ],
  commission: [
    { fieldName: "commissionPercent", label: "Commission %", fieldType: "percentage", required: true, defaultValue: 10 },
    { fieldName: "attributionDays", label: "Attribution Window", fieldType: "select", required: true, defaultValue: 30 },
    { fieldName: "commissionRules", label: "Commission Rules", fieldType: "textarea" },
    { fieldName: "expectedBudget", label: "Maximum Budget", fieldType: "currency" },
    { fieldName: "commissionCap", label: "Commission Cap", fieldType: "currency" },
    { fieldName: "affiliateTrackingEnabled", label: "Affiliate Tracking Enabled", fieldType: "boolean", defaultValue: true },
  ],
  hybrid: [
    { fieldName: "fixedFee", label: "Fixed Fee", fieldType: "currency", required: true },
    { fieldName: "commissionPercent", label: "Commission %", fieldType: "percentage", required: true, defaultValue: 10 },
    { fieldName: "attributionDays", label: "Attribution Window", fieldType: "select", required: true, defaultValue: 30 },
    { fieldName: "expectedBudget", label: "Maximum Budget", fieldType: "currency" },
    { fieldName: "commissionCap", label: "Commission Cap", fieldType: "currency" },
    { fieldName: "milestonePayment", label: "Milestone Payment", fieldType: "boolean" },
    { fieldName: "selectedServices", label: "Deliverables", fieldType: "service_selector" },
  ],
  free_product: [
    { fieldName: "productValue", label: "Product Value", fieldType: "currency", required: true },
    { fieldName: "shippingDetails", label: "Shipping Details", fieldType: "textarea" },
    { fieldName: "expectedDeliverables", label: "Expected Deliverables", fieldType: "textarea" },
    { fieldName: "returnRequired", label: "Return Required", fieldType: "boolean" },
    { fieldName: "productOwnershipTransfer", label: "Product Ownership Transfer", fieldType: "boolean", defaultValue: true },
  ],
};

function keyOf(row = {}) {
  if (typeof row === "string") return row.trim().toLowerCase();
  return String(row.key || row.slug || row.fieldName || "").trim().toLowerCase();
}

function labelOf(row = {}) {
  if (typeof row === "string") return row;
  return row.label || row.name || row.field?.label || row.fieldName || row.key || row.slug || "";
}

function normalizeCampaignType(value = "") {
  const normalized = String(value || "affiliate").trim().toLowerCase();
  const aliases = {
    product_review: "ugc",
    productreview: "ugc",
    ambassador: "brand_ambassador",
    live: "live_commerce",
  };
  return aliases[normalized] || normalized || "affiliate";
}

function normalizePaymentType(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    fixed_payment: "fixed",
    commission_model: "commission",
    commission_only: "commission",
    percentage: "commission",
    product: "free_product",
    free_product_promotion: "free_product",
  };
  const next = aliases[normalized] || normalized;
  return ["fixed", "commission", "hybrid", "free_product"].includes(next) ? next : "commission";
}

function paymentInput(payload = {}) {
  return payload.paymentModel || payload.payment || {};
}

function inferPaymentType(payload = {}) {
  const input = paymentInput(payload);
  const fallback = payload.fixedFee && payload.commissionPercent ? "hybrid" : payload.fixedFee ? "fixed" : "commission";
  return normalizePaymentType(input.paymentType || input.type || payload.paymentType || fallback);
}

function selectedServices(payload = {}) {
  const input = paymentInput(payload);
  const rows = input.selectedServices || input.services || payload.selectedServices || payload.services || [];
  return Array.isArray(rows) ? rows : [];
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim() !== "";
}

function fieldValue(payload = {}, fieldName = "") {
  const input = paymentInput(payload);
  const dynamicFields = payload.dynamicFields || input.dynamicFields || {};
  const aliases = {
    fixedAmount: "fixedFee",
    commissionPercentage: "commissionPercent",
    maximumBudget: "expectedBudget",
    product: "productIds",
    deliverables: "selectedServices",
  };
  const names = [fieldName, aliases[fieldName]].filter(Boolean);
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(dynamicFields, name)) return dynamicFields[name];
    if (Object.prototype.hasOwnProperty.call(input, name)) return input[name];
    if (Object.prototype.hasOwnProperty.call(payload, name)) return payload[name];
  }
  if (fieldName === "commissionPercent") return input.commissionPercentage ?? input.commissionPercent ?? payload.commissionPercent;
  if (fieldName === "fixedFee") return input.fixedFee ?? payload.fixedFee;
  if (fieldName === "attributionDays") return input.attributionDays ?? payload.attributionDays;
  return undefined;
}

function normalizeField(field = {}) {
  const configuration = field.configuration || field.field?.configuration || {};
  const fieldName = field.fieldName || field.key || field.field?.key || "";
  return {
    ...field,
    fieldName,
    key: fieldName,
    label: field.label || field.field?.label || fieldName,
    fieldType: field.fieldType || field.type || field.field?.fieldType || "text",
    required: Boolean(field.required ?? field.field?.required),
    configuration,
    options: field.options || configuration.options || field.field?.options || [],
    min: field.min ?? configuration.min ?? field.field?.min,
    max: field.max ?? configuration.max ?? field.field?.max,
    defaultValue: field.defaultValue ?? configuration.defaultValue ?? field.field?.defaultValue ?? null,
    displayOrder: Number(field.displayOrder || field.field?.displayOrder || 0),
  };
}

function normalizePaymentModel(row = {}) {
  const key = keyOf(row);
  return {
    ...row,
    key,
    slug: key,
    label: labelOf(row),
    name: labelOf(row),
    displayOrder: Number(row.displayOrder || 0),
  };
}

function normalizeCampaignTypeRow(row = {}, paymentModels = []) {
  const key = keyOf(row);
  const paymentByKey = new Map(paymentModels.map((payment) => [payment.key, payment]));
  const allowedRows = row.allowedPaymentModels || row.paymentModels || row.allowedPayments || [];
  const allowedPaymentModels = allowedRows.map((item) => {
    const paymentKey = normalizePaymentType(typeof item === "string" ? item : keyOf(item));
    return paymentByKey.get(paymentKey) || normalizePaymentModel({ key: paymentKey, label: labelOf(item) || paymentKey });
  }).filter((item) => item.key);
  return {
    ...row,
    key,
    slug: key,
    label: labelOf(row),
    name: labelOf(row),
    displayOrder: Number(row.displayOrder || 0),
    allowedPaymentModels,
    paymentModels: allowedPaymentModels,
    defaultPaymentType: row.defaultPaymentType || allowedPaymentModels[0]?.key || "",
  };
}

function ruleEngineConfig(configuration = {}) {
  const engine = configuration.campaignRuleEngine || {};
  const paymentModels = (engine.paymentModels?.length ? engine.paymentModels : configuration.paymentModelOptions?.length ? configuration.paymentModelOptions : configuration.paymentModels?.length ? configuration.paymentModels : FALLBACK_PAYMENT_MODELS)
    .map(normalizePaymentModel)
    .filter((row) => row.key)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const campaignTypes = (engine.campaignTypes?.length ? engine.campaignTypes : configuration.campaignTypes?.length ? configuration.campaignTypes : FALLBACK_CAMPAIGN_TYPES)
    .map((row) => normalizeCampaignTypeRow(row, paymentModels))
    .filter((row) => row.key)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const fieldsByCombination = { ...(engine.fieldsByCombination || {}) };

  if (!Object.keys(fieldsByCombination).length) {
    campaignTypes.forEach((type) => {
      type.allowedPaymentModels.forEach((payment) => {
        fieldsByCombination[`${type.key}:${payment.key}`] = (FALLBACK_FIELD_MATRIX[payment.key] || []).map(normalizeField);
      });
    });
  }

  const attributionWindows = (engine.attributionWindows?.length ? engine.attributionWindows : configuration.attributionWindows?.length ? configuration.attributionWindows : [{ key: "30_days", label: "30 Days", days: 30 }, { key: "60_days", label: "60 Days", days: 60 }, { key: "90_days", label: "90 Days", days: 90 }])
    .filter((row) => !row.customAllowed)
    .map((row) => ({ ...row, days: Number(row.days || 0) }))
    .filter((row) => row.days > 0)
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || a.days - b.days);

  return {
    campaignTypes,
    paymentModels,
    fieldsByCombination,
    attributionWindows,
    validationRulesByCombination: engine.validationRulesByCombination || {},
  };
}

class CampaignRuleEngineService {
  getClientConfiguration(configuration = {}) {
    return ruleEngineConfig(configuration);
  }

  evaluateCampaignRules(payload = {}, configuration = {}) {
    const config = ruleEngineConfig(configuration);
    const requestedCampaignType = normalizeCampaignType(payload.campaignType);
    const campaignType = config.campaignTypes.find((row) => row.key === requestedCampaignType);
    if (!campaignType) {
      throw new AppError("Campaign type is not active or configured", 400, "INVALID_CAMPAIGN_TYPE");
    }

    const paymentType = inferPaymentType(payload);
    const allowedPaymentModels = campaignType.allowedPaymentModels.length
      ? campaignType.allowedPaymentModels
      : config.paymentModels;
    const paymentModel = allowedPaymentModels.find((row) => row.key === paymentType);
    if (!paymentModel) {
      throw new AppError(`${campaignType.label || "Campaign"} does not allow ${paymentType.replace(/_/g, " ")} payment`, 400, "INVALID_CAMPAIGN_PAYMENT_MODEL");
    }

    const dynamicFields = (config.fieldsByCombination[`${campaignType.key}:${paymentType}`] || FALLBACK_FIELD_MATRIX[paymentType] || [])
      .map(normalizeField)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
    const validationRules = config.validationRulesByCombination[`${campaignType.key}:${paymentType}`] || [];
    const affiliateTrackingEnabled = ["commission", "hybrid"].includes(paymentType);
    const allowedAttributionDays = config.attributionWindows.map((row) => Number(row.days || 0)).filter(Boolean);
    const defaultAttributionDays = allowedAttributionDays[0] || 30;
    const requestedAttributionDays = numericValue(fieldValue(payload, "attributionDays") || defaultAttributionDays);
    const attributionDays = affiliateTrackingEnabled ? requestedAttributionDays : 0;

    if (affiliateTrackingEnabled && !allowedAttributionDays.includes(attributionDays)) {
      throw new AppError("Selected attribution window is not allowed", 400, "INVALID_ATTRIBUTION_WINDOW");
    }

    this.validateRequiredFields({ payload, paymentType, dynamicFields });
    this.validatePaymentValues({ payload, paymentType, attributionDays, affiliateTrackingEnabled });

    return {
      campaignType: campaignType.key,
      campaignTypeConfig: campaignType,
      paymentType,
      paymentModel,
      allowedPaymentModels,
      dynamicFields,
      validationRules,
      attributionDays,
      allowedAttributionDays,
      affiliateTrackingEnabled,
      affiliateInfrastructure: {
        enabled: affiliateTrackingEnabled,
        generateAffiliateLink: affiliateTrackingEnabled,
        attributionWindowDays: attributionDays,
        clickTracking: affiliateTrackingEnabled,
        conversionTracking: affiliateTrackingEnabled,
        commissionLedger: affiliateTrackingEnabled,
        payoutTracking: affiliateTrackingEnabled,
      },
    };
  }

  validateRequiredFields({ payload, paymentType, dynamicFields }) {
    const serviceRows = selectedServices(payload);
    const productRows = Array.isArray(payload.productIds) ? payload.productIds : [];
    dynamicFields.forEach((field) => {
      if (!field.required || field.configuration?.readOnly) return;
      const name = field.fieldName || field.key;
      if (name === "selectedServices" && serviceRows.length) return;
      if (name === "productValue" && productRows.length) return;
      if (name === "currency") return;
      if (name === "fixedFee" && serviceRows.length) return;
      if (!hasValue(fieldValue(payload, name))) {
        throw new AppError(`${field.label || name} is required for ${paymentType.replace(/_/g, " ")} payment`, 400, "CAMPAIGN_FIELD_REQUIRED");
      }
    });
  }

  validatePaymentValues({ payload, paymentType, attributionDays, affiliateTrackingEnabled }) {
    const serviceRows = selectedServices(payload);
    if (["fixed", "hybrid"].includes(paymentType)) {
      const fixedFee = numericValue(fieldValue(payload, "fixedFee"));
      if (fixedFee <= 0 && !serviceRows.length) {
        throw new AppError("Fixed payment campaigns require a fixed amount or selected creator services", 400, "FIXED_PAYMENT_REQUIRED");
      }
    }
    if (["commission", "hybrid"].includes(paymentType)) {
      const commissionPercent = numericValue(fieldValue(payload, "commissionPercent"));
      if (commissionPercent <= 0 || commissionPercent > 50) {
        throw new AppError("Commission payment campaigns require a commission percentage between 1 and 50", 400, "INVALID_COMMISSION_PERCENTAGE");
      }
      if (!affiliateTrackingEnabled || !attributionDays) {
        throw new AppError("Commission payment campaigns require affiliate attribution tracking", 400, "AFFILIATE_TRACKING_REQUIRED");
      }
    }
    if (paymentType === "free_product" && (!Array.isArray(payload.productIds) || !payload.productIds.length)) {
      throw new AppError("Free product campaigns require at least one product", 400, "PRODUCT_REQUIRED");
    }
    const commissionCap = numericValue(fieldValue(payload, "commissionCap"));
    const maximumBudget = numericValue(fieldValue(payload, "maximumBudget") || fieldValue(payload, "expectedBudget"));
    if (commissionCap > 0 && maximumBudget > 0 && commissionCap > maximumBudget) {
      throw new AppError("Commission cap cannot exceed the maximum budget", 400, "INVALID_COMMISSION_CAP");
    }
  }
}

module.exports = new CampaignRuleEngineService();
module.exports._private = {
  normalizeCampaignType,
  normalizePaymentType,
  ruleEngineConfig,
};
