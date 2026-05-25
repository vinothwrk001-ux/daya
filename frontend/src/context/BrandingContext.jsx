import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPublicBranding } from "../services/companyBrandingService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const BrandingContext = createContext({
  loading: true,
  branding: null,
  reload: async () => {},
});

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
}

function ensureHeadLink(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function ensureMeta(name, content) {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function applyBrandingToDocument(branding) {
  if (typeof document === "undefined" || !branding) return;
  const apiBaseUrl = getApiBaseUrl();
  const faviconUrl = branding?.logos?.favicon ? resolveApiAssetUrl(branding.logos.favicon) : "";
  const companyName = branding?.companyName || "UChooseMe";
  const themeColor = branding?.brandColors?.primaryColor || "#0f172a";
  document.title = companyName;
  if (faviconUrl) {
    ensureHeadLink('link[rel="icon"]', { rel: "icon", href: faviconUrl });
    ensureHeadLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: faviconUrl });
  }
  ensureHeadLink('link[rel="manifest"]', {
    rel: "manifest",
    href: `${apiBaseUrl}/api/public/branding/manifest.webmanifest`,
    crossorigin: "use-credentials",
  });
  ensureMeta("theme-color", themeColor);
}

export function BrandingProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const nextBranding = await getPublicBranding();
      setBranding(nextBranding);
      applyBrandingToDocument(nextBranding);
    } catch {
      const fallback = {
        companyName: "UChooseMe",
        supportEmail: "support@uchooseme.com",
        supportPhone: "+91 00000 00000",
        websiteUrl: "https://www.uchooseme.com",
        logos: {},
        brandColors: {
          primaryColor: "#0f172a",
          secondaryColor: "#1e293b",
          accentColor: "#f97316",
          successColor: "#16a34a",
          warningColor: "#f59e0b",
          dangerColor: "#dc2626",
        },
      };
      setBranding(fallback);
      applyBrandingToDocument(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    const handleUpdate = () => {
      reload().catch(() => {});
    };
    window.addEventListener("branding:updated", handleUpdate);
    return () => window.removeEventListener("branding:updated", handleUpdate);
  }, [reload]);

  const value = useMemo(() => ({ loading, branding, reload }), [branding, loading, reload]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
