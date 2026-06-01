const { logger } = require("../../utils/logger");
const assert = require("assert");
const { generateInvoicePdf } = require("../order-document.service");

async function main() {
  const invoice = {
    invoiceNumber: "INV-PREVIEW-001",
    orderNumber: "ORD-PREVIEW-001",
    orderDate: new Date("2026-05-12T10:00:00Z").toISOString(),
    invoiceIssuedAt: new Date("2026-05-12T10:05:00Z").toISOString(),
    status: "Placed",
    customer: {
      name: "Invoice Test User",
      phone: "9999999999",
      email: "invoice@example.com",
      shippingAddress: {
        line1: "123 Test Street",
        city: "Coimbatore",
        state: "Tamil Nadu",
        postalCode: "641001",
        country: "India",
      },
    },
    vendors: [{ name: "Vendor Test Shop" }],
    items: [
      {
        name: "Invoice Test Product",
        variantName: "8GB",
        variantSku: "SKU-8GB",
        quantity: 1,
        unitPrice: 10000,
        total: 10000,
      },
    ],
    pricing: {
      currency: "INR",
      subtotal: 10000,
      deliveryFee: 30,
      platformFee: 100,
      paymentFee: 0,
      taxes: 0,
      discounts: 0,
      grandTotal: 10130,
    },
    payment: {
      method: "ONLINE",
      status: "Paid",
      transactionId: "pay_test_001",
    },
    shipping: {
      shippingMethod: "Platform Shipping",
      courier: "Shiprocket",
      trackingNumber: "AWB001",
    },
    support: {
      companyName: "Base Company",
      email: "support@example.com",
      phone: "+91 90000 00000",
      website: "www.example.com",
      taxLabel: "GST",
      taxId: "GSTTEST001",
    },
    organization: {
      organizationName: "Configured Company",
      gstNumber: "GSTCONFIG001",
      supportEmail: "billing@example.com",
      supportPhone: "+91 98888 88888",
      companyWebsite: "www.configured.example",
      footerNotes: "Configured footer",
    },
    metadata: {
      billingLabel: "Billing Party",
      sellerLabel: "Seller Entity",
      gstLabel: "GSTIN",
      customNotes: "Custom note for invoice rendering test",
      footerText: "Footer override from metadata",
    },
  };

  const pdf = await generateInvoicePdf(invoice);
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 1000);
}

main().catch((error) => {
  logger.error("script_error", { error: error });
  process.exit(1);
});
