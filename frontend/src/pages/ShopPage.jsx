import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronDown, Heart, ShoppingCart } from "lucide-react";
import * as productService from "../services/productService";
import { formatCurrency } from "../utils/formatCurrency";

export function ShopPage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "createdAt");
  const [wishlist, setWishlist] = useState(new Set());

  const search = searchParams.get("search") || "";
  const limit = 24;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const params = {
          page,
          limit,
          sortBy,
          sortOrder: sortBy === "createdAt" ? "desc" : "asc",
        };

        if (search) {
          params.search = search;
        }

        const response = await productService.getPublicProducts(params);
        setProducts(response.data?.products || []);
        setTotalPages(response.data?.pages || 1);
      } catch (err) {
        setError("Failed to load products");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [search, page, sortBy]);

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const toggleWishlist = (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist((prev) => {
      const updated = new Set(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
      } else {
        updated.add(productId);
      }
      return updated;
    });
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {search ? `Search Results for "${search}"` : "Shop"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {products.length > 0
            ? `Showing ${products.length} product${products.length !== 1 ? "s" : ""}`
            : "No products found"}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters & Sorting */}
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="createdAt">Newest</option>
            <option value="price">Price: Low to High</option>
            <option value="name">Name (A-Z)</option>
            <option value="ratings.averageRating">Rating</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {products.map((product) => (
              <ProductCard 
                key={product._id} 
                product={product}
                isInWishlist={wishlist.has(product._id)}
                onToggleWishlist={toggleWishlist}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 2), Math.min(totalPages, page + 1))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-2 rounded-lg ${
                        page === p
                          ? "bg-blue-600 text-white"
                          : "border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-4">
            {search
              ? `No products found matching "${search}"`
              : "No products available"}
          </p>
          <Link
            to="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Production-grade marketplace product card with perfect alignment
 * Features:
 * - 4/5 aspect ratio images
 * - Compact premium layout
 * - Smart action buttons (wishlist, view, add to cart)
 * - Perfect alignment and spacing
 * - Hover effects for better UX
 */
function ProductCard({ product, isInWishlist, onToggleWishlist }) {
  const discountPercent = product.discountedPrice
    ? Math.round(((product.price - product.discountedPrice) / product.price) * 100)
    : 0;

  const finalPrice = product.discountedPrice || product.price;

  return (
    <Link
      to={`/product/${product._id}`}
      className="group flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden"
    >
      {/* Image Container with Discount Badge & Action Buttons */}
      <div className="relative w-full aspect-[4/5] bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
        {/* Product Image */}
        {product.images?.[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium">
            No image
          </div>
        )}

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-gradient-to-br from-red-500 to-orange-500 text-white px-2 py-1 rounded-md shadow-lg">
            <span className="text-xs font-bold">{discountPercent}% OFF</span>
          </div>
        )}

        {/* Premium Vertical Action Stack - Top Right Corner */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 sm:gap-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out">
          {/* Wishlist Button */}
          <button
            onClick={(e) => onToggleWishlist(e, product._id)}
            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-110 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all duration-200"
            title="Add to wishlist"
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={20}
              strokeWidth={1.5}
              className={`transition-all duration-300 ${
                isInWishlist
                  ? "fill-red-500 text-red-500"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            />
          </button>

          {/* Add to Cart Button */}
          <button
            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
            title="Add to cart"
            aria-label="Add to cart"
          >
            <ShoppingCart size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Product Info Section */}
      <div className="flex flex-col flex-grow p-3 sm:p-3.5 gap-2">
        {/* Product Name */}
        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 leading-tight">
          {product.name}
        </h3>

        {/* Category/Brand */}
        {product.category && (
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide line-clamp-1">
            {product.category}
          </p>
        )}

        {/* Spacer to push pricing to bottom */}
        <div className="flex-grow" />

        {/* Pricing Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {formatCurrency(finalPrice)}
            </span>
            {product.discountedPrice && (
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>

          {/* Rating */}
          {product.ratings?.averageRating ? (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-yellow-500">⭐</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {product.ratings.averageRating.toFixed(1)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Stock Status */}
        <div className="text-[11px] sm:text-xs">
          {product.stock > 0 ? (
            <span className="text-green-600 dark:text-green-400 font-medium">In Stock</span>
          ) : (
            <span className="text-red-600 dark:text-red-400 font-medium">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}
