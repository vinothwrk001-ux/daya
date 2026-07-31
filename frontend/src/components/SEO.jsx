import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getAbsoluteUrl, getAbsoluteImageUrl, getFallbackDescription } from '../utils/seo';

export const SEO = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  robots = 'index,follow',
  breadcrumbs = null,
  jsonLd = null,
  siteName = 'Daya Creatives',
  author = 'Daya Creatives',
}) => {
  const absoluteUrl = getAbsoluteUrl(url || window.location.pathname);
  const absoluteImage = getAbsoluteImageUrl(image);
  const safeDescription = getFallbackDescription(description);

  // Default Breadcrumb JSON-LD if breadcrumbs array is provided
  let breadcrumbJsonLd = null;
  if (breadcrumbs && breadcrumbs.length > 0) {
    breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url ? getAbsoluteUrl(crumb.url) : absoluteUrl,
      })),
    };
  }

  return (
    <Helmet>
      {/* Standard SEO Tags */}
      <title>{title}</title>
      <meta name="description" content={safeDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={robots} />
      <meta name="author" content={author} />
      <link rel="canonical" href={absoluteUrl} />
      
      {/* Viewport and Language (Usually in index.html, but good to reinforce) */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <html lang="en" />

      {/* Open Graph Tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:url" content={absoluteUrl} />

      {/* JSON-LD Structured Data */}
      {breadcrumbJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      )}
      
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};
