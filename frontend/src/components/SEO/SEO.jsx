import React from "react";
import { Helmet } from "react-helmet-async";
import { useSEO } from "../../hooks/useSEO";


export const SEO = (props) => {
  const seoData = useSEO(props);

  // Normalize jsonLd: ensure it's always an array for consistent rendering
  const jsonLdItems = Array.isArray(seoData.jsonLd)
    ? seoData.jsonLd.filter(Boolean)
    : seoData.jsonLd ? [seoData.jsonLd] : [];

  return (
    <Helmet>
      {/* Standard SEO Tags */}
      <title>{seoData.title}</title>
      <meta name="description" content={seoData.description} />
      {seoData.keywords && <meta name="keywords" content={seoData.keywords} />}
      <meta name="robots" content={seoData.robots} />
      <meta name="author" content={seoData.author} />
      <meta name="theme-color" content={seoData.themeColor} />
      <link rel="canonical" href={seoData.url} />
      

      {/* Open Graph Tags */}
      <meta property="og:type" content={seoData.type} />
      <meta property="og:title" content={seoData.title} />
      <meta property="og:description" content={seoData.description} />
      <meta property="og:image" content={seoData.image} />
      <meta property="og:url" content={seoData.url} />
      <meta property="og:site_name" content={seoData.siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoData.title} />
      <meta name="twitter:description" content={seoData.description} />
      <meta name="twitter:image" content={seoData.image} />
      <meta name="twitter:url" content={seoData.url} />
      <meta name="twitter:site" content={seoData.twitterHandle} />
      <meta name="twitter:creator" content={seoData.twitterHandle} />

      {/* JSON-LD Structured Data — Breadcrumbs */}
      {seoData.breadcrumbJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(seoData.breadcrumbJsonLd)}
        </script>
      )}

      {/* JSON-LD Structured Data — Page-specific schemas */}
      {jsonLdItems.map((schema, index) => (
        <script key={`jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};
