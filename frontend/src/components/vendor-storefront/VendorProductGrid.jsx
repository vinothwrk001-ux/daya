import { Eye, GitCompare } from "lucide-react";
import { ProductCard } from "../ProductCard";

export function VendorProductGrid({ products = [], loading = false, emptyText = "No products found." }) {
  if (loading && !products.length) {
    return (
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 16 }).map((_, index) => (
          <div key={index} className="aspect-[4/6] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700">{emptyText}</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
      {products.map((product) => (
        <div key={product._id} className="group relative">
          <ProductCard product={product} imageAspectClass="aspect-[3/4]" />
          <div className="pointer-events-none absolute left-2 right-2 top-2 flex justify-between opacity-0 transition group-hover:opacity-100">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow" title="Quick view">
              <Eye className="h-4 w-4" />
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow" title="Compare">
              <GitCompare className="h-4 w-4" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
