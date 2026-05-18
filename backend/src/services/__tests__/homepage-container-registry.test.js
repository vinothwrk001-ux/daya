const assert = require("assert/strict");
const {
  CONTAINER_TYPES,
  getContainerTypeSchema,
  normalizeContainerType,
} = require("../../config/homepageContainerRegistry");

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await runTest("supports all requested homepage container types", () => {
    assert.equal(CONTAINER_TYPES.length, 20);
    assert.ok(CONTAINER_TYPES.includes("CAROUSEL"));
    assert.ok(CONTAINER_TYPES.includes("VIDEO_PRODUCTS"));
  });

  await runTest("normalizes legacy product carousel type", () => {
    assert.equal(normalizeContainerType("product_carousel"), "CAROUSEL");
  });

  await runTest("banner schema only exposes banner-specific fields and no product filters", () => {
    const schema = getContainerTypeSchema("BANNER");
    assert.equal(schema.supportsProducts, false);
    assert.equal(schema.productFilterFields.length, 0);
    assert.deepEqual(
      schema.typeFields.map((field) => field.name),
      ["bannerImage", "bannerVideo", "heading", "subheading", "ctaButton", "ctaUrl", "overlayOpacity", "textPosition"]
    );
  });

  await runTest("flash sale schema includes countdown fields", () => {
    const schema = getContainerTypeSchema("FLASH_SALE");
    assert.equal(schema.supportsProducts, true);
    assert.ok(schema.typeFields.some((field) => field.name === "startTime"));
    assert.ok(schema.typeFields.some((field) => field.name === "endTime"));
  });

  console.log("All homepage container registry checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
