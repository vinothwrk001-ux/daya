import { useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ProductDetailsSkeleton } from "./ProductDetailsSkeleton";
import { isProductPath, scrollPageToTop, scrollToHash } from "../utils/scrollPageToTop";

/**
 * Resets scroll synchronously before route content paints.
 * For product routes, shows a viewport-filling skeleton until scroll is at 0
 * so the shared Layout footer never appears on first paint.
 */
export function RouteScrollManager() {
  const location = useLocation();
  const [visibleKey, setVisibleKey] = useState(location.key);
  const locationRef = useRef(location);

  locationRef.current = location;
  const isProductRoute = isProductPath(location.pathname);
  const isTransitioning = visibleKey !== location.key;

  useLayoutEffect(() => {
    const { hash } = locationRef.current;

    if (hash) {
      if (!scrollToHash(hash)) {
        scrollPageToTop();
      }
    } else {
      scrollPageToTop();
    }

    setVisibleKey(locationRef.current.key);
  }, [location.pathname, location.hash, location.key]);

  if (isProductRoute && isTransitioning) {
    return <ProductDetailsSkeleton />;
  }

  return <Outlet />;
}
