import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { saveTrackingContext } from "../utils/influencerTracking";

export function AffiliateRedirectPage() {
  const navigate = useNavigate();
  const { trackingCode, productId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
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
    }

    const nextParams = new URLSearchParams();
    if (reelId) nextParams.set("reel", reelId);
    const suffix = nextParams.toString() ? `?${nextParams.toString()}` : "";
    navigate(`/product/${productId}${suffix}`, { replace: true });
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
