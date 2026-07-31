export const generateKeywords = (keywordContext) => {
  if (typeof keywordContext === "string") return keywordContext;
  if (!keywordContext || typeof keywordContext !== "object") return "";

  const {
    productName,
    categoryName,
    brand = "Daya Creatives",
    businessType = "Creative Services",
    location = "Coimbatore"
  } = keywordContext;

  const keywords = [productName, categoryName, brand, businessType, location];
  
  // Filter out falsy values, trim, and deduplicate
  const uniqueKeywords = [...new Set(keywords.filter(Boolean).map(k => String(k).trim()))];
  
  return uniqueKeywords.join(", ");
};
