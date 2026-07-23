import { useLayoutEffect, useState } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { ProductDetailsSkeleton } from "./ProductDetailsSkeleton";
import { isProductPath, scrollPageToTop, scrollToHash } from "../utils/scrollPageToTop";

/**
 * Resets scroll synchronously before route content paints.
 * For product routes, shows a viewport-filling skeleton until scroll is at 0
 * so the shared Layout footer never appears on first paint.
 */
export function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [visibleKey, setVisibleKey] = useState(location.key);
  const isProductRoute = isProductPath(location.pathname);
  const isTransitioning = visibleKey !== location.key;

  useLayoutEffect(() => {
    const { hash, state } = location;

    // Do not force scroll to top if we are opening a background overlay (like reels modal)
    // or if we are navigating back/forward (POP) so we don't lose the user's scroll position.
    if (state?.background || navigationType === "POP") {
      setVisibleKey(location.key);
      return;
    }

    if (hash) {
      if (!scrollToHash(hash)) {
        scrollPageToTop();
      }
    } else {
      scrollPageToTop();
    }

    setVisibleKey(location.key);
  }, [location, navigationType]);

  if (isProductRoute && isTransitioning) {
    return <ProductDetailsSkeleton />;
  }

  return <Outlet />;
}
