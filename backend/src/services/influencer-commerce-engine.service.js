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

function normalizeConfigName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function exactNameRegex(value = "") {
  return new RegExp(`^${String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function configVersion(doc) {
  return Number(doc?.approval?.version || doc?.version || 1);
}

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

    const [scoreConfig, rankingRule, budgetRule] = await Promise.all([
      InfluencerScoreConfig.findOne(activeQuery()),
      MarketplaceRankingRule.findOne(activeQuery()),
      BudgetProtectionRule.findOne(activeQuery()),
    ]);
    if (!scoreConfig) await InfluencerScoreConfig.create({ approval: { status: "active", version: 1 } });
    if (!rankingRule) await MarketplaceRankingRule.create({ approval: { status: "active", version: 1 } });
    if (!budgetRule) await BudgetProtectionRule.create({ approval: { status: "active", version: 1 } });

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

  async overview() {
    await this.ensureDefaults();
    const [scoreConfig, rankingRule, budgetRule, tiers, plans, subscriptionCount, budgetControls] = await Promise.all([
      this.getActiveScoreConfig(),
      this.getActiveRankingRule(),
      this.getActiveBudgetRule(),
      InfluencerTier.find(activeQuery()).sort({ displayOrder: 1 }).lean(),
      VendorSubscriptionPlan.find(activeQuery()).sort({ displayOrder: 1 }).lean(),
      VendorSubscription.countDocuments({ status: { $in: ["trialing", "active"] } }),
      CampaignBudgetControl.find({}).sort({ updatedAt: -1 }).limit(20).lean(),
    ]);
    return {
      scoreConfig,
      rankingRule,
      budgetRule,
      tiers,
      plans,
      subscriptionCount,
      budgetControls,
    };
  }
}

module.exports = new InfluencerCommerceEngineService();
