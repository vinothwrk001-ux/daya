const PAGE_KEYS = Object.freeze([
  "homepage",
  "products",
  "categories",
  "product-details",
  "reels",
  "services",
  "blogs",
  "checkout",
  "wishlist",
  "profile",
  "compare",
  "track-order",
  "search-results",
  "collections",
  "cart",
  "admin-panel",
  "customer-panel",
]);

const SECTION_KEYS = Object.freeze([
  "header",
  "hero",
  "banner",
  "categories",
  "trending-products",
  "featured-products",
  "reels-section",
  "testimonials",
  "services",
  "footer",
  "newsletter",
  "navigation",
]);

const COMPONENT_KEYS = Object.freeze([
  "product-card",
  "category-card",
  "reel-card",
  "blog-card",
  "button",
  "form",
  "input",
  "dropdown",
  "accordion",
  "tabs",
  "modal",
  "drawer",
  "table",
  "cart-drawer",
  "reels-feed",
]);

const PAGE_LABELS = Object.freeze({
  homepage: "Homepage",
  products: "Products Page",
  categories: "Categories Page",
  "product-details": "Product Details Page",
  reels: "Reels Page",
  services: "Services Page",
  blogs: "Blogs Page",
  checkout: "Checkout Page",
  wishlist: "Wishlist Page",
  profile: "Profile Page",
  compare: "Compare Page",
  "track-order": "Track Order Page",
  "search-results": "Search Results",
  collections: "Collections",
  cart: "Cart Page",
  "admin-panel": "Admin Panel",
  "customer-panel": "Customer Panel",
});

const SECTION_LABELS = Object.freeze({
  header: "Header",
  hero: "Hero Section",
  banner: "Homepage Banner",
  categories: "Categories Section",
  "trending-products": "Trending Products",
  "featured-products": "Featured Products",
  "reels-section": "Reels Section",
  testimonials: "Testimonials",
  services: "Services Section",
  footer: "Footer",
  newsletter: "Newsletter",
  navigation: "Navigation",
});

const COMPONENT_LABELS = Object.freeze({
  "product-card": "Product Card",
  "category-card": "Category Card",
  "reel-card": "Reel Card",
  "blog-card": "Blog Card",
  button: "Buttons",
  form: "Forms",
  input: "Inputs",
  dropdown: "Dropdowns",
  accordion: "Accordions",
  tabs: "Tabs",
  modal: "Modals",
  drawer: "Drawers",
  table: "Tables",
  "cart-drawer": "Cart Drawer",
  "reels-feed": "Reels Feed",
});

function isValidPageKey(key) {
  return PAGE_KEYS.includes(key);
}

function isValidSectionKey(key) {
  return SECTION_KEYS.includes(key);
}

function isValidComponentKey(key) {
  return COMPONENT_KEYS.includes(key);
}

function getRegistry() {
  return {
    pages: PAGE_KEYS.map((key) => ({ key, label: PAGE_LABELS[key] || key })),
    sections: SECTION_KEYS.map((key) => ({ key, label: SECTION_LABELS[key] || key })),
    components: COMPONENT_KEYS.map((key) => ({ key, label: COMPONENT_LABELS[key] || key })),
  };
}

module.exports = {
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  PAGE_KEYS,
  PAGE_LABELS,
  SECTION_KEYS,
  SECTION_LABELS,
  getRegistry,
  isValidComponentKey,
  isValidPageKey,
  isValidSectionKey,
};
