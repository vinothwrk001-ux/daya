import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Mail, Phone, X } from "lucide-react";

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  message: "",
};

function ContactPanel({ service }) {
  const contact = service?.contact;
  if (!contact) return null;

  if (contact.type === "direct") {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Contact Information</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-indigo-500" />
            <a href={`mailto:${contact.email}`} className="font-semibold hover:text-indigo-600">
              {contact.email}
            </a>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-indigo-500" />
            <a href={`tel:${contact.phone}`} className="font-semibold hover:text-indigo-600">
              {contact.phone}
            </a>
          </p>
          {contact.altPhone ? (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-indigo-500" />
              <a href={`tel:${contact.altPhone}`} className="font-semibold hover:text-indigo-600">
                {contact.altPhone}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Contact</p>
      <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{contact.organization}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{contact.message}</p>
    </div>
  );
}

function ServiceEnquiryModalContent({ service, open, onClose }) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (!open) setForm(defaultForm);
  }, [open, service?.id]);

  const mailtoHref = useMemo(() => {
    if (!service) return "#";
    const targetEmail =
      service.contact?.type === "direct"
        ? service.contact.email
        : "vinothkumarsubramanik@gmail.com";
    const subject = encodeURIComponent(`${service.title} Enquiry`);
    const body = encodeURIComponent(
      [
        `Service: ${service.title}`,
        `Name: ${form.name}`,
        `Phone: ${form.phone}`,
        `Email: ${form.email}`,
        "",
        form.message || "I would like to know more about this service.",
      ].join("\n")
    );
    return `mailto:${targetEmail}?subject=${subject}&body=${body}`;
  }, [form, service]);

  const callHref = useMemo(() => {
    if (service?.contact?.type === "direct" && service.contact.phone) {
      return `tel:${service.contact.phone}`;
    }
    return form.phone ? `tel:${form.phone.replace(/\s/g, "")}` : "tel:9025462326";
  }, [form.phone, service]);

  if (!service || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Motion.button
            type="button"
            aria-label="Close enquiry modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-md"
          />
          <Motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-x-4 top-[6dvh] z-[91] mx-auto max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-white shadow-2xl dark:bg-slate-950 md:inset-x-auto"
            role="dialog"
            aria-modal="true"
            aria-label={service.title}
          >
            <div className={`relative overflow-hidden rounded-t-[1.75rem] bg-gradient-to-br ${service.gradient} px-6 py-7 text-white`}>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-black/20 p-2 transition hover:bg-black/30"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">Service Enquiry</p>
              <h2 className="mt-2 pr-10 text-2xl font-black">{service.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/90">{service.description}</p>
            </div>

            <div className="space-y-5 p-6">
              <ContactPanel service={service} />

              {service.modalMessage ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {service.modalMessage}
                </p>
              ) : null}

              <div className="space-y-4 rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Your Details</p>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-indigo-500/0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Your full name"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Mobile number"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Message</span>
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Tell us about your requirements..."
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={callHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                >
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
                <a
                  href={mailtoHref}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${service.gradient} px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg`}
                >
                  <Mail className="h-4 w-4" />
                  Send Email
                </a>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </Motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

const LazyModal = lazy(async () => ({ default: ServiceEnquiryModalContent }));

export function ServiceEnquiryModal(props) {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <LazyModal {...props} />
    </Suspense>
  );
}
