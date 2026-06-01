import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { clickTracking } from "../services/influencerCommerceService";
import { saveTrackingContext } from "../utils/influencerTracking";

export function AffiliateRedirectPage() {
  const navigate = useNavigate();
  const { trackingCode, productId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let alive = true;

    async function prepareAffiliateContext() {
      const trackingToken = searchParams.get("trackingToken") || "";
      const anonymousId = searchParams.get("anonymousId") || "";
      const reelId = searchParams.get("reel") || "";
      if (trackingToken) {
        saveTrackingContext({
          trackingToken,
          anonymousId,
          reelId,
          productId,
          trackingCode,
        });
      } else if (trackingCode && productId) {
        try {
          const existingAnonymousId = typeof window !== "undefined" ? window.localStorage.getItem("anonInfluencerId") || "" : "";
          const response = await clickTracking({
            trackingCode,
            productId,
            anonymousId: existingAnonymousId,
            surface: "affiliate_link",
          });
          const payload = response?.data || response || {};
          if (payload.anonymousId && typeof window !== "undefined") window.localStorage.setItem("anonInfluencerId", payload.anonymousId);
          if (payload.trackingToken) {
            saveTrackingContext({
              trackingToken: payload.trackingToken,
              anonymousId: payload.anonymousId,
              productId,
              trackingCode,
            });
          }
        } catch {
          // Product still opens if attribution preparation fails.
        }
      }

      const nextParams = new URLSearchParams();
      if (reelId) nextParams.set("reel", reelId);
      const suffix = nextParams.toString() ? `?${nextParams.toString()}` : "";
      if (alive) navigate(`/product/${productId}${suffix}`, { replace: true });
    }

    prepareAffiliateContext();
    return () => {
      alive = false;
    };
  }, [navigate, productId, searchParams, trackingCode]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
      <div>
        <p className="text-sm font-bold text-slate-500">Opening affiliate product...</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Loading product</h1>
      </div>
    </div>
  );
}
