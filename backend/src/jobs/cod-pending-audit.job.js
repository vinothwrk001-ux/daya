const { Order } = require("../models/Order");
const { logger } = require("../utils/logger");

async function runCodPendingAudit({ staleHours = 24 } = {}) {
  const threshold = new Date(Date.now() - Number(staleHours || 24) * 60 * 60 * 1000);
  const staleOrders = await Order.find({
    paymentMethod: "COD",
    "cod.status": "pending_cod",
    createdAt: { $lte: threshold },
    status: { $nin: ["Delivered", "Cancelled", "Returned"] },
  })
    .select("_id orderNumber orderGroupId createdAt status paymentStatus")
    .lean();

  logger.info("COD pending audit completed", {
    staleHours,
    staleCount: staleOrders.length,
  });

  return {
    staleHours,
    staleCount: staleOrders.length,
    staleOrders,
  };
}

module.exports = {
  runCodPendingAudit,
};
