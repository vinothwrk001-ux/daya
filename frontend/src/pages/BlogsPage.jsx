import { Construction } from "lucide-react";
import { SEO } from "../components/SEO";

export function BlogsPage() {
  return (
    <>
      <SEO 
        title="Our Blog | Daya Creatives" 
        description="We're currently working on exciting new content. Check back soon for the latest updates, tips, and stories!"
        url="/blogs"
      />
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 rounded-full bg-brand-primary/10 p-4 text-brand-primary">
          <Construction className="h-12 w-12" />
        </div>
        <h1 className="mb-3 text-3xl font-bold text-slate-900 dark:text-white">Our Blog</h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">
          We're currently working on exciting new content. Check back soon for the latest updates, tips, and stories!
        </p>
      </div>
    </>
  );
}
