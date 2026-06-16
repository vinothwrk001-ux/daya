/**
 * Optional bootstrap: creates a homepage banner from existing hero-enabled categories
 * when no homepage banners exist yet.
 *
 * Usage: node scripts/seed-homepage-banner.js
 */
require("../src/config/env");
const mongoose = require("mongoose");
const { HomepageBanner } = require("../src/models/HomepageBanner");
const { HomepageBannerCategory } = require("../src/models/HomepageBannerCategory");
const { Category } = require("../src/models/Category");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await HomepageBanner.countDocuments({});
  if (existing > 0) {
    console.log("Homepage banners already exist. Skipping seed.");
    process.exit(0);
  }

  const categories = await Category.find({
    showInHeroBanner: true,
    isActive: true,
    status: "active",
    visibility: "public",
  })
    .sort({ order: 1 })
    .limit(6)
    .lean();

  if (!categories.length) {
    console.log("No hero-enabled categories found. Create categories with showInHeroBanner first.");
    process.exit(0);
  }

  const primary = categories[0];
  const banner = await HomepageBanner.create({
    name: "Featured Collection",
    slug: "featured-collection",
    title: primary.heroHeading || primary.name,
    subtitle: primary.heroSubheading || "Explore our latest collection",
    description: primary.description || "",
    ctaText: "Shop now",
    ctaUrl: `/category/${primary.slug}`,
    desktopImage: primary.bannerUrl || primary.thumbnailUrl || "",
    mobileImage: primary.thumbnailUrl || primary.bannerUrl || "",
    status: "active",
    displayOrder: 0,
    showOnHomepage: true,
  });

  await HomepageBannerCategory.insertMany(
    categories.map((category, index) => ({
      bannerId: banner._id,
      categoryId: category._id,
      displayOrder: index,
      customTitle: category.heroHeading || "",
      customSubtitle: category.heroSubheading || "",
      cardImage: category.thumbnailUrl || category.bannerUrl || "",
      ctaUrl: `/category/${category.slug}`,
      showProductCount: true,
      status: "active",
    }))
  );

  console.log(`Created homepage banner "${banner.name}" with ${categories.length} category cards.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
