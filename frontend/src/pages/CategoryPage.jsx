import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProductCard as PremiumProductCard } from "../components/ProductCard";
import { getCategoryBySlug, trackCategoryEvent } from "../services/categoryService";
import * as productService from "../services/productService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { categoryRedirectsToServices } from "../utils/categoryLinks";
import { SEO } from "../components/SEO/SEO";
import { generateCollectionPageSchema } from "../utils/seo/schema";

function getSessionId() {
  if (typeof window === "undefined") return "";
  const key = "category_session_id";
  let sessionId = window.sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  useEffect(() => {
    let cancelled = false;
    async function loadCategory() {
      setLoading(true);
      setError("");
      try {
        const data = await getCategoryBySlug(slug);
        if (cancelled) return;
        if (categoryRedirectsToServices(data)) {
          navigate("/services", { replace: true });
          return;
        }
        setCategory(data);
        trackCategoryEvent(data._id, { eventType: "view", sessionId: getSessionId() }).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          setCategory(null);
          setError(err?.response?.data?.message || "Category not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (slug) loadCategory();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  useEffect(() => {
    if (!category?._id) return undefined;
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      try {
        const response = await productService.getPublicProducts({
          categoryId: category._id,
          search,
          sortBy,
          sortOrder,
          page,
          limit: 12,
        });
        if (cancelled) return;
        const payload = response?.data || response;
        setProducts(payload?.products || payload?.items || []);
        setPagination(payload?.pagination || { total: 0, pages: 1 });
        trackCategoryEvent(category._id, { eventType: "product_view", sessionId: getSessionId() }).catch(() => {});
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [category?._id, page, search, sortBy, sortOrder]);

  const banner = useMemo(
    () => resolveApiAssetUrl(category?.banner_url || category?.bannerUrl || category?.thumbnail_url || category?.thumbnailUrl),
    [category]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900 dark:text-white">{error}</p>
        <Link to="/shop" className="mt-4 inline-block text-red-600 hover:underline">
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {category && (
        <SEO
          title={category.seoTitle || category.name}
          description={[category.seoDescription, category.description, `Browse ${category.name} products in our storefront.`]}
          keywords={{
            categoryName: category.name,
          }}
          url={`/category/${category.slug}`}
          type="website"
          image={banner}
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Shop", url: "/shop" },
            { name: category.name }
          ]}
          jsonLd={generateCollectionPageSchema({ categoryName: category.name, description: category.seoDescription || category.description, url: `https://dayacreatives.com/category/${category.slug}` })}
        />
      )}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {banner ? (
          <img src={banner} alt={category?.name || "Category"} className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        <div className="relative mx-auto max-w-7xl px-4 py-14 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-red-400">Category</p>
          <h1 className="mt-3 fluid-h1 text-white">{category?.name || "Loading..."}</h1>
          {category?.description ? (
            <p className="mt-4 max-w-2xl text-sm text-zinc-300 md:text-base">{category.description}</p>
          ) : null}
          <p className="mt-4 text-sm font-semibold text-zinc-400">
            {category?.productCount ?? pagination.total ?? 0} products
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set("search", event.target.value);
              else next.delete("search");
              next.set("page", "1");
              setSearchParams(next);
            }}
            placeholder="Search in this category..."
            className="w-full min-w-0 flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextSortOrder] = event.target.value.split(":");
              const next = new URLSearchParams(searchParams);
              next.set("sortBy", nextSortBy);
              next.set("sortOrder", nextSortOrder);
              setSearchParams(next);
            }}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="createdAt:desc">Newest</option>
            <option value="price:asc">Price: Low to High</option>
            <option value="price:desc">Price: High to Low</option>
            <option value="name:asc">Name A-Z</option>
          </select>
        </div>

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : null}

        {!loading && !products.length ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No products found in this category.
          </div>
        ) : null}

        <div className="product-grid">
          {products.map((product) => (
            <PremiumProductCard key={product._id} product={product} />
          ))}
        </div>

        {pagination.pages > 1 ? (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: pagination.pages }).map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("page", String(pageNumber));
                    setSearchParams(next);
                  }}
                  className={`h-10 min-w-10 rounded-full px-3 text-sm font-semibold ${
                    pageNumber === page
                      ? "bg-red-600 text-white"
                      : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
