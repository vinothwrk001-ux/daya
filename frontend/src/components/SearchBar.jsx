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
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="Search product"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.trim().length > 0 && setShowResults(true)}
          className="w-full rounded-full bg-gray-100 py-3 pl-6 pr-16 text-sm text-slate-900 outline-none transition duration-300 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-300"
        />
        <button
          type="button"
          onClick={() => {
            if (searchQuery.trim()) {
              // Optionally redirect to search results or trigger search
            }
          }}
          className="absolute right-1.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition hover:bg-gray-900"
        >
          <Search className="h-5 w-5" />
        </button>
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
