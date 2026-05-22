import { ProductCarousel } from "./ProductCarousel";
import { ProductCard } from "./ProductCard";
import { formatCurrency } from "../utils/formatCurrency";

export function RecommendationSection({
  title,
  subtitle,
  items = [],
  mode = "carousel",
  bundleTotal = 0,
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  if (mode === "bundle") {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Bundle total: {formatCurrency(bundleTotal)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item._id} product={item} cardStyle="MINIMAL" imageAspectClass="aspect-[1/1]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <ProductCarousel
      title={title}
      subtitle={subtitle}
      items={items}
      desktopItemsPerView={4}
      tabletItemsPerView={2.5}
      mobileItemsPerView={1.15}
    />
  );
}
