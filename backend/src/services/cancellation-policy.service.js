const { AppError } = require("../utils/AppError");
const { CancellationPolicy, ORDER_STAGES, PAYMENT_METHODS, REFUND_METHODS } = require("../models/CancellationPolicy");

const CANCELLATION_CHARGE_CODE = "CANCELLATION_CHARGE";

function uniqueBy(items = [], key) {
  const map = new Map();
  for (const item of items) {
    if (!item?.[key]) continue;
    map.set(item[key], item);
  }
  return Array.from(map.values());
}

function normalizeFeatureFlags(flags = {}) {
  return {
    codCancellationEnabled: flags.codCancellationEnabled !== false,
    razorpayCancellationEnabled: flags.razorpayCancellationEnabled !== false,
    codRefundEnabled: flags.codRefundEnabled === true,
    razorpayRefundEnabled: flags.razorpayRefundEnabled !== false,
    manualRefundEnabled: flags.manualRefundEnabled !== false,
    walletRefundEnabled: flags.walletRefundEnabled !== false,
    autoRefundEnabled: flags.autoRefundEnabled !== false,
    partialRefundEnabled: flags.partialRefundEnabled !== false,
    stageBasedCancellationEnabled: flags.stageBasedCancellationEnabled !== false,
  };
}

function normalizePaymentMethodConfigs(configs = []) {
  const normalized = PAYMENT_METHODS.map((paymentMethod) => {
    const existing = (configs || []).find((item) => item?.paymentMethod === paymentMethod) || {};
    const defaultMethods =
      paymentMethod === "COD" ? ["MANUAL", "WALLET"] : ["RAZORPAY", "MANUAL", "WALLET"];
    const allowedRefundMethods = Array.isArray(existing.allowedRefundMethods)
      ? existing.allowedRefundMethods.filter((method) => REFUND_METHODS.includes(method))
      : defaultMethods;

    return {
      paymentMethod,
      cancellationEnabled: existing.cancellationEnabled !== false,
      refundEnabled: paymentMethod === "COD" ? existing.refundEnabled === true : existing.refundEnabled !== false,
      autoRefundEnabled: paymentMethod === "RAZORPAY" ? existing.autoRefundEnabled !== false : existing.autoRefundEnabled === true,
      manualRefundEnabled: existing.manualRefundEnabled !== false,
      walletRefundEnabled: existing.walletRefundEnabled !== false,
      allowedRefundMethods: allowedRefundMethods.length ? allowedRefundMethods : defaultMethods,
    };
  });

  return uniqueBy(normalized, "paymentMethod");
}

function normalizeDeductions(deductions = []) {
  return (Array.isArray(deductions) ? deductions : [])
    .filter((deduction) => deduction?.type && deduction?.label)
    .map((deduction) => ({
      code: deduction.code === CANCELLATION_CHARGE_CODE ? CANCELLATION_CHARGE_CODE : undefined,
      type: deduction.type,
      label: deduction.label,
      value: Number(deduction.value || 0),
      enabled: deduction.enabled !== false,
      capAmount:
        deduction.capAmount === null || deduction.capAmount === undefined
          ? null
          : Number(deduction.capAmount || 0),
    }));
}

function deriveStageCancellationCharge(existing = {}, deductions = []) {
  const configuredType = String(existing.cancellationChargeType || "").toUpperCase();
  const configuredValue = Number(existing.cancellationChargeValue || 0);
  if (["NONE", "FIXED", "PERCENTAGE"].includes(configuredType)) {
    return {
      type: configuredType,
      value: configuredType === "NONE" ? 0 : configuredValue,
    };
  }

  const existingCharge = deductions.find((deduction) => deduction.code === CANCELLATION_CHARGE_CODE);
  if (!existingCharge) {
    return { type: "NONE", value: 0 };
  }

  return {
    type: ["FIXED", "PERCENTAGE"].includes(existingCharge.type) ? existingCharge.type : "NONE",
    value: Number(existingCharge.value || 0),
  };
}

function applyStageCancellationCharge(deductions = [], charge = { type: "NONE", value: 0 }) {
  const filtered = deductions.filter((deduction) => deduction.code !== CANCELLATION_CHARGE_CODE);
  if (charge.type === "NONE" || Number(charge.value || 0) <= 0) {
    return filtered;
  }

  return [
    {
      code: CANCELLATION_CHARGE_CODE,
      type: charge.type,
      label: "Cancellation charge",
      value: Number(charge.value || 0),
      enabled: true,
      capAmount: null,
    },
    ...filtered,
  ];
}

function normalizeStageRules(stages = []) {
  const normalized = ORDER_STAGES.map((stage) => {
    const existing = (stages || []).find((item) => item?.stage === stage) || {};
    const normalizedDeductions = normalizeDeductions(existing.deductions);
    const cancellationCharge = deriveStageCancellationCharge(existing, normalizedDeductions);
    return {
      stage,
      cancellationEnabled: stage === "DELIVERED" ? false : existing.cancellationEnabled !== false,
      refundEnabled: stage === "DELIVERED" ? existing.refundEnabled === true : existing.refundEnabled !== false,
      autoApproval: existing.autoApproval !== false,
      manualApproval: existing.manualApproval === true,
      allowPartialRefund: existing.allowPartialRefund !== false,
      refundSlaHours: Number(existing.refundSlaHours ?? 72),
      cancellationChargeType: cancellationCharge.type,
      cancellationChargeValue: cancellationCharge.value,
      deductions: applyStageCancellationCharge(normalizedDeductions, cancellationCharge),
    };
  });

  return uniqueBy(normalized, "stage");
}

function normalizePolicyPayload(payload = {}, actorId = null) {
  return {
    name: String(payload.name || "Default Cancellation Policy").trim(),
    description: String(payload.description || "").trim(),
    isActive: payload.isActive !== false,
    priority: Number(payload.priority || 100),
    featureFlags: normalizeFeatureFlags(payload.featureFlags),
    paymentMethodConfigs: normalizePaymentMethodConfigs(payload.paymentMethodConfigs),
    stages: normalizeStageRules(payload.stages),
    defaultRefundMethod: REFUND_METHODS.includes(payload.defaultRefundMethod) ? payload.defaultRefundMethod : "RAZORPAY",
    notes: String(payload.notes || "").trim(),
    ...(actorId ? { updatedBy: actorId } : {}),
  };
}

class CancellationPolicyService {
  async ensureDefaultPolicy() {
    const existing = await CancellationPolicy.findOne({ isActive: true }).sort({ priority: 1, updatedAt: -1 });
    if (existing) {
      return existing;
    }

    return await CancellationPolicy.create(
      normalizePolicyPayload(
        {
          name: "Default Marketplace Cancellation Policy",
          description: "Default dynamic cancellation and refund configuration for the marketplace.",
        },
        null
      )
    );
  }

  async listPolicies() {
    await this.ensureDefaultPolicy();
    const policies = await CancellationPolicy.find({}).sort({ isActive: -1, priority: 1, updatedAt: -1 }).lean();
    return { policies };
  }

  async getPolicyById(policyId) {
    const policy = await CancellationPolicy.findById(policyId);
    if (!policy) throw new AppError("Cancellation policy not found", 404, "NOT_FOUND");
    return policy;
  }

  async getActivePolicy() {
    return await this.ensureDefaultPolicy();
  }

  async createPolicy(payload = {}, actorId = null) {
    const data = normalizePolicyPayload(payload, actorId);
    if (actorId) data.createdBy = actorId;
    const created = await CancellationPolicy.create(data);
    return created;
  }

  async updatePolicy(policyId, payload = {}, actorId = null) {
    const existing = await this.getPolicyById(policyId);
    const update = normalizePolicyPayload({ ...existing.toObject(), ...payload }, actorId);
    const updated = await CancellationPolicy.findByIdAndUpdate(
      policyId,
      { $set: update },
      { returnDocument: "after", runValidators: true }
    );
    return updated;
  }
}

module.exports = new CancellationPolicyService();
