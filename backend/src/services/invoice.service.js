const { AppError } = require("../utils/AppError");
const orderRepo = require("../repositories/order.repository");
const vendorRepo = require("../repositories/vendor.repository");
const InvoiceSettings = require("../models/InvoiceSettings");
const InvoiceMetadata = require("../models/InvoiceMetadata");
const InvoiceAuditLog = require("../models/InvoiceAuditLog");
const { uploadMany } = require("../utils/upload");
const {
  buildOrderSummary,
  generateInvoiceNumber,
  generateInvoicePdf,
} = require("./order-document.service");

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSettingsPayload(payload = {}) {
  const bankDetails = payload.bankDetails || {};
  const bankField = (key) =>
    trimOrEmpty(
      bankDetails[key] ??
        payload[`bankDetails.${key}`] ??
        payload[`bankDetails[${key}]`]
    );
  return {
    organizationName: trimOrEmpty(payload.organizationName),
    legalCompanyName: trimOrEmpty(payload.legalCompanyName),
    gstNumber: trimOrEmpty(payload.gstNumber),
    cinNumber: trimOrEmpty(payload.cinNumber),
    supportEmail: trimOrEmpty(payload.supportEmail),
    supportPhone: trimOrEmpty(payload.supportPhone),
    billingAddress: trimOrEmpty(payload.billingAddress),
    registeredAddress: trimOrEmpty(payload.registeredAddress),
    taxLabel: trimOrEmpty(payload.taxLabel) || "GST",
    invoicePrefix: trimOrEmpty(payload.invoicePrefix) || "INV",
    footerNotes: trimOrEmpty(payload.footerNotes),
    companyWebsite: trimOrEmpty(payload.companyWebsite),
    bankDetails: {
      accountName: bankField("accountName"),
      accountNumber: bankField("accountNumber"),
      ifscCode: bankField("ifscCode"),
      bankName: bankField("bankName"),
      branchName: bankField("branchName"),
      upiId: bankField("upiId"),
    },
  };
}

function sanitizeMetadataPayload(payload = {}) {
  const organizationOverrides = payload.organizationOverrides || {};
  return {
    customNotes: trimOrEmpty(payload.customNotes),
    footerText: trimOrEmpty(payload.footerText),
    billingLabel: trimOrEmpty(payload.billingLabel) || "Bill To",
    sellerLabel: trimOrEmpty(payload.sellerLabel) || "Sold By",
    gstLabel: trimOrEmpty(payload.gstLabel) || "GST",
    organizationOverrides: {
      organizationName: trimOrEmpty(organizationOverrides.organizationName),
      legalCompanyName: trimOrEmpty(organizationOverrides.legalCompanyName),
      gstNumber: trimOrEmpty(organizationOverrides.gstNumber),
      supportEmail: trimOrEmpty(organizationOverrides.supportEmail),
      supportPhone: trimOrEmpty(organizationOverrides.supportPhone),
      billingAddress: trimOrEmpty(organizationOverrides.billingAddress),
      registeredAddress: trimOrEmpty(organizationOverrides.registeredAddress),
    },
  };
}

function toSafeInvoiceSearchItem(order, invoice) {
  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer?.name || order.shippingAddress?.fullName || "",
    vendorName: invoice.vendors?.[0]?.name || "",
    paymentMethod: invoice.payment?.method || order.paymentMethod || "",
    paymentStatus: order.paymentStatus || invoice.payment?.status || "",
    orderStatus: order.status || "",
    totalAmount: invoice.pricing?.grandTotal || order.totalAmount || 0,
    currency: invoice.pricing?.currency || order.currency || "INR",
    issuedAt: invoice.invoiceIssuedAt || order.createdAt,
    version: invoice.metadata?.version || 1,
    hasCustomizations: Boolean(
      invoice.metadata?.customNotes ||
        invoice.metadata?.footerText ||
        invoice.metadata?.organizationOverrides?.organizationName
    ),
  };
}

class InvoiceService {
  async getSettings() {
    let settings = await InvoiceSettings.findOne().sort({ createdAt: -1 }).exec();
    if (!settings) {
      settings = await InvoiceSettings.create({});
    }
    return settings;
  }

  async updateSettings(payload = {}, files = {}, actor = {}, meta = {}) {
    const settings = await this.getSettings();
    const nextValues = sanitizeSettingsPayload(payload);

    if (files?.logo?.[0]) {
      const [uploaded] = await uploadMany([files.logo[0]], { folder: "invoice_branding" });
      nextValues.logoUrl = uploaded?.url || settings.logoUrl || "";
      nextValues.logoAsset = {
        publicId: uploaded?.publicId || "",
        originalName: uploaded?.originalName || "",
      };
    }

    if (files?.signature?.[0]) {
      const [uploaded] = await uploadMany([files.signature[0]], { folder: "invoice_branding" });
      nextValues.signatureUrl = uploaded?.url || settings.signatureUrl || "";
      nextValues.signatureAsset = {
        publicId: uploaded?.publicId || "",
        originalName: uploaded?.originalName || "",
      };
    }

    Object.assign(settings, nextValues, {
      updatedBy: String(actor?._id || actor?.sub || ""),
    });
    await settings.save();

    await InvoiceAuditLog.create({
      action: "invoice.settings.updated",
      actorId: String(actor?._id || actor?.sub || ""),
      actorRole: String(actor?.role || actor?.authType || ""),
      changes: nextValues,
      ipAddress: meta.ipAddress || "",
      userAgent: meta.userAgent || "",
    }).catch(() => {});

    return settings;
  }

  async getOrCreateMetadata(order) {
    let metadata = await InvoiceMetadata.findOne({ orderId: order._id }).exec();
    if (!metadata) {
      metadata = await InvoiceMetadata.create({
        orderId: order._id,
        invoiceNumber: order.invoiceNumber || generateInvoiceNumber(order),
      });
    }
    return metadata;
  }

  async buildInvoiceView(order, { actorRole = "admin", vendorId = null } = {}) {
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    const settings = await this.getSettings();
    const metadata = await this.getOrCreateMetadata(order);
    const base = buildOrderSummary(order);
    const vendor = base.vendors?.[0] || {};

    const organization = {
      organizationName: metadata.organizationOverrides?.organizationName || settings.organizationName || base.support?.companyName || "",
      legalCompanyName: metadata.organizationOverrides?.legalCompanyName || settings.legalCompanyName || settings.organizationName || "",
      gstNumber: metadata.organizationOverrides?.gstNumber || settings.gstNumber || base.support?.taxId || "",
      cinNumber: settings.cinNumber || "",
      supportEmail: metadata.organizationOverrides?.supportEmail || settings.supportEmail || base.support?.email || "",
      supportPhone: metadata.organizationOverrides?.supportPhone || settings.supportPhone || base.support?.phone || "",
      billingAddress: metadata.organizationOverrides?.billingAddress || settings.billingAddress || "",
      registeredAddress: metadata.organizationOverrides?.registeredAddress || settings.registeredAddress || "",
      taxLabel: metadata.gstLabel || settings.taxLabel || base.support?.taxLabel || "GST",
      invoicePrefix: settings.invoicePrefix || "INV",
      footerNotes: metadata.footerText || settings.footerNotes || "",
      companyWebsite: settings.companyWebsite || base.support?.website || "",
      logoUrl: settings.logoUrl || "",
      signatureUrl: settings.signatureUrl || "",
      bankDetails: settings.bankDetails || {},
    };

    const invoiceView = {
      ...base,
      invoiceNumber: metadata.invoiceNumber || base.invoiceNumber,
      invoiceIssuedAt: metadata.generatedAt?.toISOString?.() || base.orderDate,
      metadata: {
        id: metadata._id,
        version: metadata.version || 1,
        customNotes: metadata.customNotes || "",
        footerText: metadata.footerText || "",
        billingLabel: metadata.billingLabel || "Bill To",
        sellerLabel: metadata.sellerLabel || "Sold By",
        gstLabel: metadata.gstLabel || organization.taxLabel,
        generatedAt: metadata.generatedAt,
        generatedBy: metadata.generatedBy || "",
      },
      organization,
      auditSummary: {
        hasCustomizations: Boolean(
          metadata.customNotes ||
            metadata.footerText ||
            metadata.organizationOverrides?.organizationName ||
            metadata.organizationOverrides?.gstNumber
        ),
      },
      versions: metadata.versions || [],
    };

    invoiceView.support = {
      ...invoiceView.support,
      companyName: organization.organizationName || invoiceView.support?.companyName || "",
      email: organization.supportEmail || invoiceView.support?.email || "",
      phone: organization.supportPhone || invoiceView.support?.phone || "",
      website: organization.companyWebsite || invoiceView.support?.website || "",
      taxLabel: organization.taxLabel || invoiceView.support?.taxLabel || "GST",
      taxId: organization.gstNumber || invoiceView.support?.taxId || "",
    };

    if (actorRole === "vendor") {
      invoiceView.organization.bankDetails = {
        accountName: "",
        accountNumber: "",
        ifscCode: "",
        bankName: "",
        branchName: "",
        upiId: "",
      };
      invoiceView.vendors = vendorId && String(vendor.sellerId || "") !== String(vendorId) ? [] : [vendor];
    }

    return invoiceView;
  }

  async listAdminInvoices(query = {}) {
    const result = await orderRepo.list({
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      status: query.status,
      paymentStatus: query.paymentStatus,
      search: query.search,
      includeInactive: query.includeInactive === "true",
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "asc" ? 1 : -1,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const invoices = await Promise.all((result.orders || []).map((order) => this.buildInvoiceView(order)));
    return {
      invoices: invoices.map((invoice, index) => toSafeInvoiceSearchItem(result.orders[index], invoice)),
      pagination: result.pagination,
    };
  }

  async listVendorInvoices(userId, query = {}) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");
    const result = await orderRepo.listBySellerId({
      sellerId: vendor._id,
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      status: query.status,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "asc" ? 1 : -1,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const invoices = await Promise.all((result.orders || []).map((order) => this.buildInvoiceView(order, { actorRole: "vendor", vendorId: vendor._id })));
    return {
      invoices: invoices.map((invoice, index) => toSafeInvoiceSearchItem(result.orders[index], invoice)),
      pagination: result.pagination,
    };
  }

  async getAdminInvoice(orderId) {
    const order = await orderRepo.findById(orderId);
    return await this.buildInvoiceView(order);
  }

  async getVendorInvoice(userId, orderId) {
    const vendor = await vendorRepo.findByUserId(userId);
    if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");
    const order = await orderRepo.findById(orderId);
    if (!order || String(order.sellerId?._id || order.sellerId) !== String(vendor._id)) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }
    return await this.buildInvoiceView(order, { actorRole: "vendor", vendorId: vendor._id });
  }

  async getUserInvoicePreview(userId, orderId) {
    const order = await orderRepo.findByIdForUser(orderId, userId);
    return await this.buildInvoiceView(order, { actorRole: "user" });
  }

  async updateInvoiceMetadata(orderId, payload = {}, actor = {}, meta = {}) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
    const metadata = await this.getOrCreateMetadata(order);
    const nextValues = sanitizeMetadataPayload(payload);

    metadata.versions.push({
      version: Number(metadata.version || 1),
      customNotes: metadata.customNotes || "",
      footerText: metadata.footerText || "",
      billingLabel: metadata.billingLabel || "Bill To",
      sellerLabel: metadata.sellerLabel || "Sold By",
      gstLabel: metadata.gstLabel || "GST",
      organizationOverrides: metadata.organizationOverrides || {},
      updatedAt: new Date(),
      updatedBy: String(actor?._id || actor?.sub || ""),
    });

    metadata.customNotes = nextValues.customNotes;
    metadata.footerText = nextValues.footerText;
    metadata.billingLabel = nextValues.billingLabel;
    metadata.sellerLabel = nextValues.sellerLabel;
    metadata.gstLabel = nextValues.gstLabel;
    metadata.organizationOverrides = nextValues.organizationOverrides;
    metadata.version = Number(metadata.version || 1) + 1;
    metadata.generatedAt = new Date();
    metadata.generatedBy = String(actor?._id || actor?.sub || "");
    await metadata.save();

    await InvoiceAuditLog.create({
      orderId: order._id,
      metadataId: metadata._id,
      actorId: String(actor?._id || actor?.sub || ""),
      actorRole: String(actor?.role || actor?.authType || ""),
      action: "invoice.metadata.updated",
      changes: nextValues,
      ipAddress: meta.ipAddress || "",
      userAgent: meta.userAgent || "",
    }).catch(() => {});

    return await this.buildInvoiceView(order);
  }

  async getInvoiceAuditHistory(orderId) {
    const logs = await InvoiceAuditLog.find({ orderId }).sort({ createdAt: -1 }).lean().exec();
    return { logs };
  }

  async downloadAdminInvoice(orderId) {
    const invoice = await this.getAdminInvoice(orderId);
    return {
      filename: `${invoice.invoiceNumber || invoice.orderNumber}.pdf`,
      contentType: "application/pdf",
      content: await generateInvoicePdf(invoice),
    };
  }

  async downloadVendorInvoice(userId, orderId) {
    const invoice = await this.getVendorInvoice(userId, orderId);
    return {
      filename: `${invoice.invoiceNumber || invoice.orderNumber}.pdf`,
      contentType: "application/pdf",
      content: await generateInvoicePdf(invoice),
    };
  }

  async downloadUserInvoice(userId, orderId) {
    const invoice = await this.getUserInvoicePreview(userId, orderId);
    return {
      filename: `${invoice.invoiceNumber || invoice.orderNumber}.pdf`,
      contentType: "application/pdf",
      content: await generateInvoicePdf(invoice),
    };
  }
}

module.exports = new InvoiceService();
