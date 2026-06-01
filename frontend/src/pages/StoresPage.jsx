import { logger } from "../services/logger/logger.js";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Image, Search, Share2, ShieldCheck, ShoppingBag, Star, Users } from "lucide-react";
import * as vendorService from "../services/vendorService";
import { FollowStoreButton, VisitStoreButton } from "../components/seller/SellerNavigation";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function formatCompact(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
}

export function StoresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "followers");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterVerified, setFilterVerified] = useState(searchParams.get("verified") === "true");

  useEffect(() => {
    let alive = true;

    async function loadStores() {
      try {
        setLoading(true);
        const response = await vendorService.getAllVendors({ limit: 1000 });
        const vendorsData = Array.isArray(response) ? response : response?.data || [];
        if (alive) setStores(vendorsData);
      } catch (error) {
        logger.error("Failed to load stores:", { error: error });
        if (alive) setStores([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadStores();
    return () => {
      alive = false;
    };
  }, []);

  const filteredStores = useMemo(() => {
    let filtered = stores;

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((store) =>
        [store.shopName, store.companyName, store.vendorName, store.storeDescription]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }

    if (filterVerified) {
      filtered = filtered.filter((store) => store.verified || store.status === "approved");
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "followers":
          return Number(b.followersCount || 0) - Number(a.followersCount || 0);
        case "rating":
          return Number(b.rating || b.ratings?.averageRating || 0) - Number(a.rating || a.ratings?.averageRating || 0);
        case "products":
          return Number(b.productsCount || 0) - Number(a.productsCount || 0);
        case "name": {
          const nameA = a.shopName || a.companyName || a.vendorName || "";
          const nameB = b.shopName || b.companyName || b.vendorName || "";
          return nameA.localeCompare(nameB);
        }
        default:
          return 0;
      }
    });
  }, [stores, searchTerm, filterVerified, sortBy]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sortBy) params.set("sortBy", sortBy);
    if (searchTerm) params.set("search", searchTerm);
    if (filterVerified) params.set("verified", "true");
    setSearchParams(params);
  }, [sortBy, searchTerm, filterVerified, setSearchParams]);

  async function shareStore(store) {
    if (!store?.storeSlug) return;
    const storeName = store.shopName || store.companyName || store.vendorName || "Store";
    const url = `${window.location.origin}/vendor/${store.storeSlug}`;
    if (navigator.share) {
      await navigator.share({ title: storeName, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full px-3 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Stores</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Browse and follow verified sellers with top ratings and products</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search stores by name..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={filterVerified} onChange={(event) => setFilterVerified(event.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Verified only</span>
                </label>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="followers">Sort by followers</option>
                    <option value="rating">Sort by rating</option>
                    <option value="products">Sort by products</option>
                    <option value="name">Sort by name</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
              ))}
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
              <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">No stores found</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredStores.map((store) => {
                const storeName = store.shopName || store.companyName || store.vendorName || "Store";
                const logo = resolveApiAssetUrl(store.logoUrl || "");
                const rating = Number(store.rating || store.ratings?.averageRating || 0);
                const totalReviews = Number(store.totalReviews || store.ratings?.totalReviews || 0);
                const followers = Number(store.followersCount || 0);
                const products = Number(store.productsCount || 0);
                const isVerified = store.verified || store.status === "approved";
                const storeUrl = store.storeSlug ? `/vendor/${store.storeSlug}` : "";
                const previews = Array.isArray(store.previewProducts) ? store.previewProducts.slice(0, 4) : [];

                return (
                  <article key={store._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <Link to={storeUrl || "#"} className="grid grid-cols-4 gap-1 bg-slate-100 p-1 dark:bg-slate-800" aria-label={`Open ${storeName}`}>
                      {Array.from({ length: 4 }).map((_, index) => {
                        const product = previews[index];
                        const image = resolveApiAssetUrl(product?.imageUrl || "");
                        return (
                          <div key={product?._id || index} className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700">
                            {image ? (
                              <img src={image} alt={product?.name || ""} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Image className="h-5 w-5 text-slate-400" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Link>

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        <Link to={storeUrl || "#"} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                          {logo ? <img src={logo} alt={`${storeName} logo`} className="h-full w-full object-contain p-1.5" /> : <ShoppingBag className="h-8 w-8 text-slate-400" />}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={storeUrl || "#"} className="truncate text-base font-semibold text-slate-950 hover:underline dark:text-white sm:text-lg">
                              {storeName}
                            </Link>
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <ShieldCheck className="h-3.5 w-3.5" /> Verified
                              </span>
                            ) : null}
                          </div>
                          {store.storeDescription ? <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{store.storeDescription}</p> : null}

                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <span className="flex items-center gap-1.5">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{rating ? rating.toFixed(1) : "New"}</span>
                              {totalReviews ? <span className="text-slate-500">({totalReviews})</span> : null}
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              {formatCompact(followers)} followers
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <ShoppingBag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              {products} products
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <VisitStoreButton seller={store} variant="primary" children="View Store" className="w-full" />
                        <FollowStoreButton seller={store} className="w-full" />
                        <button
                          type="button"
                          onClick={() => shareStore(store)}
                          disabled={!store.storeSlug}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading ? (
            <div className="text-center text-sm text-slate-600 dark:text-slate-400">
              Showing {filteredStores.length} of {stores.length} stores
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
