import { ArrowUpRight } from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import { BrandingLogoImage } from "./BrandingLogoImage";

const fallbackFooter = {
  enabled: true,
  sections: [
    {
      title: "About Us",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Our Store", href: "/store" },
        { label: "Our Story", href: "/our-story" },
      ],
    },
    {
      title: "Resource",
      links: [
        { label: "Privacy Policies", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms-conditions" },
        { label: "Returns & Refunds", href: "/return-policy" },
        { label: "FAQ’s", href: "/faq" },
        { label: "Shipping", href: "/shipping" },
      ],
    },
  ],
  socialLinks: [
    { label: "Facebook", href: "https://facebook.com" },
    { label: "Instagram", href: "https://instagram.com" },
    { label: "LinkedIn", href: "https://linkedin.com" },
    { label: "X", href: "https://twitter.com" },
  ],
  paymentIcons: ["AMEX", "Apple Pay", "DISCOVER", "G Pay", "Mastercard", "Shop", "UnionPay", "VISA"],
};

function isExternalLink(href = "") {
  return /^https?:\/\//i.test(href);
}

export function Footer() {
  const year = new Date().getFullYear();
  const { branding } = useBranding();
  const footer = branding?.footer || fallbackFooter;
  if (footer.enabled === false) return null;

  const sections = footer.sections || fallbackFooter.sections;
  const socialLinks = footer.socialLinks || fallbackFooter.socialLinks;
  const paymentIcons = footer.paymentIcons || fallbackFooter.paymentIcons;
  const supportEmail = branding?.supportEmail || "dayacreatives@gmail.com";
  const supportPhone = branding?.supportPhone || "(12) 3456 7890";
  const aboutLinks = sections[0]?.links || [];
  const resourceLinks = sections[1]?.links || [];
  const companyName = branding?.companyName || "DayaCreatives";

  const footerStyle = {
    backgroundColor: "#000000",
    backgroundImage:
      "repeating-linear-gradient(135deg, rgba(0,0,0,1), rgba(0,0,0,1) 40px, rgba(20,20,20,0.5) 40px, rgba(20,20,20,0.5) 80px)",
    color: "#ffffff",
  };

  const socialIconComponents = [SocialFacebook, SocialInstagram, SocialLinkedIn, SocialX];

  return (
    <footer className="relative border-t border-[#222] text-white" style={footerStyle}>
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <BrandingLogoImage
              alt={`${companyName} logo`}
              className="h-14 w-auto object-contain"
            />
            <div>
              {/* <p className="text-xs uppercase tracking-[0.28em] text-white/70">Daya</p> */}
              {/* <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Creatives</p> */}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {socialIconComponents.map((Icon, index) => (
              <a
                key={index}
                href={(socialLinks[index] && socialLinks[index].href) || "#"}
                target={isExternalLink(socialLinks[index]?.href) ? "_blank" : undefined}
                rel={isExternalLink(socialLinks[index]?.href) ? "noreferrer" : undefined}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:border-r md:border-white/10">
            <h3 className="text-base font-semibold uppercase tracking-[0.24em] text-white">Business Contact</h3>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm text-red-500">📍</span>
                <span>Vadavalli, Coimbatore</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm text-red-500">📞</span>
                <span>{supportPhone}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm text-red-500">✉️</span>
                <span>{supportEmail}</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-5">
              <h3 className="text-base font-semibold uppercase tracking-[0.24em] text-white">About Us</h3>
              <div className="grid gap-3 text-sm text-slate-300">
                {aboutLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href || "#"}
                    target={isExternalLink(link.href) ? "_blank" : undefined}
                    rel={isExternalLink(link.href) ? "noreferrer" : undefined}
                    className="transition hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <h3 className="text-base font-semibold uppercase tracking-[0.24em] text-white">Resource</h3>
              <div className="grid gap-3 text-sm text-slate-300">
                {resourceLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href || "#"}
                    target={isExternalLink(link.href) ? "_blank" : undefined}
                    rel={isExternalLink(link.href) ? "noreferrer" : undefined}
                    className="transition hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-[#222] pt-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-400">
              Copyright © {year} by <span className="text-red-500">dayacreatives</span>. All Rights Reserved.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {paymentIcons.map((icon, index) => (
                <span key={index} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  {icon}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function InlineLogo(props) {
  return (
    <svg viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="400" height="120" rx="8" fill="transparent" />
      <g transform="translate(8,8)">
        <circle cx="46" cy="46" r="40" fill="#e11d48" />
        <text x="46" y="56" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="42" fill="#fff" textAnchor="middle">D</text>
        <g transform="translate(100,20)">
          <text x="0" y="10" fontFamily="Arial, Helvetica, sans-serif" fontSize="10" fill="#cbd5e1" letterSpacing="2">DAYA</text>
          <text x="0" y="36" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="18" fill="#fff">CREATIVES</text>
        </g>
      </g>
    </svg>
  );
}

function SocialFacebook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M18 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h5v-7H9v-3h2V9.5c0-2 1.2-3.5 3.4-3.5.9 0 1.8.1 2 .1v2.4h-1.4c-1.1 0-1.3.5-1.3 1.3V11h2.6l-.4 3h-2.2V22h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Z" />
    </svg>
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
