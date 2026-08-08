import { Link } from "react-router-dom";
import { SEO } from "../components/SEO/SEO";

export function NotFoundPage() {
  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you're looking for doesn't exist or has been moved."
        robots="noindex, nofollow"
        url="/404"
      />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-8xl font-black text-slate-200 dark:text-slate-800 select-none">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Page Not Found
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Go Home
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Browse Shop
          </Link>
        </div>
      </div>
    </>
  );
}
