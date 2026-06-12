import { logger } from "../services/logger/logger.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import * as productService from "../services/productService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function SearchBar({ className = "" }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (searchQuery.trim().length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await productService.getPublicProducts({
          search: searchQuery.trim(),
          limit: 8,
        });
        setResults(response.data?.products || []);
        setShowResults(true);
      } catch (error) {
        logger.error("Search error:", { error: error });
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className={`group relative mx-auto w-full max-w-4xl ${className}`.trim()}>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition group-focus-within:text-brand-primary" aria-hidden="true">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search for curated essentials, trending drops, and more"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.trim().length > 0 && setShowResults(true)}
          className="w-full rounded-full border border-brand-secondary bg-white py-3.5 pl-11 pr-12 text-sm text-brand-textPrimary shadow-brandSm outline-none transition duration-300 placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-red-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-brand-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-[5.25rem] max-h-[28rem] overflow-y-auto rounded-brandLg border border-brand-border bg-white/95 p-2 shadow-brandLg backdrop-blur-xl">
          {loading && (
            <div className="p-4 text-center text-sm text-slate-500">
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && searchQuery.trim().length > 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              No products found
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {results.map((product) => (
                  <Link
                    key={product._id}
                    to={`/product/${product._id}`}
                    onClick={() => {
                      setSearchQuery("");
                      setResults([]);
                      setShowResults(false);
                    }}
                    className="flex min-h-14 items-center gap-3 rounded-brandMd p-3 transition hover:bg-red-50"
                  >
                    <div className="h-14 w-14 flex-none overflow-hidden rounded-brandMd border border-brand-border bg-brand-surfaceSecondary">
                      {product.images?.[0]?.url ? (
                        <img
                          src={resolveApiAssetUrl(product.images[0].url)}
                          alt={product.images?.[0]?.altText || product.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {product.name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                to={`/shop?search=${encodeURIComponent(searchQuery)}`}
                onClick={() => {
                  setSearchQuery("");
                  setResults([]);
                  setShowResults(false);
                }}
                className="enterprise-primary-button mt-2 block rounded-brandMd px-4 py-3 text-center text-sm font-semibold transition"
              >
                View all results
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
