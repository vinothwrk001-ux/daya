import { useEffect, useState } from "react";
import {
  Headphones,
  LockKeyhole,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { motion as Motion } from "framer-motion";
import { MotionItem, MotionStagger, AnimatedSection } from "../components/home/AnimatedSection";
import { ReelFeed } from "../components/reel/ReelFeed";
import { DynamicHomepageRenderer } from "../components/homepage/DynamicHomepageRenderer";
import { getHomepageContainers } from "../services/homepageContainerService";
import { getHomepageBuilderPublicLayout } from "../services/homepageBuilderService";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";

const trustItems = [
  {
    icon: Truck,
    title: "Fast & secure delivery",
    detail: "Priority fulfillment, protected packaging, and reliable tracking from checkout to doorstep.",
  },
  {
    icon: Headphones,
    title: "Dedicated support",
    detail: "Human-first support for product questions, order help, and post-purchase confidence.",
  },
  {
    icon: ShieldCheck,
    title: "Verified sellers",
    detail: "Curated vendors and transparent storefront quality standards across every category.",
  },
  {
    icon: LockKeyhole,
    title: "Secure payment",
    detail: "Protected transactions and a frictionless checkout experience tuned for trust.",
  },
];

export function HomePage() {
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productContainers, setProductContainers] = useState([]);
  const [builderLayout, setBuilderLayout] = useState(null);
  const [device, setDevice] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth < 768) return "mobile";
    if (window.innerWidth < 1200) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    function handleResize() {
      const nextDevice = window.innerWidth < 768 ? "mobile" : window.innerWidth < 1200 ? "tablet" : "desktop";
      setDevice((current) => (current === nextDevice ? current : nextDevice));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const builderRes = await getHomepageBuilderPublicLayout({
          device,
        });

        if (cancelled) return;

        if (builderRes?.data?.layout && Array.isArray(builderRes?.data?.rows) && builderRes.data.rows.length) {
          setBuilderLayout(builderRes.data);
          setProductContainers([]);
        } else {
          const containersRes = await getHomepageContainers({
            device,
          });

          if (cancelled) return;

          setBuilderLayout(null);
          setProductContainers(Array.isArray(containersRes?.data) ? containersRes.data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || "Failed to load storefront");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [device]);

  return (
    <div className="w-full space-y-0 lg:space-y-0">
      {builderLayout?.layout ? (
        <DynamicHomepageRenderer rows={builderLayout.rows || []} containers={builderLayout.containers || []} loading={loading} bareCarouselShell device={device} />
      ) : (
        <>
      <AnimatedSection className="relative w-full px-3 py-8 sm:px-4 lg:px-8 lg:py-10" y={24}>
        <TrustSection />
      </AnimatedSection>

      {!commerceLoading && influencerCommerceEnabled ? (
        <AnimatedSection className="w-full px-3 py-8 sm:px-4 lg:px-8 lg:py-10" y={28}>
          <ReelFeed />
        </AnimatedSection>
      ) : null}

      {error ? (
        <div className="w-full px-3 py-8 sm:px-4 lg:px-8 lg:py-10">
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        </div>
      ) : null}

      <DynamicHomepageRenderer containers={productContainers} loading={loading} bareCarouselShell />
        </>
      )}
    </div>
  );
}

function TrustSection() {
  return (
    <MotionStagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" once>
      {trustItems.map((item) => {
        const Icon = item.icon;
        return (
          <MotionItem key={item.title}>
            <Motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              className="rounded-[1.75rem] border border-white/60 bg-white/72 p-5 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </p>
                </div>
              </div>
            </Motion.div>
          </MotionItem>
        );
      })}
    </MotionStagger>
  );
}

