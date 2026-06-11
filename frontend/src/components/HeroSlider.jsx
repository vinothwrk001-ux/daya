import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { RippleButton } from "./home/RippleButton";

const fallbackSlides = [
  {
    id: "elevated-tech",
    eyebrow: "Spring launch",
    title: "Elevate your everyday with premium picks and curated arrivals.",
    description:
      "From fast-moving essentials to statement upgrades, discover products designed to feel exceptional from first click to delivery.",
    accent: "Up to 40% off",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=80",
    gradient: "from-indigo-950/90 via-indigo-900/55 to-fuchsia-500/30",
  },
  {
    id: "home-edit",
    eyebrow: "Editor picks",
    title: "Design-led essentials for home, work, and the moments between.",
    description:
      "A polished storefront for modern shoppers with refined details, trusted delivery, and seamless browsing across every device.",
    accent: "Curated collections",
    image:
      "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1600&q=80",
    gradient: "from-slate-950/90 via-slate-900/55 to-orange-500/25",
  },
  {
    id: "fashion-drop",
    eyebrow: "Limited drop",
    title: "Modern style, expressive color, and the freshest new-season edits.",
    description:
      "Explore bold categories, interactive product discovery, and a premium shopping flow tuned for speed and clarity.",
    accent: "New arrivals daily",
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1600&q=80",
    gradient: "from-violet-950/90 via-violet-900/55 to-pink-500/30",
  },
];

export function HeroSlider({ slides = fallbackSlides }) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const normalizedSlides = useMemo(() => (slides?.length ? slides : fallbackSlides), [slides]);

  useEffect(() => {
    if (prefersReducedMotion || normalizedSlides.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % normalizedSlides.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [normalizedSlides.length, prefersReducedMotion]);

  const activeSlide = normalizedSlides[currentIndex];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-slate-950 shadow-[0_40px_120px_-55px_rgba(79,70,229,0.6)] ring-1 ring-slate-900/5 dark:border-white/10">
      <div className="absolute inset-0">
        <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
      </div>

      <div className="relative min-h-[540px] sm:min-h-[580px] lg:min-h-[620px]">
        <AnimatePresence mode="wait">
          <Motion.div
            key={activeSlide.id}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <img
              src={activeSlide.image}
              alt={activeSlide.title}
              className="h-full w-full object-cover"
              loading={currentIndex === 0 ? "eager" : "lazy"}
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${activeSlide.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_32%)]" />
          </Motion.div>
        </AnimatePresence>

        <div className="relative z-[1] flex h-full min-h-[540px] flex-col justify-between p-6 sm:p-8 lg:min-h-[620px] lg:p-12">
          <div className="flex items-start justify-between gap-4">
            <Motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/80 backdrop-blur-md"
            >
              <Sparkles className="h-4 w-4 text-orange-300" />
              {activeSlide.eyebrow}
            </Motion.div>

            <div className="hidden items-center gap-2 lg:flex">
              <SliderNavButton onClick={() => setCurrentIndex((currentIndex - 1 + normalizedSlides.length) % normalizedSlides.length)}>
                <ChevronLeft className="h-4 w-4" />
              </SliderNavButton>
              <SliderNavButton onClick={() => setCurrentIndex((currentIndex + 1) % normalizedSlides.length)}>
                <ChevronRight className="h-4 w-4" />
              </SliderNavButton>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_340px] lg:items-end">
            <div className="max-w-3xl">
              <Motion.span
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="inline-block rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-medium text-orange-100/90 backdrop-blur"
              >
                {activeSlide.accent}
              </Motion.span>
              <Motion.h1
                initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18 }}
                className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl"
              >
                {activeSlide.title}
              </Motion.h1>
              <Motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.28 }}
                className="mt-5 max-w-2xl text-sm leading-7 text-white/72 sm:text-base lg:text-lg"
              >
                {activeSlide.description}
              </Motion.p>

              <Motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.36 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <RippleButton
                  onClick={() => navigate("/shop")}
                  className="rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_-20px_rgba(129,140,248,0.85)] transition hover:shadow-[0_24px_60px_-20px_rgba(129,140,248,0.95)]"
                >
                  <span className="inline-flex items-center gap-2">
                    Shop collection
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </RippleButton>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Track order
                </Link>
              </Motion.div>
            </div>

            <Motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.24 }}
              className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/10 p-4 backdrop-blur-xl"
            >
              <StatCard label="Orders fulfilled" value="12k+" />
              <StatCard label="Support response" value="< 3 min" />
              <StatCard label="Average rating" value="4.9/5" />
            </Motion.div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {normalizedSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === currentIndex ? "w-10 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <SliderNavButton onClick={() => setCurrentIndex((currentIndex - 1 + normalizedSlides.length) % normalizedSlides.length)}>
                <ChevronLeft className="h-4 w-4" />
              </SliderNavButton>
              <SliderNavButton onClick={() => setCurrentIndex((currentIndex + 1) % normalizedSlides.length)}>
                <ChevronRight className="h-4 w-4" />
              </SliderNavButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderNavButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/15 active:scale-95"
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.22em] text-white/55">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">{value}</div>
    </div>
  );
}
