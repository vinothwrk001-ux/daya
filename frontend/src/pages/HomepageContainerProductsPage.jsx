import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { getHomepageContainerProducts } from "../services/homepageContainerService";
import { SEO } from "../components/SEO/SEO";
import { generateCollectionPageSchema } from "../utils/seo/schema";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Failed to load container products";
}

export function HomepageContainerProductsPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [container, setContainer] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0 });

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getHomepageContainerProducts(slug, { page: 1, limit: 24 });
        if (!alive) return;
        setContainer(response?.data?.container || null);
        setProducts(response?.data?.products || []);
        setPagination(response?.data?.pagination || { total: 0 });
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <>
      {container && (
        <SEO
          title={container.title || "Collection"}
          description={[container.description, `Browse the ${container.title || "collection"} at Daya Creatives.`]}
          url={`/collections/${slug}`}
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Shop", url: "/shop" },
            { name: container.title || "Collection" }
          ]}
          jsonLd={generateCollectionPageSchema({
            categoryName: container.title || "Collection",
            description: container.description,
            url: `https://dayacreatives.com/collections/${slug}`
          })}
        />
      )}
    <div className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-4 lg:px-8">
      <div className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Dynamic container</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {container?.title || "Collection"}
            </h1>
            {container?.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {container.description}
              </p>
            ) : null}
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            Browse all products
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-96 animate-pulse rounded-[1.75rem] bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : products.length ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Showing {products.length} of {pagination.total} matched products.
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No products matched this container right now.
        </div>
      )}
    </div>
    </>
  );
}
