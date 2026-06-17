/**
 * Pick the best logo asset for a given surface.
 * Hero overlay uses dark/light logo when uploaded; never CSS-invert the primary logo.
 */
export function pickBrandingLogo(branding, { context = "default" } = {}) {
  const logos = branding?.logos || {};
  const primary = logos.primary || "";
  const dark = logos.dark || "";
  const mobile = logos.mobile || "";

  if (context === "hero-overlay") {
    if (dark && dark !== primary) return dark;
    return primary || dark || mobile;
  }

  if (context === "dark-header") {
    return dark || primary || mobile;
  }

  return primary || dark || mobile;
}

export function hasDedicatedHeroLogo(branding) {
  const logos = branding?.logos || {};
  return Boolean(logos.dark && logos.dark !== logos.primary);
}
