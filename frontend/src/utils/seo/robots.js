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
    "/orders"
  ];

  const shouldNoIndex = noIndexRoutes.some(route => path.startsWith(route));
  
  return shouldNoIndex ? "noindex, nofollow" : "index, follow";
};
