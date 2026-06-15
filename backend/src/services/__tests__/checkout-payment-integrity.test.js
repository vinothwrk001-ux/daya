const assert = require("assert");
const { checkoutCreateSchema } = require("../../utils/validators/checkout.validation");

const validAddress = {
  fullName: "Test User",
  phone: "9999999999",
  line1: "123 Main St",
  city: "Chennai",
  state: "TN",
  postalCode: "600001",
  country: "India",
};

async function run() {
  const codResult = checkoutCreateSchema.validate({
    shippingAddress: validAddress,
    paymentMethod: "COD",
  });
  assert.equal(codResult.error, undefined);
  assert.equal(codResult.value.paymentMethod, "COD");

  const onlineResult = checkoutCreateSchema.validate({
    shippingAddress: validAddress,
    paymentMethod: "ONLINE",
  });
  assert.ok(onlineResult.error, "ONLINE must be rejected on public checkout create");

  const defaultResult = checkoutCreateSchema.validate({
    shippingAddress: validAddress,
  });
  assert.equal(defaultResult.error, undefined);
  assert.equal(defaultResult.value.paymentMethod, "COD");
}

run()
  .then(() => {
    console.log("checkout payment integrity tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
