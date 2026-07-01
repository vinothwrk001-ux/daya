import { lazy, Suspense, useEffect, useState } from "react";
import { motion as Motion } from "framer-motion";
import { ServicePremiumCard } from "../components/services/ServicePremiumCard";
import { SERVICES_CONTENT, SERVICES_SEO } from "../data/servicesContent";

const ServiceEnquiryModal = lazy(async () => {
  const module = await import("../components/services/ServiceEnquiryModal");
  return { default: module.ServiceEnquiryModal };
});

function applyServicesSeo() {
  if (typeof document === "undefined") return;

  document.title = SERVICES_SEO.title;

  const setMeta = (selector, attrs) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      document.head.appendChild(el);
    } else if (attrs.content) {
      el.setAttribute("content", attrs.content);
    }
  };

  setMeta('meta[name="description"]', { name: "description", content: SERVICES_SEO.description });
}

export function ServicesPage() {
  const [selectedService, setSelectedService] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    applyServicesSeo();
  }, []);

  function openService(service) {
    setSelectedService(service);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedService(null);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-0 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-[-5%] top-32 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(15,23,42,0.02))]" />
      </div>

      <section className="relative border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center lg:px-8 lg:py-20">
          <Motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex rounded-full border border-indigo-200/80 bg-indigo-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
              Our Services
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Digital Solutions &{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 bg-clip-text text-transparent">
                Creative Learning
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
              Transform your ideas into reality through professional web development, hands-on workshops, and
              industry-focused graphic design training.
            </p>
          </Motion.div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {SERVICES_CONTENT.map((service, index) => (
            <ServicePremiumCard key={service.id} service={service} index={index} onSelect={openService} />
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <ServiceEnquiryModal service={selectedService} open={modalOpen} onClose={closeModal} />
      </Suspense>
    </div>
  );
}
