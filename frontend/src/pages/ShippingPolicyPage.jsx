import { Truck, Package, CreditCard, Navigation, AlertTriangle, MapPin, XOctagon, Phone, ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "../context/BrandingContext";
import { SEO } from "../components/SEO/SEO";

export function ShippingPolicyPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "Daya Creatives";



  return (
    <>
      <SEO 
        title={`Shipping Policy | ${companyName}`}
        description={`Read the Shipping Policy for using ${companyName}.`}
        url="/shipping-policy"
      />
      <div className="relative min-h-screen overflow-hidden bg-slate-50 py-12 dark:bg-slate-950 sm:py-20">
      {/* Background gradients for premium feel */}
      <div className="pointer-events-none absolute left-0 top-[-10%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-[20%] h-[500px] w-[500px] translate-x-1/3 rounded-full bg-brand-accent/5 blur-[120px]" />

      <article className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 text-center sm:mb-16">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-brand-accent p-[2px] shadow-2xl shadow-brand-primary/20">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-white dark:bg-slate-950">
              <Truck className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-400 sm:text-5xl lg:text-6xl">
            Shipping Policy
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            At <strong>{companyName}</strong>, we are committed to delivering your orders safely and efficiently. All physical product shipments are fulfilled through our trusted logistics partner, <strong>Shiprocket</strong>, which works with leading courier services across India.
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          
          <PolicySection 
            icon={Package} 
            title="Order Processing"
            content="We aim to dispatch your products as quickly as possible:"
          >
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <ArrowUpRight className="h-3 w-3" />
                </div>
                <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">Orders are processed within <strong>2–5 business days</strong> after successful payment confirmation.</span>
              </li>
              <li className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <ArrowUpRight className="h-3 w-3" />
                </div>
                <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">Custom-made or personalized products may require additional processing time, which will be communicated during order confirmation.</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection 
            icon={Truck} 
            title="Shipping & Delivery"
            content="Getting your order to you on time:"
          >
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <ArrowUpRight className="h-3 w-3" />
                </div>
                <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">Once your order has been dispatched through Shiprocket, you will receive a shipping confirmation along with a tracking ID via email or SMS (where applicable).</span>
              </li>
              <li className="flex items-start gap-3 rounded-2xl bg-slate-50/50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  <ArrowUpRight className="h-3 w-3" />
                </div>
                <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">Estimated delivery timelines are generally <strong>3–7 business days</strong>, depending on the destination, courier availability, and serviceability of the delivery location.</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection 
            icon={CreditCard} 
            title="Shipping Charges"
            content="Shipping charges, if applicable, will be calculated and displayed during the checkout process before payment is completed."
          />

          <PolicySection 
            icon={Navigation} 
            title="Order Tracking"
            content="Customers can track their shipment using the tracking link provided after dispatch. Delivery updates are managed through Shiprocket and its courier partners."
          />

          <PolicySection 
            icon={AlertTriangle} 
            title="Delivery Delays"
            content="While we strive to ensure timely deliveries, delays may occur due to unforeseen circumstances such as adverse weather conditions, public holidays, courier operational issues, natural disasters, or other factors beyond our control. Daya Creatives shall not be held liable for such delays."
          />

          <PolicySection 
            icon={MapPin} 
            title="Incorrect Shipping Information"
            content="Customers are responsible for providing accurate shipping details. Daya Creatives will not be responsible for delays or failed deliveries resulting from incorrect or incomplete address information provided during checkout."
          />

          <PolicySection 
            icon={XOctagon} 
            title="Damaged or Lost Shipments"
            content="If your order is received in a damaged condition or is lost during transit, please contact us within 48 hours of delivery or the expected delivery date. We will coordinate with Shiprocket and the respective courier partner to investigate and resolve the issue at the earliest."
          />
          
        </div>

        <div className="mt-12 overflow-hidden rounded-[2.5rem] bg-slate-900 px-6 py-10 text-center shadow-2xl dark:bg-slate-900 sm:px-12 sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <Phone className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">Need Assistance?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            For any shipping-related questions or assistance, please contact us through the contact details available on our website. Our support team will be happy to assist you.
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
