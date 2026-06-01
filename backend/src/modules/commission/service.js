const mongoose = require("mongoose");
const { Order } = require("../../models/Order");
const { AppError } = require("../../utils/AppError");
const { emitDomainEvent, registerHandler } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { roundMoney } = require("../shared/helpers");
const {
  InfluencerCommissionRule,
  CommissionRuleVersion,
  CommissionRuleCondition,
  CommissionSnapshot,
  CommissionLedger,
  CommissionReversal,
  CommissionSettlement,
  CommissionPayoutBatch,
  CommissionAuditLog,
  InfluencerWallet,
  InfluencerLedger,
  CommissionRecord,
  InfluencerPayoutAccount,
  InfluencerWithdrawalRequest,
  RULE_TYPES,
  COMMISSION_METHODS,
} = require("./models");
const { Reel } = require("../reel/model");
const { Campaign } = require("../campaign/model");
const {
  InfluencerProfile,
  InfluencerSocialAccount,
} = require("../influencer/model");
const auditService = require("../../services/audit.service");
const { getEncryptionService, EncryptionService } = require("../../utils/encryption");

const HOLD_DAYS = Number(process.env.INFLUENCER_HOLD_DAYS || 7);
const MIN_WITHDRAWAL_AMOUNT = Number(process.env.INFLUENCER_MIN_WITHDRAWAL_AMOUNT || 500);
const MAX_WITHDRAWAL_AMOUNT = Number(process.env.INFLUENCER_MAX_WITHDRAWAL_AMOUNT || 1000000);
const RULE_PRECEDENCE = {
  product: 600,
  campaign: 500,
  influencer: 400,
  traffic_source: 300,
  category: 200,
  global: 100,
  affiliate: 90,
  performance: 80,
  custom_formula: 70,
};
const FINAL_ORDER_STATUSES = ["Delivered"];
const FINAL_PAYMENT_STATUSES = ["Paid"];
const INELIGIBLE_ORDER_STATUSES = ["Pending", "Cancelled", "Returned"];
const INELIGIBLE_PAYMENT_STATUSES = ["Pending", "Failed", "Refunded", "Partially Refunded"];

function buildCommissionRecordKey(orderId) {
  return `commission:${orderId}`;
}

function buildLedgerKey(orderId, type) {
  return `commission:${type.toLowerCase()}:${orderId}`;
}

function buildEngineLedgerKey(orderId, type) {
  return `commission-engine:${type.toLowerCase()}:${orderId}`;
}

function buildSnapshotKey(orderId) {
  return `commission-snapshot:${orderId}`;
}

function buildAuditActor(actor = {}) {
  return {
    userId: actor?._id || actor?.sub || actor?.id || null,
    userRole: actor?.role || actor?.type || "",
  };
}

function normalizeRuleCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTrafficSource(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function toComparable(value) {
  if (value == null) return value;
  if (mongoose.isValidObjectId(value)) return String(value);
  if (value instanceof Date) return value.getTime();
  return value;
}

function valuesEqual(left, right) {
  return String(toComparable(left)) === String(toComparable(right));
}

function readPath(source = {}, path = "") {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}

function conditionMatches(condition, context) {
  const actual = readPath(context, condition.field);
  const expected = condition.value;
  switch (condition.operator) {
    case "ne":
      return !valuesEqual(actual, expected);
    case "in":
      return Array.isArray(expected) && expected.some((item) => valuesEqual(actual, item));
    case "nin":
      return Array.isArray(expected) && !expected.some((item) => valuesEqual(actual, item));
    case "gt":
      return Number(actual || 0) > Number(expected || 0);
    case "gte":
      return Number(actual || 0) >= Number(expected || 0);
    case "lt":
      return Number(actual || 0) < Number(expected || 0);
    case "lte":
      return Number(actual || 0) <= Number(expected || 0);
    case "exists":
      return Boolean(actual) === Boolean(expected);
    case "between":
      return Number(actual || 0) >= Number(expected || 0) && Number(actual || 0) <= Number(condition.valueTo || 0);
    case "eq":
    default:
      return valuesEqual(actual, expected);
  }
}

function extractOrderCategoryId(order) {
  const firstItem = (order?.items || [])[0] || {};
  return firstItem?.commissionSnapshot?.categoryId || firstItem?.productId?.categoryId || firstItem?.categoryId || null;
}

function extractOrderProductId(order) {
  return order?.attribution?.productId || (order?.items || [])[0]?.productId?._id || (order?.items || [])[0]?.productId || null;
}

function buildCalculationContext(order, overrides = {}) {
  const grossSale = roundMoney(overrides.revenue ?? order?.subtotal ?? order?.totalAmount ?? 0);
  const refunds = roundMoney(overrides.refunds ?? order?.refundSummary?.grossAmount ?? 0);
  const discounts = roundMoney(overrides.discounts ?? order?.discountAmount ?? order?.priceBreakdown?.discountAmount ?? 0);
  const platformAdjustments = roundMoney(overrides.platformAdjustments ?? order?.platformFee ?? 0);
  const eligibleRevenue = Math.max(0, roundMoney(grossSale - refunds - discounts - platformAdjustments));
  const orders = Number(overrides.expectedOrders ?? overrides.orders ?? 1);
  const conversions = Number(overrides.conversions ?? orders);
  const clicks = Number(overrides.clicks ?? 0);
  return {
    order,
    influencerId: overrides.influencerId || order?.attribution?.influencerId,
    campaignId: overrides.campaignId || order?.attribution?.campaignId,
    productId: overrides.productId || extractOrderProductId(order),
    categoryId: overrides.categoryId || extractOrderCategoryId(order),
    vendorId: overrides.vendorId || order?.sellerId,
    trafficSource: normalizeTrafficSource(overrides.trafficSource || order?.attribution?.surface || "affiliate_link"),
    affiliateId: overrides.affiliateId || order?.attribution?.affiliateId,
    grossSale,
    refunds,
    discounts,
    platformAdjustments,
    eligibleRevenue,
    orders,
    conversionRate: Number(overrides.conversionRate ?? (clicks ? (conversions / clicks) * 100 : 0)),
    campaignCompletion: Number(overrides.campaignCompletion ?? 0),
    reelEngagement: Number(overrides.reelEngagement ?? 0),
    reelEngagementTarget: Number(overrides.reelEngagementTarget ?? 0),
    metrics: overrides.metrics || {},
  };
}

function evaluateArithmeticExpression(expression) {
  const tokens = String(expression || "").match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
  const values = [];
  const operators = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const applyOperator = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") values.push(right === 0 ? 0 : left / right);
  };

  for (const token of tokens) {
    if (/^\d/.test(token)) {
      values.push(Number(token));
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") applyOperator();
      operators.pop();
    } else {
      while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) applyOperator();
      operators.push(token);
    }
  }
  while (operators.length) applyOperator();
  return Number(values[0] || 0);
}

function buildWithdrawalLedgerKey(requestId, type = "request") {
  return `withdrawal:${type}:${requestId}`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDashboardRange(query = {}) {
  const now = new Date();
  const range = String(query.range || "30d").toLowerCase();
  let end = query.endDate ? new Date(query.endDate) : now;
  if (Number.isNaN(end.getTime())) end = now;
  let start;

  if (query.startDate) {
    start = new Date(query.startDate);
  } else if (range === "today") {
    start = startOfDay(now);
  } else if (range === "7d") {
    start = addDays(now, -6);
  } else if (range === "90d") {
    start = addDays(now, -89);
  } else if (range === "12m") {
    start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  } else {
    start = addDays(now, -29);
  }

  if (Number.isNaN(start.getTime())) start = addDays(now, -29);
  return { start: startOfDay(start), end };
}

function objectIdOrNull(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function percentChange(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (!previousValue) return currentValue ? 100 : 0;
  return roundMoney(((currentValue - previousValue) / previousValue) * 100);
}

function buildDateBuckets(start, end) {
  const buckets = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ date: key, revenue: 0, commission: 0, orders: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function includesProduct(order, productId) {
  if (!productId) return true;
  return (order?.items || []).some((item) => String(item.productId?._id || item.productId) === String(productId));
}

function productImage(product) {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return typeof first === "string" ? first : first?.url || "";
}

function formatRuleLabel(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildRuleSummary(rule) {
  if (!rule) return null;
  return {
    id: rule._id ? String(rule._id) : "",
    ruleName: rule.ruleName || rule.name || "",
    ruleCode: rule.ruleCode || "",
    ruleType: rule.ruleType || "",
    ruleTypeLabel: formatRuleLabel(rule.ruleType || ""),
    commissionMethod: rule.commissionMethod || "",
    commissionMethodLabel: formatRuleLabel(rule.commissionMethod || ""),
    commissionValue: Number(rule.commissionValue || 0),
    fixedAmount: Number(rule.fixedAmount || 0),
    revenueSharePercent: Number(rule.revenueSharePercent || 0),
    version: Number(rule.version || 1),
    status: rule.status || "",
  };
}

function buildSnapshotRuleSummary(snapshot) {
  if (!snapshot) return null;
  const rule = snapshot.appliedRuleId && typeof snapshot.appliedRuleId === "object" ? snapshot.appliedRuleId : null;
  return {
    snapshotId: String(snapshot._id || ""),
    appliedRuleId: String(rule?._id || snapshot.appliedRuleId || ""),
    appliedRuleVersion: Number(snapshot.appliedRuleVersion || rule?.version || 1),
    ruleName: rule?.ruleName || "Historical commission rule",
    ruleCode: rule?.ruleCode || "",
    ruleType: rule?.ruleType || snapshot.calculation?.ruleType || "",
    ruleTypeLabel: formatRuleLabel(rule?.ruleType || snapshot.calculation?.ruleType || ""),
    commissionMethod: rule?.commissionMethod || snapshot.calculation?.commissionMethod || "",
    commissionMethodLabel: formatRuleLabel(rule?.commissionMethod || snapshot.calculation?.commissionMethod || ""),
    trafficSource: snapshot.trafficSource || "",
    commissionPercent: Number(snapshot.commissionPercent || 0),
    commissionAmount: roundMoney(snapshot.commissionAmount || 0),
    bonusAmount: roundMoney(snapshot.bonusAmount || 0),
    finalEarnings: roundMoney(snapshot.finalEarnings || 0),
  };
}

function dominantRuleSummary(ruleMap = new Map()) {
  const counts = new Map();
  for (const rule of ruleMap.values()) {
    if (!rule) continue;
    const key = `${rule.appliedRuleId || rule.ruleName || ""}:${rule.appliedRuleVersion || ""}`;
    const row = counts.get(key) || { ...rule, count: 0, earnings: 0 };
    row.count += 1;
    row.earnings = roundMoney(row.earnings + Number(rule.finalEarnings || 0));
    counts.set(key, row);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.earnings - a.earnings)[0] || null;
}

async function executeWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("standalone")
    ) {
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

function attachSession(query, session) {
  if (session) query.session(session);
  return query;
}

function maskSensitive(value = "") {
  if (!value) return "";
  return EncryptionService.maskString(String(value));
}

function maskInfluencerPayoutAccount(account) {
  if (!account) return null;
  const encService = getEncryptionService();
  const doc = account.toObject ? account.toObject() : account;
  let accountNumber = "";
  let upiId = "";
  try {
    accountNumber = doc.accountNumberEncrypted ? maskSensitive(encService.decrypt(doc.accountNumberEncrypted)) : "";
  } catch (error) {
    accountNumber = "XXXX****";
  }
  try {
    upiId = doc.upiIdEncrypted ? maskSensitive(encService.decrypt(doc.upiIdEncrypted)) : "";
  } catch (error) {
    upiId = "XXXX****";
  }
  return {
    _id: doc._id,
    influencerId: doc.influencerId,
    accountHolderName: doc.accountHolderName,
    accountNumber,
    ifscCode: doc.ifscCode,
    bankName: doc.bankName,
    upiId,
    paypalEmail: doc.paypalEmail,
    paymentMethod: doc.paymentMethod,
    isDefault: doc.isDefault,
    isActive: doc.isActive,
    isVerified: doc.isVerified,
    verificationStatus: doc.verificationStatus,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeWithdrawalStatus(tab = "") {
  const value = String(tab || "").toLowerCase();
  if (value === "pending") return ["PENDING", "UNDER_REVIEW"];
  if (value === "approved") return ["APPROVED", "PROCESSING", "PAID"];
  if (value === "rejected") return ["REJECTED", "FAILED", "CANCELLED"];
  if (value === "history") return ["APPROVED", "PROCESSING", "PAID", "FAILED"];
  return [];
}

async function getOrCreateWallet(influencerId, session = null) {
  return await InfluencerWallet.findOneAndUpdate(
    { influencerId },
    { $setOnInsert: { influencerId } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session: session || undefined,
    }
  );
}

class CommissionService {
  validateRulePayload(payload = {}, { partial = false } = {}) {
    const ruleType = payload.ruleType;
    const method = payload.commissionMethod;
    if ((!partial || ruleType != null) && !RULE_TYPES.includes(ruleType)) {
      throw new AppError("Invalid commission rule type", 400, "VALIDATION_ERROR");
    }
    if ((!partial || method != null) && !COMMISSION_METHODS.includes(method)) {
      throw new AppError("Invalid commission method", 400, "VALIDATION_ERROR");
    }
    const effectiveDate = payload.effectiveDate ? new Date(payload.effectiveDate) : null;
    const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null;
    if ((!partial || payload.effectiveDate != null) && (!effectiveDate || Number.isNaN(effectiveDate.getTime()))) {
      throw new AppError("effectiveDate is required", 400, "VALIDATION_ERROR");
    }
    if (expiryDate && Number.isNaN(expiryDate.getTime())) {
      throw new AppError("Invalid expiryDate", 400, "VALIDATION_ERROR");
    }
    if (effectiveDate && expiryDate && effectiveDate > expiryDate) {
      throw new AppError("effectiveDate cannot be after expiryDate", 400, "VALIDATION_ERROR");
    }
    const percent = Number(payload.commissionValue ?? 0);
    if (payload.commissionValue != null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      throw new AppError("commissionValue must be between 0 and 100", 400, "VALIDATION_ERROR");
    }
    if (["product"].includes(ruleType) && !payload.productId) throw new AppError("productId is required", 400, "VALIDATION_ERROR");
    if (["campaign"].includes(ruleType) && !payload.campaignId) throw new AppError("campaignId is required", 400, "VALIDATION_ERROR");
    if (["influencer"].includes(ruleType) && !payload.influencerId) throw new AppError("influencerId is required", 400, "VALIDATION_ERROR");
    if (["category"].includes(ruleType) && !payload.categoryId) throw new AppError("categoryId is required", 400, "VALIDATION_ERROR");
    if (["traffic_source"].includes(ruleType) && !payload.trafficSource) throw new AppError("trafficSource is required", 400, "VALIDATION_ERROR");
  }

  async auditCommission(action, entityType, entityId, { actor = {}, oldValue = null, newValue = null, reason = "", meta = {} } = {}) {
    const auditActor = buildAuditActor(actor);
    await CommissionAuditLog.create({
      action,
      entityType,
      entityId,
      ...auditActor,
      oldValue,
      newValue,
      reason,
      ipAddress: meta?.ipAddress || "",
      userAgent: meta?.userAgent || "",
    }).catch(() => {});
  }

  async createRule(payload = {}, actor = {}, meta = {}) {
    this.validateRulePayload(payload);
    const ruleCode = normalizeRuleCode(payload.ruleCode || payload.ruleName);
    if (!ruleCode) throw new AppError("ruleCode is required", 400, "VALIDATION_ERROR");
    const exists = await InfluencerCommissionRule.findOne({ ruleCode }).lean();
    if (exists) throw new AppError("Commission rule code already exists", 409, "COMMISSION_RULE_EXISTS");

    const rule = await InfluencerCommissionRule.create({
      ...payload,
      ruleCode,
      trafficSource: payload.trafficSource ? normalizeTrafficSource(payload.trafficSource) : undefined,
      status: payload.status || "draft",
      effectiveDate: new Date(payload.effectiveDate),
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : undefined,
      createdBy: actor?._id || actor?.sub || undefined,
    });
    await CommissionRuleVersion.create({
      ruleId: rule._id,
      version: rule.version,
      snapshot: rule.toObject(),
      status: rule.status,
      createdBy: actor?._id || actor?.sub || undefined,
      changeReason: payload.reason || "Rule created",
    });
    if (Array.isArray(payload.conditions) && payload.conditions.length) {
      await CommissionRuleCondition.insertMany(payload.conditions.map((condition) => ({ ...condition, ruleId: rule._id })));
    }
    await this.auditCommission("RULE_CREATED", "InfluencerCommissionRule", rule._id, { actor, newValue: rule.toObject(), reason: payload.reason, meta });
    return rule;
  }

  async updateRule(ruleId, payload = {}, actor = {}, meta = {}) {
    if (!mongoose.isValidObjectId(ruleId)) throw new AppError("Invalid rule id", 400, "VALIDATION_ERROR");
    this.validateRulePayload(payload, { partial: true });
    const rule = await InfluencerCommissionRule.findById(ruleId);
    if (!rule) throw new AppError("Commission rule not found", 404, "NOT_FOUND");
    const oldValue = rule.toObject();
    const nextVersion = Number(rule.version || 1) + 1;
    const update = {
      ...payload,
      version: nextVersion,
      trafficSource: payload.trafficSource ? normalizeTrafficSource(payload.trafficSource) : rule.trafficSource,
      effectiveDate: payload.effectiveDate ? new Date(payload.effectiveDate) : rule.effectiveDate,
      expiryDate: payload.expiryDate === null ? null : payload.expiryDate ? new Date(payload.expiryDate) : rule.expiryDate,
    };
    Object.assign(rule, update);
    await rule.save();
    await CommissionRuleVersion.create({
      ruleId: rule._id,
      version: nextVersion,
      snapshot: rule.toObject(),
      status: rule.status,
      createdBy: actor?._id || actor?.sub || undefined,
      approvedBy: rule.approvedBy,
      changeReason: payload.reason || "Rule updated",
    });
    if (Array.isArray(payload.conditions)) {
      await CommissionRuleCondition.deleteMany({ ruleId: rule._id });
      if (payload.conditions.length) await CommissionRuleCondition.insertMany(payload.conditions.map((condition) => ({ ...condition, ruleId: rule._id })));
    }
    await this.auditCommission("RULE_UPDATED", "InfluencerCommissionRule", rule._id, { actor, oldValue, newValue: rule.toObject(), reason: payload.reason, meta });
    return rule;
  }

  async approveRule(ruleId, actor = {}, meta = {}) {
    if (!mongoose.isValidObjectId(ruleId)) throw new AppError("Invalid rule id", 400, "VALIDATION_ERROR");
    const rule = await InfluencerCommissionRule.findByIdAndUpdate(
      ruleId,
      { $set: { status: "active", approvedBy: actor?._id || actor?.sub || undefined, approvedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!rule) throw new AppError("Commission rule not found", 404, "NOT_FOUND");
    await this.auditCommission("RULE_ACTIVATED", "InfluencerCommissionRule", rule._id, { actor, newValue: rule.toObject(), reason: "Approved", meta });
    return rule;
  }

  async deactivateRule(ruleId, actor = {}, reason = "", meta = {}) {
    if (!mongoose.isValidObjectId(ruleId)) throw new AppError("Invalid rule id", 400, "VALIDATION_ERROR");
    const rule = await InfluencerCommissionRule.findByIdAndUpdate(ruleId, { $set: { status: "inactive" } }, { new: true });
    if (!rule) throw new AppError("Commission rule not found", 404, "NOT_FOUND");
    await this.auditCommission("RULE_DEACTIVATED", "InfluencerCommissionRule", rule._id, { actor, newValue: rule.toObject(), reason, meta });
    return rule;
  }

  async listRules(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.ruleType) filter.ruleType = query.ruleType;
    if (query.commissionMethod) filter.commissionMethod = query.commissionMethod;
    ["productId", "campaignId", "influencerId", "categoryId"].forEach((key) => {
      if (query[key] && mongoose.isValidObjectId(query[key])) filter[key] = query[key];
    });
    if (query.trafficSource) filter.trafficSource = normalizeTrafficSource(query.trafficSource);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [rules, total] = await Promise.all([
      InfluencerCommissionRule.find(filter).sort({ priority: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InfluencerCommissionRule.countDocuments(filter),
    ]);
    return { rules, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async resolveRule(context = {}) {
    const now = new Date();
    const base = {
      status: "active",
      effectiveDate: { $lte: now },
      $or: [{ expiryDate: null }, { expiryDate: { $exists: false } }, { expiryDate: { $gte: now } }],
    };
    const clauses = [{ ruleType: "global" }];
    if (context.productId) clauses.push({ ruleType: "product", productId: context.productId });
    if (context.campaignId) clauses.push({ ruleType: "campaign", campaignId: context.campaignId });
    if (context.influencerId) clauses.push({ ruleType: "influencer", influencerId: context.influencerId });
    if (context.categoryId) clauses.push({ ruleType: "category", categoryId: context.categoryId });
    if (context.trafficSource) clauses.push({ ruleType: "traffic_source", trafficSource: normalizeTrafficSource(context.trafficSource) });
    if (context.affiliateId) clauses.push({ ruleType: "affiliate", affiliateId: context.affiliateId });
    clauses.push({ ruleType: { $in: ["performance", "custom_formula"] } });

    const candidates = await InfluencerCommissionRule.find({ ...base, $or: clauses }).lean();
    if (!candidates.length) return null;
    const conditions = await CommissionRuleCondition.find({ ruleId: { $in: candidates.map((rule) => rule._id) } }).lean();
    const byRule = conditions.reduce((acc, condition) => {
      const key = String(condition.ruleId);
      acc.set(key, [...(acc.get(key) || []), condition]);
      return acc;
    }, new Map());
    const valid = candidates.filter((rule) => (byRule.get(String(rule._id)) || []).every((condition) => conditionMatches(condition, context)));
    valid.sort((a, b) => {
      const rank = (RULE_PRECEDENCE[b.ruleType] || 0) - (RULE_PRECEDENCE[a.ruleType] || 0);
      return rank || Number(b.priority || 0) - Number(a.priority || 0) || Number(b.version || 1) - Number(a.version || 1);
    });
    return valid[0] || null;
  }

  calculateBaseCommission(rule, context) {
    const revenue = roundMoney(context.eligibleRevenue || 0);
    const percent = Number(rule.commissionValue || 0);
    let commissionPercent = 0;
    let commissionAmount = 0;
    if (rule.commissionMethod === "percentage") {
      commissionPercent = percent;
      commissionAmount = roundMoney((revenue * percent) / 100);
    } else if (rule.commissionMethod === "fixed") {
      commissionAmount = roundMoney(rule.fixedAmount || rule.commissionValue || 0);
      commissionPercent = revenue ? roundMoney((commissionAmount / revenue) * 100) : 0;
    } else if (rule.commissionMethod === "hybrid") {
      commissionPercent = percent;
      commissionAmount = roundMoney((revenue * percent) / 100 + Number(rule.fixedAmount || 0));
    } else if (rule.commissionMethod === "tiered") {
      const tiers = [...(rule.tiers || [])].sort((a, b) => Number(b.threshold || 0) - Number(a.threshold || 0));
      const tier = tiers.find((item) => revenue >= Number(item.threshold || 0));
      commissionPercent = Number(tier?.percent ?? percent);
      commissionAmount = roundMoney((revenue * commissionPercent) / 100 + Number(tier?.fixedAmount || 0));
    } else if (rule.commissionMethod === "revenue_share") {
      commissionPercent = Number(rule.revenueSharePercent || percent);
      commissionAmount = roundMoney((revenue * commissionPercent) / 100);
    } else if (rule.commissionMethod === "custom_formula") {
      commissionAmount = this.evaluateFormula(rule.customFormula, context);
      commissionPercent = revenue ? roundMoney((commissionAmount / revenue) * 100) : 0;
    } else if (rule.commissionMethod === "performance_bonus") {
      commissionPercent = percent;
      commissionAmount = roundMoney((revenue * percent) / 100);
    }
    return {
      commissionPercent: Math.min(100, roundMoney(commissionPercent)),
      commissionAmount: Math.min(revenue, roundMoney(commissionAmount)),
    };
  }

  evaluateFormula(formula = "", context = {}) {
    const expression = String(formula || "").trim();
    if (!expression) return 0;
    if (!/^[0-9+\-*/().\s_a-zA-Z]+$/.test(expression)) {
      throw new AppError("Custom formula contains unsupported characters", 400, "INVALID_CUSTOM_FORMULA");
    }
    const variables = {
      grossSale: context.grossSale,
      eligibleRevenue: context.eligibleRevenue,
      orders: context.orders,
      conversionRate: context.conversionRate,
      campaignCompletion: context.campaignCompletion,
      reelEngagement: context.reelEngagement,
    };
    const expanded = Object.entries(variables).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`\\b${key}\\b`, "g"), String(Number(value || 0))),
      expression
    );
    const result = evaluateArithmeticExpression(expanded);
    if (!Number.isFinite(result) || result < 0) return 0;
    return roundMoney(result);
  }

  calculateBonuses(rule, context, commissionAmount) {
    const bonuses = Array.isArray(rule.bonuses) ? rule.bonuses : [];
    let bonusPercent = 0;
    let bonusAmount = 0;
    for (const bonus of bonuses) {
      const metricValue = Number(readPath(context, bonus.metric) ?? 0);
      if (!conditionMatches({ field: bonus.metric, operator: bonus.operator || "gte", value: bonus.threshold }, context)) continue;
      if (bonus.type === "fixed") {
        bonusAmount = roundMoney(bonusAmount + Number(bonus.value || 0));
      } else {
        bonusPercent = roundMoney(bonusPercent + Number(bonus.value || 0));
      }
      void metricValue;
    }
    return {
      bonusPercent,
      bonusAmount: roundMoney(bonusAmount + (commissionAmount * bonusPercent) / 100),
    };
  }

  async calculateCommission(input = {}) {
    const context = buildCalculationContext(input.order, input);
    const rule = await this.resolveRule(context);
    if (!rule) {
      return { skipped: true, reason: "NO_ACTIVE_RULE", context };
    }
    const base = this.calculateBaseCommission(rule, context);
    const bonus = this.calculateBonuses(rule, context, base.commissionAmount);
    const finalEarnings = Math.min(context.eligibleRevenue, roundMoney(base.commissionAmount + bonus.bonusAmount));
    return {
      rule,
      context,
      commissionPercent: base.commissionPercent,
      commissionAmount: base.commissionAmount,
      bonusPercent: bonus.bonusPercent,
      bonusAmount: bonus.bonusAmount,
      finalEarnings,
      vendorNet: roundMoney(context.eligibleRevenue - finalEarnings),
    };
  }

  assertOrderEligible(order) {
    if (!order?.attribution?.influencerId) return { eligible: false, reason: "NO_ATTRIBUTION" };
    if (INELIGIBLE_ORDER_STATUSES.includes(order.status) || !FINAL_ORDER_STATUSES.includes(order.status)) return { eligible: false, reason: "ORDER_NOT_ELIGIBLE" };
    if (INELIGIBLE_PAYMENT_STATUSES.includes(order.paymentStatus) || !FINAL_PAYMENT_STATUSES.includes(order.paymentStatus)) return { eligible: false, reason: "PAYMENT_NOT_ELIGIBLE" };
    if (order.refundSummary?.status === "REFUNDED") return { eligible: false, reason: "REFUNDED" };
    return { eligible: true };
  }

  async calculateAndSnapshotOrder(order, session = null) {
    const eligibility = this.assertOrderEligible(order);
    if (!eligibility.eligible) return { skipped: true, reason: eligibility.reason };
    const existing = await attachSession(CommissionSnapshot.findOne({ orderId: order._id }), session).lean();
    if (existing) return { snapshot: existing, alreadySnapshotted: true };
    const result = await this.calculateCommission({ order });
    if (result.skipped) return result;
    const snapshotPayload = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      influencerId: result.context.influencerId,
      campaignId: result.context.campaignId,
      productId: result.context.productId,
      categoryId: result.context.categoryId,
      vendorId: result.context.vendorId,
      appliedRuleId: result.rule._id,
      appliedRuleVersion: result.rule.version,
      trafficSource: result.context.trafficSource,
      commissionPercent: result.commissionPercent,
      commissionAmount: result.commissionAmount,
      bonusAmount: result.bonusAmount,
      finalEarnings: result.finalEarnings,
      eligibleRevenue: result.context.eligibleRevenue,
      grossSale: result.context.grossSale,
      refunds: result.context.refunds,
      discounts: result.context.discounts,
      platformAdjustments: result.context.platformAdjustments,
      calculation: {
        ruleType: result.rule.ruleType,
        commissionMethod: result.rule.commissionMethod,
        bonusPercent: result.bonusPercent,
      },
      idempotencyKey: buildSnapshotKey(order._id),
    };
    const [snapshot] = await CommissionSnapshot.create([snapshotPayload], { session: session || undefined });
    await CommissionLedger.create(
      [
        {
          influencerId: snapshot.influencerId,
          orderId: order._id,
          snapshotId: snapshot._id,
          entryType: "COMMISSION",
          direction: "CREDIT",
          amount: snapshot.commissionAmount,
          state: "PENDING",
          idempotencyKey: buildEngineLedgerKey(order._id, "COMMISSION"),
          reference: order.orderNumber,
          metadata: { appliedRuleId: snapshot.appliedRuleId, appliedRuleVersion: snapshot.appliedRuleVersion },
        },
        ...(snapshot.bonusAmount > 0
          ? [
              {
                influencerId: snapshot.influencerId,
                orderId: order._id,
                snapshotId: snapshot._id,
                entryType: "PERFORMANCE_BONUS",
                direction: "CREDIT",
                amount: snapshot.bonusAmount,
                state: "PENDING",
                idempotencyKey: buildEngineLedgerKey(order._id, "PERFORMANCE_BONUS"),
                reference: order.orderNumber,
                metadata: { appliedRuleId: snapshot.appliedRuleId },
              },
            ]
          : []),
      ],
      { session: session || undefined }
    );
    await this.auditCommission("COMMISSION_CALCULATED", "CommissionSnapshot", snapshot._id, { newValue: snapshotPayload });
    return { snapshot, calculation: result };
  }

  async createHoldRecord(order, session = null) {
    if (!order?.attribution?.influencerId) return null;
    const snapshotResult = await this.calculateAndSnapshotOrder(order, session);
    if (snapshotResult?.skipped) return null;
    const snapshot = snapshotResult.snapshot;

    const payload = {
      orderId: order._id,
      vendorId: order.sellerId,
      influencerId: order.attribution.influencerId,
      campaignId: order.attribution.campaignId,
      reelId: order.attribution.reelId,
      postId: order.attribution.postId,
      storefrontId: order.attribution.storefrontId,
      collectionId: order.attribution.collectionId,
      surface: order.attribution.surface,
      trackingSessionId: order.attribution.trackingSessionId,
      state: "HOLD",
      idempotencyKey: buildCommissionRecordKey(order._id),
      holdUntil: order.payoutEligibleAt || new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000),
      gross: roundMoney(order.subtotal || 0),
      platformFee: roundMoney(order.platformCommissionAmount || 0),
      influencerShare: roundMoney(snapshot.finalEarnings || 0),
      vendorNet: roundMoney(snapshot.eligibleRevenue - snapshot.finalEarnings),
      commissionPercent: roundMoney(snapshot.commissionPercent || 0),
      metadata: {
        orderNumber: order.orderNumber,
        productId: snapshot.productId || order.attribution.productId,
        commissionSnapshotId: snapshot._id,
        appliedRuleId: snapshot.appliedRuleId,
        appliedRuleVersion: snapshot.appliedRuleVersion,
      },
    };

    return await CommissionRecord.findOneAndUpdate(
      { orderId: order._id },
      { $setOnInsert: payload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session: session || undefined,
      }
    );
  }

  async settleForOrder(orderId) {
    return await executeWithOptionalTransaction(async (session) => {
      const order = await attachSession(Order.findById(orderId), session).lean();
      if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
      if (!order.attribution?.influencerId) return { skipped: true, reason: "NO_ATTRIBUTION" };
      if (order.status !== "Delivered") return { skipped: true, reason: "ORDER_NOT_DELIVERED" };
      if (order.paymentStatus !== "Paid") return { skipped: true, reason: "PAYMENT_NOT_CAPTURED" };

      const holdRecord = await this.createHoldRecord(order, session);
      if (!holdRecord) return { skipped: true, reason: "NO_COMMISSION_RECORD" };
      if (holdRecord.state === "SETTLED") return { skipped: true, reason: "ALREADY_SETTLED" };
      if (holdRecord.state === "REVERSED") return { skipped: true, reason: "ALREADY_REVERSED" };
      if (holdRecord.holdUntil > new Date()) return { skipped: true, reason: "HOLD_OPEN" };

      const alreadyLedgered = await attachSession(
        InfluencerLedger.findOne({ idempotencyKey: buildLedgerKey(order._id, "COMMISSION") }),
        session
      ).lean();
      if (alreadyLedgered) {
        await CommissionRecord.updateOne(
          { _id: holdRecord._id, state: { $ne: "SETTLED" } },
          { $set: { state: "SETTLED", settledAt: new Date() } },
          { session: session || undefined }
        );
        return { skipped: true, reason: "ALREADY_SETTLED" };
      }

      const updatedRecord = await CommissionRecord.findOneAndUpdate(
        {
          _id: holdRecord._id,
          state: "HOLD",
          holdUntil: { $lte: new Date() },
        },
        {
          $set: {
            state: "SETTLED",
            settledAt: new Date(),
          },
        },
        {
          new: true,
          session: session || undefined,
        }
      );

      if (!updatedRecord) {
        const latest = await attachSession(CommissionRecord.findOne({ orderId }), session).lean();
        return { skipped: true, reason: latest?.state === "SETTLED" ? "ALREADY_SETTLED" : "STATE_CHANGED" };
      }

      const wallet = await getOrCreateWallet(updatedRecord.influencerId, session);
      const nextAvailable = roundMoney(wallet.availableBalance) + roundMoney(updatedRecord.influencerShare);
      const nextTotal = roundMoney(wallet.totalEarnings) + roundMoney(updatedRecord.influencerShare);

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: nextAvailable,
            totalEarnings: nextTotal,
          },
        },
        {
          new: true,
          runValidators: true,
          session: session || undefined,
        }
      );

      await InfluencerLedger.create(
        [
          {
            influencerId: updatedRecord.influencerId,
            orderId: order._id,
            type: "CREDIT",
            amount: updatedRecord.influencerShare,
            source: "COMMISSION",
            idempotencyKey: buildLedgerKey(order._id, "COMMISSION"),
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              campaignId: updatedRecord.campaignId,
              reelId: updatedRecord.reelId,
              trackingSessionId: updatedRecord.trackingSessionId,
            },
          },
        ],
        { session: session || undefined }
      );

      await CommissionLedger.updateMany(
        { orderId: order._id, state: "PENDING" },
        { $set: { state: "APPROVED" } },
        { session: session || undefined }
      );

      return {
        settled: true,
        record: updatedRecord,
        wallet: updatedWallet,
      };
    }).then(async (result) => {
      if (result?.settled) {
        await emitDomainEvent(INFLUENCER_EVENTS.COMMISSION_DISTRIBUTED, {
          orderId,
          influencerId: result.record.influencerId,
          amount: result.record.influencerShare,
        });
      }
      return result;
    });
  }

  async reverseForRefund(orderId) {
    return await executeWithOptionalTransaction(async (session) => {
      const record = await attachSession(CommissionRecord.findOne({ orderId }), session);
      if (!record) return { skipped: true, reason: "NOT_FOUND" };
      if (record.state === "REVERSED") return { skipped: true, reason: "ALREADY_REVERSED" };
      if (record.state === "CANCELLED") return { skipped: true, reason: "ALREADY_CANCELLED" };

      if (record.state === "HOLD") {
        await CommissionRecord.updateOne(
          { _id: record._id, state: "HOLD" },
          { $set: { state: "CANCELLED", reversedAt: new Date() } },
          { session: session || undefined }
        );
        return { cancelled: true };
      }

      if (record.state !== "SETTLED") {
        return { skipped: true, reason: "NOT_SETTLED" };
      }

      const reversalKey = buildLedgerKey(orderId, "REVERSAL");
      const existingReversal = await attachSession(InfluencerLedger.findOne({ idempotencyKey: reversalKey }), session).lean();
      if (existingReversal) {
        await CommissionRecord.updateOne(
          { _id: record._id, state: { $ne: "REVERSED" } },
          { $set: { state: "REVERSED", reversedAt: new Date() } },
          { session: session || undefined }
        );
        return { skipped: true, reason: "ALREADY_REVERSED" };
      }

      const updatedRecord = await CommissionRecord.findOneAndUpdate(
        { _id: record._id, state: "SETTLED" },
        { $set: { state: "REVERSED", reversedAt: new Date() } },
        { new: true, session: session || undefined }
      );

      if (!updatedRecord) return { skipped: true, reason: "STATE_CHANGED" };

      const wallet = await getOrCreateWallet(record.influencerId, session);
      if (roundMoney(wallet.availableBalance) < roundMoney(record.influencerShare)) {
        throw new AppError("Influencer wallet does not have enough available balance for reversal", 409, "REVERSAL_BLOCKED");
      }

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance) - roundMoney(record.influencerShare),
            reversedAmount: roundMoney(wallet.reversedAmount) + roundMoney(record.influencerShare),
          },
        },
        {
          new: true,
          runValidators: true,
          session: session || undefined,
        }
      );

      await InfluencerLedger.create(
        [
          {
            influencerId: record.influencerId,
            orderId,
            type: "DEBIT",
            amount: record.influencerShare,
            source: "REVERSAL",
            idempotencyKey: reversalKey,
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              campaignId: record.campaignId,
              reelId: record.reelId,
              trackingSessionId: record.trackingSessionId,
            },
          },
        ],
        { session: session || undefined }
      );

      const snapshot = await attachSession(CommissionSnapshot.findOne({ orderId }), session).lean();
      const [engineReversal] = await CommissionLedger.create(
        [
          {
            influencerId: record.influencerId,
            orderId,
            snapshotId: snapshot?._id,
            entryType: "REVERSAL",
            direction: "DEBIT",
            amount: record.influencerShare,
            state: "REVERSED",
            idempotencyKey: buildEngineLedgerKey(orderId, "REVERSAL"),
            reason: "REFUND",
            metadata: { source: "reverseForRefund" },
          },
        ],
        { session: session || undefined }
      );
      if (snapshot) {
        await CommissionReversal.create(
          [
            {
              orderId,
              influencerId: record.influencerId,
              snapshotId: snapshot._id,
              ledgerId: engineReversal._id,
              amount: record.influencerShare,
              reason: "REFUND",
              idempotencyKey: `commission-reversal:${orderId}`,
            },
          ],
          { session: session || undefined }
        );
      }

      return { reversed: true, wallet: updatedWallet };
    });
  }

  async settleEligibleOrders() {
    const eligible = await CommissionRecord.find({
      state: "HOLD",
      holdUntil: { $lte: new Date() },
    })
      .select("orderId")
      .lean();

    const results = [];
    for (const record of eligible) {
      results.push(await this.settleForOrder(record.orderId));
    }

    return {
      processed: results.filter((item) => item?.settled).length,
      results,
    };
  }

  async getInfluencerWallet(userId, influencerId) {
    if (!influencerId) {
      const profile = await require("../influencer/service").getProfile(userId);
      influencerId = profile._id;
    }
    const wallet = await getOrCreateWallet(influencerId);
    const ledger = await InfluencerLedger.find({ influencerId }).sort({ createdAt: -1 }).limit(50).lean();
    return { wallet, ledger };
  }

  async getInfluencerDashboard(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);
    const { start, end } = parseDashboardRange(query);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - (end.getTime() - start.getTime()));
    const campaignId = objectIdOrNull(query.campaignId);
    const productId = objectIdOrNull(query.productId);
    const category = query.category ? String(query.category).trim().toLowerCase() : "";
    const brand = query.brand ? String(query.brand).trim().toLowerCase() : "";
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 8));

    const baseRecordMatch = {
      influencerId,
      createdAt: { $gte: start, $lte: end },
    };
    if (campaignId) baseRecordMatch.campaignId = campaignId;

    const previousRecordMatch = {
      influencerId,
      createdAt: { $gte: previousStart, $lte: previousEnd },
    };
    if (campaignId) previousRecordMatch.campaignId = campaignId;

    const campaignFilter = { influencerId };
    if (campaignId) campaignFilter._id = campaignId;

    const reelFilter = { influencerId };
    if (campaignId) reelFilter.campaignId = campaignId;
    if (productId) reelFilter.productIds = productId;

    const [
      currentAgg,
      previousAgg,
      pendingAgg,
      ledgerAgg,
      recentLedger,
      records,
      reels,
      campaigns,
      socialAccounts,
      activeProfile,
    ] = await Promise.all([
      CommissionRecord.aggregate([
        { $match: baseRecordMatch },
        {
          $group: {
            _id: null,
            commission: { $sum: "$influencerShare" },
            gross: { $sum: "$gross" },
            orders: { $sum: 1 },
          },
        },
      ]),
      CommissionRecord.aggregate([
        { $match: previousRecordMatch },
        {
          $group: {
            _id: null,
            commission: { $sum: "$influencerShare" },
            gross: { $sum: "$gross" },
            orders: { $sum: 1 },
          },
        },
      ]),
      CommissionRecord.aggregate([
        { $match: { influencerId, state: "HOLD" } },
        { $group: { _id: null, total: { $sum: "$influencerShare" } } },
      ]),
      InfluencerLedger.aggregate([
        {
          $match: {
            influencerId,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$source",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      InfluencerLedger.find({ influencerId }).sort({ createdAt: -1 }).limit(8).lean(),
      CommissionRecord.find(baseRecordMatch)
        .populate({
          path: "orderId",
          select: "orderNumber userId items totalAmount subtotal status paymentStatus createdAt",
          populate: [
            { path: "userId", select: "name email" },
            { path: "items.productId", select: "name images category brand price discountPrice analytics" },
          ],
        })
        .populate({ path: "campaignId", select: "state commissionPercent fixedFee deadline vendorId createdAt", populate: { path: "vendorId", select: "shopName companyName" } })
        .populate("reelId", "caption videoUrl metrics state publishedAt createdAt productIds")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      Reel.find(reelFilter)
        .populate({ path: "campaignId", select: "state commissionPercent fixedFee deadline vendorId", populate: { path: "vendorId", select: "shopName companyName" } })
        .sort({ "metrics.orders": -1, "metrics.clicks": -1, createdAt: -1 })
        .limit(10)
        .lean(),
      Campaign.find(campaignFilter)
        .populate("productIds", "name category brand images")
        .populate("vendorId", "shopName companyName")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      InfluencerSocialAccount.find({ influencerId }).select("platform followersCount engagementRate updatedAt").lean(),
      InfluencerProfile.findById(influencerId).select("followers stats permissions").lean(),
    ]);

    const filteredRecords = records.filter((record) => {
      const order = record.orderId;
      if (!includesProduct(order, productId)) return false;
      if (!category && !brand) return true;
      return (order?.items || []).some((item) => {
        const product = item.productId || {};
        const productCategory = String(product.category || "").toLowerCase();
        const productBrand = String(product.brand || "").toLowerCase();
        return (!category || productCategory === category) && (!brand || productBrand.includes(brand));
      });
    });

    const snapshotIds = filteredRecords
      .map((record) => record.metadata?.commissionSnapshotId)
      .filter((id) => id && mongoose.isValidObjectId(id));
    const orderIds = filteredRecords
      .map((record) => record.orderId?._id || record.orderId)
      .filter((id) => id && mongoose.isValidObjectId(id));
    const snapshotClauses = [
      ...(snapshotIds.length ? [{ _id: { $in: snapshotIds } }] : []),
      ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
    ];
    const snapshots = snapshotClauses.length
      ? await CommissionSnapshot.find({ $or: snapshotClauses }).populate("appliedRuleId").lean()
      : [];
    const snapshotByOrder = new Map();
    const snapshotById = new Map();
    for (const snapshot of snapshots) {
      snapshotByOrder.set(String(snapshot.orderId), snapshot);
      snapshotById.set(String(snapshot._id), snapshot);
    }
    const ruleByRecordId = new Map();
    for (const record of filteredRecords) {
      const snapshot =
        snapshotById.get(String(record.metadata?.commissionSnapshotId || "")) ||
        snapshotByOrder.get(String(record.orderId?._id || record.orderId || ""));
      ruleByRecordId.set(String(record._id), buildSnapshotRuleSummary(snapshot));
    }
    let currentApplicableRule = await this.resolveRule({
      influencerId,
      trafficSource: query.trafficSource || "affiliate_link",
      orders: filteredRecords.length,
      conversionRate: 0,
      campaignCompletion: 0,
      reelEngagement: 0,
      eligibleRevenue: 0,
      grossSale: 0,
    });

    const current = currentAgg[0] || {};
    const previous = previousAgg[0] || {};
    const totalClicks = reels.reduce((sum, reel) => sum + Number(reel.metrics?.clicks || 0), 0);
    const totalViews = reels.reduce((sum, reel) => sum + Number(reel.metrics?.views || 0), 0);
    const totalOrders = filteredRecords.length;
    const totalEarnings = roundMoney(filteredRecords.reduce((sum, record) => sum + Number(record.influencerShare || 0), 0));
    const grossRevenue = roundMoney(filteredRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0));
    const conversionRate = totalClicks > 0 ? roundMoney((totalOrders / totalClicks) * 100) : 0;
    const averageOrderValue = totalOrders > 0 ? roundMoney(grossRevenue / totalOrders) : 0;
    const followers = Number(activeProfile?.followers || socialAccounts.reduce((sum, account) => sum + Number(account.followersCount || 0), 0));
    const engagementRate = socialAccounts.length
      ? roundMoney(socialAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / socialAccounts.length)
      : 0;
    currentApplicableRule = await this.resolveRule({
      influencerId,
      trafficSource: query.trafficSource || "affiliate_link",
      orders: totalOrders,
      conversionRate,
      campaignCompletion: 0,
      reelEngagement: engagementRate,
      eligibleRevenue: averageOrderValue,
      grossSale: averageOrderValue,
    });

    const revenueBuckets = buildDateBuckets(start, end);
    const revenueMap = new Map(revenueBuckets.map((item) => [item.date, item]));
    for (const record of filteredRecords) {
      const key = new Date(record.createdAt).toISOString().slice(0, 10);
      const row = revenueMap.get(key);
      if (row) {
        row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        row.orders += 1;
      }
    }

    const productRows = new Map();
    for (const record of filteredRecords) {
      const order = record.orderId;
      const appliedRule = ruleByRecordId.get(String(record._id));
      for (const item of order?.items || []) {
        const product = item.productId || {};
        const id = String(product._id || item.productId || "");
        if (!id) continue;
        if (productId && id !== String(productId)) continue;
        const row = productRows.get(id) || {
          id,
          name: product.name || item.name || "Product",
          image: productImage(product) || item.image || "",
          category: product.category || "",
          brand: product.brand || "",
          orders: 0,
          revenue: 0,
          commission: 0,
          clicks: 0,
          appliedRule: null,
          appliedRuleCounts: {},
        };
        row.orders += Number(item.quantity || 1);
        row.revenue = roundMoney(row.revenue + Number(item.price || 0) * Number(item.quantity || 1));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        if (appliedRule) {
          row.appliedRule = row.appliedRule || appliedRule;
          row.appliedRuleCounts[appliedRule.ruleTypeLabel || "Rule"] = Number(row.appliedRuleCounts[appliedRule.ruleTypeLabel || "Rule"] || 0) + 1;
        }
        productRows.set(id, row);
      }
    }

    for (const reel of reels) {
      const linkedProducts = (reel.productIds || []).map((id) => String(id));
      for (const linkedProductId of linkedProducts) {
        const row = productRows.get(linkedProductId);
        if (row) row.clicks += Number(reel.metrics?.clicks || 0);
      }
    }

    const reelRevenue = new Map();
    for (const record of filteredRecords) {
      const id = String(record.reelId?._id || record.reelId || "");
      if (!id) continue;
      const row = reelRevenue.get(id) || { revenue: 0, commission: 0, orders: 0 };
      row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
      row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
      row.orders += 1;
      reelRevenue.set(id, row);
    }

    const topProducts = [...productRows.values()]
      .map((row) => ({
        ...row,
        ctr: totalViews ? roundMoney((row.clicks / totalViews) * 100) : 0,
        conversionRate: totalClicks ? roundMoney((row.orders / totalClicks) * 100) : 0,
        appliedRuleType: Object.entries(row.appliedRuleCounts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || row.appliedRule?.ruleTypeLabel || "",
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 8);

    const topVideos = reels.map((reel) => {
      const money = reelRevenue.get(String(reel._id)) || {};
      const clicks = Number(reel.metrics?.clicks || 0);
      const views = Number(reel.metrics?.views || 0);
      return {
        id: String(reel._id),
        title: reel.caption || "Untitled content",
        thumbnail: reel.videoUrl || "",
        views,
        clicks,
        orders: Number(reel.metrics?.orders || money.orders || 0),
        revenue: roundMoney(money.revenue || 0),
        commission: roundMoney(money.commission || 0),
        ctr: views ? roundMoney((clicks / views) * 100) : 0,
        engagementRate: views ? roundMoney(((clicks + Number(reel.metrics?.orders || 0)) / views) * 100) : 0,
        publishedAt: reel.publishedAt || reel.createdAt,
        status: reel.state,
      };
    });

    const activeCampaigns = campaigns.map((campaign) => {
      const campaignRecords = filteredRecords.filter((record) => String(record.campaignId?._id || record.campaignId) === String(campaign._id));
      const campaignRule = dominantRuleSummary(new Map(campaignRecords.map((record) => [String(record._id), ruleByRecordId.get(String(record._id))])));
      return {
        id: String(campaign._id),
        name: campaign.productIds?.[0]?.name || `${campaign.vendorId?.shopName || campaign.vendorId?.companyName || "Brand"} campaign`,
        brand: campaign.vendorId?.shopName || campaign.vendorId?.companyName || "Brand",
        category: campaign.productIds?.[0]?.category || "",
        status: campaign.state,
        startDate: campaign.createdAt,
        endDate: campaign.deadline,
        budget: Number(campaign.fixedFee || 0),
        commissionPercent: Number(campaignRule?.commissionPercent ?? campaign.commissionPercent ?? 0),
        appliedRule: campaignRule,
        appliedRuleType: campaignRule?.ruleTypeLabel || "",
        revenueEarned: roundMoney(campaignRecords.reduce((sum, record) => sum + Number(record.influencerShare || 0), 0)),
      };
    });

    const recentOrders = filteredRecords.slice((page - 1) * limit, page * limit).map((record) => {
      const order = record.orderId || {};
      const firstItem = order.items?.[0] || {};
      const appliedRule = ruleByRecordId.get(String(record._id));
      return {
        id: String(order._id || record.orderId),
        orderNumber: order.orderNumber || String(order._id || record.orderId).slice(-8),
        product: firstItem.name || firstItem.productId?.name || "Product",
        productId: String(firstItem.productId?._id || firstItem.productId || ""),
        customer: order.userId?.name || order.userId?.email || "Customer",
        amount: Number(order.totalAmount || record.gross || 0),
        commission: Number(record.influencerShare || 0),
        commissionPercent: Number(appliedRule?.commissionPercent ?? record.commissionPercent ?? 0),
        appliedRule,
        appliedRuleType: appliedRule?.ruleTypeLabel || "",
        status: record.state === "HOLD" ? "Pending" : record.state === "SETTLED" ? "Completed" : record.state,
        orderStatus: order.status,
        createdAt: order.createdAt || record.createdAt,
      };
    });

    const earningsBreakdown = ledgerAgg.map((row) => ({
      source: row._id === "COMMISSION" ? "Product Commissions" : row._id === "REVERSAL" ? "Reversals" : row._id || "Other Earnings",
      amount: roundMoney(row.total || 0),
      count: row.count,
    }));
    const breakdownTotal = earningsBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    for (const item of earningsBreakdown) {
      item.percentage = breakdownTotal ? roundMoney((item.amount / breakdownTotal) * 100) : 0;
    }

    const pendingEarnings = roundMoney(pendingAgg[0]?.total || 0);
    const dominantHistoricalRule = dominantRuleSummary(ruleByRecordId);
    const recentActivity = [
      ...recentLedger.map((entry) => ({
        id: String(entry._id),
        type: "wallet",
        title: entry.type === "CREDIT" ? "Commission approved" : "Wallet adjustment",
        message: entry.source === "COMMISSION" ? "Order commission moved through your ledger." : entry.source,
        amount: entry.amount,
        entryType: entry.type,
        createdAt: entry.createdAt,
      })),
      ...activeCampaigns
        .filter((campaign) => campaign.status === "proposed")
        .slice(0, 3)
        .map((campaign) => ({
          id: `campaign-${campaign.id}`,
          type: "campaign",
          title: "Campaign invitation",
          message: `${campaign.brand} invited you to a campaign.`,
          createdAt: campaign.startDate,
        })),
    ]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);

    return {
      filters: {
        range: query.range || "30d",
        startDate: start,
        endDate: end,
        campaignId: campaignId ? String(campaignId) : "",
        productId: productId ? String(productId) : "",
        category,
        brand,
      },
      totalEarnings,
      pendingEarnings,
      totalOrders,
      totalClicks,
      conversionRate,
      availableBalance: roundMoney(wallet.availableBalance || 0),
      followers,
      commissionRuleSummary: {
        currentApplicableRule: buildRuleSummary(currentApplicableRule),
        mostAppliedRule: dominantHistoricalRule,
        ruleSource: dominantHistoricalRule ? "historical_snapshots" : currentApplicableRule ? "current_resolution" : "none",
        note: dominantHistoricalRule
          ? "Shown from immutable commission snapshots on attributed orders."
          : currentApplicableRule
            ? "Shown from current rule resolution for this influencer."
            : "No active commission rule currently applies to this influencer.",
      },
      earningsOverTime: [...revenueMap.values()].map((row) => ({ date: row.date, amount: row.commission })),
      recentActivity,
      kpis: [
        { key: "earnings", label: "Total Earnings", value: totalEarnings, format: "currency", growth: percentChange(current.commission, previous.commission), sparkline: [...revenueMap.values()].map((row) => row.commission) },
        { key: "clicks", label: "Product Clicks", value: totalClicks, format: "number", growth: percentChange(totalClicks, 0), sparkline: reels.map((row) => row.metrics?.clicks || 0).slice(0, 12) },
        { key: "orders", label: "Orders Generated", value: totalOrders, format: "number", growth: percentChange(current.orders, previous.orders), sparkline: [...revenueMap.values()].map((row) => row.orders) },
        { key: "conversion", label: "Conversion Rate", value: conversionRate, format: "percent", growth: percentChange(conversionRate, 0), sparkline: [...revenueMap.values()].map((row) => row.orders) },
        { key: "followers", label: "Followers Count", value: followers, format: "number", growth: 0, sparkline: [followers, followers, followers] },
        { key: "balance", label: "Withdrawable Balance", value: roundMoney(wallet.availableBalance || 0), format: "currency", growth: 0, sparkline: [wallet.availableBalance || 0] },
      ],
      metrics: {
        grossRevenue,
        commissionRevenue: totalEarnings,
        bonusRevenue: 0,
        campaignRevenue: totalEarnings,
        averageOrderValue,
        engagementRate,
        totalViews,
      },
      revenueOverview: [...revenueMap.values()],
      earningsBreakdown,
      topProducts,
      topVideos,
      activeCampaigns: activeCampaigns.filter((campaign) => ["active", "accepted", "completed", "proposed"].includes(campaign.status)),
      campaignInvitations: activeCampaigns.filter((campaign) => campaign.status === "proposed"),
      followersGrowth: [...revenueMap.values()].map((row, index, rows) => ({
        date: row.date,
        followers,
        newFollowers: index === rows.length - 1 ? 0 : 0,
        lostFollowers: 0,
        growthRate: 0,
      })),
      recentOrders: {
        rows: recentOrders,
        page,
        limit,
        total: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / limit) || 1,
      },
      earningsSummary: {
        pending: pendingEarnings,
        approved: roundMoney(wallet.totalEarnings || 0),
        withdrawable: roundMoney(wallet.availableBalance || 0),
        lifetime: roundMoney(wallet.totalEarnings || 0),
        withdrawn: roundMoney(wallet.withdrawnBalance || 0),
      },
      quickActions: [
        { key: "affiliate", label: "Create Affiliate Link", href: "/influencer/affiliate-links", enabled: Boolean(profile.permissions?.affiliateLinks) },
        { key: "product", label: "Add Product", href: "/influencer/collections", enabled: Boolean(profile.permissions?.collections) },
        { key: "video", label: "Upload Video", href: "/influencer/reels/upload", enabled: true },
        { key: "collection", label: "Create Collection", href: "/influencer/collections", enabled: Boolean(profile.permissions?.collections) },
        { key: "withdraw", label: "Request Withdrawal", href: "/influencer/earnings", enabled: Boolean(profile.permissions?.wallet) },
        { key: "analytics", label: "Analytics", href: "/influencer/analytics", enabled: Boolean(profile.permissions?.analytics) },
      ],
      notifications: {
        unreadCount: 0,
        items: [],
      },
    };
  }

  async getInfluencerEarnings(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const wallet = await getOrCreateWallet(influencerId);
    const { start, end } = parseDashboardRange(query);

    const pendingAgg = await CommissionRecord.aggregate([
      { $match: { influencerId, state: "HOLD" } },
      { $group: { _id: null, total: { $sum: "$influencerShare" } } },
    ]);
    const pending = roundMoney(pendingAgg[0]?.total || 0);
    const settledAgg = await CommissionRecord.aggregate([
      { $match: { influencerId, state: "SETTLED" } },
      { $group: { _id: null, total: { $sum: "$influencerShare" }, gross: { $sum: "$gross" }, count: { $sum: 1 } } },
    ]);
    const bonusAgg = await InfluencerLedger.aggregate([
      { $match: { influencerId, source: { $in: ["BONUS", "REFERRAL", "ADJUSTMENT", "CAMPAIGN"] } } },
      { $group: { _id: "$source", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const ledgerFilter = { influencerId };
    if (query.type === "CREDIT" || query.type === "DEBIT") {
      ledgerFilter.type = query.type;
    }
    if (["COMMISSION", "REVERSAL", "WITHDRAWAL", "WITHDRAWAL_REVERSAL", "BONUS", "REFERRAL", "ADJUSTMENT", "CAMPAIGN"].includes(query.source)) {
      ledgerFilter.source = query.source;
    }
    if (query.from || query.to) {
      ledgerFilter.createdAt = {};
      if (query.from) ledgerFilter.createdAt.$gte = new Date(query.from);
      if (query.to) ledgerFilter.createdAt.$lte = new Date(query.to);
    }

    const [transactions, total, records, withdrawals, account] = await Promise.all([
      InfluencerLedger.find(ledgerFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InfluencerLedger.countDocuments(ledgerFilter),
      CommissionRecord.find({ influencerId, createdAt: { $gte: start, $lte: end } })
        .populate({ path: "orderId", select: "orderNumber totalAmount status paymentStatus createdAt items", populate: { path: "items.productId", select: "name category brand images" } })
        .populate({ path: "campaignId", select: "title campaignType category vendorId", populate: { path: "vendorId", select: "shopName companyName" } })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      InfluencerWithdrawalRequest.find({ influencerId }).populate("payoutAccountId").sort({ requestedAt: -1 }).limit(100).lean(),
      InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 }).lean(),
    ]);

    const dailyMap = new Map(buildDateBuckets(start, end).map((bucket) => [bucket.date, bucket]));
    const productBreakdown = new Map();
    const campaignBreakdown = new Map();
    for (const record of records) {
      const key = new Date(record.createdAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.revenue = roundMoney(bucket.revenue + Number(record.gross || 0));
        bucket.commission = roundMoney(bucket.commission + Number(record.influencerShare || 0));
        bucket.orders += 1;
      }
      const campaignId = String(record.campaignId?._id || record.campaignId || "");
      if (campaignId) {
        const row = campaignBreakdown.get(campaignId) || {
          id: campaignId,
          campaign: record.campaignId?.title || `${record.campaignId?.vendorId?.shopName || record.campaignId?.vendorId?.companyName || "Brand"} campaign`,
          orders: 0,
          revenue: 0,
          commission: 0,
        };
        row.orders += 1;
        row.revenue = roundMoney(row.revenue + Number(record.gross || 0));
        row.commission = roundMoney(row.commission + Number(record.influencerShare || 0));
        campaignBreakdown.set(campaignId, row);
      }
      for (const item of record.orderId?.items || []) {
        const product = item.productId || {};
        const id = String(product._id || item.productId || "");
        if (!id) continue;
        const row = productBreakdown.get(id) || {
          id,
          productName: product.name || item.name || "Product",
          campaign: record.campaignId?.title || "",
          category: product.category || "",
          brand: product.brand || "",
          orders: 0,
          revenue: 0,
          commissionRate: Number(record.commissionPercent || 0),
          commissionEarned: 0,
        };
        row.orders += Number(item.quantity || 1);
        row.revenue = roundMoney(row.revenue + Number(item.price || 0) * Number(item.quantity || 1));
        row.commissionEarned = roundMoney(row.commissionEarned + Number(record.influencerShare || 0));
        productBreakdown.set(id, row);
      }
    }

    const withdrawalBuckets = withdrawals.reduce(
      (acc, request) => {
        if (["PENDING", "UNDER_REVIEW"].includes(request.status)) acc.pending.push(request);
        if (["APPROVED", "PROCESSING", "PAID"].includes(request.status)) acc.approved.push(request);
        if (["REJECTED", "FAILED", "CANCELLED"].includes(request.status)) acc.rejected.push(request);
        if (["PAID", "PROCESSING", "APPROVED", "FAILED"].includes(request.status)) acc.history.push(request);
        return acc;
      },
      { pending: [], approved: [], rejected: [], history: [] }
    );

    const bonusEarnings = bonusAgg.map((row) => ({
      type: row._id,
      description: `${String(row._id || "").toLowerCase()} earnings`,
      amount: roundMoney(row.total || 0),
      count: row.count,
      status: "APPROVED",
    }));
    const bonusTotal = roundMoney(bonusEarnings.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    const approved = roundMoney(settledAgg[0]?.total || wallet.totalEarnings || 0);
    const taxableIncome = roundMoney(approved + bonusTotal);
    const taxWithheld = roundMoney(taxableIncome * Number(process.env.INFLUENCER_TAX_WITHHOLDING_RATE || 0));

    return {
      available: roundMoney(wallet.availableBalance || 0),
      pendingBalance: roundMoney(wallet.pendingBalance || 0),
      pending,
      approved,
      totalEarnings: roundMoney(wallet.totalEarnings || approved),
      withdrawn: roundMoney(wallet.withdrawnBalance || 0),
      transactions,
      wallet: {
        availableBalance: roundMoney(wallet.availableBalance || 0),
        pendingBalance: roundMoney(wallet.pendingBalance || 0),
        reservedBalance: roundMoney(wallet.pendingBalance || 0),
        totalBalance: roundMoney(Number(wallet.availableBalance || 0) + Number(wallet.pendingBalance || 0)),
        totalEarnings: roundMoney(wallet.totalEarnings || 0),
        withdrawnBalance: roundMoney(wallet.withdrawnBalance || 0),
        status: wallet.status,
      },
      kpis: {
        totalEarnings: roundMoney(wallet.totalEarnings || approved),
        pendingEarnings: pending,
        approvedEarnings: approved,
        withdrawableBalance: roundMoney(wallet.availableBalance || 0),
        totalWithdrawn: roundMoney(wallet.withdrawnBalance || 0),
        bonusEarnings: bonusTotal,
      },
      earningsHistory: transactions,
      pendingEarnings: records.filter((record) => record.state === "HOLD").map((record) => ({
        id: record._id,
        referenceId: record.metadata?.orderNumber || String(record.orderId?._id || record.orderId || "").slice(-8),
        source: "Commission",
        orderId: record.orderId?.orderNumber || "",
        campaign: record.campaignId?.title || "",
        amount: Number(record.influencerShare || 0),
        expectedApprovalDate: record.holdUntil,
        status: "Pending",
      })),
      approvedEarnings: records.filter((record) => record.state === "SETTLED").map((record) => ({
        id: record._id,
        date: record.settledAt || record.createdAt,
        source: "Commission",
        order: record.orderId?.orderNumber || "",
        campaign: record.campaignId?.title || "",
        amount: Number(record.gross || 0),
        commission: Number(record.influencerShare || 0),
        status: record.state,
      })),
      commissionBreakdown: {
        products: [...productBreakdown.values()].sort((a, b) => b.commissionEarned - a.commissionEarned),
        campaigns: [...campaignBreakdown.values()].sort((a, b) => b.commission - a.commission),
        averageCommission: records.length ? roundMoney(records.reduce((sum, record) => sum + Number(record.commissionPercent || 0), 0) / records.length) : 0,
      },
      bonusEarnings,
      taxSummary: {
        taxableIncome,
        totalEarnings: roundMoney(wallet.totalEarnings || approved),
        taxWithheld,
        netEarnings: roundMoney(taxableIncome - taxWithheld),
        deductions: 0,
        documents: [],
      },
      revenueTrend: [...dailyMap.values()],
      withdrawals: withdrawalBuckets,
      payoutAccount: maskInfluencerPayoutAccount(account),
      withdrawalRules: {
        minimumAmount: MIN_WITHDRAWAL_AMOUNT,
        maximumAmount: MAX_WITHDRAWAL_AMOUNT,
        processingTime: "2-5 business days",
      },
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listInfluencerWithdrawals(userId, query = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter = { influencerId };
    const statuses = normalizeWithdrawalStatus(query.tab || query.status);
    if (statuses.length) filter.status = { $in: statuses };
    const [requests, total] = await Promise.all([
      InfluencerWithdrawalRequest.find(filter).populate("payoutAccountId").sort({ requestedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InfluencerWithdrawalRequest.countDocuments(filter),
    ]);
    return {
      requests: requests.map((request) => ({ ...request, payoutAccountId: maskInfluencerPayoutAccount(request.payoutAccountId) })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async requestWithdrawal(userId, payload = {}, actor = {}, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const amount = roundMoney(payload.amount || 0);
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new AppError(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT}`, 400, "WITHDRAWAL_MINIMUM_NOT_MET");
    }
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      throw new AppError(`Maximum withdrawal amount is ${MAX_WITHDRAWAL_AMOUNT}`, 400, "WITHDRAWAL_MAXIMUM_EXCEEDED");
    }

    return await executeWithOptionalTransaction(async (session) => {
      const wallet = await getOrCreateWallet(influencerId, session);
      if (roundMoney(wallet.availableBalance || 0) < amount) {
        throw new AppError("Insufficient withdrawable balance", 400, "INSUFFICIENT_BALANCE");
      }
      const pending = await attachSession(
        InfluencerWithdrawalRequest.findOne({ influencerId, status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } }),
        session
      ).lean();
      if (pending) throw new AppError("A withdrawal request is already pending", 409, "WITHDRAWAL_ALREADY_PENDING");

      const account = payload.payoutAccountId
        ? await attachSession(InfluencerPayoutAccount.findOne({ _id: payload.payoutAccountId, influencerId, isActive: true }), session)
        : await attachSession(InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 }), session);
      if (!account) throw new AppError("Add a bank account or payout method before requesting withdrawal", 400, "PAYOUT_ACCOUNT_REQUIRED");

      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance || 0) - amount,
            pendingBalance: roundMoney(wallet.pendingBalance || 0) + amount,
          },
        },
        { new: true, session: session || undefined, runValidators: true }
      );

      const [request] = await InfluencerWithdrawalRequest.create(
        [
          {
            influencerId,
            payoutAccountId: account._id,
            amount,
            paymentMethod: payload.paymentMethod || account.paymentMethod || "bank_transfer",
            status: "PENDING",
            remarks: payload.remarks || "",
            expectedProcessingAt: addDays(new Date(), 3),
          },
        ],
        { session: session || undefined }
      );

      const [ledgerEntry] = await InfluencerLedger.create(
        [
          {
            influencerId,
            type: "DEBIT",
            amount,
            source: "WITHDRAWAL",
            idempotencyKey: buildWithdrawalLedgerKey(request._id),
            balanceAfter: updatedWallet.availableBalance,
            meta: {
              withdrawalRequestId: request._id,
              payoutAccountId: account._id,
              status: request.status,
            },
          },
        ],
        { session: session || undefined }
      );

      await auditService.log({
        actor: actor || { _id: userId, role: "influencer" },
        action: "influencer.withdrawal.requested",
        entityType: "InfluencerWithdrawalRequest",
        entityId: request._id,
        metadata: { influencerId: String(influencerId), amount, ledgerEntryId: String(ledgerEntry._id) },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      }).catch(() => {});

      return { request, wallet: updatedWallet, ledgerEntry };
    });
  }

  async cancelWithdrawal(userId, requestId, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    return await executeWithOptionalTransaction(async (session) => {
      const request = await attachSession(InfluencerWithdrawalRequest.findOne({ _id: requestId, influencerId }), session);
      if (!request) throw new AppError("Withdrawal request not found", 404, "NOT_FOUND");
      if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
        throw new AppError("Only pending withdrawal requests can be cancelled", 400, "INVALID_WITHDRAWAL_STATUS");
      }
      const wallet = await getOrCreateWallet(influencerId, session);
      const updatedWallet = await InfluencerWallet.findByIdAndUpdate(
        wallet._id,
        {
          $set: {
            availableBalance: roundMoney(wallet.availableBalance || 0) + roundMoney(request.amount || 0),
            pendingBalance: Math.max(0, roundMoney(wallet.pendingBalance || 0) - roundMoney(request.amount || 0)),
          },
        },
        { new: true, session: session || undefined, runValidators: true }
      );
      request.status = "CANCELLED";
      request.rejectedAt = new Date();
      request.rejectionReason = "Cancelled by influencer";
      await request.save({ session: session || undefined });

      await InfluencerLedger.create(
        [
          {
            influencerId,
            type: "CREDIT",
            amount: request.amount,
            source: "WITHDRAWAL_REVERSAL",
            idempotencyKey: buildWithdrawalLedgerKey(request._id, "cancel"),
            balanceAfter: updatedWallet.availableBalance,
            meta: { withdrawalRequestId: request._id, reason: "cancelled" },
          },
        ],
        { session: session || undefined }
      );
      return { request, wallet: updatedWallet };
    });
  }

  async getInfluencerPayoutAccounts(userId) {
    const profile = await require("../influencer/service").getProfile(userId);
    const accounts = await InfluencerPayoutAccount.find({ influencerId: profile._id, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
    return { accounts: accounts.map(maskInfluencerPayoutAccount) };
  }

  async upsertInfluencerPayoutAccount(userId, payload = {}, meta = {}) {
    const profile = await require("../influencer/service").getProfile(userId);
    const influencerId = profile._id;
    const encService = getEncryptionService();
    const normalized = {
      accountHolderName: String(payload.accountHolderName || "").trim(),
      accountNumber: String(payload.accountNumber || "").trim(),
      ifscCode: String(payload.ifscCode || "").trim().toUpperCase(),
      bankName: String(payload.bankName || "").trim(),
      upiId: String(payload.upiId || "").trim().toLowerCase(),
      paypalEmail: String(payload.paypalEmail || "").trim().toLowerCase(),
      paymentMethod: payload.paymentMethod || "bank_transfer",
    };
    const hasBank = normalized.accountHolderName && normalized.accountNumber && normalized.ifscCode;
    const hasUpi = Boolean(normalized.upiId);
    const hasPaypal = Boolean(normalized.paypalEmail);
    if (!hasBank && !hasUpi && !hasPaypal) {
      throw new AppError("Provide bank, UPI, or PayPal payout details", 400, "PAYOUT_ACCOUNT_REQUIRED");
    }

    const existing = await InfluencerPayoutAccount.findOne({ influencerId, isActive: true, isDefault: true }).sort({ createdAt: -1 });
    if (existing) {
      await InfluencerPayoutAccount.updateMany({ influencerId, isActive: true, isDefault: true }, { $set: { isDefault: false, isActive: false } });
    }
    const account = await InfluencerPayoutAccount.create({
      influencerId,
      accountHolderName: normalized.accountHolderName,
      accountNumberEncrypted: normalized.accountNumber ? encService.encrypt(normalized.accountNumber) : "",
      ifscCode: normalized.ifscCode,
      bankName: normalized.bankName,
      upiIdEncrypted: normalized.upiId ? encService.encrypt(normalized.upiId) : "",
      paypalEmail: normalized.paypalEmail,
      paymentMethod: normalized.paymentMethod,
      isDefault: true,
      isActive: true,
      isVerified: false,
      verificationStatus: "PENDING",
      version: existing ? Number(existing.version || 1) + 1 : 1,
      previousVersions: existing ? [existing.toObject ? existing.toObject() : existing] : [],
      updateReason: payload.updateReason || "Influencer updated payout account",
    });

    await auditService.log({
      actor: { _id: userId, role: "influencer" },
      action: existing ? "influencer.payout_account.updated" : "influencer.payout_account.created",
      entityType: "InfluencerPayoutAccount",
      entityId: account._id,
      metadata: { influencerId: String(influencerId), paymentMethod: account.paymentMethod },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    }).catch(() => {});

    return maskInfluencerPayoutAccount(account);
  }

  async simulateCommission(payload = {}) {
    const result = await this.calculateCommission({
      influencerId: payload.influencerId,
      campaignId: payload.campaignId,
      productId: payload.productId,
      categoryId: payload.categoryId,
      trafficSource: payload.trafficSource,
      revenue: payload.revenue,
      expectedOrders: payload.expectedOrders,
      conversionRate: payload.conversionRate,
      campaignCompletion: payload.campaignCompletion,
      reelEngagement: payload.reelEngagement,
      reelEngagementTarget: payload.reelEngagementTarget,
      order: {
        subtotal: payload.revenue,
        totalAmount: payload.revenue,
        discountAmount: payload.discounts || 0,
        platformFee: payload.platformAdjustments || 0,
        sellerId: payload.vendorId,
        attribution: {
          influencerId: payload.influencerId,
          campaignId: payload.campaignId,
          productId: payload.productId,
          surface: payload.trafficSource,
        },
        items: [{ productId: payload.productId }],
      },
    });
    if (result.skipped) {
      return {
        appliedRule: null,
        reason: result.reason,
        commissionPercent: 0,
        bonusPercent: 0,
        finalEarnings: 0,
        settlementProjection: null,
      };
    }
    return {
      appliedRule: {
        id: result.rule._id,
        ruleName: result.rule.ruleName,
        ruleCode: result.rule.ruleCode,
        ruleType: result.rule.ruleType,
        version: result.rule.version,
      },
      commissionPercent: result.commissionPercent,
      commissionAmount: result.commissionAmount,
      bonusPercent: result.bonusPercent,
      bonusAmount: result.bonusAmount,
      finalEarnings: result.finalEarnings,
      settlementProjection: {
        cycle: payload.cycle || "weekly",
        estimatedApprovalDate: addDays(new Date(), HOLD_DAYS),
      },
    };
  }

  async getAdminDashboard(query = {}) {
    const match = {};
    if (query.from || query.to) {
      match.createdAt = {};
      if (query.from) match.createdAt.$gte = new Date(query.from);
      if (query.to) match.createdAt.$lte = new Date(query.to);
    }
    const [
      snapshotSummary,
      ledgerSummary,
      topInfluencers,
      topCampaigns,
      topProducts,
      topCategories,
      trafficSourcePerformance,
      pendingSettlement,
    ] = await Promise.all([
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: null, totalCommission: { $sum: "$finalEarnings" }, bonus: { $sum: "$bonusAmount" }, count: { $sum: 1 } } }]),
      CommissionLedger.aggregate([{ $match: match }, { $group: { _id: "$state", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: "$influencerId", total: { $sum: "$finalEarnings" }, orders: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 10 }]),
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: "$campaignId", total: { $sum: "$finalEarnings" }, orders: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 10 }]),
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: "$productId", total: { $sum: "$finalEarnings" }, orders: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 10 }]),
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: "$categoryId", total: { $sum: "$finalEarnings" }, orders: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 10 }]),
      CommissionSnapshot.aggregate([{ $match: match }, { $group: { _id: "$trafficSource", total: { $sum: "$finalEarnings" }, revenue: { $sum: "$eligibleRevenue" }, orders: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      CommissionLedger.aggregate([{ $match: { state: "APPROVED" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    ]);
    const byState = ledgerSummary.reduce((acc, row) => {
      acc[row._id] = { amount: roundMoney(row.total), count: row.count };
      return acc;
    }, {});
    return {
      totalCommission: roundMoney(snapshotSummary[0]?.totalCommission || 0),
      pendingCommission: byState.PENDING?.amount || 0,
      approvedCommission: byState.APPROVED?.amount || 0,
      settledCommission: byState.SETTLED?.amount || 0,
      paidCommission: byState.PAID?.amount || 0,
      reversedCommission: byState.REVERSED?.amount || 0,
      bonusCommission: roundMoney(snapshotSummary[0]?.bonus || 0),
      topInfluencers,
      topCampaigns,
      topProducts,
      topCategories,
      trafficSourcePerformance,
      settlementForecast: {
        amount: roundMoney(pendingSettlement[0]?.total || 0),
        entries: Number(pendingSettlement[0]?.count || 0),
      },
    };
  }

  async createSettlement(payload = {}, actor = {}, meta = {}) {
    const cycle = payload.cycle || "weekly";
    const periodStart = payload.periodStart ? new Date(payload.periodStart) : addDays(new Date(), -7);
    const periodEnd = payload.periodEnd ? new Date(payload.periodEnd) : new Date();
    const entries = await CommissionLedger.find({
      state: "APPROVED",
      createdAt: { $gte: periodStart, $lte: periodEnd },
    }).lean();
    const totalAmount = roundMoney(entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
    const settlement = await CommissionSettlement.create({
      cycle,
      status: "PENDING_APPROVAL",
      periodStart,
      periodEnd,
      totalAmount,
      entryCount: entries.length,
      metadata: { createdBy: actor?._id || actor?.sub || null },
    });
    await CommissionLedger.updateMany({ _id: { $in: entries.map((entry) => entry._id) } }, { $set: { settlementId: settlement._id, state: "SETTLED" } });
    await this.auditCommission("SETTLEMENT_CREATED", "CommissionSettlement", settlement._id, { actor, newValue: settlement.toObject(), reason: payload.reason, meta });
    return settlement;
  }

  async approveSettlement(settlementId, actor = {}, meta = {}) {
    const settlement = await CommissionSettlement.findByIdAndUpdate(
      settlementId,
      { $set: { status: "APPROVED", approvedBy: actor?._id || actor?.sub || undefined, approvedAt: new Date() } },
      { new: true }
    );
    if (!settlement) throw new AppError("Settlement not found", 404, "NOT_FOUND");
    await this.auditCommission("SETTLEMENT_APPROVED", "CommissionSettlement", settlement._id, { actor, newValue: settlement.toObject(), meta });
    return settlement;
  }

  async preparePayoutBatch(settlementId, actor = {}, meta = {}) {
    const settlement = await CommissionSettlement.findById(settlementId).lean();
    if (!settlement) throw new AppError("Settlement not found", 404, "NOT_FOUND");
    if (!["APPROVED", "QUEUED_FOR_PAYOUT"].includes(settlement.status)) throw new AppError("Settlement must be approved before payout", 400, "SETTLEMENT_NOT_APPROVED");
    const rows = await CommissionLedger.aggregate([
      { $match: { settlementId: new mongoose.Types.ObjectId(settlementId), state: "SETTLED" } },
      { $group: { _id: "$influencerId", amount: { $sum: "$amount" }, ledgerIds: { $push: "$_id" } } },
    ]);
    const influencerIds = rows.map((row) => row._id);
    const [wallets, accounts, profiles] = await Promise.all([
      InfluencerWallet.find({ influencerId: { $in: influencerIds } }).lean(),
      InfluencerPayoutAccount.find({ influencerId: { $in: influencerIds }, isActive: true, isDefault: true }).lean(),
      InfluencerProfile.find({ _id: { $in: influencerIds } }).lean(),
    ]);
    const walletByInfluencer = new Map(wallets.map((wallet) => [String(wallet.influencerId), wallet]));
    const accountByInfluencer = new Map(accounts.map((account) => [String(account.influencerId), account]));
    const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const entries = rows.map((row) => {
      const key = String(row._id);
      const wallet = walletByInfluencer.get(key);
      const account = accountByInfluencer.get(key);
      const profile = profileById.get(key);
      const blocked = wallet?.status === "suspended" || profile?.state === "suspended";
      return {
        influencerId: row._id,
        payoutAccountId: account?._id,
        paymentMethod: account?.paymentMethod || "manual",
        kycStatus: account?.verificationStatus || "PENDING",
        availableBalance: roundMoney(wallet?.availableBalance || 0),
        payoutAmount: roundMoney(row.amount || 0),
        ledgerIds: row.ledgerIds,
        status: blocked ? "BLOCKED" : account && account.isVerified ? "READY" : "KYC_PENDING",
      };
    });
    const batch = await CommissionPayoutBatch.create({
      settlementId,
      status: entries.every((entry) => entry.status === "READY") ? "READY" : "DRAFT",
      totalAmount: roundMoney(entries.reduce((sum, entry) => sum + (entry.status === "READY" ? Number(entry.payoutAmount || 0) : 0), 0)),
      influencerCount: entries.length,
      entries,
    });
    await CommissionLedger.updateMany({ settlementId }, { $set: { payoutBatchId: batch._id } });
    await CommissionSettlement.updateOne({ _id: settlementId }, { $set: { status: "QUEUED_FOR_PAYOUT" } });
    await this.auditCommission("PAYOUT_PREPARED", "CommissionPayoutBatch", batch._id, { actor, newValue: batch.toObject(), meta });
    return batch;
  }

  async listAuditLogs(query = {}) {
    const filter = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [logs, total] = await Promise.all([
      CommissionAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CommissionAuditLog.countDocuments(filter),
    ]);
    return { logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async getOverview() {
    const [records, ledgers] = await Promise.all([
      CommissionRecord.find({})
        .populate("influencerId", "userId")
        .populate("vendorId", "shopName companyName")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      InfluencerLedger.find({}).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return { records, ledgers };
  }

  registerEventHandlers() {
    registerHandler(INFLUENCER_EVENTS.ORDER_DELIVERED, async ({ orderId }) => {
      await this.settleForOrder(orderId);
    });
    registerHandler(INFLUENCER_EVENTS.ORDER_ELIGIBLE_FOR_SETTLEMENT, async ({ orderId }) => {
      await this.settleForOrder(orderId);
    });
  }
}

module.exports = new CommissionService();
