const assert = require("assert");
const paymentService = require("../payment.service");

async function expectConfigError(envPatch, expectedCode) {
  const previous = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };

  try {
    Object.entries(envPatch).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });

    await assert.rejects(
      () => paymentService.validateRazorpayConfiguration({ verifyCredentials: false }),
      (error) => error?.code === expectedCode
    );
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

async function run() {
  await expectConfigError(
    {
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
    },
    "RAZORPAY_NOT_CONFIGURED"
  );

  await expectConfigError(
    {
      RAZORPAY_KEY_ID: "bad_key",
      RAZORPAY_KEY_SECRET: "123456789012345678901",
    },
    "RAZORPAY_CONFIG_ERROR"
  );

  await expectConfigError(
    {
      RAZORPAY_KEY_ID: "rzp_test_ValidKey123",
      RAZORPAY_KEY_SECRET: "rzp_test_secret_should_not_be_key",
    },
    "RAZORPAY_CONFIG_ERROR"
  );

  const previousForHealth = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };

  try {
    process.env.RAZORPAY_KEY_ID = "rzp_test_ValidKey123";
    process.env.RAZORPAY_KEY_SECRET = "validSecretValue1234567890";
    const result = await paymentService.validateRazorpayConfiguration({ verifyCredentials: false });
    assert.equal(result.mode, "test");
    assert.equal(result.credentialsVerified, false);
    assert.match(result.keyId, /^rzp_test.*\.\.\./);
  } finally {
    Object.entries(previousForHealth).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }

  const previous = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };

  try {
    process.env.RAZORPAY_KEY_ID = "bad_key";
    process.env.RAZORPAY_KEY_SECRET = "123";
    const health = await paymentService.getRazorpayHealth();
    assert.equal(health.status, "Unhealthy");
    assert.equal(health.checks.credentialsConfigured, false);
    assert.equal(health.mode, "unknown");
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }

  console.log("payment-security-domain tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
