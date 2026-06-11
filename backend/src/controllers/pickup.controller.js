const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const pickupService = require("../services/pickup.service");

const getAdminPickups = asyncHandler(async (req, res) => {
  return ok(res, await pickupService.listAdminBatches(req.query), "Pickup batches retrieved");
});

const scheduleAdminPickup = asyncHandler(async (req, res) => {
  const result = await pickupService.scheduleAdminPickup(req.body, req.user);
  return ok(res, result, result.idempotentReplay ? "Pickup batch already scheduled" : "Pickup scheduled successfully");
});

module.exports = {
  getAdminPickups,
  scheduleAdminPickup,
};
