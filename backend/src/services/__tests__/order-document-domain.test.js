const { logger } = require("../../utils/logger");
const assert = require("assert");
const {
  buildOrderSnapshot,
  buildOrderSummary,
  generateInvoiceNumber,
  generateInvoicePdf,
} = require("../order-document.service");

async function main() {
  const baseOrder = {
    _id: "681dd52f0000000000000001",
    orderNumber: "ORD-20260509-AB12CD",
    invoiceNumber: generateInvoiceNumber({ orderNumber: "ORD-20260509-AB12CD" }),
    createdAt: new Date("2026-05-09T10:00:00.000Z"),
    status: "Placed",
    paymentStatus: "Paid",
    paymentMethod: "ONLINE",
    shippingMode: "PLATFORM",
    shippingFee: 75,
    platformFee: 20,
    taxAmount: 18,
    discountAmount: 10,
    subtotal: 1000,
    totalAmount: 1103,
    razorpayPaymentId: "pay_test_123",
    paymentCapturedAt: new Date("2026-05-09T10:02:00.000Z"),
    shippingAddress: {
      fullName: "Asha Verma",
      phone: "9999999999",
      line1: "12 Lake View",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      country: "India",
    },
    billingAddress: {
      fullName: "Asha Verma",
      phone: "9999999999",
      line1: "12 Lake View",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      country: "India",
    },
    items: [
      {
        productId: "681dd52f0000000000000101",
        name: "Warehouse Tee",
        image: "/img/tee.png",
        variantId: "TEE-BLK-M",
        variantSku: "TEE-BLK-M",
        variantTitle: "Black / M",
        variantAttributes: { color: "Black", size: "M" },
        quantity: 2,
        price: 500,
      },
    ],
    pricingSnapshot: {
      charges: [
        { key: "shipping_cost", displayName: "Shipping Fee", amount: 75, category: "SHIPPING" },
        { key: "platform_fee", displayName: "Platform Fee", amount: 20, category: "PLATFORM_FEE" },
        { key: "tax", displayName: "Tax", amount: 18, category: "TAX" },
      ],
    },
    timeline: [
      { status: "Placed", note: "Order placed", timestamp: new Date("2026-05-09T10:00:00.000Z") },
      { status: "Packed", note: "Order confirmed", timestamp: new Date("2026-05-09T12:00:00.000Z") },
      { status: "Shipped", note: "Handed to courier", timestamp: new Date("2026-05-10T08:00:00.000Z") },
    ],
  };

  const snapshot = buildOrderSnapshot(baseOrder, {
    user: { name: "Asha Verma", email: "asha@example.com", phone: "9999999999" },
  });

  assert.equal(snapshot.items[0].variantName, "Black / M");
  assert.equal(snapshot.pricing.subtotal, 1000);
  assert.equal(snapshot.payment.transactionId, "pay_test_123");

  const immutableSnapshot = { ...snapshot };
  const liveOrder = {
    ...baseOrder,
    orderSnapshot: immutableSnapshot,
    items: [
      {
        ...baseOrder.items[0],
        name: "Renamed Live Product",
      },
    ],
  };
  const summary = buildOrderSummary(liveOrder);

  assert.equal(summary.items[0].name, "Warehouse Tee");
  assert.equal(summary.timeline.current, "SHIPPED");

  const pdf = await generateInvoicePdf(summary);
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 1000);

  const codSummary = buildOrderSummary({
    ...baseOrder,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    orderSnapshot: buildOrderSnapshot({
      ...baseOrder,
      paymentMethod: "COD",
      paymentStatus: "Pending",
    }, {
      user: { name: "Asha Verma", email: "asha@example.com", phone: "9999999999" },
    }),
  });
  assert.equal(codSummary.payment.method, "COD");
  assert.equal(codSummary.payment.status, "Pending");

  logger.info("script_output", { value: "Order document domain checks passed." });
}

main().catch((error) => {
  logger.error("script_error", { error: error });
  process.exit(1);
});
