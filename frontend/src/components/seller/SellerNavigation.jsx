import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ShieldCheck, Star, Store, Users } from "lucide-react";
import { useAuthStore } from "../../context/authStore";
import { followVendorStore, getVendorStorefront, getMyFollowedStores, trackVendorStoreEvent, unfollowVendorStore } from "../../services/vendorStorefrontService";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

export function normalizeSeller(source = {}) {
  const seller = source?.sellerId || source?.seller || source?.vendor || source;
  if (!seller) return null;
  const slug = seller.storeSlug || seller.slug || "";
  const name = seller.vendorName || seller.shopName || seller.companyName || seller.name || "";
  if (!name && !slug) return null;
  return {
    _id: seller._id || seller.sellerId || "",
    name: name || "Marketplace Store",
    storeSlug: slug,
    logoUrl: seller.logoUrl || "",
    verified: seller.verified ?? seller.status === "approved",
    rating: seller.rating ?? seller.ratings?.averageRating ?? 0,
    followersCount: seller.followersCount ?? 0,
    productsCount: seller.productsCount ?? 0,
    storeUrl: slug ? `/vendor/${slug}` : "",
  };
}

export function SellerBadge({ seller, compact = false }) {
  const normalized = normalizeSeller(seller);
  if (!normalized) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
      <Store className="h-3.5 w-3.5 text-blue-600" />
      <span className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>{normalized.name}</span>
      {normalized.verified ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Verified seller" /> : null}
    </span>
  );
}

export function SellerNameLink({ seller, className = "", showPrefix = true, preview = true }) {
  const normalized = normalizeSeller(seller);
  if (!normalized) return null;
  const content = (
    <span className={`group/seller relative inline-flex items-center gap-1.5 ${className}`}>
      {showPrefix ? <span className="text-slate-500 dark:text-slate-400">Sold By:</span> : null}
      {normalized.storeUrl ? (
        <Link
          to={normalized.storeUrl}
          onClick={(event) => {
            event.stopPropagation();
            trackVendorStoreEvent(normalized.storeSlug, { eventType: "STORE_CLICK", path: window.location.pathname }).catch(() => {});
          }}
          className="inline-flex items-center gap-1 font-semibold text-blue-700 underline-offset-4 transition hover:underline dark:text-blue-300"
        >
          <Store className="h-3.5 w-3.5" />
          {normalized.name}
          {normalized.verified ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : null}
        </Link>
      ) : (
        <SellerBadge seller={normalized} />
      )}
      {preview && normalized.storeSlug ? <SellerPreviewPopover seller={normalized} /> : null}
    </span>
  );
  return content;
}

export function VisitStoreButton({ seller, children = "View Profile", className = "", variant = "secondary" }) {
  const normalized = normalizeSeller(seller);
  if (!normalized?.storeUrl) return null;
  
  const baseStyles = "inline-flex items-center justify-center rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition";
  const variantStyles = variant === "primary" 
    ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
    : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";
  
  return (
    <Link
      to={normalized.storeUrl}
      onClick={(event) => {
        event.stopPropagation();
        trackVendorStoreEvent(normalized.storeSlug, { eventType: "STORE_CLICK", path: window.location.pathname }).catch(() => {});
      }}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </Link>
  );
}

export function StoreRatingDisplay({ seller, rating }) {
  const normalized = normalizeSeller(seller);
  const value = Number(rating ?? normalized?.rating ?? 0);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value ? value.toFixed(1) : "New"}
    </span>
  );
}

export function FollowStoreButton({ seller, initialFollowing = false, className = "" }) {
  const normalized = normalizeSeller(seller);
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load follow status when component mounts and user is logged in
  useEffect(() => {
    let active = true;

    async function loadFollowStatus() {
      if (!token || !normalized?.storeSlug) return;
      
      try {
        setLoading(true);
        const followedStores = await getMyFollowedStores({ limit: 1000 });
        const followedSlugs = Array.isArray(followedStores) 
          ? followedStores.map(s => (s.storeSlug || s.slug))
          : followedStores?.data?.map?.(s => (s.storeSlug || s.slug)) || [];
        
        if (active) {
          const isFollowing = followedSlugs.includes(normalized.storeSlug);
          setFollowing(isFollowing);
        }
      } catch (error) {
        console.error("Failed to load follow status:", error);
        if (active) {
          setFollowing(initialFollowing);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadFollowStatus();
    return () => {
      active = false;
    };
  }, [token, normalized?.storeSlug, initialFollowing]);

  // Update state when initialFollowing prop changes (for guest/public views)
  useEffect(() => {
    if (!token) {
      setFollowing(initialFollowing);
    }
  }, [initialFollowing, token]);

  if (!normalized?.storeSlug) return null;

  async function toggleFollow() {
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(`/vendor/${normalized.storeSlug}`)}`);
      return;
    }
    if (busy || loading) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowVendorStore(normalized.storeSlug);
        setFollowing(false);
      } else {
        await followVendorStore(normalized.storeSlug);
        setFollowing(true);
      }
      trackVendorStoreEvent(normalized.storeSlug, { eventType: following ? "UNFOLLOW" : "FOLLOW", path: window.location.pathname }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || loading}
      onClick={(event) => {
        event.stopPropagation();
        toggleFollow();
      }}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition disabled:opacity-60 ${
        following 
          ? "bg-slate-200 text-slate-900 hover:bg-rose-100 hover:text-rose-900 dark:bg-slate-700 dark:text-white dark:hover:bg-rose-600" 
          : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
      } ${className}`}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-1">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        </>
      ) : following ? (
        <>
          <span className="inline-flex items-center gap-1 group-hover:hidden">
            <Check className="h-4 w-4" /> Following
          </span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}

export function SellerCard({ seller, compact = false }) {
  const normalized = normalizeSeller(seller);
  if (!normalized) return null;
  const logo = resolveApiAssetUrl(normalized.logoUrl);
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {logo ? <img src={logo} alt={`${normalized.name} logo`} className="h-full w-full object-cover" /> : <Store className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <SellerNameLink seller={normalized} showPrefix={false} preview={false} className="text-xs sm:text-sm" />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <StoreRatingDisplay seller={normalized} />
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {normalized.followersCount || 0}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <VisitStoreButton seller={normalized} children="View Profile" variant="primary" className="w-full" />
        <FollowStoreButton seller={normalized} className="w-full" />
      </div>
    </div>
  );
}

export function SellerPreviewPopover({ seller }) {
  const normalized = normalizeSeller(seller);
  const [store, setStore] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const display = useMemo(() => normalizeSeller(store?.vendor || normalized), [store, normalized]);
  if (!normalized?.storeSlug) return null;

  function loadPreview() {
    if (loaded) return;
    setLoaded(true);
    getVendorStorefront(normalized.storeSlug)
      .then((response) => setStore(response.data))
      .catch(() => setStore(null));
  }

  const logo = resolveApiAssetUrl(display?.logoUrl);
  return (
    <span
      onMouseEnter={loadPreview}
      onFocus={loadPreview}
      className="pointer-events-none absolute left-0 top-full z-30 hidden w-72 pt-2 group-hover/seller:block group-focus-within/seller:block"
    >
      <span className="pointer-events-auto block rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <span className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-slate-400" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-bold text-slate-950 dark:text-white">
              {display?.name}
              {display?.verified ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : null}
            </span>
            <span className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <StoreRatingDisplay seller={display} />
              <span>{display?.followersCount || store?.vendor?.followersCount || 0} followers</span>
              <span>{display?.productsCount || store?.vendor?.productsCount || 0} products</span>
            </span>
          </span>
        </span>
        <span className="mt-3 flex gap-2">
          <VisitStoreButton seller={display} className="flex-1" />
          <FollowStoreButton seller={display} initialFollowing={Boolean(store?.isFollowing)} className="flex-1" />
        </span>
      </span>
    </span>
  );
}
