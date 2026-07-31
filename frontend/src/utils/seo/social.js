import { getAbsoluteUrl } from "./urls";

export const getAbsoluteImageUrl = (url) => {
  if (!url) return getAbsoluteUrl("/assets/images/logo.png"); // Fallback logo
  if (url.startsWith("http")) return url;
  return getAbsoluteUrl(url);
};
