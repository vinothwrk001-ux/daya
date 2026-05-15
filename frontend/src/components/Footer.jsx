import { Link } from "react-router-dom";
import { ArrowUpRight, Send } from "lucide-react";

const footerGroups = [
  {
    title: "About us",
    links: [
      { label: "Our story", href: "/" },
      { label: "Why UChooseMe", href: "/role" },
      { label: "Track order", href: "/dashboard" },
    ],
  },
  {
    title: "Customer service",
    links: [
      { label: "Shipping policy", href: "/shipping-policy" },
      { label: "Return policy", href: "/return-policy" },
      { label: "Privacy policy", href: "/privacy-policy" },
    ],
  },
  {
    title: "Quick links",
    links: [
      { label: "Shop", href: "/shop" },
      { label: "Login", href: "/login" },
      { label: "Terms & conditions", href: "/terms-and-conditions" },
    ],
  },
];

const socials = [
  { label: "Instagram", href: "#", icon: SocialInstagram },
  { label: "X", href: "#", icon: SocialX },
  { label: "YouTube", href: "#", icon: SocialYouTube },
  { label: "LinkedIn", href: "#", icon: SocialLinkedIn },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 overflow-hidden border-t border-white/10 bg-slate-950 text-slate-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.25),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_24%)]" />
      <div className="relative w-full px-3 py-12 sm:px-4 lg:px-8 lg:py-16">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:p-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-200/80">
              Premium commerce
            </span>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.05em] text-white lg:text-4xl">
              Built for discovery, trusted by modern shoppers, and shaped for smooth conversion.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">
              A premium storefront experience with polished motion, thoughtful responsiveness, and scalable components that support growth.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="mailto:support@uchooseme.com"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Contact support
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <Send className="h-4 w-4 text-orange-300" />
                Coimbatore, Tamil Nadu
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {group.title}
                </h3>
                <div className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="group inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
                    >
                      <span>{link.label}</span>
                      <span className="h-px w-0 bg-current transition-all duration-300 group-hover:w-4" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="text-sm text-slate-400">
            © {year} UChooseMe. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            {socials.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialInstagram(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.75" />
      <circle cx="17.25" cy="6.75" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SocialX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 4 20 20" />
      <path d="M20 4 12.9 12.1 11 14l-7 6" />
      <path d="M9 4h11l-6.3 7.2" />
      <path d="M4 20h5.2l4.2-4.8" />
    </svg>
  );
}

function SocialYouTube(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M21 12.2c0 2.6-.3 4.3-.7 5.2a2.8 2.8 0 0 1-1.7 1.5c-1.2.4-3.6.6-6.6.6s-5.4-.2-6.6-.6a2.8 2.8 0 0 1-1.7-1.5C3.3 16.5 3 14.8 3 12.2s.3-4.3.7-5.2a2.8 2.8 0 0 1 1.7-1.5C6.6 5.1 9 4.9 12 4.9s5.4.2 6.6.6A2.8 2.8 0 0 1 20.3 7c.4.9.7 2.6.7 5.2Z" />
      <path fill="currentColor" stroke="none" d="m10 9 5 3-5 3V9Z" />
    </svg>
  );
}

function SocialLinkedIn(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 9v8" />
      <path d="M11 17v-4.5a2.5 2.5 0 1 1 5 0V17" />
      <circle cx="7" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    </svg>
  );
}
