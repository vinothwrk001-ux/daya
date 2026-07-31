import { ScrollText, Layers, CreditCard, Tag, Copyright, Clock, ShieldAlert, RefreshCw, Scale } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "../context/BrandingContext";
import { SEO } from "../components/SEO";

export function TermsAndConditionsPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "Daya Creatives";

  return (
    <>
      <SEO 
        title={`Terms & Conditions | ${companyName}`}
        description={`Read the Terms and Conditions for using ${companyName}.`}
        url="/terms-and-conditions"
      />
      <div className="relative min-h-screen overflow-hidden bg-slate-50 py-12 dark:bg-slate-950 sm:py-20">
      {/* Background gradients for premium feel */}
      <div className="pointer-events-none absolute left-0 top-[-10%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-[20%] h-[500px] w-[500px] translate-x-1/3 rounded-full bg-brand-accent/5 blur-[120px]" />

      <article className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 text-center sm:mb-16">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-brand-accent p-[2px] shadow-2xl shadow-brand-primary/20">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-white dark:bg-slate-950">
              <ScrollText className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-400 sm:text-5xl lg:text-6xl">
            Terms & Conditions
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            Welcome to <strong>{companyName}</strong>. By accessing or using our website and services, you agree to be bound by the following Terms & Conditions.
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          
          <PolicySection 
            icon={Layers} 
            title="Services"
            content="Daya Creatives provides creative solutions including, but not limited to, branding, graphic design, UI/UX design, website design, social media creatives, digital marketing, video production, print design, and related creative services."
          />

          <PolicySection 
            icon={CreditCard} 
            title="Orders & Payments"
            content="All orders are subject to acceptance and payment confirmation. Payments made through our website are securely processed via Razorpay. Work on projects may commence only after the applicable payment has been successfully received."
          />

          <PolicySection 
            icon={Tag} 
            title="Pricing"
            content="All prices displayed on the website are subject to change without prior notice. Any revised pricing will not affect confirmed orders unless mutually agreed upon."
          />

          <PolicySection 
            icon={Copyright} 
            title="Intellectual Property"
            content="Unless otherwise agreed in writing, all concepts, designs, graphics, website content, and creative assets produced by Daya Creatives remain our intellectual property until the agreed payment has been received in full. Unauthorized copying, reproduction, distribution, or commercial use is strictly prohibited."
          />

          <PolicySection 
            icon={Clock} 
            title="Project Delivery"
            content="Project timelines are estimates and may vary depending on project scope, client approvals, revisions, or unforeseen circumstances. Delays resulting from incomplete client information or delayed feedback may affect delivery schedules."
          />

          <PolicySection 
            icon={ShieldAlert} 
            title="Limitation of Liability"
            content="Daya Creatives shall not be liable for any indirect, incidental, consequential, or business losses arising from the use of our website or services."
          />

          <PolicySection 
            icon={RefreshCw} 
            title="Changes to Terms"
            content="We reserve the right to update these Terms & Conditions at any time. Continued use of our website constitutes acceptance of the latest version."
          />
          
        </div>

        <div className="mt-12 overflow-hidden rounded-[2.5rem] bg-slate-900 px-6 py-10 text-center shadow-2xl dark:bg-slate-900 sm:px-12 sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <Scale className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">Agreement</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            By using this website, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
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
