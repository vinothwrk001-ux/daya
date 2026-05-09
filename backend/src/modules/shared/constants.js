const INFLUENCER_CATEGORIES = [
  "baby",
  "beauty",
  "electronics",
  "fashion",
  "fitness",
  "food",
  "home",
  "lifestyle",
  "pets",
  "sports",
  "toys",
];

const INFLUENCER_STATES = ["draft", "submitted", "verified", "active", "suspended"];
const CAMPAIGN_STATES = ["draft", "proposed", "accepted", "active", "completed", "cancelled"];
const REEL_STATES = ["uploaded", "pending_review", "approved", "published", "rejected"];
const COMMISSION_STATES = ["HOLD", "SETTLED", "CANCELLED", "REVERSED"];

const INFLUENCER_EVENTS = {
  INFLUENCER_ACTIVATED: "INFLUENCER_ACTIVATED",
  CAMPAIGN_ACTIVATED: "CAMPAIGN_ACTIVATED",
  REEL_PUBLISHED: "REEL_PUBLISHED",
  TRACKING_CREATED: "TRACKING_CREATED",
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_ELIGIBLE_FOR_SETTLEMENT: "ORDER_ELIGIBLE_FOR_SETTLEMENT",
  COMMISSION_DISTRIBUTED: "COMMISSION_DISTRIBUTED",
};

module.exports = {
  INFLUENCER_CATEGORIES,
  INFLUENCER_STATES,
  CAMPAIGN_STATES,
  REEL_STATES,
  COMMISSION_STATES,
  INFLUENCER_EVENTS,
};
