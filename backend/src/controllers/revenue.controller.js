const { ok } = require("../utils/apiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const revenueService = require("../services/revenue.service");

const getRevenueSummary = asyncHandler(async (req, res) => {
  const data = await revenueService.getRevenueSummary({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

  return ok(res, data, "Revenue summary loaded");
});

const exportRevenue = asyncHandler(async (req, res) => {
  const format = String(req.query.format || "csv").trim().toLowerCase();
  if (!["csv", "excel", "pdf"].includes(format)) {
    throw new AppError("Invalid export format", 400, "VALIDATION_ERROR");
  }

  const result = await revenueService.exportRevenueReport({
    format,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
  res.send(result.buffer);
});

module.exports = {
  getRevenueSummary,
  exportRevenue,
};
