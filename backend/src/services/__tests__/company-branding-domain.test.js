const { logger } = require("../../utils/logger");
const assert = require("assert");
const {
  buildManifest,
  buildSchemaMarkup,
  toPublicBranding,
} = require("../company-branding.service");

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => logger.info("script_output", { value: `ok - ${name}` }))
    .catch((error) => {
      logger.error("script_error", { error: `not ok - ${name}` });
      logger.error("script_error", { error: error });
      process.exitCode = 1;
    });
}

test("toPublicBranding prefers optimized asset urls and preserves brand colors", () => {
  const branding = toPublicBranding({
    _id: "b1",
    tenantType: "platform",
    tenantKey: "default",
    companyName: "Acme Commerce",
    supportEmail: "support@acme.test",
    supportPhone: "+1 555 0100",
    websiteUrl: "https://acme.test",
    version: 3,
    primaryLogo: { url: "/uploads/original.png", webpUrl: "/uploads/original.webp" },
    darkLogo: {},
    mobileLogo: {},
    favicon: { url: "/uploads/favicon.png" },
    emailLogo: {},
    invoiceLogo: {},
    brandColors: { primaryColor: "#111827", accentColor: "#f97316" },
    seoBranding: { organizationName: "Acme Org", organizationUrl: "https://acme.test/org", organizationLogo: {} },
    updatedAt: new Date("2026-05-25T00:00:00Z"),
  });

  assert.equal(branding.companyName, "Acme Commerce");
  assert.equal(branding.logos.primary, "/uploads/original.webp");
  assert.equal(branding.logos.dark, "/uploads/original.webp");
  assert.equal(branding.logos.favicon, "/uploads/favicon.png");
  assert.equal(branding.brandColors.primaryColor, "#111827");
  assert.equal(branding.seoBranding.organizationName, "Acme Org");
});

test("buildSchemaMarkup produces organization metadata", () => {
  const markup = buildSchemaMarkup({
    companyName: "Acme Commerce",
    websiteUrl: "https://acme.test",
    supportEmail: "support@acme.test",
    supportPhone: "+1 555 0100",
    primaryLogo: { url: "/uploads/logo.png" },
    seoBranding: { organizationName: "Acme Org", organizationUrl: "https://acme.test/org", organizationLogo: {} },
  });

  assert.equal(markup["@type"], "Organization");
  assert.equal(markup.name, "Acme Org");
  assert.equal(markup.url, "https://acme.test/org");
  assert.equal(markup.logo, "/uploads/logo.png");
  assert.equal(markup.contactPoint[0].email, "support@acme.test");
});

test("buildManifest emits cache-safe pwa metadata", () => {
  const manifest = buildManifest({
    origin: "https://admin.acme.test",
    branding: {
      companyName: "Acme Commerce",
      logos: { favicon: "/uploads/favicon.png" },
      assets: { favicon: { url: "/uploads/favicon.png" } },
      brandColors: { primaryColor: "#111827", secondaryColor: "#0f172a" },
    },
  });

  assert.equal(manifest.name, "Acme Commerce");
  assert.equal(manifest.theme_color, "#111827");
  assert.equal(manifest.background_color, "#0f172a");
  assert.equal(manifest.icons[0].src, "https://admin.acme.test/uploads/favicon.png");
});
