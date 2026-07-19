import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useBranding } from "../context/BrandingContext";
import { pickBrandingLogo } from "../utils/brandingLogo";

export function BrandLogo({ className = "", imgClassName = "", showName = true, dark = false }) {
  const { branding } = useBranding();
  const logoUrl = dark
    ? pickBrandingLogo(branding, { context: "dark-header" })
    : pickBrandingLogo(branding, { context: "default" });
  const name = branding?.companyName || "DayaCreatives";

  if (logoUrl) {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
        <img
          src={resolveApiAssetUrl(logoUrl)}
          alt={name}
          className={imgClassName || "branding-logo-image"}
          loading="eager"
          decoding="async"
        />
        {showName ? <span className="text-sm font-semibold tracking-[-0.03em]">{name}</span> : null}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
        {name.charAt(0).toUpperCase()}
      </span>
      {showName ? <span className="text-sm font-semibold tracking-[-0.03em]">{name}</span> : null}
    </div>
  );
}
