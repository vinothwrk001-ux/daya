import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuthStore } from "../context/authStore";
import { useBranding } from "../context/BrandingContext";
import { BrandLogo } from "./BrandLogo";
import { BrandingLogoImage } from "./BrandingLogoImage";
import { SearchBar } from "./SearchBar";
import { HeaderShopActions } from "./HeaderShopActions";
import { UserMenu } from "./UserMenu";
import { hasDedicatedHeroLogo, pickBrandingLogo } from "../utils/brandingLogo";

const NAV_LINKS = [
  { label: "HOME", to: "/" },
  { label: "SHOP", to: "/shop" },
  { label: "SERVICES", to: "/services" },
  { label: "BLOGS", to: "#" },
];

/**
 * Hero overlay header with a balanced 3-column grid so the search bar
 * stays visually centered regardless of logo or action column widths.
 */
export function HeroHeader({ variant = "overlay" }) {
  const { branding } = useBranding();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);

  const isOverlay = variant === "overlay";
  const textClass = isOverlay ? "text-white hover:text-white/80" : "text-slate-900 hover:text-slate-700";
  const navClass = isOverlay ? "text-white hover:text-white/80" : "text-slate-900 hover:text-slate-700";
  const heroLogoUrl = pickBrandingLogo(branding, { context: isOverlay ? "hero-overlay" : "default" });
  const useHeroContrast = isOverlay && heroLogoUrl && !hasDedicatedHeroLogo(branding);

  return (
    <>
      <div className="hero-header-grid w-full">
        <div className="hero-header-grid__start flex min-w-0 items-center">
          <Link to="/" className="inline-flex shrink-0 transition hover:opacity-90" aria-label="Home">
            {heroLogoUrl ? (
              <BrandingLogoImage
                context={isOverlay ? "hero-overlay" : "default"}
                className="hero-header-logo"
                withHeroContrast={useHeroContrast}
              />
            ) : (
              <BrandLogo showName={false} className={textClass} imgClassName="hero-header-logo" />
            )}
          </Link>
        </div>

        <div className="hero-header-grid__center min-w-0">
          <SearchBar />
        </div>

        <div className="hero-header-grid__end flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <HeaderShopActions
            variant="inline"
            className={isOverlay ? "[&_a]:text-white [&_a]:hover:text-white/80" : ""}
          />
          {!authReady ? (
            <span className={`inline-block h-8 w-20 animate-pulse rounded-lg ${isOverlay ? "bg-white/20" : "bg-slate-200"}`} aria-hidden="true" />
          ) : user ? (
            <UserMenu variant={isOverlay ? "hero" : "default"} />
          ) : (
            <Link to="/login" className={`flex items-center gap-2 transition ${textClass}`}>
              <User className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden text-xs font-medium sm:inline sm:text-sm">Login</span>
            </Link>
          )}
        </div>
      </div>

      <nav className="mt-3 flex w-full justify-center sm:mt-4" aria-label="Primary">
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {NAV_LINKS.map((item) =>
            item.to.startsWith("/") ? (
              <Link key={item.label} to={item.to} className={`text-xs font-semibold transition sm:text-sm ${navClass}`}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.to} className={`text-xs font-semibold transition sm:text-sm ${navClass}`}>
                {item.label}
              </a>
            )
          )}
        </div>
      </nav>
    </>
  );
}
