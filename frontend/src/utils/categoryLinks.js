export function categoryRedirectsToServices(category) {
  return Boolean(category?.redirectToServices || category?.redirect_to_services);
}

export function getCategoryHref(category) {
  if (categoryRedirectsToServices(category)) {
    return "/services";
  }
  if (category?.slug) {
    return `/category/${category.slug}`;
  }
  return "/shop";
}
