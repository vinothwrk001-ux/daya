import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const PlatformFeaturesContext = createContext({
  loading: true,
  influencerCommerceEnabled: true,
  reload: async () => {},
});

export function PlatformFeaturesProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [influencerCommerceEnabled, setInfluencerCommerceEnabled] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/public/features");
      const enabled = res?.data?.data?.influencerCommerceEnabled;
      setInfluencerCommerceEnabled(enabled !== false);
    } catch {
      setInfluencerCommerceEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const value = useMemo(
    () => ({
      loading,
      influencerCommerceEnabled,
      reload,
    }),
    [loading, influencerCommerceEnabled, reload]
  );

  return <PlatformFeaturesContext.Provider value={value}>{children}</PlatformFeaturesContext.Provider>;
}

export function usePlatformFeatures() {
  return useContext(PlatformFeaturesContext);
}
