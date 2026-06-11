const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const auditService = require("./audit.service");
const { Campaign } = require("../modules/campaign/model");
const { InfluencerProfile, InfluencerSocialAccount } = require("../modules/influencer/model");
const { CommissionRecord } = require("../modules/commission/models");
const { Vendor } = require("../models/Vendor");
const notificationService = require("./notification.service");
const {
  InfluencerScoreConfig,
  InfluencerTier,
  VendorSubscriptionPlan,
  VendorSubscription,
  CampaignBudgetControl,
  BudgetProtectionRule,
  MarketplaceRankingRule,
  InfluencerPlatformConfiguration,
  InfluencerServiceType,
  InfluencerPackageTemplate,
  InfluencerCategoryOption,
  InfluencerLanguageOption,
  CampaignAttributionWindow,
  CampaignPaymentModelConfig,
  CampaignTypeConfig,
  CampaignPaymentModelOption,
  CampaignPaymentRuleConfig,
  CampaignDynamicFieldConfig,
  CampaignValidationRuleConfig,
  InfluencerRequirementField,
  InfluencerCampaignTemplate,
  InfluencerDiscoveryRule,
  InfluencerCampaignRule,
  InfluencerDynamicFormField,
  InfluencerConfigVersion,
  ConfigAuditLog,
} = require("../models/InfluencerCommerceConfig");

const MODULE = "influencer_commerce_config";
const ENTITY = {
  scoreConfigs: InfluencerScoreConfig,
  tiers: InfluencerTier,
  subscriptionPlans: VendorSubscriptionPlan,
  vendorSubscriptions: VendorSubscription,
  budgetControls: CampaignBudgetControl,
  budgetRules: BudgetProtectionRule,
  rankingRules: MarketplaceRankingRule,
  platformConfigurations: InfluencerPlatformConfiguration,
  serviceTypes: InfluencerServiceType,
  packageTemplates: InfluencerPackageTemplate,
  categoryOptions: InfluencerCategoryOption,
  languageOptions: InfluencerLanguageOption,
  attributionWindows: CampaignAttributionWindow,
  paymentModels: CampaignPaymentModelConfig,
  campaignTypes: CampaignTypeConfig,
  paymentModelOptions: CampaignPaymentModelOption,
  campaignPaymentRules: CampaignPaymentRuleConfig,
  campaignDynamicFields: CampaignDynamicFieldConfig,
  campaignValidationRules: CampaignValidationRuleConfig,
  requirementFields: InfluencerRequirementField,
  campaignTemplates: InfluencerCampaignTemplate,
  discoveryRules: InfluencerDiscoveryRule,
  campaignRules: InfluencerCampaignRule,
  dynamicFormFields: InfluencerDynamicFormField,
};

function actorId(actor) {
  return actor?.sub || actor?._id || actor?.id || null;
}

function objectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function percent(value, max) {
  const denominator = Math.max(1, Number(max) || 1);
  return boundedScore((Number(value || 0) / denominator) * 100);
}

function scoreWeightTotal(payload = {}) {
  return ["followersWeight", "engagementWeight", "conversionWeight", "completionWeight", "revenueWeight"]
    .reduce((sum, key) => sum + cleanNumber(payload[key]), 0);
}

function rankingWeightTotal(payload = {}) {
  return [
    "scoreWeight",
    "revenueWeight",
    "ordersWeight",
    "conversionWeight",
    "campaignSuccessWeight",
    "storefrontRevenueWeight",
    "engagementWeight",
    "followersWeight",
  ].reduce((sum, key) => sum + cleanNumber(payload[key]), 0);
}

function activeQuery() {
  return { "approval.status": "active" };
}

function nonArchivedQuery() {
  return { "approval.status": { $ne: "archived" } };
}

async function editableSingleton(Model) {
  return (
    await Model.findOne(activeQuery()).sort({ "approval.version": -1, updatedAt: -1 }).lean()
  ) || (
    await Model.findOne(nonArchivedQuery()).sort({ "approval.version": -1, updatedAt: -1 }).lean()
  );
}

function normalizeConfigName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function exactNameRegex(value = "") {
  return new RegExp(`^${String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function configVersion(doc) {
  return Number(doc?.approval?.version || doc?.version || 1);
}

const SERVICE_TYPE_DEFAULTS = [
  ["reel", "Reel", 1],
  ["post", "Post", 2],
  ["story", "Story", 3],
  ["live_stream", "Live Stream", 4],
  ["short_video", "Short Video", 5],
  ["unboxing_video", "Unboxing Video", 6],
  ["review_video", "Review Video", 7],
  ["storefront_promotion", "Storefront Promotion", 8],
  ["collection_promotion", "Collection Promotion", 9],
  ["affiliate_promotion", "Affiliate Promotion", 10],
  ["custom_service", "Custom Service", 99],
].map(([key, label, displayOrder]) => ({
  key,
  label,
  displayOrder,
  defaultCurrency: "INR",
  defaultDeliveryDays: key === "live_stream" ? 0 : 3,
  defaultRevisionCount: 1,
  approval: { status: "active", version: 1 },
}));

const PACKAGE_TEMPLATE_DEFAULTS = [
  ["single", "Single Deliverable", "", "Single Deliverable", 1, 3, 1, 1],
  ["bundle_3", "Three Deliverables", "", "Three Deliverables", 3, 5, 1, 2],
  ["bundle_5", "Five Deliverables", "", "Five Deliverables", 5, 7, 2, 3],
].map(([key, label, serviceTypeKey, packageName, quantity, defaultDeliveryDays, defaultRevisionCount, displayOrder]) => ({
  key,
  label,
  serviceTypeKey,
  packageName,
  quantity,
  defaultDeliveryDays,
  defaultRevisionCount,
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const CATEGORY_OPTION_DEFAULTS = [
  ["fashion", "Fashion", 1],
  ["beauty", "Beauty", 2],
  ["fitness", "Fitness", 3],
  ["food", "Food", 4],
  ["technology", "Technology", 5],
  ["home", "Home", 6],
  ["travel", "Travel", 7],
].map(([key, label, displayOrder]) => ({
  key,
  label,
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const LANGUAGE_OPTION_DEFAULTS = [
  ["en", "English", 1],
  ["hi", "Hindi", 2],
  ["ta", "Tamil", 3],
  ["te", "Telugu", 4],
  ["ml", "Malayalam", 5],
  ["kn", "Kannada", 6],
].map(([key, label, displayOrder]) => ({
  key,
  label,
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const ATTRIBUTION_WINDOW_DEFAULTS = [
  { key: "30_days", label: "30 Days", days: 30, displayOrder: 1 },
  { key: "60_days", label: "60 Days", days: 60, displayOrder: 2 },
  { key: "90_days", label: "90 Days", days: 90, displayOrder: 3 },
  { key: "custom", label: "Custom", days: 30, customAllowed: true, minDays: 1, maxDays: 365, displayOrder: 99 },
].map((row) => ({ ...row, approval: { status: "active", version: 1 } }));

const PAYMENT_MODEL_DEFAULTS = [
  {
    key: "fixed",
    label: "Fixed Payment",
    requiresFixedFee: true,
    fields: [
      { key: "services", label: "Services", fieldType: "json", required: true, displayOrder: 1 },
      { key: "quantity", label: "Quantity", fieldType: "number", required: true, min: 1, defaultValue: 1, displayOrder: 2 },
      { key: "total", label: "Total", fieldType: "currency", required: true, displayOrder: 3 },
    ],
    budgetComponents: ["fixedCost", "taxes", "platformFees"],
    displayOrder: 1,
  },
  {
    key: "commission",
    label: "Commission Model",
    requiresCommission: true,
    requiresAttributionWindow: true,
    fields: [
      { key: "commissionPercentage", label: "Commission %", fieldType: "percentage", required: true, min: 0, max: 50, displayOrder: 1 },
      { key: "attributionDays", label: "Attribution Window", fieldType: "number", required: true, defaultValue: 30, displayOrder: 2 },
      { key: "expectedBudget", label: "Expected Budget", fieldType: "currency", required: false, displayOrder: 3 },
    ],
    budgetComponents: ["commissionReserve", "taxes", "platformFees"],
    displayOrder: 2,
  },
  {
    key: "hybrid",
    label: "Hybrid Model",
    requiresFixedFee: true,
    requiresCommission: true,
    requiresAttributionWindow: true,
    fields: [
      { key: "services", label: "Services", fieldType: "json", required: true, displayOrder: 1 },
      { key: "fixedFee", label: "Fixed Fee", fieldType: "currency", required: true, displayOrder: 2 },
      { key: "commissionPercentage", label: "Commission %", fieldType: "percentage", required: true, min: 0, max: 50, displayOrder: 3 },
      { key: "attributionDays", label: "Attribution Window", fieldType: "number", required: true, defaultValue: 30, displayOrder: 4 },
    ],
    budgetComponents: ["fixedCost", "commissionReserve", "taxes", "platformFees"],
    displayOrder: 3,
  },
  {
    key: "free_product",
    label: "Free Product Promotion",
    requiresProduct: true,
    fields: [
      { key: "productValue", label: "Product Value", fieldType: "currency", required: true, displayOrder: 1 },
      { key: "shippingCost", label: "Shipping", fieldType: "currency", required: false, displayOrder: 2 },
      { key: "returnRequired", label: "Return Required", fieldType: "boolean", required: false, defaultValue: false, displayOrder: 3 },
    ],
    budgetComponents: ["productCost", "shippingCost", "taxes", "platformFees"],
    displayOrder: 4,
  },
].map((row) => ({ ...row, approval: { status: "active", version: 1 } }));

const CAMPAIGN_TYPE_DEFAULTS = [
  ["affiliate", "Affiliate Campaign", "Drive tracked sales through affiliate links.", 1],
  ["sponsored", "Sponsored Campaign", "Brand awareness and sponsored content.", 2],
  ["ugc", "UGC Campaign", "Purchase creator-generated content.", 3],
  ["video", "Video Campaign", "Reels, Shorts, video reviews, and product videos.", 4],
  ["live_commerce", "Live Commerce Campaign", "Live selling and real-time commerce.", 5],
  ["brand_ambassador", "Brand Ambassador Program", "Long-term creator partnerships.", 6],
  ["custom", "Custom Campaign", "Admin-configured campaign workflow for future campaign types.", 99],
].map(([slug, name, purpose, displayOrder]) => ({
  slug,
  name,
  description: purpose,
  purpose,
  status: "active",
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const PAYMENT_MODEL_OPTION_DEFAULTS = [
  ["fixed", "Fixed Payment", "Pay a fixed creator fee for agreed deliverables.", 1],
  ["commission", "Commission Model", "Pay through attributed sales commission.", 2],
  ["hybrid", "Hybrid Model", "Combine a fixed fee with attributed sales commission.", 3],
  ["free_product", "Free Product Promotion", "Provide product value instead of direct cash payment.", 4],
].map(([slug, name, description, displayOrder]) => ({
  slug,
  name,
  description,
  status: "active",
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const CAMPAIGN_PAYMENT_RULE_MATRIX = {
  affiliate: ["commission", "hybrid"],
  sponsored: ["fixed", "hybrid"],
  ugc: ["fixed", "free_product"],
  video: ["fixed", "hybrid", "free_product"],
  live_commerce: ["commission", "hybrid"],
  brand_ambassador: ["fixed", "hybrid"],
  custom: ["fixed", "commission", "hybrid", "free_product"],
};

const CAMPAIGN_DYNAMIC_FIELD_DEFAULTS = {
  fixed: [
    ["fixedFee", "Fixed Amount", "currency", true, { min: 0 }],
    ["currency", "Currency", "select", true, { defaultValue: "INR", options: [{ label: "INR", value: "INR" }] }],
    ["milestonePayment", "Milestone Payment", "boolean", false, { defaultValue: false }],
    ["selectedServices", "Deliverables", "service_selector", false, {}],
    ["paymentSchedule", "Payment Schedule", "textarea", false, {}],
  ],
  commission: [
    ["commissionPercent", "Commission %", "percentage", true, { min: 0, max: 50, defaultValue: 10 }],
    ["attributionDays", "Attribution Window", "select", true, { defaultValue: 30, source: "attributionWindows" }],
    ["commissionRules", "Commission Rules", "textarea", false, {}],
    ["expectedBudget", "Maximum Budget", "currency", false, { min: 0 }],
    ["commissionCap", "Commission Cap", "currency", false, { min: 0 }],
    ["affiliateTrackingEnabled", "Affiliate Tracking Enabled", "boolean", false, { defaultValue: true, readOnly: true }],
  ],
  hybrid: [
    ["fixedFee", "Fixed Fee", "currency", true, { min: 0 }],
    ["commissionPercent", "Commission %", "percentage", true, { min: 0, max: 50, defaultValue: 10 }],
    ["attributionDays", "Attribution Window", "select", true, { defaultValue: 30, source: "attributionWindows" }],
    ["expectedBudget", "Maximum Budget", "currency", false, { min: 0 }],
    ["commissionCap", "Commission Cap", "currency", false, { min: 0 }],
    ["milestonePayment", "Milestone Payment", "boolean", false, { defaultValue: false }],
    ["selectedServices", "Deliverables", "service_selector", false, {}],
  ],
  free_product: [
    ["productValue", "Product Value", "currency", true, { min: 0 }],
    ["shippingDetails", "Shipping Details", "textarea", false, {}],
    ["expectedDeliverables", "Expected Deliverables", "textarea", false, {}],
    ["returnRequired", "Return Required", "boolean", false, { defaultValue: false }],
    ["productOwnershipTransfer", "Product Ownership Transfer", "boolean", false, { defaultValue: true }],
  ],
};

const REQUIREMENT_FIELD_DEFAULTS = [
  ["productRequired", "Product Required", "boolean", 1],
  ["sampleRequired", "Sample Required", "boolean", 2],
  ["productReturnRequired", "Product Return Required", "boolean", 3],
  ["brandGuidelinesRequired", "Brand Guidelines Required", "boolean", 4],
  ["creativeApprovalRequired", "Creative Approval Required", "boolean", 5],
  ["contentApprovalRequired", "Content Approval Required", "boolean", 6],
  ["minimumBudget", "Minimum Campaign Budget", "currency", 7],
  ["minimumAttributionDays", "Minimum Attribution Window", "number", 8],
  ["preferredCategories", "Preferred Categories", "multi_select", 9],
  ["languages", "Languages", "multi_select", 10],
  ["targetAudience", "Target Audience", "textarea", 11],
  ["deliveryTime", "Delivery Time", "text", 12],
  ["communicationPreferences", "Communication Preferences", "textarea", 13],
  ["location", "Location", "location", 14],
  ["shippingAddress", "Shipping Address", "address", 15],
  ["notes", "Notes", "textarea", 16],
].map(([key, label, fieldType, displayOrder]) => ({
  key,
  label,
  fieldType,
  displayOrder,
  approval: { status: "active", version: 1 },
}));

const DYNAMIC_FORM_FIELD_DEFAULTS = PAYMENT_MODEL_DEFAULTS.flatMap((model) => (
  model.fields.map((field) => ({
    scope: "campaign_payment_model",
    paymentType: model.key,
    field,
    displayOrder: field.displayOrder || model.displayOrder,
    approval: { status: "active", version: 1 },
  }))
));

async function logConfigChange({ actor, action, entityType, entityId, oldValue, newValue, reason = "", reqMeta = {} }) {
  await ConfigAuditLog.create({
    module: MODULE,
    entityType,
    entityId: entityId ? String(entityId) : "",
    action,
    oldValue,
    newValue,
    changedBy: actorId(actor),
    reason,
    ipAddress: reqMeta.ipAddress || actor?.ipAddress || "",
    userAgent: reqMeta.userAgent || actor?.userAgent || "",
  });
  await auditService.log({
    actor,
    action: `admin.influencer_commerce_config.${entityType}.${action}`,
    entityType,
    entityId,
    metadata: { reason, oldValue, newValue },
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent,
  }).catch(() => {});
}

async function saveVersion({ entityType, doc, actor, reason = "" }) {
  await InfluencerConfigVersion.create({
    module: MODULE,
    entityType,
    entityId: doc._id,
    version: configVersion(doc),
    snapshot: doc.toObject ? doc.toObject() : doc,
    reason,
    createdBy: actorId(actor),
  });
}

async function archiveDocument({ actor, entityType, doc, reason, reqMeta = {}, action = "delete" }) {
  const oldValue = doc.toObject();
  const nextApproval = {
    ...(oldValue.approval || {}),
    status: "archived",
    archivedAt: new Date(),
    updatedBy: actorId(actor),
    version: configVersion(oldValue) + 1,
    reason,
  };
  doc.set({ approval: nextApproval });
  await doc.save();
  await saveVersion({ entityType, doc, actor, reason });
  await logConfigChange({
    actor,
    action,
    entityType,
    entityId: doc._id,
    oldValue,
    newValue: doc.toObject(),
    reason,
    reqMeta,
  });
  return doc;
}

function ensureModel(entityType) {
  const Model = ENTITY[entityType];
  if (!Model) throw new AppError("Unknown configuration type", 400, "INVALID_CONFIG_TYPE");
  return Model;
}

function validateConfig(entityType, payload = {}) {
  if (entityType === "scoreConfigs" && payload.approval?.status === "active" && scoreWeightTotal(payload) !== 100) {
    throw new AppError("Influencer score weights must equal 100 before activation", 400, "INVALID_SCORE_WEIGHTS");
  }
  if (entityType === "rankingRules" && payload.approval?.status === "active" && rankingWeightTotal(payload) !== 100) {
    throw new AppError("Marketplace ranking weights must equal 100 before activation", 400, "INVALID_RANKING_WEIGHTS");
  }
  if (entityType === "tiers") {
    if (cleanNumber(payload.minScore) > cleanNumber(payload.maxScore, 100)) {
      throw new AppError("Tier minimum score cannot be greater than maximum score", 400, "INVALID_TIER_RANGE");
    }
    if (cleanNumber(payload.maxFollowers) > 0 && cleanNumber(payload.minFollowers) > cleanNumber(payload.maxFollowers)) {
      throw new AppError("Tier minimum followers cannot be greater than maximum followers", 400, "INVALID_TIER_FOLLOWER_RANGE");
    }
  }
  if (entityType === "campaignTypes") {
    if (!payload.name || !payload.slug) throw new AppError("Campaign type name and slug are required", 400, "INVALID_CAMPAIGN_TYPE_CONFIG");
  }
  if (entityType === "paymentModelOptions") {
    if (!payload.name || !payload.slug) throw new AppError("Payment model name and slug are required", 400, "INVALID_PAYMENT_MODEL_CONFIG");
  }
  if (entityType === "campaignPaymentRules") {
    if (!payload.campaignTypeId || !payload.paymentModelId) throw new AppError("Campaign payment rules require campaignTypeId and paymentModelId", 400, "INVALID_PAYMENT_RULE_CONFIG");
  }
  if (entityType === "campaignDynamicFields") {
    if (!payload.campaignTypeId || !payload.paymentModelId || !payload.fieldName) {
      throw new AppError("Campaign dynamic fields require campaignTypeId, paymentModelId, and fieldName", 400, "INVALID_DYNAMIC_FIELD_CONFIG");
    }
  }
  if (entityType === "campaignValidationRules") {
    if (!payload.campaignTypeId || !payload.paymentModelId || !payload.ruleName) {
      throw new AppError("Campaign validation rules require campaignTypeId, paymentModelId, and ruleName", 400, "INVALID_VALIDATION_RULE_CONFIG");
    }
  }
}

function configKey(row = {}) {
  if (typeof row === "string") return row.trim().toLowerCase();
  return String(row.slug || row.key || row.fieldName || "").trim().toLowerCase();
}

function configLabel(row = {}) {
  if (typeof row === "string") return row;
  return row.name || row.label || row.field?.label || row.fieldName || row.slug || row.key || "";
}

function isActiveCampaignConfig(row = {}) {
  return row.status !== "inactive" && row.status !== "archived" && row.approval?.status === "active";
}

function normalizeCampaignDynamicField(field = {}, campaignTypeMap = new Map(), paymentModelMap = new Map()) {
  const configuration = field.configuration || field.field?.configuration || {};
  const fieldName = field.fieldName || field.field?.key || field.key || "";
  return {
    id: field._id,
    campaignTypeId: field.campaignTypeId,
    campaignType: campaignTypeMap.get(String(field.campaignTypeId))?.slug || "",
    paymentModelId: field.paymentModelId,
    paymentType: paymentModelMap.get(String(field.paymentModelId))?.slug || field.paymentType || "",
    fieldName,
    key: fieldName,
    label: field.label || field.field?.label || fieldName,
    fieldType: field.fieldType || field.field?.fieldType || "text",
    type: field.fieldType || field.field?.fieldType || "text",
    required: Boolean(field.required ?? field.field?.required),
    configuration,
    options: configuration.options || field.field?.options || [],
    min: configuration.min ?? field.field?.min,
    max: configuration.max ?? field.field?.max,
    defaultValue: configuration.defaultValue ?? field.field?.defaultValue ?? null,
    displayOrder: Number(field.displayOrder || field.field?.displayOrder || 0),
  };
}

function buildCampaignRuleEngineConfig({
  campaignTypes = [],
  paymentModelOptions = [],
  campaignPaymentRules = [],
  campaignDynamicFields = [],
  campaignValidationRules = [],
  attributionWindows = [],
} = {}) {
  const activeTypes = campaignTypes.filter(isActiveCampaignConfig).map((row) => ({
    id: row._id,
    key: configKey(row),
    slug: configKey(row),
    label: configLabel(row),
    name: configLabel(row),
    description: row.description || "",
    purpose: row.purpose || row.description || "",
    displayOrder: Number(row.displayOrder || 0),
  })).sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const activePayments = paymentModelOptions.filter(isActiveCampaignConfig).map((row) => ({
    id: row._id,
    key: configKey(row),
    slug: configKey(row),
    label: configLabel(row),
    name: configLabel(row),
    description: row.description || "",
    displayOrder: Number(row.displayOrder || 0),
    metadata: row.metadata || {},
  })).sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const campaignTypeMap = new Map(campaignTypes.map((row) => [String(row._id), row]));
  const paymentModelMap = new Map(paymentModelOptions.map((row) => [String(row._id), row]));
  const paymentByKey = new Map(activePayments.map((row) => [row.key, row]));
  const fieldsByCombination = {};
  const normalizedFields = campaignDynamicFields
    .filter((row) => row.approval?.status === "active")
    .map((row) => normalizeCampaignDynamicField(row, campaignTypeMap, paymentModelMap))
    .filter((row) => row.campaignType && row.paymentType)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));

  normalizedFields.forEach((field) => {
    const key = `${field.campaignType}:${field.paymentType}`;
    fieldsByCombination[key] = [...(fieldsByCombination[key] || []), field];
  });

  const rulesByType = campaignPaymentRules
    .filter((row) => row.approval?.status === "active" && row.status !== "inactive" && row.status !== "archived")
    .reduce((map, row) => {
      const type = campaignTypeMap.get(String(row.campaignTypeId));
      const payment = paymentModelMap.get(String(row.paymentModelId));
      const typeKey = configKey(type);
      const paymentKey = configKey(payment);
      if (!typeKey || !paymentKey) return map;
      const entry = map.get(typeKey) || { allowed: new Set(), blocked: new Set() };
      if (row.allowed) entry.allowed.add(paymentKey);
      else entry.blocked.add(paymentKey);
      map.set(typeKey, entry);
      return map;
    }, new Map());

  const validationRulesByCombination = campaignValidationRules
    .filter((row) => row.approval?.status === "active")
    .reduce((map, row) => {
      const typeKey = configKey(campaignTypeMap.get(String(row.campaignTypeId)));
      const paymentKey = configKey(paymentModelMap.get(String(row.paymentModelId)));
      if (!typeKey || !paymentKey) return map;
      const key = `${typeKey}:${paymentKey}`;
      map[key] = [...(map[key] || []), {
        id: row._id,
        ruleName: row.ruleName,
        severity: row.severity || "error",
        configuration: row.ruleConfiguration || {},
      }];
      return map;
    }, {});

  return {
    campaignTypes: activeTypes.map((type) => {
      const rule = rulesByType.get(type.key) || { allowed: new Set(activePayments.map((payment) => payment.key)), blocked: new Set() };
      const allowedPaymentModels = [...rule.allowed]
        .filter((key) => paymentByKey.has(key) && !rule.blocked.has(key))
        .map((key) => paymentByKey.get(key));
      return {
        ...type,
        allowedPaymentModels,
        paymentModels: allowedPaymentModels,
        defaultPaymentType: allowedPaymentModels[0]?.key || "",
      };
    }),
    paymentModels: activePayments,
    attributionWindows: attributionWindows
      .filter((row) => row.approval?.status === "active" && !row.customAllowed)
      .map((row) => ({ id: row._id, key: row.key, label: row.label, days: Number(row.days || 0), displayOrder: Number(row.displayOrder || 0) }))
      .filter((row) => row.days > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.days - b.days),
    fieldsByCombination,
    validationRulesByCombination,
  };
}

class InfluencerCommerceEngineService {
  async syncTierPlanPairs(actor = null, reqMeta = {}) {
    const activeTiers = await InfluencerTier.find(activeQuery()).sort({ displayOrder: 1, priority: 1 });
    const activeTierNames = new Set(activeTiers.map((tier) => normalizeConfigName(tier.tierName)).filter(Boolean));

    for (const tier of activeTiers) {
      await this.syncPairedConfig(actor, "tiers", tier, {}, reqMeta);
    }

    const orphanPlans = await VendorSubscriptionPlan.find(activeQuery());
    for (const plan of orphanPlans) {
      const planName = normalizeConfigName(plan.planName);
      if (planName && activeTierNames.has(planName)) continue;
      await archiveDocument({
        actor,
        entityType: "subscriptionPlans",
        doc: plan,
        reason: "Archived because no matching influencer tier exists",
        reqMeta,
        action: "sync_archive",
      });
    }
  }

  async syncPairedConfig(actor, entityType, doc, payload = {}, reqMeta = {}) {
    if (entityType === "tiers") {
      const tierName = String(doc.tierName || "").trim();
      if (!tierName) return null;
      const currentPlan = await VendorSubscriptionPlan.findOne({
        $or: [
          { linkedTierId: doc._id },
          { allowedTiers: doc._id },
          { planName: exactNameRegex(tierName) },
        ],
        "approval.status": { $ne: "archived" },
      });
      const planPayload = {
        planName: tierName,
        linkedTierId: doc._id,
        allowedTiers: [doc._id],
        allowAllTiers: false,
        displayOrder: doc.displayOrder || doc.priority || currentPlan?.displayOrder || 0,
        approval: {
          ...(currentPlan?.approval?.toObject ? currentPlan.approval.toObject() : currentPlan?.approval || {}),
          status: doc.approval?.status || "active",
          updatedBy: actorId(actor),
        },
      };
      if (currentPlan) {
        currentPlan.set(planPayload);
        await currentPlan.save();
        if (String(doc.linkedPlanId || "") !== String(currentPlan._id)) {
          doc.set({ linkedPlanId: currentPlan._id });
          await doc.save();
        }
        return currentPlan;
      }
      const createdPlan = await VendorSubscriptionPlan.create({
        planName: tierName,
        monthlyPrice: payload.monthlyPrice ?? 0,
        yearlyPrice: payload.yearlyPrice ?? 0,
        campaignLimit: payload.campaignLimit ?? 1,
        influencerVisibilityLimit: payload.influencerVisibilityLimit ?? 20,
        linkedTierId: doc._id,
        allowedTiers: [doc._id],
        allowAllTiers: false,
        displayOrder: doc.displayOrder || doc.priority || 0,
        approval: { status: doc.approval?.status || "active", version: 1, createdBy: actorId(actor), updatedBy: actorId(actor) },
      });
      doc.set({ linkedPlanId: createdPlan._id });
      await doc.save();
      await saveVersion({ entityType: "subscriptionPlans", doc: createdPlan, actor, reason: "Created automatically for matching influencer tier" });
      await logConfigChange({ actor, action: "sync_create", entityType: "subscriptionPlans", entityId: createdPlan._id, oldValue: null, newValue: createdPlan.toObject(), reason: "Created automatically for matching influencer tier", reqMeta });
      return createdPlan;
    }

    if (entityType === "subscriptionPlans") {
      const planName = String(doc.planName || "").trim();
      if (!planName) return null;
      let tier = await InfluencerTier.findOne({
        $or: [
          { linkedPlanId: doc._id },
          ...(doc.linkedTierId ? [{ _id: doc.linkedTierId }] : []),
          { tierName: exactNameRegex(planName) },
        ],
        "approval.status": { $ne: "archived" },
      });
      if (!tier) {
        tier = await InfluencerTier.create({
          tierName: planName,
          color: payload.color || "#475569",
          priority: payload.priority ?? doc.displayOrder ?? 0,
          displayOrder: payload.displayOrder ?? doc.displayOrder ?? 0,
          linkedPlanId: doc._id,
          approval: { status: doc.approval?.status || "active", version: 1, createdBy: actorId(actor), updatedBy: actorId(actor) },
        });
        await saveVersion({ entityType: "tiers", doc: tier, actor, reason: "Created automatically for matching vendor subscription plan" });
        await logConfigChange({ actor, action: "sync_create", entityType: "tiers", entityId: tier._id, oldValue: null, newValue: tier.toObject(), reason: "Created automatically for matching vendor subscription plan", reqMeta });
      } else {
        tier.set({
          tierName: planName,
          linkedPlanId: doc._id,
          displayOrder: payload.displayOrder ?? tier.displayOrder,
          approval: {
            ...(tier.approval?.toObject ? tier.approval.toObject() : tier.approval || {}),
            status: doc.approval?.status || tier.approval?.status || "active",
            updatedBy: actorId(actor),
          },
        });
        await tier.save();
      }
      doc.set({ linkedTierId: tier._id, allowedTiers: [tier._id], allowAllTiers: false });
      await doc.save();
      return tier;
    }

    return null;
  }

  async archivePairedConfig(actor, entityType, doc, reqMeta = {}) {
    if (entityType === "tiers") {
      const pairedPlan = await VendorSubscriptionPlan.findOne({
        $or: [
          { linkedTierId: doc._id },
          { allowedTiers: doc._id },
          { planName: exactNameRegex(doc.tierName) },
        ],
        "approval.status": { $ne: "archived" },
      });
      if (!pairedPlan) return null;
      return archiveDocument({
        actor,
        entityType: "subscriptionPlans",
        doc: pairedPlan,
        reason: `Archived automatically because tier ${doc.tierName} was archived`,
        reqMeta,
      });
    }

    if (entityType === "subscriptionPlans") {
      const pairedTier = await InfluencerTier.findOne({
        $or: [
          { linkedPlanId: doc._id },
          ...(doc.linkedTierId ? [{ _id: doc.linkedTierId }] : []),
          { tierName: exactNameRegex(doc.planName) },
        ],
        "approval.status": { $ne: "archived" },
      });
      if (!pairedTier) return null;
      return archiveDocument({
        actor,
        entityType: "tiers",
        doc: pairedTier,
        reason: `Archived automatically because plan ${doc.planName} was archived`,
        reqMeta,
      });
    }

    return null;
  }

  async ensureDefaults() {
    const existingTiers = await InfluencerTier.countDocuments();
    if (!existingTiers) {
      await InfluencerTier.insertMany([
        { tierName: "Starter", color: "#64748b", priority: 1, minScore: 0, maxScore: 20, displayOrder: 1, benefits: ["Basic campaign access"], approval: { status: "active", version: 1 } },
        { tierName: "Bronze", color: "#b45309", priority: 2, minScore: 21, maxScore: 40, displayOrder: 2, benefits: ["Entry campaign access"], approval: { status: "active", version: 1 } },
        { tierName: "Silver", color: "#64748b", priority: 3, minScore: 41, maxScore: 60, displayOrder: 3, benefits: ["Mid-tier campaign access"], approval: { status: "active", version: 1 } },
        { tierName: "Gold", color: "#ca8a04", priority: 4, minScore: 61, maxScore: 80, displayOrder: 4, benefits: ["Priority discovery"], approval: { status: "active", version: 1 } },
        { tierName: "Diamond", color: "#0891b2", priority: 5, minScore: 81, maxScore: 90, displayOrder: 5, benefits: ["Premium campaign access"], approval: { status: "active", version: 1 } },
        { tierName: "Platinum", color: "#7c3aed", priority: 6, minScore: 91, maxScore: 100, displayOrder: 6, benefits: ["Top marketplace ranking"], approval: { status: "active", version: 1 } },
      ]);
    }

    const [scoreConfigCount, rankingRuleCount, budgetRuleCount] = await Promise.all([
      InfluencerScoreConfig.countDocuments(nonArchivedQuery()),
      MarketplaceRankingRule.countDocuments(nonArchivedQuery()),
      BudgetProtectionRule.countDocuments(nonArchivedQuery()),
    ]);
    if (!scoreConfigCount) await InfluencerScoreConfig.create({ approval: { status: "active", version: 1 } });
    if (!rankingRuleCount) await MarketplaceRankingRule.create({ approval: { status: "active", version: 1 } });
    if (!budgetRuleCount) await BudgetProtectionRule.create({ approval: { status: "active", version: 1 } });

    const plans = await VendorSubscriptionPlan.countDocuments();
    if (!plans) {
      const tiers = await InfluencerTier.find(activeQuery()).sort({ displayOrder: 1 }).lean();
      await VendorSubscriptionPlan.insertMany([
        ...tiers.map((tier) => ({
          planName: tier.tierName,
          monthlyPrice: ({ Silver: 999, Gold: 2999, Diamond: 6999 }[tier.tierName] ?? 0),
          yearlyPrice: ({ Silver: 9990, Gold: 29990, Diamond: 69990 }[tier.tierName] ?? 0),
          campaignLimit: ({ Starter: 1, Bronze: 3, Silver: 5, Gold: 10, Diamond: 20, Platinum: 30 }[tier.tierName] ?? 1),
          influencerVisibilityLimit: ({ Starter: 20, Bronze: 50, Silver: 100, Gold: 500, Diamond: -1, Platinum: -1 }[tier.tierName] ?? 20),
          linkedTierId: tier._id,
          allowedTiers: [tier._id],
          allowAllTiers: false,
          prioritySupport: tier.tierName === "Platinum",
          featuredCampaigns: ["Gold", "Diamond", "Platinum"].includes(tier.tierName),
          advancedAnalytics: ["Diamond", "Platinum"].includes(tier.tierName),
          dedicatedManager: tier.tierName === "Platinum",
          displayOrder: tier.displayOrder || tier.priority || 0,
          approval: { status: "active", version: 1 },
        })),
      ]);
    }

    const [
      serviceTypeCount,
      packageTemplateCount,
      categoryOptionCount,
      languageOptionCount,
      attributionWindowCount,
      paymentModelCount,
      campaignTypeConfigCount,
      campaignPaymentModelOptionCount,
      campaignPaymentRuleConfigCount,
      campaignDynamicFieldConfigCount,
      campaignValidationRuleConfigCount,
      requirementFieldCount,
      campaignTemplateCount,
      discoveryRuleCount,
      campaignRuleCount,
      dynamicFormFieldCount,
    ] = await Promise.all([
      InfluencerServiceType.countDocuments(),
      InfluencerPackageTemplate.countDocuments(),
      InfluencerCategoryOption.countDocuments(),
      InfluencerLanguageOption.countDocuments(),
      CampaignAttributionWindow.countDocuments(),
      CampaignPaymentModelConfig.countDocuments(),
      CampaignTypeConfig.countDocuments(),
      CampaignPaymentModelOption.countDocuments(),
      CampaignPaymentRuleConfig.countDocuments(),
      CampaignDynamicFieldConfig.countDocuments(),
      CampaignValidationRuleConfig.countDocuments(),
      InfluencerRequirementField.countDocuments(),
      InfluencerCampaignTemplate.countDocuments(),
      InfluencerDiscoveryRule.countDocuments(),
      InfluencerCampaignRule.countDocuments(),
      InfluencerDynamicFormField.countDocuments(),
    ]);

    if (!serviceTypeCount) await InfluencerServiceType.insertMany(SERVICE_TYPE_DEFAULTS);
    if (!packageTemplateCount) await InfluencerPackageTemplate.insertMany(PACKAGE_TEMPLATE_DEFAULTS);
    if (!categoryOptionCount) await InfluencerCategoryOption.insertMany(CATEGORY_OPTION_DEFAULTS);
    if (!languageOptionCount) await InfluencerLanguageOption.insertMany(LANGUAGE_OPTION_DEFAULTS);
    if (!attributionWindowCount) await CampaignAttributionWindow.insertMany(ATTRIBUTION_WINDOW_DEFAULTS);
    if (!paymentModelCount) await CampaignPaymentModelConfig.insertMany(PAYMENT_MODEL_DEFAULTS);
    if (!campaignTypeConfigCount) await CampaignTypeConfig.insertMany(CAMPAIGN_TYPE_DEFAULTS);
    if (!campaignPaymentModelOptionCount) await CampaignPaymentModelOption.insertMany(PAYMENT_MODEL_OPTION_DEFAULTS);
    if (!campaignPaymentRuleConfigCount || !campaignDynamicFieldConfigCount || !campaignValidationRuleConfigCount) {
      const [campaignTypes, paymentOptions] = await Promise.all([
        CampaignTypeConfig.find({}).lean(),
        CampaignPaymentModelOption.find({}).lean(),
      ]);
      const typeBySlug = new Map(campaignTypes.map((row) => [row.slug, row]));
      const paymentBySlug = new Map(paymentOptions.map((row) => [row.slug, row]));

      if (!campaignPaymentRuleConfigCount) {
        const rules = Object.entries(CAMPAIGN_PAYMENT_RULE_MATRIX).flatMap(([campaignType, allowedModels]) => {
          const campaignTypeId = typeBySlug.get(campaignType)?._id;
          if (!campaignTypeId) return [];
          return [...paymentBySlug.entries()].map(([paymentType, paymentModel]) => ({
            campaignTypeId,
            paymentModelId: paymentModel._id,
            allowed: allowedModels.includes(paymentType),
            status: "active",
            reason: allowedModels.includes(paymentType)
              ? `${paymentModel.name} is allowed for ${typeBySlug.get(campaignType)?.name}`
              : `${paymentModel.name} is blocked for ${typeBySlug.get(campaignType)?.name}`,
            approval: { status: "active", version: 1 },
          }));
        });
        if (rules.length) await CampaignPaymentRuleConfig.insertMany(rules);
      }

      if (!campaignDynamicFieldConfigCount) {
        const fields = Object.entries(CAMPAIGN_PAYMENT_RULE_MATRIX).flatMap(([campaignType, allowedModels]) => {
          const campaignTypeId = typeBySlug.get(campaignType)?._id;
          if (!campaignTypeId) return [];
          return allowedModels.flatMap((paymentType) => {
            const paymentModelId = paymentBySlug.get(paymentType)?._id;
            if (!paymentModelId) return [];
            return (CAMPAIGN_DYNAMIC_FIELD_DEFAULTS[paymentType] || []).map(([fieldName, label, fieldType, required, configuration], index) => ({
              campaignTypeId,
              paymentModelId,
              fieldName,
              label,
              fieldType,
              required,
              configuration,
              displayOrder: index + 1,
              approval: { status: "active", version: 1 },
            }));
          });
        });
        if (fields.length) await CampaignDynamicFieldConfig.insertMany(fields);
      }

      if (!campaignValidationRuleConfigCount) {
        const validationRules = Object.entries(CAMPAIGN_PAYMENT_RULE_MATRIX).flatMap(([campaignType, allowedModels]) => {
          const campaignTypeId = typeBySlug.get(campaignType)?._id;
          if (!campaignTypeId) return [];
          return allowedModels.flatMap((paymentType) => {
            const paymentModelId = paymentBySlug.get(paymentType)?._id;
            if (!paymentModelId) return [];
            const rules = [{
              campaignTypeId,
              paymentModelId,
              ruleName: "payment_model_allowed",
              ruleConfiguration: { campaignType, paymentType },
              severity: "error",
              approval: { status: "active", version: 1 },
            }];
            if (["commission", "hybrid"].includes(paymentType)) {
              rules.push({
                campaignTypeId,
                paymentModelId,
                ruleName: "attribution_window_required",
                ruleConfiguration: { allowedWindows: [30, 60, 90], customVendorWindowAllowed: false },
                severity: "error",
                approval: { status: "active", version: 1 },
              });
              rules.push({
                campaignTypeId,
                paymentModelId,
                ruleName: "affiliate_tracking_required",
                ruleConfiguration: { clickTracking: true, conversionTracking: true, commissionLedger: true, payoutTracking: true },
                severity: "error",
                approval: { status: "active", version: 1 },
              });
            }
            return rules;
          });
        });
        if (validationRules.length) await CampaignValidationRuleConfig.insertMany(validationRules);
      }
    }
    if (!requirementFieldCount) await InfluencerRequirementField.insertMany(REQUIREMENT_FIELD_DEFAULTS);
    if (!campaignTemplateCount) {
      await InfluencerCampaignTemplate.insertMany([
        {
          key: "direct_creator_campaign",
          label: "Direct Creator Campaign",
          campaignType: "sponsored",
          defaultPaymentType: "fixed",
          defaultDeliverables: ["content", "tracking_link"],
          displayOrder: 1,
          approval: { status: "active", version: 1 },
        },
        {
          key: "global_marketplace_campaign",
          label: "Global Marketplace Campaign",
          campaignType: "affiliate",
          defaultPaymentType: "commission",
          defaultDeliverables: ["tracking_link", "content"],
          displayOrder: 2,
          approval: { status: "active", version: 1 },
        },
      ]);
    }
    if (!discoveryRuleCount) {
      await InfluencerDiscoveryRule.create({
        key: "default_discovery",
        label: "Default Discovery Rules",
        rules: { filters: ["subscriptionPlan", "category", "language", "location", "score", "followers"] },
        approval: { status: "active", version: 1 },
      });
    }
    if (!campaignRuleCount) {
      await InfluencerCampaignRule.create({
        key: "default_campaign_contract",
        label: "Default Campaign Rules",
        rules: { immutableSnapshots: true, lockOnAcceptance: true, backendRateAuthority: true },
        approval: { status: "active", version: 1 },
      });
    }
    if (!dynamicFormFieldCount) await InfluencerDynamicFormField.insertMany(DYNAMIC_FORM_FIELD_DEFAULTS);

    await this.syncTierPlanPairs();
  }

  async getActiveScoreConfig() {
    await this.ensureDefaults();
    return InfluencerScoreConfig.findOne(activeQuery()).sort({ "approval.version": -1, updatedAt: -1 }).lean();
  }

  async getActiveRankingRule() {
    await this.ensureDefaults();
    return MarketplaceRankingRule.findOne(activeQuery()).sort({ "approval.version": -1, updatedAt: -1 }).lean();
  }

  async getActiveBudgetRule() {
    await this.ensureDefaults();
    return BudgetProtectionRule.findOne(activeQuery()).sort({ "approval.version": -1, updatedAt: -1 }).lean();
  }

  async getVendorSubscription(vendorId) {
    await this.ensureDefaults();
    const subscription = await VendorSubscription.findOne({
      vendorId,
      status: { $in: ["trialing", "active", "grace_period"] },
      $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: new Date() } }],
    }).populate("planId").sort({ createdAt: -1 }).lean();
    return subscription?.planId ? subscription : null;
  }

  async calculateInfluencerScore(profile, extras = {}) {
    const config = await this.getActiveScoreConfig();
    if (!config) throw new AppError("Influencer score engine is disabled.", 409, "INFLUENCER_SCORE_ENGINE_DISABLED");
    const followers = percent(profile.followers, config.normalization?.followersMax);
    const engagement = percent(extras.engagementRate, config.normalization?.engagementMax);
    const clicks = cleanNumber(profile.stats?.clicks);
    const sales = cleanNumber(profile.stats?.sales);
    const conversion = percent(clicks ? (sales / clicks) * 100 : 0, config.normalization?.conversionMax);
    const completion = percent(extras.completionRate ?? 0, config.normalization?.completionMax);
    const revenue = percent(profile.stats?.revenue, config.normalization?.revenueMax);
    const score = boundedScore(
      (followers * config.followersWeight) / 100 +
      (engagement * config.engagementWeight) / 100 +
      (conversion * config.conversionWeight) / 100 +
      (completion * config.completionWeight) / 100 +
      (revenue * config.revenueWeight) / 100
    );
    return {
      score: Number(score.toFixed(2)),
      components: {
        followers: Number(followers.toFixed(2)),
        engagement: Number(engagement.toFixed(2)),
        conversion: Number(conversion.toFixed(2)),
        completion: Number(completion.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
      },
      configVersion: configVersion(config),
    };
  }

  async assignTier(profile, score) {
    await this.ensureDefaults();
    const followers = cleanNumber(profile.followers);
    const tiers = await InfluencerTier.find(activeQuery()).sort({ priority: -1, displayOrder: 1 }).lean();
    return tiers.find((tier) => {
      const scoreOk = score >= cleanNumber(tier.minScore) && score <= cleanNumber(tier.maxScore, 100);
      const minFollowersOk = followers >= cleanNumber(tier.minFollowers);
      const maxFollowersOk = !cleanNumber(tier.maxFollowers) || followers <= cleanNumber(tier.maxFollowers);
      return scoreOk && minFollowersOk && maxFollowersOk;
    }) || null;
  }

  async scoreProfiles(profiles = []) {
    const ids = profiles.map((profile) => profile._id).filter(Boolean);
    const [socialAccounts, campaignStats] = await Promise.all([
      ids.length ? InfluencerSocialAccount.find({ influencerId: { $in: ids }, verificationStatus: "verified" }).lean() : [],
      ids.length ? Campaign.aggregate([
        { $match: { $or: [{ influencerId: { $in: ids } }, { "applications.influencerId": { $in: ids } }] } },
        { $project: { influencerId: 1, applications: 1, state: 1 } },
      ]) : [],
    ]);
    const socialMap = socialAccounts.reduce((map, account) => {
      const key = String(account.influencerId || "");
      const current = map.get(key) || { total: 0, count: 0 };
      current.total += cleanNumber(account.engagementRate);
      current.count += 1;
      map.set(key, current);
      return map;
    }, new Map());
    const completionMap = campaignStats.reduce((map, campaign) => {
      const touched = [];
      if (campaign.influencerId) touched.push(campaign.influencerId);
      for (const application of campaign.applications || []) touched.push(application.influencerId);
      for (const id of touched) {
        const key = String(id || "");
        const current = map.get(key) || { total: 0, completed: 0 };
        current.total += 1;
        if (campaign.state === "completed") current.completed += 1;
        map.set(key, current);
      }
      return map;
    }, new Map());

    const rows = [];
    for (const profile of profiles) {
      const key = String(profile._id);
      const social = socialMap.get(key);
      const completion = completionMap.get(key);
      const engagementRate = social?.count ? social.total / social.count : 0;
      const completionRate = completion?.total ? (completion.completed / completion.total) * 100 : 0;
      const score = await this.calculateInfluencerScore(profile, { engagementRate, completionRate });
      const tier = await this.assignTier(profile, score.score);
      rows.push({ profile, engagementRate, completionRate, score, tier });
    }
    return rows;
  }

  async rankInfluencerRows(rows = []) {
    const rule = await this.getActiveRankingRule();
    if (!rule) throw new AppError("Influencer marketplace ranking is disabled.", 409, "INFLUENCER_RANKING_DISABLED");
    return rows.map((row) => {
      const stats = row.profile?.stats || {};
      const clicks = cleanNumber(stats.clicks);
      const sales = cleanNumber(stats.sales);
      const rankingScore = boundedScore(
        (row.score.score * rule.scoreWeight) / 100 +
        (percent(stats.revenue, 1000000) * rule.revenueWeight) / 100 +
        (percent(sales, 10000) * rule.ordersWeight) / 100 +
        (percent(clicks ? (sales / clicks) * 100 : 0, 25) * rule.conversionWeight) / 100 +
        (percent(row.completionRate, 100) * rule.campaignSuccessWeight) / 100 +
        (percent(stats.revenue, 1000000) * rule.storefrontRevenueWeight) / 100 +
        (percent(row.engagementRate, 20) * rule.engagementWeight) / 100 +
        (percent(row.profile?.followers, 1000000) * rule.followersWeight) / 100
      );
      return { ...row, rankingScore: Number(rankingScore.toFixed(2)), rankingRuleVersion: configVersion(rule) };
    }).sort((a, b) => b.rankingScore - a.rankingScore);
  }

  async allowedInfluencerFilter(vendorId) {
    const subscription = await this.getVendorSubscription(vendorId);
    const plan = subscription?.planId;
    if (!subscription || !plan) return { _id: { $in: [] } };
    const allowAllTiers = Boolean(subscription?.entitlementsSnapshot?.allowAllTiers ?? plan?.allowAllTiers);
    if (!plan || allowAllTiers) return {};
    const allowedTierIds = subscription?.allowedTiers?.length
      ? subscription.allowedTiers
      : (plan.linkedTierId ? [plan.linkedTierId] : (plan.allowedTiers || []));
    const allowedTiers = await InfluencerTier.find({ _id: { $in: allowedTierIds }, ...activeQuery() }).lean();
    if (!allowedTiers.length) return { _id: { $in: [] } };
    return {
      $or: allowedTiers.map((tier) => ({
        followers: {
          $gte: cleanNumber(tier.minFollowers),
          ...(!cleanNumber(tier.maxFollowers) ? {} : { $lte: cleanNumber(tier.maxFollowers) }),
        },
      })),
    };
  }

  async enforceCampaignLimit(vendorId) {
    const subscription = await this.getVendorSubscription(vendorId);
    const plan = subscription?.planId;
    if (!subscription || !plan) {
      throw new AppError("An active subscription is required to create influencer campaigns.", 403, "SUBSCRIPTION_REQUIRED");
    }
    const limit = cleanNumber(subscription?.campaignLimit ?? plan?.campaignLimit, -1);
    if (limit < 0) return { allowed: true, activeCount: 0, limit, plan };
    const activeCount = await Campaign.countDocuments({ vendorId, state: { $in: ["draft", "proposed", "accepted", "active"] } });
    if (activeCount >= limit) {
      throw new AppError(`Campaign limit reached for ${plan.planName}. Upgrade your plan to create more campaigns.`, 403, "CAMPAIGN_LIMIT_EXCEEDED", {
        activeCount,
        limit,
        planName: plan.planName,
      });
    }
    return { allowed: true, activeCount, limit, plan };
  }

  async discoveryLimit(vendorId, requestedLimit = 24) {
    const subscription = await this.getVendorSubscription(vendorId);
    const plan = subscription?.planId;
    if (!subscription || !plan) return { limit: 0, visibilityLimit: 0, plan: null, subscription: null };
    const max = cleanNumber(subscription?.visibilityLimit ?? plan?.influencerVisibilityLimit, requestedLimit);
    if (max < 0) return { limit: requestedLimit, visibilityLimit: -1, plan, subscription };
    return { limit: Math.min(requestedLimit, max), visibilityLimit: max, plan, subscription };
  }

  async ensureCampaignBudgetControl(campaign, budgetValue = 0) {
    const budget = cleanNumber(budgetValue || campaign.fixedFee || 0);
    const spentAmount = cleanNumber(campaign.analytics?.commission) + cleanNumber(campaign.fixedFee);
    const remainingAmount = Math.max(0, budget - spentAmount);
    return CampaignBudgetControl.findOneAndUpdate(
      { campaignId: campaign._id },
      {
        $set: {
          budget,
          spentAmount,
          remainingAmount,
          projectedSpend: spentAmount,
          expectedCommission: cleanNumber(campaign.analytics?.commission),
          lastEvaluatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  async evaluateBudget(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    const rule = await this.getActiveBudgetRule();
    if (!rule) throw new AppError("Campaign budget protection is disabled.", 409, "CAMPAIGN_BUDGET_PROTECTION_DISABLED");
    const records = await CommissionRecord.aggregate([
      { $match: { campaignId: campaign._id } },
      { $group: { _id: null, commission: { $sum: "$influencerShare" }, gross: { $sum: "$gross" } } },
    ]);
    const control = await CampaignBudgetControl.findOne({ campaignId: campaign._id });
    const budget = cleanNumber(control?.budget || campaign.fixedFee);
    const spentAmount = cleanNumber(campaign.fixedFee) + cleanNumber(records[0]?.commission);
    const remainingAmount = Math.max(0, budget - spentAmount);
    const consumedPercent = budget ? (spentAmount / budget) * 100 : 0;
    const remainingPercent = budget ? (remainingAmount / budget) * 100 : 100;
    const update = {
      spentAmount,
      remainingAmount,
      expectedCommission: cleanNumber(records[0]?.commission),
      projectedSpend: spentAmount,
      lastEvaluatedAt: new Date(),
      settingsSnapshot: rule,
    };

    if (budget && remainingPercent <= cleanNumber(rule.warningThresholdPercent, 20)) update.warningSent = true;
    if (budget && remainingPercent <= cleanNumber(rule.criticalThresholdPercent, 10)) update.criticalWarningSent = true;
    if (budget && remainingAmount <= 0 && rule.pauseWhenExhausted) {
      update.paused = true;
      if (!["completed", "cancelled"].includes(campaign.state)) {
        campaign.state = "cancelled";
        campaign.history.push({ state: "cancelled", actorId: null, note: "Paused automatically because campaign budget was exhausted", changedAt: new Date() });
        await campaign.save();
      }
    }

    const nextControl = await CampaignBudgetControl.findOneAndUpdate(
      { campaignId: campaign._id },
      { $set: update, $setOnInsert: { budget } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    if (update.paused && rule.notifyAdmin && typeof notificationService.notifyAdmins === "function") {
      await notificationService.notifyAdmins({
        title: "Campaign budget exhausted",
        message: `${campaign.title || "Campaign"} was paused automatically.`,
        type: "campaign_budget",
      }).catch(() => {});
    }
    return { control: nextControl, consumedPercent: Number(consumedPercent.toFixed(2)), remainingPercent: Number(remainingPercent.toFixed(2)) };
  }

  async listConfig(entityType, query = {}) {
    await this.ensureDefaults();
    const Model = ensureModel(entityType);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const filter = {};
    if (query.status) filter["approval.status"] = query.status;
    if (query.vendorId && entityType === "vendorSubscriptions") filter.vendorId = objectId(query.vendorId);
    if (query.campaignId && entityType === "budgetControls") filter.campaignId = objectId(query.campaignId);
    const [items, total] = await Promise.all([
      Model.find(filter).sort({ displayOrder: 1, "approval.version": -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Model.countDocuments(filter),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async createConfig(actor, entityType, payload = {}, reqMeta = {}) {
    const Model = ensureModel(entityType);
    const docPayload = { ...payload };
    docPayload.approval = { ...(docPayload.approval || {}), version: 1, createdBy: actorId(actor), updatedBy: actorId(actor) };
    validateConfig(entityType, docPayload);
    const doc = await Model.create(docPayload);
    if (entityType === "tiers" || entityType === "subscriptionPlans") {
      await this.syncPairedConfig(actor, entityType, doc, payload, reqMeta);
    }
    await saveVersion({ entityType, doc, actor, reason: payload.reason || "" });
    await logConfigChange({ actor, action: "create", entityType, entityId: doc._id, oldValue: null, newValue: doc.toObject(), reason: payload.reason || "", reqMeta });
    return doc;
  }

  async updateConfig(actor, entityType, id, payload = {}, reqMeta = {}) {
    const Model = ensureModel(entityType);
    const current = await Model.findById(id);
    if (!current) throw new AppError("Configuration not found", 404, "NOT_FOUND");
    const oldValue = current.toObject();
    const nextPayload = { ...oldValue, ...payload, approval: { ...(oldValue.approval || {}), ...(payload.approval || {}) } };
    nextPayload.approval.version = configVersion(oldValue) + 1;
    nextPayload.approval.updatedBy = actorId(actor);
    if (nextPayload.approval.status === "active" && oldValue.approval?.status !== "active") {
      nextPayload.approval.approvedBy = actorId(actor);
      nextPayload.approval.approvedAt = new Date();
    }
    validateConfig(entityType, nextPayload);
    current.set(nextPayload);
    await current.save();
    if (entityType === "tiers" || entityType === "subscriptionPlans") {
      await this.syncPairedConfig(actor, entityType, current, payload, reqMeta);
    }
    await saveVersion({ entityType, doc: current, actor, reason: payload.reason || "" });
    await logConfigChange({ actor, action: "update", entityType, entityId: current._id, oldValue, newValue: current.toObject(), reason: payload.reason || "", reqMeta });
    return current;
  }

  async deleteConfig(actor, entityType, id, payload = {}, reqMeta = {}) {
    const Model = ensureModel(entityType);
    const current = await Model.findById(id);
    if (!current) throw new AppError("Configuration not found", 404, "NOT_FOUND");
    const reason = payload.reason || "Archived from admin configuration engine";
    await archiveDocument({ actor, entityType, doc: current, reason, reqMeta });
    if (entityType === "tiers" || entityType === "subscriptionPlans") {
      await this.archivePairedConfig(actor, entityType, current, reqMeta);
    }
    return current;
  }

  async recoverConfig(actor, entityType, id, version, reqMeta = {}) {
    const Model = ensureModel(entityType);
    const current = await Model.findById(id);
    if (!current) throw new AppError("Configuration not found", 404, "NOT_FOUND");
    const versionDoc = await InfluencerConfigVersion.findOne({ entityType, entityId: current._id, version: Number(version) }).lean();
    if (!versionDoc) throw new AppError("Configuration version not found", 404, "VERSION_NOT_FOUND");
    const oldValue = current.toObject();
    const snapshot = { ...versionDoc.snapshot };
    delete snapshot._id;
    snapshot.approval = { ...(snapshot.approval || {}), version: configVersion(current) + 1, updatedBy: actorId(actor), status: "draft" };
    validateConfig(entityType, snapshot);
    current.set(snapshot);
    await current.save();
    await saveVersion({ entityType, doc: current, actor, reason: `Recovered from version ${version}` });
    await logConfigChange({ actor, action: "recover", entityType, entityId: current._id, oldValue, newValue: current.toObject(), reason: `Recovered from version ${version}`, reqMeta });
    return current;
  }

  async versions(entityType, id) {
    return InfluencerConfigVersion.find({ entityType, entityId: id }).sort({ version: -1 }).lean();
  }

  async auditLogs(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const filter = {};
    if (query.entityType) filter.entityType = query.entityType;
    if (query.module) filter.module = query.module;
    const [items, total] = await Promise.all([
      ConfigAuditLog.find(filter).populate("changedBy", "name email role").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ConfigAuditLog.countDocuments(filter),
    ]);
    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async commerceConfiguration({ includeInactive = false } = {}) {
    await this.ensureDefaults();
    const sort = { displayOrder: 1, updatedAt: -1 };
    const configQuery = includeInactive ? nonArchivedQuery() : activeQuery();
    const configStatusQuery = includeInactive ? { status: { $ne: "archived" } } : { status: "active" };
    const [
      serviceTypes,
      packageTemplates,
      categoryOptions,
      languageOptions,
      attributionWindows,
      paymentModels,
      campaignTypes,
      paymentModelOptions,
      campaignPaymentRules,
      campaignDynamicFields,
      campaignValidationRules,
      requirementFields,
      campaignTemplates,
      discoveryRules,
      campaignRules,
      dynamicFormFields,
    ] = await Promise.all([
      InfluencerServiceType.find(configQuery).sort(sort).lean(),
      InfluencerPackageTemplate.find(configQuery).sort(sort).lean(),
      InfluencerCategoryOption.find(configQuery).sort(sort).lean(),
      InfluencerLanguageOption.find(configQuery).sort(sort).lean(),
      CampaignAttributionWindow.find(configQuery).sort(sort).lean(),
      CampaignPaymentModelConfig.find(configQuery).sort(sort).lean(),
      CampaignTypeConfig.find({ ...configQuery, ...configStatusQuery }).sort(sort).lean(),
      CampaignPaymentModelOption.find({ ...configQuery, ...configStatusQuery }).sort(sort).lean(),
      CampaignPaymentRuleConfig.find({ ...configQuery, ...configStatusQuery }).sort({ createdAt: 1 }).lean(),
      CampaignDynamicFieldConfig.find(configQuery).sort(sort).lean(),
      CampaignValidationRuleConfig.find(configQuery).sort(sort).lean(),
      InfluencerRequirementField.find(configQuery).sort(sort).lean(),
      InfluencerCampaignTemplate.find(configQuery).sort(sort).lean(),
      InfluencerDiscoveryRule.find(configQuery).sort(sort).lean(),
      InfluencerCampaignRule.find(configQuery).sort(sort).lean(),
      InfluencerDynamicFormField.find(configQuery).sort(sort).lean(),
    ]);
    return {
      serviceTypes,
      packageTemplates,
      categoryOptions,
      languageOptions,
      attributionWindows,
      paymentModels,
      campaignTypes,
      paymentModelOptions,
      campaignPaymentRules,
      campaignDynamicFields,
      campaignValidationRules,
      campaignRuleEngine: buildCampaignRuleEngineConfig({
        campaignTypes,
        paymentModelOptions,
        campaignPaymentRules,
        campaignDynamicFields,
        campaignValidationRules,
        attributionWindows,
      }),
      requirementFields,
      campaignTemplates,
      discoveryRules,
      campaignRules,
      dynamicFormFields,
    };
  }

  async overview() {
    await this.ensureDefaults();
    const [scoreConfig, rankingRule, budgetRule, tiers, plans, subscriptionCount, budgetControls, commerceConfiguration] = await Promise.all([
      editableSingleton(InfluencerScoreConfig),
      editableSingleton(MarketplaceRankingRule),
      editableSingleton(BudgetProtectionRule),
      InfluencerTier.find(nonArchivedQuery()).sort({ displayOrder: 1 }).lean(),
      VendorSubscriptionPlan.find(nonArchivedQuery()).sort({ displayOrder: 1 }).lean(),
      VendorSubscription.countDocuments({ status: { $in: ["trialing", "active"] } }),
      CampaignBudgetControl.find({}).sort({ updatedAt: -1 }).limit(20).lean(),
      this.commerceConfiguration({ includeInactive: true }),
    ]);
    return {
      scoreConfig,
      rankingRule,
      budgetRule,
      tiers,
      plans,
      subscriptionCount,
      budgetControls,
      ...commerceConfiguration,
    };
  }
}

module.exports = new InfluencerCommerceEngineService();
