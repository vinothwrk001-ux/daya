import { ArrowUpRight, Send } from "lucide-react";
import { useBranding } from "../context/BrandingContext";

const fallbackFooter = {
  enabled: true,
  theme: "dark",
  backgroundColor: "#0f172a",
  textColor: "#e2e8f0",
  linkColor: "#60a5fa",
  sections: [
    {
      title: "About",
      description: "Modern marketplace identity, brand story, and press updates.",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Our Story", href: "/our-story" },
        { label: "Careers", href: "/careers" },
        { label: "Press", href: "/press" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Customer Service",
      description: "Support for orders, returns, shipping, and refunds.",
      links: [
        { label: "Help Center", href: "/help-center" },
        { label: "Track Order", href: "/track-order" },
        { label: "Returns", href: "/returns" },
        { label: "Refund Policy", href: "/refund-policy" },
        { label: "Shipping Policy", href: "/shipping-policy" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      title: "Shop",
      description: "Browse categories, brands, and the latest deals.",
      links: [
        { label: "Categories", href: "/categories" },
        { label: "Brands", href: "/brands" },
        { label: "Deals", href: "/deals" },
        { label: "New Arrivals", href: "/new-arrivals" },
        { label: "Best Sellers", href: "/best-sellers" },
      ],
    },
    {
      title: "Vendors",
      description: "Seller resources, policies, and partner onboarding.",
      links: [
        { label: "Become a Seller", href: "/become-a-seller" },
        { label: "Seller Dashboard", href: "/seller-dashboard" },
        { label: "Vendor Directory", href: "/vendor-directory" },
        { label: "Seller Policies", href: "/seller-policies" },
      ],
    },
    {
      title: "Legal",
      description: "Terms, privacy, cookie, and disclaimer policies.",
      links: [
        { label: "Terms & Conditions", href: "/terms-and-conditions" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Cookies Policy", href: "/cookies-policy" },
        { label: "Disclaimer", href: "/disclaimer" },
      ],
    },
  ],
  socialLinks: [
    { label: "Facebook", href: "https://facebook.com" },
    { label: "Instagram", href: "https://instagram.com" },
    { label: "YouTube", href: "https://youtube.com" },
    { label: "LinkedIn", href: "https://linkedin.com" },
    { label: "Twitter/X", href: "https://twitter.com" },
  ],
  legalLinks: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms-and-conditions" },
    { label: "Cookies Policy", href: "/cookies-policy" },
    { label: "Disclaimer", href: "/disclaimer" },
  ],
  paymentIcons: ["Visa", "MasterCard", "UPI", "PayPal", "Stripe"],
};

function isExternalLink(href = "") {
  return /^https?:\/\//i.test(href);
}

export function Footer() {
  const year = new Date().getFullYear();
  const { branding } = useBranding();
  const footer = branding?.footer || fallbackFooter;
  if (footer.enabled === false) return null;

  const sections = footer.sections?.filter((section) => section?.title || section?.description || (section.links || []).some((link) => link?.label || link?.href)) || fallbackFooter.sections;
  const socialLinks = footer.socialLinks?.filter((link) => link?.label || link?.href) || fallbackFooter.socialLinks;
  const legalLinks = footer.legalLinks?.filter((link) => link?.label || link?.href) || fallbackFooter.legalLinks;
  const paymentIcons = footer.paymentIcons || fallbackFooter.paymentIcons;
  const companyName = branding?.companyName || "UChooseMe";
  const supportEmail = branding?.supportEmail || "support@uchooseme.com";
  const supportPhone = branding?.supportPhone || "";

  const containerStyle = {
    backgroundColor: footer.backgroundColor || fallbackFooter.backgroundColor,
    color: footer.textColor || fallbackFooter.textColor,
  };

  const linkStyle = {
    color: footer.linkColor || fallbackFooter.linkColor,
  };

  const bodyClasses = footer.theme === "light" ? "bg-white text-slate-950" : "bg-slate-950 text-slate-200";
  const sectionHeadingClass = footer.theme === "light" ? "text-slate-900" : "text-slate-100";
  const sectionTextClass = footer.theme === "light" ? "text-slate-600" : "text-slate-300";

  return (
    <footer className="relative mt-12 overflow-hidden border-t border-white/10" style={containerStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_24%)]" />
      <div className={`relative w-full px-3 py-12 sm:px-4 lg:px-8 lg:py-16 ${bodyClasses}`}>
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
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Contact support
                <ArrowUpRight className="h-4 w-4" />
              </a>
              {supportPhone ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <Send className="h-4 w-4 text-orange-300" />
                  {supportPhone}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {sections.map((group, index) => (
              <div key={index}>
                <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${sectionHeadingClass}`}>{group.title || "Information"}</h3>
                <p className={`mt-2 text-sm leading-6 ${sectionTextClass}`}>{group.description}</p>
                <div className="mt-4 space-y-3">
                  {(group.links || []).filter((link) => link?.label || link?.href).map((link, linkIndex) => (
                    <a
                      key={`${index}-${linkIndex}`}
                      href={link.href || "#"}
                      target={isExternalLink(link.href) ? "_blank" : undefined}
                      rel={isExternalLink(link.href) ? "noreferrer" : undefined}
                      style={linkStyle}
                      className="block text-sm transition hover:underline"
                    >
                      <span>{link.label || link.href}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${sectionHeadingClass}`}>Connect with us</h3>
                <p className={`mt-2 text-sm leading-6 ${sectionTextClass}`}>Follow our social channels for updates, offers, and news.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {socialLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.href || "#"}
                      target={isExternalLink(link.href) ? "_blank" : undefined}
                      rel={isExternalLink(link.href) ? "noreferrer" : undefined}
                      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
                      style={linkStyle}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <h3 className={`text-sm font-semibold uppercase tracking-[0.24em] ${sectionHeadingClass}`}>Newsletter</h3>
                <p className={`mt-2 text-sm leading-6 ${sectionTextClass}`}>Enter your email to receive product updates and offers.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    aria-label="Email address"
                    placeholder="Enter your email"
                    className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-white/40 focus:ring-2 focus:ring-white/10"
                  />
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-center">
            <div>
              <div className="text-sm" style={{ color: footer.textColor || fallbackFooter.textColor }}>
                {footer.copyrightText || `© ${year} ${companyName}. All Rights Reserved.`}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
                {(legalLinks || []).map((link, index) => (
                  <a
                    key={index}
                    href={link.href || "#"}
                    target={isExternalLink(link.href) ? "_blank" : undefined}
                    rel={isExternalLink(link.href) ? "noreferrer" : undefined}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-2 transition hover:bg-white/20"
                    style={linkStyle}
                  >
                    {link.label || link.href}
                  </a>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-100">
                <div className="font-semibold text-white">Payment Methods</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
                  {paymentIcons.map((icon, index) => (
                    <span key={index} className="rounded-full bg-white/10 px-3 py-1">
                      {icon}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-100">
                <div className="font-semibold text-white">Connect</div>
                <div className="mt-3 space-y-2 text-xs text-slate-200">
                  <div>{supportEmail}</div>
                  {supportPhone ? <div>{supportPhone}</div> : null}
                </div>
              </div>
            </div>
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
