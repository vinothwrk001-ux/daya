const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const influencerCommerceEngine = require("./influencer-commerce-engine.service");
const campaignRuleEngine = require("./campaign-rule-engine.service");
const { Campaign } = require("../modules/campaign/model");
const { Product } = require("../models/Product");
const {
  InfluencerProfile,
  InfluencerSocialAccount,
} = require("../modules/influencer/model");
const {
  InfluencerService,
  InfluencerRequirement,
  CampaignPaymentModel,
  CampaignServiceSnapshot,
  CampaignAttributionRule,
  PAYMENT_MODEL_TYPES,
} = require("../modules/influencerCommerce/model");

function objectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function money(value) {
  const number = Number(value || 0);
  return Number(number.toFixed(2));
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizePaymentType(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    fixed_payment: "fixed",
    percentage: "commission",
    commission_model: "commission",
    product: "free_product",
    free_product_promotion: "free_product",
  };
  const next = aliases[normalized] || normalized;
  return PAYMENT_MODEL_TYPES.includes(next) ? next : "commission";
}

function productPrice(product = {}) {
  return Number(product.discountPrice ?? product.price ?? product.value ?? 0) || 0;
}

function profileName(profile = {}) {
  return profile.displayName || profile.userId?.name || profile.userId?.email || "Creator";
}

function profileUsername(profile = {}) {
  return profile.userId?.username || profile.userId?.email || profile.influencerCode || String(profile._id || "").slice(-8);
}

function serializeForHash(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item instanceof mongoose.Types.ObjectId) return String(item);
    if (item instanceof Date) return item.toISOString();
    return item;
  });
}

function safeStatus(value = "active") {
  const status = String(value || "active").trim().toLowerCase();
  return SERVICE_STATUSES_SAFE.has(status) ? status : "active";
}

function fallbackPackageForService(service = {}) {
  return {
    _id: null,
    packageName: service.packageName || service.serviceName || "Package",
    quantity: 1,
    price: money(service.price),
    currency: service.currency || "INR",
    deliveryDays: Number(service.deliveryDays || 0),
    deliveryLabel: service.deliveryLabel || "",
    revisionCount: Number(service.revisionCount || 0),
    description: service.description || "",
    status: service.status || "active",
    metadata: {},
  };
}

function servicePackages(service = {}, { activeOnly = false } = {}) {
  const packages = Array.isArray(service.packages) ? service.packages : [];
  const filtered = activeOnly ? packages.filter((item) => String(item.status || "active") === "active") : packages;
  if (filtered.length) return filtered;
  if (!packages.length && Number(service.price || 0) >= 0 && (!activeOnly || String(service.status || "active") === "active")) {
    return [fallbackPackageForService(service)];
  }
  return [];
}

function serviceStartingRate(service = {}) {
  const packages = servicePackages(service, { activeOnly: true });
  if (!packages.length) return money(service.price);
  return money(Math.min(...packages.map((item) => Number(item.price || 0))));
}

function packageId(pkg = {}) {
  return pkg._id ? String(pkg._id) : "";
}

class InfluencerRateCardService {
  async getConfiguration() {
    return influencerCommerceEngine.commerceConfiguration();
  }

  async getProfileForUser(userId) {
    const profile = await InfluencerProfile.findOne({ userId }).populate("userId", "name email username").lean();
    if (!profile) throw new AppError("Influencer profile not found", 404, "INFLUENCER_NOT_FOUND");
    return profile;
  }

  async listServices(influencerId, includeInactive = true) {
    const filter = { influencerId };
    if (!includeInactive) filter.status = "active";
    return InfluencerService.find(filter).sort({ serviceName: 1, createdAt: 1 }).lean();
  }

  async getRequirement(influencerId) {
    return InfluencerRequirement.findOne({ influencerId }).lean();
  }

  async getMyCommerceProfile(userId) {
    const profile = await this.getProfileForUser(userId);
    const [configuration, services, requirements] = await Promise.all([
      this.getConfiguration(),
      this.listServices(profile._id, true),
      this.getRequirement(profile._id),
    ]);
    return {
      profile,
      services,
      requirements: requirements || null,
      configuration,
    };
  }

  normalizePackagePayload(item = {}, defaults = {}, index = 0) {
    const quantity = Math.max(1, Number(item.quantity ?? defaults.quantity ?? 1) || 1);
    const name = String(
      item.packageName ||
      item.name ||
      item.label ||
      defaults.packageName ||
      defaults.label ||
      (quantity > 1 ? `${quantity} Deliverables` : "Single Deliverable")
    ).trim();
    const normalized = {
      packageName: name || "Package",
      quantity,
      price: money(item.price ?? defaults.price ?? 0),
      currency: String(item.currency || defaults.currency || "INR").toUpperCase(),
      deliveryDays: Math.max(0, Number(item.deliveryDays ?? defaults.deliveryDays ?? 0) || 0),
      deliveryLabel: String(item.deliveryLabel || defaults.deliveryLabel || "").trim(),
      revisionCount: Math.max(0, Number(item.revisionCount ?? defaults.revisionCount ?? 0) || 0),
      description: String(item.description || "").trim(),
      status: safeStatus(item.status || defaults.status || "active"),
      metadata: item.metadata || {},
    };
    const id = objectId(item.id || item._id);
    if (id) normalized._id = id;
    if (!normalized.packageName) normalized.packageName = `Package ${index + 1}`;
    return normalized;
  }

  normalizeServicePayload(item = {}, serviceTypes = []) {
    const typeById = new Map(serviceTypes.map((type) => [String(type._id), type]));
    const typeByKey = new Map(serviceTypes.map((type) => [String(type.key), type]));
    const configuredType =
      typeById.get(String(item.serviceTypeId || "")) ||
      typeByKey.get(String(item.serviceTypeKey || item.serviceType || item.key || "").toLowerCase());
    const serviceTypeKey = String(configuredType?.key || item.serviceTypeKey || item.serviceType || item.key || "custom_service").toLowerCase();
    const serviceName = String(item.serviceName || item.name || configuredType?.label || "Custom Service").trim();
    if (!configuredType && serviceTypeKey !== "custom_service" && !serviceName) {
      throw new AppError("Unknown influencer service type", 400, "INVALID_SERVICE_TYPE");
    }
    const currency = String(item.currency || configuredType?.defaultCurrency || "INR").toUpperCase();
    const baseDeliveryDays = Math.max(0, Number(item.deliveryDays ?? configuredType?.defaultDeliveryDays ?? 0) || 0);
    const baseRevisionCount = Math.max(0, Number(item.revisionCount ?? configuredType?.defaultRevisionCount ?? 0) || 0);
    const status = safeStatus(item.status || (item.active === false ? "inactive" : "active"));
    const packageDefaults = {
      packageName: item.packageName || serviceName,
      quantity: item.quantity || 1,
      price: item.price,
      currency,
      deliveryDays: baseDeliveryDays,
      deliveryLabel: item.deliveryLabel || "",
      revisionCount: baseRevisionCount,
      status,
    };
    const packages = (Array.isArray(item.packages) && item.packages.length ? item.packages : [packageDefaults])
      .map((row, index) => this.normalizePackagePayload(row, packageDefaults, index));
    const activePackages = packages.filter((row) => row.status === "active");
    const primaryPackage = (activePackages.length ? activePackages : packages)
      .slice()
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0] || packageDefaults;
    return {
      serviceTypeId: configuredType?._id || objectId(item.serviceTypeId) || undefined,
      serviceTypeKey,
      serviceName,
      serviceCategory: String(item.serviceCategory || item.category || configuredType?.group || "").trim(),
      price: money(primaryPackage.price ?? item.price),
      currency: primaryPackage.currency || currency,
      deliveryDays: Math.max(0, Number(primaryPackage.deliveryDays ?? baseDeliveryDays) || 0),
      deliveryLabel: String(item.deliveryLabel || "").trim(),
      revisionCount: Math.max(0, Number(primaryPackage.revisionCount ?? baseRevisionCount) || 0),
      minimumNoticePeriod: Math.max(0, Number(item.minimumNoticePeriod ?? item.minNoticePeriod ?? 0) || 0),
      contentApprovalRequired: Boolean(item.contentApprovalRequired),
      brandApprovalRequired: Boolean(item.brandApprovalRequired ?? item.approvalRequired),
      description: String(item.description || "").trim(),
      status,
      packages,
      metadata: { ...(item.metadata || {}), packageCount: packages.length },
    };
  }

  async saveMyServices(userId, payload = {}) {
    const profile = await this.getProfileForUser(userId);
    const configuration = await this.getConfiguration();
    const rows = Array.isArray(payload) ? payload : (payload.services || []);
    const savedIds = [];

    for (const row of rows) {
      const normalized = this.normalizeServicePayload(row, configuration.serviceTypes || []);
      const id = objectId(row.id || row._id);
      const query = id ? { _id: id, influencerId: profile._id } : { _id: new mongoose.Types.ObjectId(), influencerId: profile._id };
      const saved = await InfluencerService.findOneAndUpdate(
        query,
        { $set: { ...normalized, influencerId: profile._id } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      savedIds.push(saved._id);
    }

    if ((Array.isArray(payload) || payload.replace !== false) && savedIds.length) {
      await InfluencerService.deleteMany({ influencerId: profile._id, _id: { $nin: savedIds } });
    }
    if ((Array.isArray(payload) || payload.replace !== false) && !savedIds.length) {
      await InfluencerService.deleteMany({ influencerId: profile._id });
    }

    return this.getMyCommerceProfile(userId);
  }

  async saveMyRequirements(userId, payload = {}) {
    const profile = await this.getProfileForUser(userId);
    const update = {
      influencerId: profile._id,
      minimumBudget: money(payload.minimumBudget),
      minimumAttributionDays: Math.max(0, Number(payload.minimumAttributionDays ?? payload.minimumAttributionWindow ?? 0) || 0),
      productRequired: Boolean(payload.productRequired),
      sampleRequired: Boolean(payload.sampleRequired),
      productReturnRequired: Boolean(payload.productReturnRequired),
      shippingRequired: Boolean(payload.shippingRequired),
      brandGuidelinesRequired: Boolean(payload.brandGuidelinesRequired),
      creativeApprovalRequired: Boolean(payload.creativeApprovalRequired),
      contentApprovalRequired: Boolean(payload.contentApprovalRequired),
      approvalRequired: Boolean(payload.approvalRequired ?? payload.creativeApprovalRequired ?? payload.contentApprovalRequired),
      languages: arrayValue(payload.languages),
      categories: arrayValue(payload.categories),
      preferredCategories: arrayValue(payload.preferredCategories || payload.categories),
      targetAudience: String(payload.targetAudience || "").trim(),
      deliveryTime: String(payload.deliveryTime || "").trim(),
      communicationPreferences: String(payload.communicationPreferences || "").trim(),
      location: {
        country: payload.location?.country || payload.country || "",
        state: payload.location?.state || payload.state || "",
        city: payload.location?.city || payload.city || "",
      },
      shippingAddress: payload.shippingAddress || {},
      notes: String(payload.notes || "").trim(),
      customFields: payload.customFields || {},
    };
    await InfluencerRequirement.findOneAndUpdate(
      { influencerId: profile._id },
      { $set: update },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    return this.getMyCommerceProfile(userId);
  }

  async getCreatorCards(influencerIds = []) {
    const ids = [...new Set(influencerIds.map(String).filter(Boolean))].map(objectId).filter(Boolean);
    if (!ids.length) return new Map();
    const [services, requirements, socials] = await Promise.all([
      InfluencerService.find({ influencerId: { $in: ids }, status: "active" }).sort({ price: 1 }).lean(),
      InfluencerRequirement.find({ influencerId: { $in: ids } }).lean(),
      InfluencerSocialAccount.find({ influencerId: { $in: ids }, verificationStatus: "verified" }).lean(),
    ]);
    const serviceMap = new Map();
    services.forEach((service) => {
      const key = String(service.influencerId);
      const rows = serviceMap.get(key) || [];
      rows.push(service);
      serviceMap.set(key, rows);
    });
    const requirementMap = new Map(requirements.map((row) => [String(row.influencerId), row]));
    const socialMap = new Map();
    socials.forEach((account) => {
      const key = String(account.influencerId);
      const rows = socialMap.get(key) || [];
      rows.push(account);
      socialMap.set(key, rows);
    });
    return new Map(ids.map((id) => {
      const key = String(id);
      const rateCard = (serviceMap.get(key) || [])
        .map((service) => ({ ...service, startingPrice: serviceStartingRate(service), packages: servicePackages(service, { activeOnly: true }) }))
        .sort((a, b) => serviceStartingRate(a) - serviceStartingRate(b));
      const startingRate = rateCard.length ? Math.min(...rateCard.map((row) => serviceStartingRate(row))) : 0;
      return [key, {
        services: rateCard,
        rateCard,
        startingRate: money(startingRate),
        requirements: requirementMap.get(key) || null,
        socialAccounts: socialMap.get(key) || [],
      }];
    }));
  }

  async getCreatorProfile(influencerId) {
    const profile = await InfluencerProfile.findById(influencerId).populate("userId", "name email username").lean();
    if (!profile) throw new AppError("Influencer not found", 404, "NOT_FOUND");
    const cardMap = await this.getCreatorCards([profile._id]);
    const card = cardMap.get(String(profile._id)) || {};
    const scored = (await influencerCommerceEngine.scoreProfiles([profile]))[0];
    const clicks = Number(profile.stats?.clicks || 0);
    return {
      profile: {
        ...profile,
        name: profileName(profile),
        username: profileUsername(profile),
      },
      followers: Number(profile.followers || 0),
      influencerScore: scored?.score?.score || 0,
      engagementRate: card.socialAccounts?.length
        ? money(card.socialAccounts.reduce((sum, account) => sum + Number(account.engagementRate || 0), 0) / card.socialAccounts.length)
        : 0,
      conversionRate: clicks ? money((Number(profile.stats?.sales || 0) / clicks) * 100) : 0,
      completedCampaigns: scored?.completionRate || 0,
      rating: Number(profile.rating || 0),
      reviews: [],
      services: card.services || [],
      rateCard: card.rateCard || [],
      requirements: card.requirements || null,
      categories: profile.categories || [],
      languages: profile.languages || [],
      socialLinks: profile.socialHandles || {},
      campaignHistory: [],
    };
  }

  async buildInfluencerSnapshot(influencerId, selectedServices = []) {
    if (!influencerId) return { rateCard: [], selectedServices: [], requirements: null, profile: null };
    const profile = await InfluencerProfile.findById(influencerId).populate("userId", "name email username").lean();
    if (!profile) throw new AppError("Influencer not found", 404, "NOT_FOUND");
    const [services, requirements] = await Promise.all([
      InfluencerService.find({ influencerId, status: "active" }).lean(),
      InfluencerRequirement.findOne({ influencerId }).lean(),
    ]);
    const decoratedServices = services.map((service) => ({
      ...service,
      startingPrice: serviceStartingRate(service),
      packages: servicePackages(service, { activeOnly: true }),
    }));
    const byId = new Map(decoratedServices.map((service) => [String(service._id), service]));
    const byKey = new Map(decoratedServices.map((service) => [String(service.serviceTypeKey), service]));
    const byName = new Map(decoratedServices.map((service) => [String(service.serviceName).toLowerCase(), service]));
    const selected = (selectedServices || []).map((item) => {
      const service =
        byId.get(String(item.serviceId || item.id || item._id || "")) ||
        byKey.get(String(item.serviceTypeKey || item.serviceType || "").toLowerCase()) ||
        byName.get(String(item.serviceName || item.name || "").toLowerCase());
      if (!service) throw new AppError("Selected creator service is not available", 400, "SERVICE_NOT_AVAILABLE");
      const packages = servicePackages(service, { activeOnly: true });
      const requestedPackageId = String(item.packageId || item.package_id || item.package || "");
      const requestedPackageName = String(item.packageName || item.packageLabel || "").trim().toLowerCase();
      const selectedPackage = requestedPackageId
        ? packages.find((pkg) => packageId(pkg) === requestedPackageId)
        : requestedPackageName
          ? packages.find((pkg) => String(pkg.packageName || pkg.name || "").trim().toLowerCase() === requestedPackageName)
          : packages.slice().sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
      if (!selectedPackage) throw new AppError("Selected creator package is not available", 400, "PACKAGE_NOT_AVAILABLE");
      const quantity = Math.max(1, Number(item.units ?? item.orderQuantity ?? item.selectedQuantity ?? item.quantity ?? 1) || 1);
      const rate = money(selectedPackage.price);
      return {
        serviceId: service._id,
        packageId: selectedPackage._id || null,
        serviceTypeKey: service.serviceTypeKey,
        serviceName: service.serviceName,
        packageName: selectedPackage.packageName || service.serviceName,
        packageQuantity: Math.max(1, Number(selectedPackage.quantity || 1)),
        rate,
        currency: selectedPackage.currency || service.currency,
        quantity,
        total: money(rate * quantity),
        deliveryDays: selectedPackage.deliveryDays ?? service.deliveryDays,
        revisionCount: selectedPackage.revisionCount ?? service.revisionCount,
        minimumNoticePeriod: service.minimumNoticePeriod || 0,
        contentApprovalRequired: Boolean(service.contentApprovalRequired),
        brandApprovalRequired: Boolean(service.brandApprovalRequired),
        snapshot: {
          service: {
            serviceId: service._id,
            serviceTypeId: service.serviceTypeId,
            serviceTypeKey: service.serviceTypeKey,
            serviceName: service.serviceName,
            serviceCategory: service.serviceCategory,
            description: service.description,
            minimumNoticePeriod: service.minimumNoticePeriod || 0,
            contentApprovalRequired: Boolean(service.contentApprovalRequired),
            brandApprovalRequired: Boolean(service.brandApprovalRequired),
            metadata: service.metadata || {},
          },
          package: {
            packageId: selectedPackage._id || null,
            packageName: selectedPackage.packageName || service.serviceName,
            packageQuantity: Math.max(1, Number(selectedPackage.quantity || 1)),
            price: rate,
            currency: selectedPackage.currency || service.currency,
            deliveryDays: selectedPackage.deliveryDays ?? service.deliveryDays,
            deliveryLabel: selectedPackage.deliveryLabel || service.deliveryLabel || "",
            revisionCount: selectedPackage.revisionCount ?? service.revisionCount,
            description: selectedPackage.description || "",
            metadata: selectedPackage.metadata || {},
          },
        },
      };
    });
    return {
      profile: { id: profile._id, name: profileName(profile), username: profileUsername(profile) },
      rateCard: decoratedServices,
      selectedServices: selected,
      requirements: requirements || null,
    };
  }

  async loadVendorProducts(vendorId, productIds = []) {
    const ids = productIds.map(objectId).filter(Boolean);
    if (!ids.length) return [];
    return Product.find({ _id: { $in: ids }, sellerId: vendorId }).select("_id name price discountPrice category images thumbnail").lean();
  }

  validateAttributionDays(days, windows = []) {
    const value = Math.max(0, Number(days || 0));
    if (!value) return 0;
    if (windows.some((window) => Number(window.days) === value && !window.customAllowed)) return value;
    const custom = windows.find((window) => window.customAllowed);
    if (custom && value >= Number(custom.minDays || 1) && value <= Number(custom.maxDays || 365)) return value;
    throw new AppError("Selected attribution window is not allowed", 400, "INVALID_ATTRIBUTION_WINDOW");
  }

  async calculateCampaignPricing({ vendorId, influencerId = null, payload = {}, products = [] }) {
    const configuration = await this.getConfiguration();
    const productRows = products.length ? products : await this.loadVendorProducts(vendorId, payload.productIds || []);
    const paymentInput = payload.paymentModel || payload.payment || {};
    const ruleEvaluation = campaignRuleEngine.evaluateCampaignRules(payload, configuration);
    const paymentType = ruleEvaluation.paymentType;
    const selectedInput = paymentInput.services || paymentInput.selectedServices || payload.services || payload.selectedServices || [];
    const influencerSnapshot = await this.buildInfluencerSnapshot(influencerId, selectedInput);
    const selectedTotal = influencerSnapshot.selectedServices.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const fixedCost = ["fixed", "hybrid"].includes(paymentType)
      ? money(selectedInput.length && influencerId ? selectedTotal : Number(paymentInput.fixedFee ?? payload.fixedFee ?? 0))
      : 0;
    const commissionPercentage = ["commission", "hybrid"].includes(paymentType)
      ? Math.max(0, Math.min(50, Number(paymentInput.commissionPercentage ?? paymentInput.commissionPercent ?? payload.commissionPercent ?? 0) || 0))
      : 0;
    const attributionDays = ["commission", "hybrid"].includes(paymentType)
      ? ruleEvaluation.attributionDays
      : 0;
    const productValue = paymentType === "free_product"
      ? money(paymentInput.productValue ?? productRows.reduce((sum, product) => sum + productPrice(product), 0))
      : 0;
    const shippingCost = money(paymentInput.shippingCost ?? payload.shippingCost ?? 0);
    const taxes = money(paymentInput.taxes ?? payload.taxes ?? 0);
    const platformFees = money(paymentInput.platformFees ?? payload.platformFees ?? 0);
    const expectedBudget = money(paymentInput.expectedBudget ?? payload.budget ?? fixedCost);
    const commissionReserve = ["commission", "hybrid"].includes(paymentType)
      ? money(paymentInput.commissionReserve ?? ((expectedBudget * commissionPercentage) / 100))
      : 0;
    const totalBudget = money(fixedCost + commissionReserve + productValue + shippingCost + taxes + platformFees);
    const requirements = influencerSnapshot.requirements;

    if (requirements?.minimumBudget && totalBudget < Number(requirements.minimumBudget)) {
      throw new AppError("Campaign budget is below the influencer minimum", 400, "INFLUENCER_MINIMUM_BUDGET");
    }
    if (requirements?.minimumAttributionDays && attributionDays && attributionDays < Number(requirements.minimumAttributionDays)) {
      throw new AppError("Attribution window is below the influencer minimum", 400, "INFLUENCER_MINIMUM_ATTRIBUTION");
    }

    const pricing = {
      fixedCost,
      commissionReserve,
      productCost: productValue,
      shippingCost,
      taxes,
      platformFees,
      totalBudget,
      currency: paymentInput.currency || payload.currency || influencerSnapshot.selectedServices[0]?.currency || "INR",
    };
    const paymentModel = {
      paymentType,
      fixedFee: fixedCost,
      commissionPercentage,
      attributionDays,
      productValue,
      shippingCost,
      productCost: productValue,
      taxes,
      platformFees,
      commissionReserve,
      totalBudget,
      currency: pricing.currency,
      selectedServices: influencerSnapshot.selectedServices,
      ruleEngine: {
        campaignType: ruleEvaluation.campaignType,
        campaignTypeLabel: ruleEvaluation.campaignTypeConfig?.label || "",
        allowedPaymentModels: ruleEvaluation.allowedPaymentModels.map((model) => ({ key: model.key, label: model.label })),
        dynamicFields: ruleEvaluation.dynamicFields,
        validationRules: ruleEvaluation.validationRules,
        affiliateInfrastructure: ruleEvaluation.affiliateInfrastructure,
      },
      snapshot: {
        input: paymentInput,
        configurationVersion: {
          paymentModels: (configuration.paymentModels || []).map((model) => ({ id: model._id, key: model.key, version: model.approval?.version || 1 })),
          campaignTypes: (configuration.campaignTypes || []).map((type) => ({ id: type._id, slug: type.slug, version: type.approval?.version || 1 })),
          paymentModelOptions: (configuration.paymentModelOptions || []).map((model) => ({ id: model._id, slug: model.slug, version: model.approval?.version || 1 })),
          attributionWindows: (configuration.attributionWindows || []).map((window) => ({ id: window._id, key: window.key, days: window.days, version: window.approval?.version || 1 })),
        },
      },
    };
    return {
      paymentType,
      campaignType: ruleEvaluation.campaignType,
      fixedFee: fixedCost,
      commissionPercentage,
      attributionDays,
      affiliateTrackingEnabled: ruleEvaluation.affiliateTrackingEnabled,
      affiliateInfrastructure: ruleEvaluation.affiliateInfrastructure,
      pricing,
      paymentModel,
      influencerSnapshot,
      campaignFields: {
        paymentType,
        campaignType: ruleEvaluation.campaignType,
        commissionPercent: commissionPercentage,
        fixedFee: fixedCost,
        attributionWindowDays: attributionDays,
        pricing,
        paymentModelSnapshot: paymentModel,
        influencerRateSnapshot: influencerSnapshot,
        requirementsSnapshot: influencerSnapshot.requirements || {},
      },
      budgetValue: totalBudget || fixedCost || expectedBudget,
    };
  }

  async attachCampaignPricing(campaign, pricing) {
    if (!campaign?._id || !pricing) return null;
    await Promise.all([
      CampaignPaymentModel.findOneAndUpdate(
        { campaignId: campaign._id },
        { $set: { campaignId: campaign._id, ...pricing.paymentModel } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      ),
      CampaignAttributionRule.findOneAndUpdate(
        { campaignId: campaign._id },
        {
          $set: {
            campaignId: campaign._id,
            attributionDays: pricing.attributionDays,
            trackingEnabled: Boolean(pricing.affiliateTrackingEnabled),
            source: "campaign_payment_model",
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      ),
    ]);
    await CampaignServiceSnapshot.deleteMany({ campaignId: campaign._id });
    const selectedSnapshots = pricing.influencerSnapshot?.selectedServices || pricing.paymentModel?.selectedServices || [];
    if (selectedSnapshots.length) {
      await CampaignServiceSnapshot.insertMany(selectedSnapshots.map((row) => ({
        campaignId: campaign._id,
        influencerId: pricing.influencerSnapshot?.profile?.id || campaign.influencerId || null,
        serviceId: row.serviceId || null,
        packageId: row.packageId || null,
        serviceTypeKey: row.serviceTypeKey || "",
        serviceName: row.serviceName || "",
        packageName: row.packageName || "",
        quantity: row.quantity || 1,
        packageQuantity: row.packageQuantity || 1,
        price: row.rate || 0,
        total: row.total || 0,
        currency: row.currency || pricing.pricing?.currency || "INR",
        deliveryDays: row.deliveryDays || 0,
        revisionCount: row.revisionCount || 0,
        snapshotJson: row.snapshot || row,
        status: "proposed",
      })));
    }
    return campaign;
  }

  async getCampaignCommerceDocs(campaignIds = []) {
    const ids = campaignIds.map(objectId).filter(Boolean);
    if (!ids.length) return { paymentModels: new Map(), attributionRules: new Map(), serviceSnapshots: new Map() };
    const [paymentModels, attributionRules, serviceSnapshots] = await Promise.all([
      CampaignPaymentModel.find({ campaignId: { $in: ids } }).lean(),
      CampaignAttributionRule.find({ campaignId: { $in: ids } }).lean(),
      CampaignServiceSnapshot.find({ campaignId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
    ]);
    const snapshotMap = serviceSnapshots.reduce((map, row) => {
      const key = String(row.campaignId);
      const rows = map.get(key) || [];
      rows.push(row);
      map.set(key, rows);
      return map;
    }, new Map());
    return {
      paymentModels: new Map(paymentModels.map((row) => [String(row.campaignId), row])),
      attributionRules: new Map(attributionRules.map((row) => [String(row.campaignId), row])),
      serviceSnapshots: snapshotMap,
    };
  }

  async lockCampaignContract(campaignId, { influencerId = null, actorId = null, source = "acceptance" } = {}) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404, "NOT_FOUND");
    const participantId = influencerId || campaign.influencerId;
    const existingSnapshot = campaign.influencerRateSnapshot && Array.isArray(campaign.influencerRateSnapshot.selectedServices)
      ? campaign.influencerRateSnapshot
      : null;
    const influencerSnapshot = existingSnapshot?.selectedServices?.length
      ? existingSnapshot
      : participantId
        ? await this.buildInfluencerSnapshot(participantId, campaign.paymentModelSnapshot?.selectedServices || [])
        : (existingSnapshot || {});
    const paymentModel = campaign.paymentModelSnapshot || {};
    const requirements = influencerSnapshot.requirements || campaign.requirementsSnapshot || {};
    const lockedAt = new Date();
    const contract = {
      influencerId: participantId || null,
      lockedAt,
      acceptedBy: actorId || null,
      source,
      paymentModel,
      influencerRateCard: influencerSnapshot,
      requirements,
      termsHash: crypto.createHash("sha256").update(serializeForHash({
        campaignId: campaign._id,
        participantId,
        paymentModel,
        influencerSnapshot,
        requirements,
      })).digest("hex"),
    };
    const existingIndex = (campaign.contractSnapshots || []).findIndex((row) => String(row.influencerId || "") === String(participantId || ""));
    if (existingIndex >= 0) campaign.contractSnapshots[existingIndex] = contract;
    else campaign.contractSnapshots.push(contract);
    campaign.contractSnapshot = {
      locked: true,
      lockedAt,
      acceptedBy: actorId || undefined,
      vendorId: campaign.vendorId,
      influencerId: participantId || undefined,
      termsHash: contract.termsHash,
      paymentModel,
      influencerRateCard: influencerSnapshot,
      requirements,
    };
    campaign.termsFrozen = {
      commissionPercent: campaign.commissionPercent,
      fixedFee: campaign.fixedFee,
      productIds: campaign.productIds,
      deadline: campaign.deadline,
      paymentType: campaign.paymentType,
      attributionWindowDays: campaign.attributionWindowDays,
      pricing: campaign.pricing,
      paymentModelSnapshot: paymentModel,
      influencerRateSnapshot: influencerSnapshot,
      requirementsSnapshot: requirements,
      frozenAt: lockedAt,
    };
    campaign.history.push({ state: "contract_locked", actorId, note: "Campaign contract locked with immutable pricing snapshots", changedAt: lockedAt });
    await campaign.save();
    await CampaignPaymentModel.updateOne({ campaignId: campaign._id }, { $set: { status: "locked", lockedAt } });
    await CampaignServiceSnapshot.updateMany({ campaignId: campaign._id }, { $set: { status: "locked", lockedAt } });
    return campaign;
  }
}

const SERVICE_STATUSES_SAFE = new Set(["draft", "active", "inactive", "archived"]);

module.exports = new InfluencerRateCardService();
