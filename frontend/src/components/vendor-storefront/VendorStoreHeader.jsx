import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Edit3, Image, LockKeyhole, RotateCcw, Share2, ShieldCheck, Star, Truck } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../context/authStore";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { followVendorStore, unfollowVendorStore } from "../../services/vendorStorefrontService";
import { getVendorMe } from "../../services/vendorService";

const numberFormatter = new Intl.NumberFormat("en-IN");
const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCount(value, compact = false) {
  const number = Number(value || 0);
  return compact ? compactFormatter.format(number) : numberFormatter.format(number);
}

export function VendorStoreHeader({ vendor, isFollowing, onFollowChange }) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  const [isOwnStore, setIsOwnStore] = useState(false);
  const banner = resolveApiAssetUrl(vendor?.bannerUrl);
  const logo = resolveApiAssetUrl(vendor?.logoUrl);
  const shippingMode = String(vendor?.shippingSettings?.defaultShippingMode || "").replace(/_/g, " ");
  const dynamicInfo = useMemo(() => {
    const items = [
      vendor?.vendorCode ? { icon: ShieldCheck, label: "Store ID", value: vendor.vendorCode } : null,
      vendor?.companyName && vendor.companyName !== vendor.vendorName ? { icon: Building2, label: "Company", value: vendor.companyName } : null,
      vendor?.defaultCourier ? { icon: Truck, label: "Courier", value: vendor.defaultCourier } : null,
      shippingMode ? { icon: Truck, label: "Shipping", value: shippingMode } : null,
    ];
    return items.filter(Boolean);
  }, [shippingMode, vendor]);

  useEffect(() => {
    let alive = true;

    if (!isAuthenticated || user?.role !== "vendor" || !vendor?.storeSlug) {
      setIsOwnStore(false);
      return () => {
        alive = false;
      };
    }

    getVendorMe()
      .then((response) => {
        const currentVendor = response?.data || response;
        if (!alive) return;
        setIsOwnStore(String(currentVendor?.storeSlug || "").toLowerCase() === String(vendor.storeSlug || "").toLowerCase());
      })
      .catch(() => {
        if (alive) setIsOwnStore(false);
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.role, vendor?.storeSlug]);

  async function toggleFollow() {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/vendor/${vendor.storeSlug}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const response = isFollowing
        ? await unfollowVendorStore(vendor.storeSlug)
        : await followVendorStore(vendor.storeSlug);
      onFollowChange?.(response.data);
    } finally {
      setBusy(false);
    }
  }

  async function shareStore() {
    const url = `${window.location.origin}/vendor/${vendor.storeSlug}`;
    if (navigator.share) {
      await navigator.share({ title: vendor.vendorName, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  const navClass = ({ isActive }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="relative h-36 overflow-hidden bg-slate-100 sm:h-44 lg:h-52 dark:bg-slate-900">
        {banner ? (
          <img src={banner} alt={`${vendor.vendorName} banner`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#e5e7eb_52%,#f1f5f9)] dark:bg-[linear-gradient(135deg,#0f172a,#1e293b_52%,#111827)]">
            <Image className="h-20 w-20 text-slate-300 dark:text-slate-700" strokeWidth={1.25} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
        <div className="flex flex-col gap-4 pt-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-white text-center shadow-sm ring-1 ring-slate-200 dark:border-slate-950 dark:bg-slate-900 dark:ring-slate-800 sm:h-28 sm:w-28">
              {logo ? (
                <img src={logo} alt={`${vendor.vendorName} logo`} className="h-full w-full object-contain p-2" />
              ) : (
                <div className="grid gap-1 text-slate-700 dark:text-slate-200">
                  <span className="text-xl font-semibold tracking-wide">{vendor.vendorName?.slice(0, 3) || "GRM"}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400">Store</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-950 dark:text-white sm:text-3xl">{vendor.vendorName}</h1>
                {vendor.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified Store
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                {vendor.storeDescription || "Premium Fashion & Textile Marketplace"}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 pr-4">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{Number(vendor.rating || 0).toFixed(1)}</span>
                  <span className="font-medium">({formatCount(vendor.totalReviews)} Reviews)</span>
                </span>
                <span className="border-l border-slate-200 px-4 dark:border-slate-800">{formatCount(vendor.followersCount, true)} Followers</span>
                <span className="border-l border-slate-200 px-4 dark:border-slate-800">{formatCount(vendor.productsCount)} Products</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <RotateCcw className="h-4 w-4" /> Easy Returns
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <Truck className="h-4 w-4" /> On-time Delivery
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <LockKeyhole className="h-4 w-4" /> Secure Payments
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3 lg:justify-end lg:pt-3">
            {isOwnStore ? (
              <Link
                to="/vendor/settings"
                className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                title="Edit this store profile"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </Link>
            ) : user?.role === "vendor" ? null : (
              <button
                type="button"
                onClick={toggleFollow}
                disabled={busy}
                className={`group inline-flex min-w-32 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60 ${
                  isFollowing ? "bg-slate-950 hover:bg-rose-600 dark:bg-white dark:text-slate-950 dark:hover:bg-rose-600 dark:hover:text-white" : "bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                }`}
              >
                {isFollowing ? (
                  <>
                    <span className="inline-flex items-center gap-1 group-hover:hidden">Following <Check className="h-4 w-4" /></span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                  </>
                ) : (
                  "Follow Store"
                )}
              </button>
            )}
            <button
              type="button"
              onClick={shareStore}
              className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Share profile"
              title="Share profile"
            >
              <Share2 className="h-4 w-4" />
              Share Profile
            </button>
          </div>
        </div>

        {dynamicInfo.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {dynamicInfo.map((item) => {
              const Icon = item.icon;
              return (
                <span key={`${item.label}-${item.value}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="shrink-0 text-slate-500 dark:text-slate-400">{item.label}:</span>
                  <span className="truncate">{item.value}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {vendor.storeCategories?.length ? (
          <div className={`${dynamicInfo.length ? "mt-3" : "mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"} flex flex-wrap gap-2`}>
            {vendor.storeCategories.map((category) => (
              <span key={category} className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {category}
              </span>
            ))}
          </div>
        ) : null}

        <nav className="mt-4 flex gap-2 overflow-x-auto border-t border-slate-100 pt-4 dark:border-slate-800">
          <NavLink to={`/vendor/${vendor.storeSlug}`} end className={navClass}>Store</NavLink>
          <NavLink to={`/vendor/${vendor.storeSlug}/products`} className={navClass}>Products</NavLink>
          <NavLink to={`/vendor/${vendor.storeSlug}/reviews`} className={navClass}>Reviews</NavLink>
          <NavLink to={`/vendor/${vendor.storeSlug}/followers`} className={navClass}>Followers</NavLink>
          <Link to="/cart" className="ml-auto hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 sm:block">
            Marketplace Cart
          </Link>
        </nav>
      </div>
    </header>
  );
}
