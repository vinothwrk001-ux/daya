import { useEffect, useState } from "react";
import { getHomepageBanners } from "../../services/homepageBannerService";

export function useHomepageBanners() {
  const [data, setData] = useState({ container: null, settings: {}, banners: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await getHomepageBanners();
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setData({ container: null, settings: {}, banners: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, hasManagedBanners: data.banners.length > 0 };
}
