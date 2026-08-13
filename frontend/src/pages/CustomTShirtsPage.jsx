import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Check, Info, ShieldCheck, Clock, Layers, Users, Zap, Star, MapPin } from "lucide-react";

export function CustomTShirtsPage() {
  const [selectedGsm, setSelectedGsm] = useState("180");

  const [gallery, setGallery] = useState([]);
  const [allColors, setAllColors] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchGallery = async () => {
      try {
        const { getPublicCustomTShirtBanners } = await import("../services/customTShirtBannerService");
        const res = await getPublicCustomTShirtBanners();
        const data = res.data || res;
        const formattedGallery = data.map(banner => ({
          label: banner.label,
          src: banner.imageUrl
        }));
        setGallery(formattedGallery);
      } catch (error) {
        console.error("Failed to fetch custom t-shirt banners", error);
      }
    };

    const fetchColors = async () => {
      try {
        const { getPublicCustomTShirtColors } = await import("../services/customTShirtColorService");
        const res = await getPublicCustomTShirtColors();
        setAllColors(res.data || res);
      } catch (error) {
        console.error("Failed to fetch custom t-shirt colors", error);
      }
    };

    fetchGallery();
    fetchColors();
  }, []);

  const colors = allColors.filter(c => c.availableInGsm?.includes(selectedGsm));

  // A simple T-Shirt SVG shape
  const TshirtIcon = ({ color = "#1a1a1a", className = "w-16 h-16" }) => (
    <svg viewBox="0 0 24 24" fill={color} className={className}>
      <path d="M7 4V5H17V4H20.627L22 8L19.25 9.1L18 20H6L4.75 9.1L2 8L3.373 4H7ZM9 2H15V3H9V2Z" stroke={color === "#f8f8f8" ? "#e5e5e5" : "none"} strokeWidth="0.5" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* TOP SECTION */}
      <section className="max-w-6xl mx-auto px-4 py-4 lg:py-6 lg:px-6">
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 lg:gap-10">

          {/* Left Column */}
          <div className="space-y-6">
            {/* Headlines */}
            <div className="space-y-3">
              <div className="text-red-600 font-bold text-sm tracking-widest uppercase">
                Custom Printed. Your Way.
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-950 uppercase leading-none">
                Customize <br />
                <span className="text-red-600">Your T-Shirts</span>
              </h1>
              <p className="text-slate-600 text-base max-w-md pt-2">
                Premium quality T-shirts for brands, events, teams and personal orders.
              </p>
            </div>

            {/* GSM Selection */}
            <div className="space-y-4 pt-2">
              <h3 className="font-black text-xl uppercase tracking-tight">
                Choose Your <span className="text-red-600">GSM</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedGsm("180")}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedGsm === "180"
                      ? "border-red-600 shadow-md bg-red-50/10"
                      : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {selectedGsm === "180" && (
                    <>
                      <div className="absolute top-2 left-2 text-red-600">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="absolute top-2 right-2 text-red-600">
                        <Check className="w-5 h-5" />
                      </div>
                    </>
                  )}
                  <TshirtIcon className="w-10 h-10 ml-2" color="#1a1a1a" />
                  <div>
                    <div className="font-black text-slate-950">180 GSM</div>
                    <div className="text-xs text-slate-500 font-medium">Everyday Comfort</div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedGsm("220")}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedGsm === "220"
                      ? "border-red-600 shadow-md bg-red-50/10"
                      : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {selectedGsm === "220" && (
                    <>
                      <div className="absolute top-2 left-2 text-red-600">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="absolute top-2 right-2 text-red-600">
                        <Check className="w-5 h-5" />
                      </div>
                    </>
                  )}
                  <TshirtIcon className="w-10 h-10 ml-2" color="#1a1a1a" />
                  <div>
                    <div className="font-black text-slate-950">220 GSM</div>
                    <div className="text-xs text-slate-500 font-medium">Premium Heavyweight</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-4 pt-4">
              <h3 className="font-black text-xl uppercase flex items-center gap-2 tracking-tight">
                Pick Your <span className="text-red-600">Color</span>
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-y-6 gap-x-2">
                {colors.map((c) => (
                  <div key={c.name} className="flex flex-col items-center gap-2 group cursor-pointer transition-transform hover:-translate-y-1">
                    <TshirtIcon className="w-14 h-14 drop-shadow-sm" color={c.hex} />
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center group-hover:text-red-600 transition-colors">
                      {c.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column / WhatsApp Card */}
          <div className="flex flex-col justify-center h-full">
            <div className="bg-slate-50 rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-sm relative overflow-hidden h-auto flex flex-col justify-center transform scale-100 translate-x-0 translate-y-0 lg:scale-105 lg:translate-x-8 lg:-translate-y-16 transition-transform duration-300 ease-out">
              <div className="relative z-10 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-black text-xl lg:text-2xl uppercase tracking-tight text-slate-950 leading-none">
                    Have a Design <br /> <span className="text-red-600">In Mind?</span>
                  </h3>
                  <p className="text-sm text-slate-600 leading-snug">
                    Tell us what you need and we'll help you choose the right T-shirt, GSM, colour and printing option.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1 w-full pt-2 pb-4 border-b border-black/10">
                  <div className="flex flex-col items-center gap-2">
                    <Star className="w-6 h-6 text-red-600" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-black text-center leading-tight">Custom<br />Printing</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Layers className="w-6 h-6 text-red-600" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-black text-center leading-tight">Bulk<br />Orders</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-6 h-6 text-red-600" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-black text-center leading-tight">Corporate<br />& Events</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Zap className="w-6 h-6 text-red-600" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-black text-center leading-tight">Fan<br />Merchandise</span>
                  </div>
                </div>

                <a
                  href={`https://wa.me/918610393548?text=${encodeURIComponent("Hi Daya Creatives, I’m interested in customizing a T-shirt. Please share the available customization options, designs, sizes, colors, and pricing. Thank you!")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white py-3 rounded-lg font-bold transition-colors uppercase tracking-wide text-xs mt-3"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enquire On WhatsApp
                  <span className="ml-2">›</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM SECTION */}
      <section className="bg-[#111111] py-6 border-t-[8px] border-[#0a0a0a] w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <div className="max-w-5xl mx-auto space-y-10 px-4 lg:px-6 mb-4">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="text-red-600 font-bold text-sm tracking-widest uppercase">
              Made For You.
            </div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white uppercase leading-none">
              Worn By You.
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto pt-2">
              From custom designs to bulk orders — here's what our customers created with Daya Clothings.
            </p>
          </div>
        </div>

        {/* Banner Stack */}
        <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto px-4 lg:px-8">
          {gallery.map((item, index) => (
            <div key={index} className="relative rounded-3xl overflow-hidden group bg-slate-900 w-full shadow-2xl aspect-[14/6]">
              <img
                src={item.src}
                alt={item.label}
                className="w-full h-full object-cover block"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Label Tag */}
              <div className="absolute bottom-6 left-6 md:left-12 flex items-center gap-2 max-w-[90%] bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-4 group-hover:translate-y-0">
                <MapPin className="w-4 h-4 text-white shrink-0" />
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
