export const getFallbackDescription = (descriptions, maxLength = 160) => {
  // Convert to array and find the first non-empty description
  const descArray = Array.isArray(descriptions) ? descriptions : [descriptions];
  const validDesc = descArray.find(d => d && String(d).trim().length > 0) 
    || "Discover premium fashion, creative services, workshops, web development, and graphic design at Daya Creatives.";
  
  const stripped = String(validDesc).replace(/(<([^>]+)>)/gi, "").trim();
  
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength - 3).trim() + "...";
};

export const formatTitle = (title, siteName = "Daya Creatives") => {
  let finalTitle = siteName;
  
  if (title) {
    finalTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  }
  
  if (finalTitle.length <= 60) return finalTitle;
  
  // Truncate to 57 chars and add "..."
  return finalTitle.substring(0, 57).trim() + "...";
};
