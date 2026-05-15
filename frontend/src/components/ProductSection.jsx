import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import * as productService from "../services/productService";
import { formatCurrency } from "../utils/formatCurrency";

export function ProductSection({ title, icon, sortBy = "createdAt", limit = 8 }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await productService.getPublicProducts({
          limit,
          sortBy,
          sortOrder: sortBy === "createdAt" ? "desc" : "asc",
          page: 1,
        });
        setProducts(res.data.products);
      } catch (err) {
        setError("Failed to load products");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [sortBy, limit]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
        </div>
        <Link
          to={`/shop?sortBy=${sortBy}`}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm sm:text-base font-medium"
        >
          View All →
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 animate-pulse"
            >
              <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Products Grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">No products available</p>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }) {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discountPercent = product.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSubmitting(true);
    setIsInWishlist(!isInWishlist);
    setTimeout(() => setIsSubmitting(false), 300);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 300);
  };

  return (
    <Link
      to={`/product/${product._id}`}
      className="group flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden"
    >
      {/* Image Container with Actions */}
      <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
        {/* Product Image */}
        {product.images?.[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="h-full w-full object-cover object-center group-hover:scale-110 transition duration-300"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
            No Image
          </div>
        )}

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-gradient-to-br from-orange-500 to-red-500 text-white px-2 py-1 rounded-md shadow-lg">
            <span className="text-xs font-bold">{discountPercent}% OFF</span>
          </div>
        )}

        {/* Premium Vertical Action Stack - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out z-10">
          {/* Wishlist Button */}
          <button
            onClick={handleWishlist}
            disabled={isSubmitting}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60"
            title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={18}
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
            onClick={handleAddToCart}
            disabled={isSubmitting || product?.stock === 0}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Add to cart"
            aria-label="Add to cart"
          >
            <ShoppingCart size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Product Info Section */}
      <div className="flex flex-col flex-grow p-3 sm:p-4 gap-2">
        {/* Product Name */}
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
          {product.name}
        </h3>

        {/* Category */}
        <p className="text-xs text-slate-500 dark:text-slate-400">{product.category}</p>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Rating */}
        {product.ratings?.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-yellow-500">⭐</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {product.ratings.averageRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(product.discountPrice || product.price)}
          </span>
          {product.discountPrice && (
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-through">
              {formatCurrency(product.price)}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="text-xs font-medium">
          {product.stock > 0 ? (
            <span className="text-green-600 dark:text-green-400">In Stock</span>
          ) : (
            <span className="text-red-600 dark:text-red-400">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}
