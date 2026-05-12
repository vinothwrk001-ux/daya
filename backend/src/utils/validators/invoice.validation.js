const Joi = require("joi");

const invoiceSettingsSchema = Joi.object({
  organizationName: Joi.string().trim().allow("").max(160),
  legalCompanyName: Joi.string().trim().allow("").max(160),
  gstNumber: Joi.string().trim().allow("").max(80),
  cinNumber: Joi.string().trim().allow("").max(80),
  supportEmail: Joi.string().trim().allow("").email({ tlds: { allow: false } }).max(160),
  supportPhone: Joi.string().trim().allow("").max(40),
  billingAddress: Joi.string().trim().allow("").max(500),
  registeredAddress: Joi.string().trim().allow("").max(500),
  taxLabel: Joi.string().trim().allow("").max(40),
  invoicePrefix: Joi.string().trim().allow("").max(20),
  footerNotes: Joi.string().trim().allow("").max(1200),
  companyWebsite: Joi.string().trim().allow("").max(200),
  bankDetails: Joi.object({
    accountName: Joi.string().trim().allow("").max(120),
    accountNumber: Joi.string().trim().allow("").max(80),
    ifscCode: Joi.string().trim().allow("").max(40),
    bankName: Joi.string().trim().allow("").max(120),
    branchName: Joi.string().trim().allow("").max(120),
    upiId: Joi.string().trim().allow("").max(120),
  }).default({}),
});

const invoiceMetadataSchema = Joi.object({
  customNotes: Joi.string().trim().allow("").max(1200),
  footerText: Joi.string().trim().allow("").max(1200),
  billingLabel: Joi.string().trim().allow("").max(80),
  sellerLabel: Joi.string().trim().allow("").max(80),
  gstLabel: Joi.string().trim().allow("").max(80),
  organizationOverrides: Joi.object({
    organizationName: Joi.string().trim().allow("").max(160),
    legalCompanyName: Joi.string().trim().allow("").max(160),
    gstNumber: Joi.string().trim().allow("").max(80),
    supportEmail: Joi.string().trim().allow("").email({ tlds: { allow: false } }).max(160),
    supportPhone: Joi.string().trim().allow("").max(40),
    billingAddress: Joi.string().trim().allow("").max(500),
    registeredAddress: Joi.string().trim().allow("").max(500),
  }).default({}),
});

module.exports = {
  invoiceSettingsSchema,
  invoiceMetadataSchema,
};
