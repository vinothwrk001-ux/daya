import { memo } from "react";
import { ArrowRight } from "lucide-react";
import { MotionItem, MotionStagger } from "./home/AnimatedSection";

function CategoryCarouselComponent({
  categories: categoriesProp,
  onSelect,
  title = "Categories",
  loading = false,
}) {
  const categories = Array.isArray(categoriesProp) ? categoriesProp.filter(Boolean) : [];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-gray-50 via-white to-slate-100 p-5 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.22)] sm:p-6 lg:p-8 dark:border-white/10 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-800/80">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(165,180,252,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(221,214,254,0.32),transparent_34%)]" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500/90">
            Curated discovery
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-gray-900 dark:text-white lg:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Browse thoughtfully grouped categories with a calmer visual system, stronger hierarchy, and refined micro-interactions.
          </p>
        </div>

        {!loading && categories.length > 0 ? (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-500 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
            {categories.length} categories
          </div>
        ) : null}
      </div>

      <MotionStagger
        once
        stagger={0.06}
        className="relative mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6"
      >
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[162px] animate-pulse rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-md dark:border-white/10 dark:bg-slate-900/60"
              />
            ))
          : categories.map((category) => (
              <MotionItem key={category.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(category)}
                  className="group relative flex h-full min-h-[162px] w-full cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 p-5 text-center shadow-md backdrop-blur-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl active:scale-95 dark:border-white/10 dark:bg-slate-900/60"
                >
                  <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-90 ${category.color}`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_44%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]" />

                  <span className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all duration-300 ease-in-out group-hover:scale-110 ${category.logo ? "" : `bg-gradient-to-br ${category.iconBg}`}`}>
                    <CategoryIcon Icon={category.IconComponent} />
                  </span>

                  <div className="relative space-y-2">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                      {category.name}
                    </h3>
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-all duration-300 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300">
                      Explore
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              </MotionItem>
            ))}

        {!loading && categories.length === 0 ? (
          <div className="col-span-full flex min-h-[162px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            No categories available
          </div>
        ) : null}
      </MotionStagger>
    </section>
  );
}

function CategoryIcon({ Icon }) {
  if (!Icon) {
    return null;
  }

  // Try to render the component to check what type it is
  try {
    const sample = <Icon className="h-5 w-5 text-indigo-700 dark:text-indigo-200" />;
    
    // Check if it's an img element (has type 'img')
    if (sample?.type === "img") {
      // For images, render without the className that's meant for SVG icons
      return <Icon className="h-full w-full" />;
    }
    
    if (sample?.type === "span") {
      return <span className="text-lg leading-none">{sample}</span>;
    }

    // For SVG icons, wrap in SVG
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-indigo-700 dark:text-indigo-200" aria-hidden="true">
        {sample}
      </svg>
    );
  } catch {
    // Fallback: just render the icon
    return <Icon className="h-5 w-5 text-indigo-700 dark:text-indigo-200" />;
  }
}

export const CategoryCarousel = memo(CategoryCarouselComponent);
