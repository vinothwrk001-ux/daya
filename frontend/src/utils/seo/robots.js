export const getRobotsDirective = (path = "", customRobots = null) => {
  if (customRobots) return customRobots;
  
  // Define protected or non-indexable routes
  const noIndexRoutes = [
    "/admin",
    "/checkout",
    "/cart",
    "/login",
    "/register",
    "/profile",
    "/wishlist",
    "/orders",
    "/staff",
    "/user",
    "/dashboard",
    "/forgot-password",
    "/settings",
    "/notifications",
    "/saved-reels",
    "/support",
    "/addresses",
    "/reviews",
    "/compare",
    "/checkout/success",
  ];

  const shouldNoIndex = noIndexRoutes.some(route => path.startsWith(route));
  
  return shouldNoIndex ? "noindex, nofollow" : "index, follow";
};
