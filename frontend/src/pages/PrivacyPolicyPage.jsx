import { ShieldCheck, Info, FileText, Lock, Users, ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "../context/BrandingContext";
import { SEO } from "../components/SEO";

export function PrivacyPolicyPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "Daya Creatives";



  return (
    <>
      <SEO 
        title={`Privacy Policy | ${companyName}`}
        description={`Read the Privacy Policy for using ${companyName}.`}
        url="/privacy-policy"
      />
      <div className="relative min-h-screen overflow-hidden bg-slate-50 py-12 dark:bg-slate-950 sm:py-20">
      {/* Background gradients for premium feel */}
      <div className="pointer-events-none absolute left-0 top-[-10%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-[20%] h-[500px] w-[500px] translate-x-1/3 rounded-full bg-brand-accent/5 blur-[120px]" />

      <article className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 text-center sm:mb-16">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-brand-accent p-[2px] shadow-2xl shadow-brand-primary/20">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-white dark:bg-slate-950">
              <ShieldCheck className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-400 sm:text-5xl lg:text-6xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            {companyName} ("we," "our," or "us") is committed to protecting the privacy and security of our customers and website visitors. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website or engage with our services.
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          
          <PolicySection 
            icon={Info} 
            title="Information We Collect"
            content="We may collect personal information including your name, email address, phone number, billing information, and project-related details when you contact us, submit an enquiry, or place an order through our website."
          />

          <PolicySection 
            icon={FileText} 
            title="How We Use Your Information"
            content="The information collected is used to:"
          >
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Provide and manage our creative and digital services.",
                "Process secure online payments.",
                "Respond to enquiries and customer support requests.",
                "Improve our website, services, and user experience.",
                "Comply with applicable legal and regulatory requirements.",
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                  <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection 
            icon={Lock} 
            title="Payment Security"
            content="All online payments are securely processed through Razorpay. Daya Creatives does not collect or store your complete debit/credit card or banking credentials. Payment information is handled directly by Razorpay in accordance with its security standards and applicable regulations."
          />

          <PolicySection 
            icon={Users} 
            title="Information Sharing"
            content="We do not sell, rent, or trade your personal information. Information may be shared only with trusted service providers, payment partners, or government authorities where required by law."
          />

          <PolicySection 
            icon={ShieldCheck} 
            title="Data Security"
            content="We implement reasonable administrative, technical, and organizational measures to protect your personal information from unauthorized access, disclosure, alteration, or misuse."
          />

          <PolicySection 
            icon={Info} 
            title="Policy Updates"
            content="Daya Creatives reserves the right to modify this Privacy Policy at any time. Any updates will be published on this page with the revised effective date."
          />

        </div>

        <div className="mt-12 overflow-hidden rounded-[2.5rem] bg-slate-900 px-6 py-10 text-center shadow-2xl dark:bg-slate-900 sm:px-12 sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <Lock className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">Your Privacy Matters</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            By using our website, you acknowledge and agree to this Privacy Policy. If you have any questions or concerns about how we handle your data, please don't hesitate to reach out.
          </p>
        </div>
      </article>
    </div>
    </>
  );
}

function PolicySection({ icon: Icon, title, content, children }) {
  return (
    <section className="group relative overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-brandSm ring-1 ring-slate-100 transition-shadow duration-300 hover:shadow-brandMd dark:bg-slate-900 dark:ring-slate-800 sm:p-10">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-primary/5 blur-3xl transition-opacity duration-300 group-hover:bg-brand-primary/10" />
      
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex shrink-0 items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-7 w-7" strokeWidth={1.5} />
          </div>
        </div>
        
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
            {content}
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
