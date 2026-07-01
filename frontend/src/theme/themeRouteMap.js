export function resolvePageKeyFromPath(pathname = "") {
  const path = String(pathname || "").split("?")[0];

  if (path === "/") return "homepage";
  if (path.startsWith("/shop") || path.startsWith("/category")) return "products";
  if (path.startsWith("/product/")) return "product-details";
  if (path.startsWith("/reels")) return "reels";
  if (path.startsWith("/services")) return "services";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/wishlist")) return "wishlist";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/compare")) return "compare";
  if (path.startsWith("/collections")) return "collections";
  if (path.startsWith("/admin")) return "admin-panel";
  if (
    path.startsWith("/profile") ||
    path.startsWith("/orders") ||
    path.startsWith("/user/dashboard") ||
    path.startsWith("/dashboard/user")
  ) {
    return "profile";
  }
  return null;
}

export function resolveBreakpointFromWidth(width = typeof window !== "undefined" ? window.innerWidth : 1280) {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
