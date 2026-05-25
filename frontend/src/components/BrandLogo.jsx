import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useBranding } from "../context/BrandingContext";

export function BrandLogo({ variant = "primary", className = "", imgClassName = "", showName = true, dark = false }) {
  const { branding } = useBranding();
  const logoKey = dark ? "dark" : variant;
  const logoUrl = branding?.logos?.[logoKey] || branding?.logos?.primary || "";
  const name = branding?.companyName || "UChooseMe";

  if (logoUrl) {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
        <img src={resolveApiAssetUrl(logoUrl)} alt={name} className={imgClassName || "h-10 w-auto object-contain"} />
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
