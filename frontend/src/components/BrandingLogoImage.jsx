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
  const logoUrl = pickBrandingLogo(branding, { context });
  const name = alt || branding?.companyName || "Logo";

  if (!logoUrl) return null;

  return (
    <img
      src={resolveApiAssetUrl(logoUrl)}
      alt={name}
      className={`${className}${withHeroContrast ? " branding-logo-image--hero-contrast" : ""}`.trim()}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  );
}
