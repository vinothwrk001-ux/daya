export const generateOrganizationSchema = ({ companyName = "Daya Creatives", url = "https://dayacreatives.com", logoUrl = "https://dayacreatives.com/favicon.png" }) => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": companyName,
    "url": url,
    "logo": logoUrl,
    "description": "Daya Creatives is a premium fashion, web development, and creative solutions studio.",
    "email": "dayastudios08@gmail.com",
    "founder": {
      "@type": "Person",
      "name": "Daya"
    },
    "sameAs": [
      "https://www.instagram.com/daya.creatives/",
      "https://www.instagram.com/daya_clothings/",
      "https://facebook.com/dayacreatives",
      "https://linkedin.com/company/dayacreatives",
      "https://twitter.com/dayacreatives"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-91505 16461",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": "en"
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "upstairs of pr bakes, near 1c bus stand, V.N.R.Nagar, Vadavalli, Coimbatore, Tamil Nadu 641041",
      "addressLocality": "Coimbatore",
      "addressRegion": "Tamil Nadu",
      "postalCode": "641041",
      "addressCountry": "IN"
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday"
        ],
        "opens": "09:00",
        "closes": "18:00"
      }
    ]
  };
};

export const generateWebSiteSchema = ({ url = "https://dayacreatives.com", siteName = "Daya Creatives" }) => {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteName,
    "url": url,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${url}/shop?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
};

export const generateProductSchema = ({ product, activeVariant, url, pricing, stock, media, relatedProducts = [] }) => {
  if (!product) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": media?.map(m => m.url) || [],
    "description": product.shortDescription || product.description,
    "sku": activeVariant?.sku || product.productNumber || product.SKU || product._id,
    "category": product.category,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Daya Creatives"
    },
    "offers": {
      "@type": "Offer",
      "url": url,
      "priceCurrency": "INR",
      "price": pricing?.salePrice || product.price,
      "availability": stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    ...(product?.ratings?.averageRating ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.ratings.averageRating,
        "reviewCount": product.ratings.totalReviews || 1
      }
    } : {}),
    ...(relatedProducts?.length > 0 ? {
      "isSimilarTo": relatedProducts.map(rp => ({
        "@type": "Product",
        "name": rp.name,
        "url": `https://dayacreatives.com/product/${rp._id}`
      }))
    } : {})
  };
};

export const generateCollectionPageSchema = ({ categoryName, description, url }) => {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": categoryName,
    "description": description,
    "url": url
  };
};

export const generateServiceSchema = ({ serviceName = "Creative Solutions", description, providerName = "Daya Creatives", url, relatedServices = [] }) => {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": serviceName,
    "provider": {
      "@type": "Organization",
      "name": providerName
    },
    "description": description,
    "url": url,
    ...(relatedServices?.length > 0 ? {
      "isRelatedTo": relatedServices.map(rs => ({
        "@type": "Service",
        "name": rs.name,
        "url": rs.url
      }))
    } : {})
  };
};

export const generateBlogPostingSchema = ({ title, description, url, datePublished, dateModified, authorName = "Daya Creatives", image }) => {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description,
    "image": image ? [image] : [],
    "datePublished": datePublished || new Date().toISOString(),
    "dateModified": dateModified || datePublished || new Date().toISOString(),
    "author": {
      "@type": "Person",
      "name": authorName
    },
    "publisher": {
      "@type": "Organization",
      "name": "Daya Creatives",
      "logo": {
        "@type": "ImageObject",
        "url": "https://dayacreatives.com/favicon.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    }
  };
};

export const generatePersonSchema = ({ name, role, url }) => {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "jobTitle": role,
    "url": url,
    "worksFor": {
      "@type": "Organization",
      "name": "Daya Creatives"
    }
  };
};
