const trackingSecurityService = require("./security.service");

function eventSecurity(eventType, { blockOnLimit = true } = {}) {
  return async function trackingEventSecurity(req, res, next) {
    try {
      const decision = await trackingSecurityService.evaluateEvent(req, eventType);
      req.trackingSecurity = decision;

      if (blockOnLimit && (decision.status === "rate_limited" || decision.status === "fraud")) {
        return res.status(429).json({
          success: false,
          message: "Engagement request rejected by traffic quality controls",
          data: {
            tracked: false,
            counted: false,
            reason: decision.reason,
            fraudScore: decision.fraudScore,
            fraudLevel: decision.fraudLevel,
          },
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  eventSecurity,
};
