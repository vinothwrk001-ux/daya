const { Order } = require("../models/Order");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");
const { buildExportFile } = require("./export.service");

function buildRevenueMatch({ startDate, endDate } = {}) {
  const match = {
    isActive: true,
    paymentStatus: "Paid",
    status: "Delivered",
  };
  applyDateRange(match, normalizeDateRange({ startDate, endDate }));
  return match;
}

function formatDateLabel(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function buildDateRangeLabel(startDate, endDate) {
  if (!startDate && !endDate) return "All time";
  const left = startDate ? formatDateLabel(startDate) : "Beginning";
  const right = endDate ? formatDateLabel(endDate) : "Today";
  return `${left} - ${right}`;
}

async function getRevenueSummary({ startDate, endDate } = {}) {
  const match = buildRevenueMatch({ startDate, endDate });

  const [summary] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalAmount" },
        platformRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        totalSales: 1,
        platformRevenue: 1,
        totalOrders: 1,
      },
    },
  ]);

  const revenueTrend = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        platformRevenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: [
                { $lt: ["$_id.month", 10] },
                { $concat: ["0", { $toString: "$_id.month" }] },
                { $toString: "$_id.month" },
              ],
            },
            "-",
            {
              $cond: [
                { $lt: ["$_id.day", 10] },
                { $concat: ["0", { $toString: "$_id.day" }] },
                { $toString: "$_id.day" },
              ],
            },
          ],
        },
        revenue: 1,
        platformRevenue: 1,
        orders: 1,
      },
    },
  ]);

  return {
    totalSales: summary?.totalSales || 0,
    platformRevenue: summary?.platformRevenue || 0,
    totalOrders: summary?.totalOrders || 0,
    dateRange: buildDateRangeLabel(startDate, endDate),
    revenueTrend,
  };
}

async function exportRevenueReport({ format, startDate, endDate } = {}) {
  const match = buildRevenueMatch({ startDate, endDate });
  const rows = await Order.find(match)
    .select("orderNumber totalAmount paymentMethod paymentStatus status createdAt")
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const dateRange = buildDateRangeLabel(startDate, endDate);
  return await buildExportFile({
    rows: rows.map((order) => ({
      OrderNumber: order.orderNumber,
      TotalSales: formatCurrency(order.totalAmount),
      PaymentMethod: order.paymentMethod,
      PaymentStatus: order.paymentStatus,
      OrderStatus: order.status,
      CreatedAt: order.createdAt ? new Date(order.createdAt).toISOString() : "",
      DateRange: dateRange,
    })),
    title: "Revenue Report",
    filenameBase: "revenue-report",
    format,
  });
}

module.exports = {
  getRevenueSummary,
  exportRevenueReport,
};
