import { useEffect, useState } from "react";
import {
  PenTool, Laptop, Map, Video, ArrowUpRight, Phone, Mail, MapPin,
  Smartphone, Clapperboard, Layout, Shirt, Camera, Edit3, X
} from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SEO } from "../components/SEO/SEO";
import { generateServiceSchema } from "../utils/seo/schema";
import { api } from "../services/api";

export function ServicesPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "Daya Creatives";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    projectDetails: ""
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPdf, setSelectedPdf] = useState(null);

  const validateField = (name, value) => {
    let error = "";
    if (name === "name") {
      if (!value.trim()) error = "Name is required.";
      else if (value.trim().length < 2) error = "Name must be at least 2 characters long.";
    }
    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.trim()) error = "Email is required.";
      else if (!emailRegex.test(value.trim())) error = "Please enter a valid email address.";
    }
    if (name === "phone") {
      const phoneRegex = /^\d{10}$/;
      const digitsOnly = value.replace(/\D/g, "");
      if (!value.trim()) error = "Phone number is required.";
      else if (!phoneRegex.test(digitsOnly)) error = "Please enter exactly 10 digits.";
    }
    if (name === "projectDetails") {
      if (!value.trim()) error = "Project details are required.";
      else if (value.trim().length < 10) error = "Project details must be at least 10 characters long.";
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (touched[name]) {
      setFieldErrors({ ...fieldErrors, [name]: validateField(name, value) });
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });
    setFieldErrors({ ...fieldErrors, [name]: validateField(name, value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const errors = {};
    Object.keys(formData).forEach((key) => {
      errors[key] = validateField(key, formData[key]);
    });
    setFieldErrors(errors);
    setTouched({ name: true, email: true, phone: true, projectDetails: true });

    if (Object.values(errors).some(err => err)) {
      return;
    }
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      await api.post("/api/service-requests", formData);
      setSuccessMsg("Your request has been submitted successfully! We'll get back to you soon.");
      setFormData({ name: "", email: "", phone: "", projectDetails: "" });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      id: "website-design & UI/UX",
      icon: Layout,
      title: "Web Development & UI/UX Design",
      desc: "Modern, responsive websites designed for performance and user experience.",
      deliverables: ["Custom Web Design", "Landing Pages", "E-Commerce Sites", "Responsive Design", "Wireframing", "Web Maintenance", "User Research", "Prototyping", "Mobile App UI", "Web App UI", "Usability Testing"]
    },
    {
      id: "print-merch",
      icon: Shirt,
      title: "Print & Merchandise",
      desc: "T-shirt designs, packaging, stickers and print materials that leave an impression.",
      deliverables: ["T-Shirt ", "Calender", "Packages", "Printing Services", "Stickers & Labels", "Branding Merchandise"]
    },
    {
      id: "workshop",
      icon: Laptop,
      title: "Workshop",
      desc: "Practical workshops designed to build creative skills, professional portfolios, and industry-ready expertise",
      deliverables: ["Graphic Design", "Resume Building", "Portfolio Development", "Photoshop & Illustrator", "After Effects & Premiere Pro", "AutoCAD & Fusion 360", "Art Workshop"]
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
    <>
      <SEO
        title="Services"
        description={["Creative Solutions That Build Brands, Inspire Audiences & Drive Results"]}
        keywords={{ categoryName: "Services", businessType: "Creative Solutions" }}
        url="/services"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Services" }
        ]}
        jsonLd={generateServiceSchema({
          serviceName: "Creative Solutions",
          description: "Creative Solutions That Build Brands, Inspire Audiences & Drive Results",
          url: "https://dayacreatives.com/services"
        })}
      />
      <div className="flex w-full flex-col items-center overflow-x-hidden bg-black">

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
          <div className="flex whitespace-nowrap text-white">
            {Array.from({ length: 4 }).map((_, blockIndex) => (
              <div key={blockIndex} className="flex animate-marquee shrink-0 items-center gap-12 px-6 text-3xl font-bold uppercase sm:text-4xl md:text-5xl lg:gap-24 lg:px-12">
                {["Web Development", "Designing", "Branding", "Editing", "UI/UX", "Printing", "Workshop"].map((service, index) => [
                  <span key={`text-${index}`}>{service}</span>,
                  <span key={`sep-${index}`} className="px-2 opacity-60">|</span>
                ])}
              </div>
            ))}
          </div>
        </section>

        {/* 3. What We Do Section */}
        <section className="w-full bg-black px-6 py-20 text-white lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="relative mb-16 flex flex-col items-center">
              <div className="text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c11c1d]">
                  WHAT WE DO
                </p>
                <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
                  Services That Help<br />Your Brand Grow
                </h2>
              </div>
              <div className="mt-6 sm:absolute sm:bottom-2 sm:right-0 sm:mt-0">
                <a
                  href="https://www.behance.net/gallery/241615521/Daya-Creatives-Portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#c11c1d] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#a01618]"
                >
                  Explore Our Work <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

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
        <section className="-mt-[20px] w-full bg-black px-6 pb-8 pt-10 text-white sm:pb-20 lg:pb-32">
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
              <a
                href="https://www.behance.net/gallery/241615521/Daya-Creatives-Portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#c11c1d] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#a01618]"
              >
                View All Work <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => {
                const isNSDC = i === 0;
                return (
                  <div
                    key={i}
                    className={`group flex flex-col bg-black p-2 sm:p-4 transition-colors hover:bg-[#111] ${isNSDC ? 'cursor-pointer' : ''}`}
                    onClick={() => isNSDC && setSelectedPdf("/assets/NSDC - PDF.pdf")}
                  >
                    <div className="mb-2 sm:mb-4 aspect-square w-full rounded-lg sm:rounded-xl bg-[#1a1a1a] flex items-center justify-center text-[#444] overflow-hidden">
                      {isNSDC ? (
                        <img
                          src="/assets/Thumbnail NDSC..jpeg"
                          alt="NSDC"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="text-center font-black opacity-50 uppercase tracking-widest text-[9px] sm:text-base">
                          {i % 4 === 0 && "IKIGAI"}
                          {i % 4 === 1 && "Guided"}
                          {i % 4 === 2 && "Frame House"}
                          {i % 4 === 3 && "CK Tours"}
                        </div>
                      )}
                    </div>
                    <h3 className="text-[10px] leading-tight sm:leading-normal sm:text-sm font-bold text-white uppercase">
                      {isNSDC ? "NSDC" : (
                        i % 4 === 0 ? "IKIGAI" :
                          i % 4 === 1 ? "Guided Abroad" :
                            i % 4 === 2 ? "The Frame House Media" :
                              "CK Tours & Travels"
                      )}
                    </h3>
                    <p className="text-[8px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">Brand Identity</p>
                  </div>
                );
              })}
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
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {successMsg && (
                  <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-500">
                    {successMsg}
                  </div>
                )}
                {errorMsg && (
                  <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Your Name"
                    className={`w-full rounded-lg border ${fieldErrors.name && touched.name ? 'border-red-500' : 'border-[#333]'} bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none`}
                  />
                  {fieldErrors.name && touched.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                </div>

                <div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Your Email"
                    className={`w-full rounded-lg border ${fieldErrors.email && touched.email ? 'border-red-500' : 'border-[#333]'} bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none`}
                  />
                  {fieldErrors.email && touched.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
                </div>

                <div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 10) {
                        setFormData(prev => ({ ...prev, phone: value }));
                        if (touched.phone) {
                          setFieldErrors(prev => ({ ...prev, phone: validateField("phone", value) }));
                        }
                      }
                    }}
                    onBlur={handleBlur}
                    placeholder="Your Phone (10 digits)"
                    maxLength={10}
                    className={`w-full rounded-lg border ${fieldErrors.phone && touched.phone ? 'border-red-500' : 'border-[#333]'} bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none`}
                  />
                  {fieldErrors.phone && touched.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <textarea
                    name="projectDetails"
                    value={formData.projectDetails}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Tell us about your project"
                    rows="4"
                    className={`w-full resize-none rounded-lg border ${fieldErrors.projectDetails && touched.projectDetails ? 'border-red-500' : 'border-[#333]'} bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#c11c1d] focus:outline-none`}
                  />
                  {fieldErrors.projectDetails && touched.projectDetails && <p className="mt-1 text-xs text-red-500">{fieldErrors.projectDetails}</p>}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#c11c1d] px-6 py-4 font-bold text-white transition-colors hover:bg-[#a01618] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* PDF Modal */}
      {selectedPdf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8 backdrop-blur-sm">
          <button
            onClick={() => setSelectedPdf(null)}
            className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-[#c11c1d]"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative h-full w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <iframe
              src={`${selectedPdf}#view=FitH`}
              className="h-full w-full border-none"
              title="PDF Viewer"
            />
          </div>
        </div>
      )}
    </>
  );
}
