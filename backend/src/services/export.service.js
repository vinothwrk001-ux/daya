const { Parser } = require("json2csv");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { AppError } = require("../utils/AppError");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");
const { User } = require("../models/User");
const { Product } = require("../models/Product");
const { Order } = require("../models/Order");
const { Payment } = require("../models/Payment");
const { ReturnRequest } = require("../models/ReturnRequest");
const { ProductReview } = require("../models/ProductReview");
const { AuditLog } = require("../models/AuditLog");
const productAnalyticsService = require("./product-analytics.service");

function toCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function toDateTime(value) {
  return value ? new Date(value).toLocaleString("en-IN") : "";
}

function parseFilters(rawFilters) {
  if (!rawFilters) return {};
  if (typeof rawFilters === "object") return rawFilters;
  try {
    return JSON.parse(rawFilters);
  } catch {
    return {};
  }
}

function normalizeModuleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function buildFileName(moduleName, format) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${moduleName}-${stamp}.${format === "excel" ? "xlsx" : format}`;
}

async function createCsvBuffer(rows) {
  const fields = rows.length ? Object.keys(rows[0]) : [];
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);
  return Buffer.from(csv, "utf8");
}

async function createExcelBuffer(rows, title) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.slice(0, 31) || "Report");

  const headers = rows.length ? Object.keys(rows[0]) : ["No data"];
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 4),
  }));

  if (rows.length) {
    rows.forEach((row) => worksheet.addRow(row));
  } else {
    worksheet.addRow({ "No data": "No data available for selected filters" });
  }

  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function createPdfBuffer(rows, title) {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    const generatedAt = toDateTime(new Date());

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`GRM Report - ${title}`);
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#64748b").text(`Generated at ${generatedAt}`);
    doc.fillColor("#111827");
    doc.moveDown();

    if (!rows.length) {
      doc.fontSize(11).text("No data available for selected filters.");
      doc.end();
      return;
    }

    const headers = Object.keys(rows[0]);
    doc.fontSize(10).text(headers.join(" | "));
    doc.moveDown(0.5);
    doc.fontSize(9);

    rows.forEach((row) => {
      const line = headers.map((header) => String(row[header] ?? "")).join(" | ");
      doc.text(line, { width: 520 });
      doc.moveDown(0.4);
    });

    doc.end();
  });
}

async function getRowsForModule(moduleName, user, query) {
  const filters = parseFilters(query.filters);
  const dateRange = normalizeDateRange({
    startDate: query.startDate,
    endDate: query.endDate,
  });

  const handlers = {
    users: async () => {
      const dbQuery = {};
      if (filters.role) dbQuery.role = filters.role;
      applyDateRange(dbQuery, dateRange);
      const users = await User.find(dbQuery).sort({ createdAt: -1 }).lean();
      return users.map((item) => ({
        Name: item.name,
        Email: item.email || "",
        Phone: item.phone,
        Role: item.role,
        Status: item.status,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    products: async () => {
      const dbQuery = {};
      if (filters.status) dbQuery.status = filters.status;
      if (filters.category) dbQuery.category = filters.category;
      applyDateRange(dbQuery, dateRange);
      const products = await Product.find(dbQuery).sort({ createdAt: -1 }).lean();
      return products.map((item) => ({
        Name: item.name,
        Category: item.category,
        SKU: item.SKU,
        Price: toCurrency(item.discountPrice || item.price),
        Stock: item.stock,
        Status: item.status,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    orders: async () => {
      const dbQuery = { isActive: true };
      if (filters.status) dbQuery.status = filters.status;
      if (filters.paymentStatus) dbQuery.paymentStatus = filters.paymentStatus;
      applyDateRange(dbQuery, dateRange);
      const orders = await Order.find(dbQuery)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .lean();
      return orders.map((item) => ({
        OrderNumber: item.orderNumber || String(item._id),
        Customer: item.userId?.name || "",
        Email: item.userId?.email || "",
        Amount: toCurrency(item.totalAmount),
        PaymentStatus: item.paymentStatus,
        Status: item.status,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    invoices: async () => {
      const dbQuery = { isActive: true };
      if (filters.status) dbQuery.status = filters.status;
      if (filters.paymentStatus) dbQuery.paymentStatus = filters.paymentStatus;
      applyDateRange(dbQuery, dateRange);
      const orders = await Order.find(dbQuery)
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .lean();
      return orders.map((item) => ({
        InvoiceNumber: item.invoiceNumber || "",
        OrderNumber: item.orderNumber || String(item._id),
        Customer: item.userId?.name || "",
        Phone: item.userId?.phone || "",
        Issuer: "Platform",
        Amount: toCurrency(item.totalAmount),
        PaymentStatus: item.paymentStatus,
        Status: item.status,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    payments: async () => {
      const dbQuery = {};
      if (filters.status) dbQuery.status = filters.status;
      applyDateRange(dbQuery, dateRange);
      const payments = await Payment.find(dbQuery).populate("userId", "name email").sort({ createdAt: -1 }).lean();
      return payments.map((item) => ({
        User: item.userId?.name || "",
        Email: item.userId?.email || "",
        Amount: toCurrency(item.amount),
        Currency: item.currency,
        Status: item.status,
        RazorpayOrderId: item.razorpayOrderId,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    returns: async () => {
      const dbQuery = {};
      if (filters.status) dbQuery.status = filters.status;
      applyDateRange(dbQuery, dateRange);
      const items = await ReturnRequest.find(dbQuery)
        .populate("orderId", "orderNumber")
        .populate("customerId", "name email")
        .sort({ createdAt: -1 })
        .lean();
      return items.map((item) => ({
        Order: item.orderId?.orderNumber || "",
        Customer: item.customerId?.name || "",
        Email: item.customerId?.email || "",
        Reason: item.reason,
        Status: item.status,
        RefundAmount: toCurrency(item.refundAmount || 0),
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    reviews: async () => {
      const dbQuery = {};
      applyDateRange(dbQuery, dateRange);
      const items = await ProductReview.find(dbQuery)
        .populate("productId", "name")
        .populate("customerId", "name email")
        .sort({ createdAt: -1 })
        .lean();
      return items.map((item) => ({
        Product: item.productId?.name || "",
        Customer: item.customerId?.name || "",
        Email: item.customerId?.email || "",
        Rating: item.rating,
        Comment: item.review || item.title || "",
        PlatformResponse: item.platformReply || "",
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    audit_logs: async () => {
      const dbQuery = {};
      if (filters.action) dbQuery.action = filters.action;
      if (filters.actorRole) dbQuery.actorRole = filters.actorRole;
      if (filters.entityType) dbQuery.entityType = filters.entityType;
      if (filters.status) dbQuery.status = filters.status;
      applyDateRange(dbQuery, dateRange);
      const items = await AuditLog.find(dbQuery).populate("actorId", "name email").sort({ createdAt: -1 }).lean();
      return items.map((item) => ({
        Action: item.action,
        Actor: item.actorId?.name || "",
        ActorEmail: item.actorId?.email || "",
        ActorRole: item.actorRole || "",
        EntityType: item.entityType || "",
        Status: item.status,
        CreatedAt: toDateTime(item.createdAt),
      }));
    },
    analytics: async () => {
      const rows = await productAnalyticsService.buildExportRows({
        scope: "admin",
        userId: user.sub,
        filters: {
          range: query.range,
          startDate: query.startDate,
          endDate: query.endDate,
          categoryId: query.categoryId,
          paymentMethod: query.paymentMethod,
          orderStatus: query.orderStatus,
        },
      });
      return rows.map((row) => ({
        ...row,
        Revenue: toCurrency(row.Revenue),
        NetRevenue: toCurrency(row.NetRevenue),
        RefundAmount: toCurrency(row.RefundAmount),
      }));
    },
  };

  const handler = handlers[moduleName];
  if (!handler) {
    throw new AppError("Unsupported export module", 400, "VALIDATION_ERROR");
  }

  return await handler();
}

async function exportModule({ user, query }) {
  const moduleName = normalizeModuleName(query.module);
  const format = String(query.format || "csv").trim().toLowerCase();

  if (!moduleName) {
    throw new AppError("module is required", 400, "VALIDATION_ERROR");
  }
  if (!["csv", "excel", "pdf"].includes(format)) {
    throw new AppError("Invalid export format", 400, "VALIDATION_ERROR");
  }

  const rows = await getRowsForModule(moduleName, user, query);

  let buffer;
  let contentType;
  if (format === "csv") {
    buffer = await createCsvBuffer(rows);
    contentType = "text/csv; charset=utf-8";
  } else if (format === "excel") {
    buffer = await createExcelBuffer(rows, moduleName);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    buffer = await createPdfBuffer(rows, moduleName.replace(/_/g, " ").toUpperCase());
    contentType = "application/pdf";
  }

  return {
    buffer,
    contentType,
    filename: buildFileName(moduleName, format),
  };
}

async function buildExportFile({ rows, title, filenameBase, format }) {
  let buffer;
  let contentType;

  if (format === "csv") {
    buffer = await createCsvBuffer(rows);
    contentType = "text/csv; charset=utf-8";
  } else if (format === "excel") {
    buffer = await createExcelBuffer(rows, title);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "pdf") {
    buffer = await createPdfBuffer(rows, title);
    contentType = "application/pdf";
  } else {
    throw new AppError("Invalid export format", 400, "VALIDATION_ERROR");
  }

  return {
    buffer,
    contentType,
    filename: buildFileName(filenameBase, format),
  };
}

module.exports = {
  exportModule,
  buildExportFile,
};
