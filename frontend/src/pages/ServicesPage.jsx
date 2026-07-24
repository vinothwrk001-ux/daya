import { useEffect } from "react";
import { 
  PenTool, Laptop, Map, Video, ArrowUpRight, Phone, Mail, MapPin, 
  Smartphone, Clapperboard, Layout, Shirt, Camera, Edit3 
} from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import { Link } from "react-router-dom";

export function ServicesPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "DayaCreatives";

  useEffect(() => {
    document.title = `Services | ${companyName}`;
    return () => {
      document.title = companyName;
    };
  }, [companyName]);

  const SERVICES_LIST = [
    {
      id: "brand-identity",
      icon: PenTool,
      title: "Brand Identity",
      desc: "Logo design, brand kits and visual identity that represent your brand perfectly.",
      deliverables: ["Premium Logo Design", "Brand Strategy", "Brand Guidelines", "Color Palette & Typography", "Business Cards", "Stationery Design", "Brand Assets", "Social Media Branding"]
    },
    {
      id: "graphic-design",
      icon: Edit3,
      title: "Graphic Design",
      desc: "Creative designs for print and digital that communicate your message effectively.",
      deliverables: ["Social Media Graphics", "Posters & Flyers", "Brochures & Menus", "Infographics", "Packaging Design", "Advertisement Creatives"]
    },
    {
      id: "social-media",
      icon: Smartphone,
      title: "Social Media Design",
      desc: "Engaging social media posts, stories and campaigns that increase engagement.",
      deliverables: ["Instagram Grids", "Story Templates", "Facebook Covers", "LinkedIn Graphics", "Ad Creatives", "Social Media Guidelines"]
    },
    {
      id: "video-editing",
      icon: Clapperboard,
      title: "Video Editing",
      desc: "Professional videos and reels that tell your story and captivate your audience.",
      deliverables: ["Instagram Reels", "YouTube Videos", "Promo Videos", "Color Grading", "Motion Graphics", "Video Transitions"]
    },
    {
      id: "website-design",
      icon: Layout,
      title: "Website Design",
      desc: "Modern, responsive websites designed for performance and user experience.",
      deliverables: ["Custom Web Design", "Landing Pages", "E-Commerce Sites", "Responsive Design", "Wireframing", "Web Maintenance"]
    },
    {
      id: "print-merch",
      icon: Shirt,
      title: "Print & Merchandise",
      desc: "T-shirt designs, packaging, stickers and print materials that leave an impression.",
      deliverables: ["T-Shirt Design", "Hoodies & Apparel", "Mug Designs", "Tote Bags", "Custom Stickers", "Event Merchandise"]
    },
    {
      id: "ui-ux",
      icon: Laptop,
      title: "UI/UX Design",
      desc: "User-centered UI/UX designs that create seamless digital experiences.",
      deliverables: ["User Research", "Wireframing", "Prototyping", "Mobile App UI", "Web App UI", "Usability Testing"]
    },
    {
      id: "photography",
      icon: Camera,
      title: "Photography",
      desc: "High-quality product and branding photography that elevates your brand.",
      deliverables: ["Product Photography", "Brand Lifestyle", "Event Coverage", "Corporate Headshots", "Photo Retouching", "Studio Setup"]
    }
  ];

  return (
    <div className="flex w-full flex-col items-center overflow-x-hidden">
      
      {/* 1. Header Section */}
      <section className="w-full bg-white px-6 pb-6 pt-2 text-center lg:pb-8 lg:pt-2">
        <h1 className="mb-2 text-3xl font-black uppercase tracking-widest text-[#c11c1d] sm:text-4xl md:text-5xl">
          SERVICES
        </h1>
        <p className="mx-auto max-w-2xl text-xs font-bold text-black sm:text-sm md:text-base">
          Creative Solutions That Build Brands, Inspire Audiences & Drive Results
        </p>
      </section>

      {/* 2. Marquee Section */}
      <section className="relative flex w-full overflow-hidden bg-[#c11c1d] py-4 sm:py-6">
        <div className="flex animate-marquee whitespace-nowrap text-white">
          <div className="flex shrink-0 items-center gap-12 px-6 text-3xl font-bold uppercase sm:text-4xl md:text-5xl lg:gap-24 lg:px-12">
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
          </div>
          {/* Duplicate for seamless looping */}
          <div className="flex shrink-0 items-center gap-12 px-6 text-3xl font-bold uppercase sm:text-4xl md:text-5xl lg:gap-24 lg:px-12">
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
            <span>DESIGN</span>
            <span>WEBSITE</span>
          </div>
        </div>
      </section>

      {/* 3. What We Do Section */}
      <section className="w-full bg-black px-6 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c11c1d]">
            WHAT WE DO
          </p>
          <h2 className="mb-16 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Services That Help<br />Your Brand Grow
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {SERVICES_LIST.map((service, i) => (
              <div 
                key={i} 
                className="group relative flex h-[240px] sm:h-auto sm:aspect-square w-full flex-col overflow-hidden rounded-2xl bg-[#111111] p-4 sm:p-6 text-left transition-all duration-300 hover:bg-[#1a1a1a]"
              >
                {/* Static Header part */}
                <div className="relative z-10">
                  <service.icon className="mb-3 h-6 w-6 text-[#c11c1d] sm:mb-5 sm:h-8 sm:w-8" />
                  <h3 className="mb-3 min-h-[40px] text-lg font-bold text-white leading-tight sm:mb-6 sm:min-h-[56px] sm:text-xl">
                    {service.title}
                  </h3>
                </div>

                {/* Main content wrapper with relative positioning for cross-fade */}
                <div className="relative flex-1">
                  
                  {/* Default State */}
                  <div className="absolute inset-0 flex flex-col justify-between transition-all duration-300 group-hover:-translate-y-4 group-hover:opacity-0 group-hover:pointer-events-none">
                    <p className="text-[11px] leading-relaxed text-slate-400 sm:text-[13px]">
                      {service.desc}
                    </p>
                    <div className="mt-auto flex items-end pb-1 sm:pb-2">
                      <ArrowUpRight className="h-4 w-4 text-[#c11c1d] sm:h-5 sm:w-5" />
                    </div>
                  </div>

                  {/* Hover State */}
                  <div className="absolute inset-0 flex flex-col translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                    <p className="mb-2 text-[10px] font-bold text-[#c11c1d] sm:mb-3 sm:text-xs">
                      What We Deliver:
                    </p>
                    <ul className="custom-scrollbar-thin flex-1 space-y-1 overflow-y-auto pr-1 pb-1 text-[10px] text-slate-300 sm:space-y-2 sm:text-[13px] sm:pr-2 sm:pb-2">
                      {service.deliverables.map((item, j) => (
                        <li key={j} className="flex items-start">
                          <span className="mr-1.5 text-[#c11c1d] sm:mr-2">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Portfolio Section */}
      <section className="w-full bg-black px-6 pb-8 pt-10 text-white sm:pb-20 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c11c1d]">
                OUR PORTFOLIO
              </p>
              <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
                Some Of Our Recent Work
              </h2>
            </div>
            <Link
              to="#"
              className="inline-flex items-center gap-2 rounded-lg border border-[#333] px-5 py-2.5 text-sm font-bold transition-colors hover:border-[#c11c1d] hover:text-[#c11c1d]"
            >
              View All Work <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="group flex flex-col bg-black p-2 sm:p-4 transition-colors hover:bg-[#111]">
                <div className="mb-2 sm:mb-4 aspect-square w-full rounded-lg sm:rounded-xl bg-[#1a1a1a] flex items-center justify-center text-[#444] overflow-hidden">
                   <div className="text-center font-black opacity-50 uppercase tracking-widest text-[9px] sm:text-base">
                     {i % 4 === 0 && "IKIGAI"}
                     {i % 4 === 1 && "Guided"}
                     {i % 4 === 2 && "Frame House"}
                     {i % 4 === 3 && "CK Tours"}
                   </div>
                </div>
                <h3 className="text-[10px] leading-tight sm:leading-normal sm:text-sm font-bold text-white uppercase">
                   {i % 4 === 0 && "IKIGAI"}
                   {i % 4 === 1 && "Guided Abroad"}
                   {i % 4 === 2 && "The Frame House Media"}
                   {i % 4 === 3 && "CK Tours & Travels"}
                </h3>
                <p className="text-[8px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">Brand Identity</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Contact Section */}
      <section className="w-full bg-black px-6 pt-8 pb-20 text-white sm:py-20 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 lg:grid-cols-2">
          
          <div className="flex flex-col">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c11c1d]">
              LET'S WORK TOGETHER
            </p>
            <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              Have a Project in Mind?
            </h2>
            <p className="mb-12 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
              Let's create something amazing together. Get in touch with us and let's bring your ideas to life.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Phone className="h-5 w-5 text-[#c11c1d]" />
                <span className="text-sm font-medium sm:text-base">+91 12345 67890</span>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="h-5 w-5 text-[#c11c1d]" />
                <span className="text-sm font-medium sm:text-base">hello@dayacreatives.com</span>
              </div>
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-[#c11c1d]" />
                <span className="text-sm font-medium sm:text-base">Coimbatore, Tamil Nadu, India</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111111] p-6 sm:p-8">
            <form className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="Your Name" 
                className="w-full rounded-lg border border-[#333] bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none"
              />
              <input 
                type="email" 
                placeholder="Your Email" 
                className="w-full rounded-lg border border-[#333] bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none"
              />
              <input 
                type="tel" 
                placeholder="Your Phone" 
                className="w-full rounded-lg border border-[#333] bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none"
              />
              <textarea 
                placeholder="Tell us about your project" 
                rows="4"
                className="w-full resize-none rounded-lg border border-[#333] bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none"
              />
              <button 
                type="button"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#c11c1d] px-6 py-4 font-bold text-white transition-colors hover:bg-[#a01618]"
              >
                Send Message <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </div>

        </div>
      </section>

    </div>
  );
}
