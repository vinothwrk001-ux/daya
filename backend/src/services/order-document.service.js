const fs = require("fs");
const path = require("path");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const { logger } = require("../utils/logger");

const SUPPORT_EMAIL = process.env.ORDER_SUPPORT_EMAIL || "support@uchooseme.com";
const SUPPORT_PHONE = process.env.ORDER_SUPPORT_PHONE || "+91 00000 00000";
const COMPANY_NAME = process.env.INVOICE_COMPANY_NAME || "GRM Commerce";
const COMPANY_WEBSITE = process.env.INVOICE_COMPANY_WEBSITE || "www.uchooseme.com";
const COMPANY_TAX_LABEL = process.env.INVOICE_TAX_LABEL || "GST";
const COMPANY_TAX_ID = process.env.INVOICE_TAX_ID || "TAX-ID-PENDING";

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function normalizeAttributes(attributes = {}) {
  if (!attributes) return {};
  if (attributes instanceof Map) {
    return Object.fromEntries(attributes.entries());
  }
  return typeof attributes === "object" ? attributes : {};
}

function buildVariantLabel(item = {}) {
  const attributes = normalizeAttributes(item.variantAttributes);
  const attributeLabel = Object.entries(attributes)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return item.variantTitle || attributeLabel || item.variantSku || "Standard";
}

function getChargeAmount(charges = [], predicate) {
  const charge = Array.isArray(charges) ? charges.find(predicate) : null;
  return roundMoney(charge?.amount || 0);
}

function getPaymentCharges(charges = [], paymentMethod = "ONLINE") {
  const normalizedMethod = String(paymentMethod || "ONLINE").toUpperCase();
  if (normalizedMethod === "COD") {
    return getChargeAmount(
      charges,
      (charge) =>
        String(charge?.key || "").toLowerCase().includes("cod") ||
        String(charge?.displayName || "").toLowerCase().includes("cod")
    );
  }

  return getChargeAmount(
    charges,
    (charge) =>
      String(charge?.key || "").toLowerCase().includes("razorpay") ||
      String(charge?.key || "").toLowerCase().includes("gateway") ||
      String(charge?.displayName || "").toLowerCase().includes("razorpay") ||
      String(charge?.displayName || "").toLowerCase().includes("gateway")
  );
}

function generateInvoiceNumber(order) {
  const seed = String(order?.orderNumber || order?._id || Date.now()).replace(/[^a-zA-Z0-9]/g, "");
  return `INV-${seed.slice(-18).toUpperCase()}`;
}

function estimateDeliveryDate(order) {
  if (order?.deliveredAt) return toDate(order.deliveredAt);
  const baseDate = toDate(order?.createdAt, new Date());
  const shippingMode = String(order?.shippingMode || "SELF").toUpperCase();
  const dayOffset = shippingMode === "PLATFORM" ? 6 : 4;
  return new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
}

function normalizeTimelineEventStatus(status = "") {
  const normalized = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (!normalized) return "PLACED";
  if (normalized === "PENDING") return "PLACED";
  if (normalized === "PACKED") return "CONFIRMED";
  if (normalized === "PLACED") return "PLACED";
  if (normalized === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (normalized === "SHIPPED") return "SHIPPED";
  if (normalized === "DELIVERED") return "DELIVERED";
  if (normalized === "CANCELLED") return "CANCELLED";
  if (normalized === "RETURNED") return "RETURNED";
  return normalized;
}

function buildTimeline(order) {
  const rawTimeline = Array.isArray(order?.timeline) ? order.timeline : [];
  const events = rawTimeline
    .map((entry, index) => ({
      key: `${normalizeTimelineEventStatus(entry?.status)}-${index}`,
      status: normalizeTimelineEventStatus(entry?.status),
      label: String(entry?.status || "Placed"),
      note: entry?.note || "",
      timestamp: toDate(entry?.timestamp || entry?.changedAt || entry?.createdAt || order?.createdAt, order?.createdAt),
    }))
    .filter((entry) => entry.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!events.length) {
    events.push({
      key: "PLACED-0",
      status: "PLACED",
      label: "Placed",
      note: "Order placed",
      timestamp: toDate(order?.createdAt, new Date()),
    });
  }

  const steps = [
    { key: "PLACED", label: "Placed" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
    { key: "DELIVERED", label: "Delivered" },
  ].map((step) => {
    const matchingEvent = events.find((event) => event.status === step.key);
    return {
      ...step,
      completed: Boolean(matchingEvent),
      timestamp: matchingEvent?.timestamp || null,
    };
  });

  const cancellationEvent = events.find((event) => event.status === "CANCELLED");
  const returnEvent = events.find((event) => event.status === "RETURNED");

  const currentKey = returnEvent
    ? "RETURNED"
    : cancellationEvent
      ? "CANCELLED"
      : steps.slice().reverse().find((step) => step.completed)?.key || "PLACED";

  return {
    current: currentKey,
    steps,
    events: events.map((event) => ({
      ...event,
      timestamp: event.timestamp?.toISOString?.() || event.timestamp,
    })),
  };
}

function buildOrderSnapshot(order, options = {}) {
  const user = options.user || order?.userId || {};
  const paymentRecord = options.paymentRecord || order?.paymentRecordId || {};
  const invoiceNumber = order?.invoiceNumber || generateInvoiceNumber(order);
  const charges = order?.pricingSnapshot?.charges || order?.chargesBreakdown || [];
  const currency = order?.currency || "INR";
  const shippingAddress = order?.shippingAddress || {};
  const billingAddress =
    order?.billingAddress && Object.keys(order.billingAddress || {}).length ? order.billingAddress : shippingAddress;
  const estimatedDelivery = estimateDeliveryDate(order);
  const items = (order?.items || []).map((item, index) => ({
    lineId: `${order?._id || "order"}-${index + 1}`,
    productId: String(item?.productId?._id || item?.productId || ""),
    image: item?.image || "",
    name: item?.name || "Product",
    variantId: item?.variantId || "",
    variantSku: item?.variantSku || "",
    variantName: buildVariantLabel(item),
    variantAttributes: normalizeAttributes(item?.variantAttributes),
    quantity: Number(item?.quantity || 0),
    unitPrice: roundMoney(item?.price || 0),
    total: roundMoney(Number(item?.price || 0) * Number(item?.quantity || 0)),
    weight: item?.weight || null,
  }));

  return {
    version: Number(order?.snapshotVersion || 1),
    orderId: String(order?._id || ""),
    orderNumber: order?.orderNumber || "",
    orderDate: toDate(order?.createdAt, new Date()).toISOString(),
    invoiceNumber,
    invoiceIssuedAt: toDate(order?.createdAt, new Date()).toISOString(),
    customer: {
      name: shippingAddress?.fullName || user?.name || "",
      phone: shippingAddress?.phone || user?.phone || "",
      email: user?.email || "",
      shippingAddress,
      billingAddress,
    },
    issuer: {
      name: COMPANY_NAME,
      website: COMPANY_WEBSITE,
      logoUrl: "",
    },
    items,
    pricing: {
      currency,
      subtotal: roundMoney(order?.subtotal || 0),
      deliveryFee: roundMoney(order?.shippingFee || 0),
      platformFee: roundMoney(order?.platformFee || 0),
      paymentFee: getPaymentCharges(charges, order?.paymentMethod),
      taxes: roundMoney(order?.taxAmount || 0),
      discounts: roundMoney(order?.discountAmount || 0),
      grandTotal: roundMoney(order?.totalAmount || 0),
      charges: (charges || []).map((charge) => ({
        key: charge?.key || "",
        label: charge?.displayName || charge?.key || "Charge",
        category: charge?.category || "",
        amount: roundMoney(charge?.amount || 0),
      })),
    },
    payment: {
      method: order?.paymentMethod || paymentRecord?.method || "ONLINE",
      status: order?.paymentStatus || "Pending",
      razorpayOrderId: order?.razorpayOrderId || paymentRecord?.razorpayOrderId || "",
      razorpayPaymentId: order?.razorpayPaymentId || paymentRecord?.razorpayPaymentId || "",
      transactionId: order?.razorpayPaymentId || paymentRecord?.razorpayPaymentId || "",
      paidAt: toDate(order?.paymentCapturedAt || paymentRecord?.paidAt)?.toISOString() || null,
    },
    shipping: {
      shippingMethod: order?.shippingMode === "PLATFORM" ? "Platform Shipping" : "Self Shipping",
      shippingMode: order?.shippingMode || "SELF",
      courier: order?.courierName || "",
      trackingNumber: order?.trackingId || "",
      trackingUrl: order?.trackingUrl || "",
      logisticsProvider: order?.deliveryPartner || "",
      shipmentId: order?.shipmentId || "",
      estimatedDelivery: estimatedDelivery.toISOString(),
      estimatedDeliveryLabel: formatDate(estimatedDelivery),
    },
    support: {
      email: SUPPORT_EMAIL,
      phone: SUPPORT_PHONE,
      website: COMPANY_WEBSITE,
      companyName: COMPANY_NAME,
      taxLabel: COMPANY_TAX_LABEL,
      taxId: COMPANY_TAX_ID,
    },
  };
}

function getSnapshot(order, options = {}) {
  if (order?.orderSnapshot && typeof order.orderSnapshot === "object") {
    return {
      ...order.orderSnapshot,
      invoiceNumber: order.orderSnapshot.invoiceNumber || order.invoiceNumber || generateInvoiceNumber(order),
    };
  }
  return buildOrderSnapshot(order, options);
}

function buildOrderSummary(order, options = {}) {
  const snapshot = getSnapshot(order, options);
  return {
    _id: order?._id,
    orderId: order?._id,
    orderNumber: order?.orderNumber || snapshot.orderNumber,
    invoiceNumber: order?.invoiceNumber || snapshot.invoiceNumber,
    orderDate: snapshot.orderDate,
    createdAt: order?.createdAt,
    status: order?.status,
    paymentStatus: order?.paymentStatus,
    estimatedDelivery: snapshot.shipping?.estimatedDelivery || null,
    estimatedDeliveryLabel: snapshot.shipping?.estimatedDeliveryLabel || "",
    customer: snapshot.customer,
    issuer: snapshot.issuer || {
      name: snapshot.support?.companyName || COMPANY_NAME,
      website: snapshot.support?.website || COMPANY_WEBSITE,
      logoUrl: "",
    },
    items: snapshot.items || [],
    pricing: snapshot.pricing,
    payment: {
      ...snapshot.payment,
      status: order?.paymentStatus || snapshot.payment?.status,
      timestamp: snapshot.payment?.paidAt || null,
    },
    shipping: {
      ...snapshot.shipping,
      courier: order?.courierName || snapshot.shipping?.courier || "",
      trackingNumber: order?.trackingId || snapshot.shipping?.trackingNumber || "",
      trackingUrl: order?.trackingUrl || snapshot.shipping?.trackingUrl || "",
      logisticsProvider: order?.deliveryPartner || snapshot.shipping?.logisticsProvider || "",
      shipmentId: order?.shipmentId || snapshot.shipping?.shipmentId || "",
    },
    cancellation: order?.cancellation || null,
    refundSummary: order?.refundSummary || null,
    refundId: order?.refundId || null,
    timeline: buildTimeline(order),
    support: snapshot.support,
    rawStatus: {
      orderStatus: order?.status,
      paymentStatus: order?.paymentStatus,
      shippingStatus: order?.shippingStatus,
      pickupStatus: order?.pickupStatus,
    },
  };
}

function collectInvoiceRows(summary) {
  return (summary?.items || []).map((item) => ({
    name: item.name,
    variantName: item.variantName,
    sku: item.variantSku || "-",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }));
}

function drawRule(doc, y) {
  doc
    .moveTo(50, y)
    .lineTo(545, y)
    .lineWidth(1)
    .strokeColor("#e2e8f0")
    .stroke();
}

function writeKeyValue(doc, label, value, x, y, width = 220) {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#64748b")
    .text(label, x, y, { width });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(value || "-", x, y + 12, { width });
}

async function resolvePdfImageSource(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("data:image/")) {
    const [, base64Payload = ""] = raw.split(",");
    return base64Payload ? Buffer.from(base64Payload, "base64") : null;
  }

  if (/^https?:\/\//i.test(raw)) {
    const response = await axios.get(raw, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }

  const normalizedPath = raw.startsWith("/uploads/")
    ? path.join(process.cwd(), raw.replace(/^\//, "").replace(/\//g, path.sep))
    : path.isAbsolute(raw)
      ? raw
      : path.join(process.cwd(), raw);

  if (fs.existsSync(normalizedPath)) {
    return normalizedPath;
  }

  return null;
}

async function generateInvoicePdf(summary) {
  const logoSource = await resolvePdfImageSource(summary?.organization?.logoUrl);
  const signatureSource = await resolvePdfImageSource(summary?.organization?.signatureUrl);

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    const org = summary.organization || {};
    const support = summary.support || {};
    const companyName = org.organizationName || support.companyName || COMPANY_NAME;
    const supportEmail = org.supportEmail || support.email || SUPPORT_EMAIL;
    const supportPhone = org.supportPhone || support.phone || SUPPORT_PHONE;
    const companyWebsite = org.companyWebsite || support.website || COMPANY_WEBSITE;
    const taxLabel = summary.metadata?.gstLabel || org.taxLabel || support.taxLabel || COMPANY_TAX_LABEL;
    const taxId = org.gstNumber || support.taxId || COMPANY_TAX_ID;
    const billingLabel = summary.metadata?.billingLabel || "Bill To";
    const issuerLabel = summary.metadata?.issuerLabel || "Issued By";

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Draw the blue background bar
    doc.rect(0, 0, 595, 110).fill("#0f172a");

    // Determine starting x for text content (logo + margin or just margin)
    let textStartX = 50;
    if (logoSource) {
      try {
        // Draw logo: 36x36 points, with 10pt margin to the right of logo
        doc.image(logoSource, 50, 20, { width: 36, height: 36, fit: [36, 36] });
        textStartX = 50 + 36 + 10; // 50 (logo x) + 36 (logo width) + 10 (margin)
      } catch (error) {
        // If logo fails to load, proceed without it
        logger.warn("Failed to load invoice logo for PDF", {
          source: "order-document.service",
          event: "invoice_logo_load_failed",
          error,
        });
      }
    }

    // Company name
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(24)
      .text(companyName, textStartX, 38);

    // Website, email, phone on next line
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#cbd5e1")
      .text(`${companyWebsite} | ${supportEmail} | ${supportPhone}`, textStartX, 72);

    // Payment Status
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#cbd5e1")
      .text(`Payment: ${summary.payment?.status || "-"}`, textStartX, 72 + 18);

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Tax Invoice", 50, 130);

    writeKeyValue(doc, "Invoice Number", summary.invoiceNumber, 50, 165);
    writeKeyValue(doc, "Order Number", summary.orderNumber, 220, 165);
    writeKeyValue(doc, "Invoice Date", formatDate(summary.orderDate), 390, 165, 155);
    writeKeyValue(doc, "Payment Status", summary.payment?.status || "-", 50, 205);
    writeKeyValue(doc, "Order Status", summary.status || "-", 220, 205);
    writeKeyValue(doc, "Payment Method", summary.payment?.method || "-", 390, 205, 155);

    drawRule(doc, 255);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(billingLabel, 50, 272);
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    doc.text(summary.customer?.name || "-", 50, 290);
    doc.text(summary.customer?.phone || "-", 50, 304);
    doc.text(summary.customer?.email || "-", 50, 318);
    doc.text(summary.customer?.shippingAddress?.line1 || "-", 50, 332, { width: 210 });
    if (summary.customer?.shippingAddress?.line2) {
      doc.text(summary.customer.shippingAddress.line2, 50, 346, { width: 210 });
    }
    doc.text(
      [
        summary.customer?.shippingAddress?.city,
        summary.customer?.shippingAddress?.state,
        summary.customer?.shippingAddress?.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
      50,
      360,
      { width: 210 }
    );
    doc.text(summary.customer?.shippingAddress?.country || "", 50, 374, { width: 210 });

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(issuerLabel, 320, 272);
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    doc.text(summary.issuer?.name || companyName, 320, 290);
    doc.text(`Support: ${supportPhone}`, 320, 304);
    doc.text(`Email: ${supportEmail}`, 320, 318, { width: 220 });
    doc.text(`${taxLabel}: ${taxId}`, 320, 332, { width: 220 });

    drawRule(doc, 405);

    const tableTop = 420;
    const columns = { item: 50, sku: 260, qty: 350, price: 410, total: 485 };

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#475569");
    doc.text("Item", columns.item, tableTop);
    doc.text("SKU", columns.sku, tableTop);
    doc.text("Qty", columns.qty, tableTop);
    doc.text("Unit Price", columns.price, tableTop);
    doc.text("Total", columns.total, tableTop);
    drawRule(doc, tableTop + 18);

    let y = tableTop + 28;
    for (const row of collectInvoiceRows(summary)) {
      const itemHeight = 30;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(row.name, columns.item, y, { width: 190 });
      doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(row.variantName || "-", columns.item, y + 12, { width: 190 });
      doc.font("Helvetica").fontSize(10).fillColor("#334155").text(row.sku || "-", columns.sku, y, { width: 75 });
      doc.text(String(row.quantity || 0), columns.qty, y, { width: 40, align: "right" });
      doc.text(formatCurrency(row.unitPrice, summary.pricing?.currency), columns.price, y, { width: 65, align: "right" });
      doc.text(formatCurrency(row.total, summary.pricing?.currency), columns.total, y, { width: 60, align: "right" });
      y += itemHeight;
      drawRule(doc, y - 2);
    }

    const totalsTop = Math.max(y + 20, 620);
    const totals = [
      ["Subtotal", summary.pricing?.subtotal],
      ["Delivery Fee", summary.pricing?.deliveryFee],
      ["Platform Fee", summary.pricing?.platformFee],
      [summary.payment?.method === "COD" ? "COD Charges" : "Razorpay Charges", summary.pricing?.paymentFee],
      ["Taxes", summary.pricing?.taxes],
      ["Discounts", summary.pricing?.discounts ? -Math.abs(summary.pricing.discounts) : 0],
    ];

    for (const [label, amount] of totals) {
      doc.font("Helvetica").fontSize(10).fillColor("#334155").text(label, 360, totalsTop + totals.indexOf(totals.find((t) => t[0] === label)) * 18, { width: 100 });
      doc.text(formatCurrency(amount || 0, summary.pricing?.currency), 470, totalsTop + totals.indexOf(totals.find((t) => t[0] === label)) * 18, {
        width: 75,
        align: "right",
      });
    }

    drawRule(doc, totalsTop + 115);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Grand Total", 360, totalsTop + 125, { width: 100 });
    doc.text(formatCurrency(summary.pricing?.grandTotal || 0, summary.pricing?.currency), 450, totalsTop + 125, {
      width: 95,
      align: "right",
    });

    doc.font("Helvetica").fontSize(9).fillColor("#64748b");
    doc.text(
      `Payment reference: ${summary.payment?.transactionId || summary.payment?.razorpayOrderId || "Not available"}`,
      50,
      740,
      { width: 495 }
    );
    doc.text(
      `Shipping: ${summary.shipping?.shippingMethod || "-"} | Courier: ${summary.shipping?.courier || "Pending"} | Tracking: ${summary.shipping?.trackingNumber || "Pending"}`,
      50,
      754,
      { width: 495 }
    );
    doc.text(
      summary.metadata?.customNotes || summary.organization?.billingAddress || "",
      50,
      772,
      { width: 495 }
    );

    if (signatureSource) {
      try {
        doc.image(signatureSource, 430, 728, { width: 80, height: 32, fit: [80, 32] });
      } catch (error) {
        logger.warn("Failed to load invoice signature for PDF", {
          source: "order-document.service",
          event: "invoice_signature_load_failed",
          error,
        });
      }
    }

    doc.text(
      summary.metadata?.footerText || `Need help? Contact ${supportEmail} or ${supportPhone}`,
      50,
      780,
      { width: 495, align: "center" }
    );

    doc.end();
  });
}

module.exports = {
  buildOrderSnapshot,
  buildOrderSummary,
  buildTimeline,
  generateInvoiceNumber,
  generateInvoicePdf,
  getSnapshot,
};
