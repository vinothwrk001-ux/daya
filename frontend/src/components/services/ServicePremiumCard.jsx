import { memo } from "react";
import { motion as Motion } from "framer-motion";
import { ArrowUpRight, Code2, GraduationCap, Mail, Palette, Phone, Sparkles } from "lucide-react";

const ICONS = {
  "blue-violet": Code2,
  "orange-red": GraduationCap,
  "green-teal": Palette,
};

function ContactSnippet({ service }) {
  const contact = service.contact;
  if (!contact) return null;

  if (contact.type === "direct") {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Quick Contact</p>
        <div className="mt-2 space-y-1.5 text-xs text-white/90">
          <p className="flex items-center gap-2 truncate">
            <Mail className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="truncate">{contact.email}</span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            {contact.phone}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Contact</p>
      <p className="mt-1.5 text-sm font-bold text-white">{contact.organization}</p>
    </div>
  );
}

function ServicePremiumCardComponent({ service, index = 0, onSelect }) {
  const Icon = ICONS[service.theme] || Code2;

  return (
    <Motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.65, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -10 }}
      className="group relative h-full"
    >
      <div
        className={`absolute -inset-0.5 rounded-[1.85rem] bg-gradient-to-br ${service.gradient} opacity-0 blur-sm transition duration-500 group-hover:opacity-70`}
      />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] transition duration-500 group-hover:shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950">
        <div className={`relative overflow-hidden bg-gradient-to-br ${service.gradient} px-7 pb-8 pt-7 text-white`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_50%)]" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-start justify-between gap-3">
            <Motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-md"
            >
              <Icon className="h-8 w-8" strokeWidth={1.6} />
            </Motion.div>
            <span className="rounded-full border border-white/25 bg-black/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm">
              0{index + 1}
            </span>
          </div>

          <h3 className="relative mt-6 text-2xl font-black tracking-tight">{service.title}</h3>
          <p className="relative mt-3 text-sm leading-7 text-white/90">{service.description}</p>

          <ContactSnippet service={service} />
        </div>

        <div className="flex flex-1 flex-col p-7">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            What you get
          </div>

          <ul className="grid flex-1 gap-2.5 sm:grid-cols-1">
            {service.features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition group-hover:border-slate-200 group-hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:group-hover:border-slate-700"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${service.gradient} text-[11px] font-black text-white shadow-sm`}>
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onSelect?.(service)}
            className={`group/btn relative mt-8 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r ${service.gradient} px-5 py-4 text-sm font-bold text-white shadow-lg transition hover:shadow-xl active:scale-[0.98]`}
          >
            <span className="absolute inset-0 translate-y-full bg-white/20 transition duration-300 group-hover/btn:translate-y-0" />
            <span className="relative">{service.ctaLabel}</span>
            <ArrowUpRight className="relative h-4 w-4 transition group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </Motion.article>
  );
}

export const ServicePremiumCard = memo(ServicePremiumCardComponent);
