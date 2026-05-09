const userRepo = require("../../repositories/user.repository");
const { AppError } = require("../../utils/AppError");
const { emitDomainEvent } = require("../events/event-bus");
const { INFLUENCER_EVENTS } = require("../shared/constants");
const { InfluencerProfile } = require("./model");

async function getProfileByUserId(userId) {
  return await InfluencerProfile.findOne({ userId }).populate("userId", "name email phone role").exec();
}

class InfluencerService {
  async register(userId, payload = {}) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
    if (user.role !== "influencer") {
      await userRepo.updateById(userId, { role: "influencer" });
    }

    const nextState = payload.submit ? "submitted" : "draft";
    const profile = await InfluencerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          categories: payload.categories || [],
          followers: Number(payload.followers || 0),
          bio: payload.bio || "",
          socialHandles: payload.socialHandles || {},
          state: nextState,
          ...(payload.submit ? { "moderation.submittedAt": new Date() } : {}),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).populate("userId", "name email phone role");

    return profile;
  }

  async getProfile(userId) {
    const profile = await getProfileByUserId(userId);
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");
    return profile;
  }

  async getProfileById(profileId) {
    const profile = await InfluencerProfile.findById(profileId).populate("userId", "name email phone role").exec();
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");
    return profile;
  }

  async updateProfile(userId, payload = {}) {
    const profile = await this.getProfile(userId);
    if (["verified", "active", "suspended"].includes(profile.state) && payload.submit) {
      throw new AppError("Verified profiles cannot be re-submitted", 400, "INVALID_STATE");
    }

    return await InfluencerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(payload.categories ? { categories: payload.categories } : {}),
          ...(payload.followers !== undefined ? { followers: Number(payload.followers || 0) } : {}),
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.socialHandles ? { socialHandles: payload.socialHandles } : {}),
          ...(payload.submit ? { state: "submitted", "moderation.submittedAt": new Date() } : {}),
        },
      },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone role");
  }

  async list(query = {}) {
    const filters = {};
    if (query.state) filters.state = query.state;
    if (query.category) filters.categories = query.category;
    if (query.verified !== undefined) filters.verified = query.verified === "true";

    return await InfluencerProfile.find(filters)
      .populate("userId", "name email phone")
      .sort({ verified: -1, followers: -1, createdAt: -1 })
      .lean();
  }

  async moderate(profileId, payload = {}) {
    const profile = await InfluencerProfile.findById(profileId);
    if (!profile) throw new AppError("Influencer profile not found", 404, "NOT_FOUND");

    const update = {
      verified: payload.state === "verified" || payload.state === "active",
      state: payload.state,
      "moderation.notes": payload.notes || profile.moderation?.notes || "",
    };

    if (payload.state === "verified" || payload.state === "active") {
      update["moderation.verifiedAt"] = new Date();
    }
    if (payload.state === "suspended") {
      update["moderation.suspendedAt"] = new Date();
    }

    const updated = await InfluencerProfile.findByIdAndUpdate(profileId, { $set: update }, { new: true }).populate(
      "userId",
      "name email phone role"
    );

    if (payload.state === "active") {
      await emitDomainEvent(INFLUENCER_EVENTS.INFLUENCER_ACTIVATED, {
        influencerId: updated._id,
        userId: updated.userId?._id || updated.userId,
      });
    }

    return updated;
  }
}

module.exports = new InfluencerService();
