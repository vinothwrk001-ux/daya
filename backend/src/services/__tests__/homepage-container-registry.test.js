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
    assert.equal(CONTAINER_TYPES.length, 32);
    assert.ok(CONTAINER_TYPES.includes("CAROUSEL"));
    assert.ok(CONTAINER_TYPES.includes("FEATURED_PRODUCTS"));
    assert.ok(CONTAINER_TYPES.includes("VIDEO_PRODUCTS"));
    assert.ok(CONTAINER_TYPES.includes("VENDOR_STOREFRONT_GRID"));
    assert.ok(CONTAINER_TYPES.includes("INFLUENCER_FEATURED_CREATORS"));
    assert.equal(CONTAINER_TYPES.includes("FEATURED"), false);
    assert.equal(CONTAINER_TYPES.includes("LIST"), false);
    assert.equal(CONTAINER_TYPES.includes("TABS"), false);
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
      ["bannerMedia", "overlayOpacity", "textPosition", "autoSlide", "slideSpeed", "showArrows", "showDots", "infiniteLoop", "swipeEnabled", "showCtaOnHover"]
    );
  });

  await runTest("featured products schema exposes product showcase controls", () => {
    const schema = getContainerTypeSchema("FEATURED_PRODUCTS");
    const fieldNames = schema.typeFields.map((field) => field.name);
    assert.equal(schema.supportsProducts, true);
    assert.ok(fieldNames.includes("heroProduct"));
    assert.ok(fieldNames.includes("secondaryProducts"));
    assert.ok(fieldNames.includes("featuredLayoutStyle"));
    assert.ok(fieldNames.includes("productSourceMode"));
  });

  await runTest("flash sale schema includes countdown fields", () => {
    const schema = getContainerTypeSchema("FLASH_SALE");
    assert.equal(schema.supportsProducts, true);
    assert.ok(schema.typeFields.some((field) => field.name === "startTime"));
    assert.ok(schema.typeFields.some((field) => field.name === "endTime"));
  });

  await runTest("storefront discovery schemas do not expose product filters", () => {
    const vendorSchema = getContainerTypeSchema("VENDOR_STOREFRONT_GRID");
    const influencerSchema = getContainerTypeSchema("INFLUENCER_STOREFRONT_CAROUSEL");
    assert.equal(vendorSchema.supportsProducts, false);
    assert.equal(influencerSchema.supportsProducts, false);
    assert.equal(vendorSchema.productFilterFields.length, 0);
    assert.equal(influencerSchema.productFilterFields.length, 0);
    assert.ok(vendorSchema.typeFields.some((field) => field.name === "manualVendorIds"));
    assert.ok(influencerSchema.typeFields.some((field) => field.name === "manualInfluencerIds"));
  });

  console.log("All homepage container registry checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
