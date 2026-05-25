import { useEffect } from "react";
import { useBranding } from "../context/BrandingContext";

export function LegalPageLayout({ title, description, sections = [] }) {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "UChooseMe";

  useEffect(() => {
    if (title) {
      document.title = `${title} | ${companyName}`;
    }
    return () => {
      document.title = companyName;
    };
  }, [companyName, title]);

  return (
    <article className="mx-auto max-w-4xl">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          {description}
        </p>
      </header>

      <div className="mt-6 grid gap-4">
        {sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              {section.heading}
            </h2>
            <div className="mt-3 grid gap-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {(section.body || []).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
