import { useEffect, useState } from "react";
import { DynamicHomepageRenderer } from "../components/homepage/DynamicHomepageRenderer";
import { getHomepageBuilderPublicLayout } from "../services/homepageBuilderService";

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [builderLayout, setBuilderLayout] = useState(null);
  const [device, setDevice] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth < 768) return "mobile";
    if (window.innerWidth < 1200) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    function handleResize() {
      const nextDevice = window.innerWidth < 768 ? "mobile" : window.innerWidth < 1200 ? "tablet" : "desktop";
      setDevice((current) => (current === nextDevice ? current : nextDevice));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await getHomepageBuilderPublicLayout({ device });
        if (cancelled) return;
        setBuilderLayout(response?.data || null);
      } catch (loadError) {
        if (!cancelled) {
          setBuilderLayout(null);
          setError(loadError?.response?.data?.message || "Failed to load storefront");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [device]);

  return (
    <div className="w-full">
      {error ? (
        <div className="w-full px-3 py-8 sm:px-4 lg:px-8 lg:py-10">
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        </div>
      ) : null}

      <DynamicHomepageRenderer
        rows={builderLayout?.rows || []}
        containers={builderLayout?.containers || []}
        loading={loading}
        bareOuterLayout
        bareCarouselShell
        device={device}
      />
    </div>
  );
}
