import { getCanonicalUrl } from "../utils/seo/canonical";
import { getFallbackDescription, formatTitle } from "../utils/seo/metadata";
import { getAbsoluteImageUrl } from "../utils/seo/social";
import { getRobotsDirective } from "../utils/seo/robots";
import { buildBreadcrumbSchema } from "../utils/seo/breadcrumbs";
import { generateKeywords } from "../utils/seo/keywords";

export const useSEO = ({
  title,
  description,
  keywords,
  image,
  url,
  type = "website",
  robots = null,
  breadcrumbs = null,
  jsonLd = null,
  siteName = "Daya Creatives",
  author = "Daya Creatives",
  themeColor = "#0f172a",
  twitterHandle = "@DayaCreatives"
}) => {
  const currentPath = url || (typeof window !== "undefined" ? window.location.pathname : "");
  
  const absoluteUrl = getCanonicalUrl(currentPath);
  const absoluteImage = getAbsoluteImageUrl(image);
  const safeDescription = getFallbackDescription(description);
  const safeTitle = formatTitle(title, siteName);
  const finalRobots = getRobotsDirective(currentPath, robots);
  const finalKeywords = generateKeywords(keywords);
  
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbs, absoluteUrl);
  
  return {
    title: safeTitle,
    description: safeDescription,
    keywords: finalKeywords,
    url: absoluteUrl,
    image: absoluteImage,
    type,
    robots: finalRobots,
    author,
    siteName,
    themeColor,
    twitterHandle,
    breadcrumbJsonLd,
    jsonLd,
  };
};
