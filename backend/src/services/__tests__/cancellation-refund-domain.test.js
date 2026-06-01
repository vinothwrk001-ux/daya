const { logger } = require("../../utils/logger");
const assert = require("assert");
const cancellationRefundService = require("../cancellation-refund.service");

function main() {
  const policy = {
    featureFlags: {
      codCancellationEnabled: true,
      razorpayCancellationEnabled: true,
      codRefundEnabled: false,
      razorpayRefundEnabled: true,
      manualRefundEnabled: true,
      walletRefundEnabled: true,
      autoRefundEnabled: true,
      partialRefundEnabled: true,
      stageBasedCancellationEnabled: true,
    },
    paymentMethodConfigs: [
      {
        paymentMethod: "COD",
        cancellationEnabled: true,
        refundEnabled: false,
        autoRefundEnabled: false,
        manualRefundEnabled: true,
        walletRefundEnabled: true,
        allowedRefundMethods: ["MANUAL", "WALLET"],
      },
      {
        paymentMethod: "RAZORPAY",
        cancellationEnabled: true,
        refundEnabled: true,
        autoRefundEnabled: true,
        manualRefundEnabled: true,
        walletRefundEnabled: true,
        allowedRefundMethods: ["RAZORPAY", "MANUAL", "WALLET"],
      },
    ],
    stages: [
      {
        stage: "SHIPPED",
        cancellationEnabled: true,
        refundEnabled: true,
        autoApproval: false,
        manualApproval: true,
        refundSlaHours: 72,
        cancellationChargeType: "PERCENTAGE",
        cancellationChargeValue: 10,
        deductions: [
          { type: "SHIPPING", label: "Shipping recovery", value: 100, enabled: true },
          { type: "GATEWAY_FEE", label: "Gateway recovery", value: 0, enabled: true },
          { code: "CANCELLATION_CHARGE", type: "PERCENTAGE", label: "Cancellation charge", value: 10, enabled: true },
        ],
      },
    ],
  };

  const order = {
    _id: "order_1",
    orderNumber: "ORD-1001",
    status: "Shipped",
    paymentMethod: "ONLINE",
    subtotal: 5000,
    shippingFee: 100,
    taxAmount: 0,
    discountAmount: 0,
    platformFee: 0,
    totalAmount: 5100,
  };

  const payment = {
    method: "ONLINE",
    razorpayPaymentId: "pay_123",
    gatewayFeeAmount: 50,
  };

  const preview = cancellationRefundService.__private.buildRefundPreview({ order, payment, policy });
  assert.equal(preview.stage, "SHIPPED");
  assert.equal(preview.refundMethod, "RAZORPAY");
  assert.equal(preview.approvalRequired, true);
  assert.equal(preview.deductionAmount, 660);
  assert.equal(preview.refundAmount, 4440);

  const codPreview = cancellationRefundService.__private.buildRefundPreview({
    order: {
      ...order,
      paymentMethod: "COD",
      status: "Shipped",
      totalAmount: 3000,
      shippingFee: 0,
      subtotal: 3000,
    },
    payment: null,
    policy: {
      ...policy,
      stages: [
        {
          stage: "SHIPPED",
          cancellationEnabled: true,
          refundEnabled: true,
          autoApproval: true,
          manualApproval: false,
          refundSlaHours: 48,
          cancellationChargeType: "NONE",
          cancellationChargeValue: 0,
          deductions: [],
        },
      ],
    },
  });

  assert.equal(codPreview.refundMethod, "WALLET");
  assert.equal(codPreview.refundAmount, 3000);

  logger.info("script_output", { value: "Cancellation refund domain checks passed." });
}

try {
  main();
} catch (error) {
  logger.error("script_error", { error: error });
  process.exit(1);
}
