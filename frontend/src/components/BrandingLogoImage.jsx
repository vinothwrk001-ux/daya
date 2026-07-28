import { useState } from "react";
import { useBranding } from "../context/BrandingContext";
import { pickBrandingLogo } from "../utils/brandingLogo";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function BrandingLogoImage({
  context = "default",
  alt,
  className = "branding-logo-image",
  withHeroContrast = false,
}) {
  const { branding } = useBranding();
  const [error, setError] = useState(false);
  const logoUrl = pickBrandingLogo(branding, { context });
  const name = alt || branding?.companyName || "Logo";

  if (!logoUrl || error) {
    return <span className="text-xl font-bold tracking-[-0.03em]">{name === "Logo" ? "DayaCreatives" : name}</span>;
  }

  return (
    <img
      src={resolveApiAssetUrl(logoUrl)}
      alt={name}
      className={`${className}${withHeroContrast ? " branding-logo-image--hero-contrast" : ""}`.trim()}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      onError={() => setError(true)}
    />
  );
}
