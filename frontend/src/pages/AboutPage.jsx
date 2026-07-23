import { ArrowUpRight, FolderGit2, Users, Award, Briefcase } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "../context/BrandingContext";
import { Link } from "react-router-dom";

export function AboutPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "DayaCreatives";

  useEffect(() => {
    document.title = `About Us | ${companyName}`;
    return () => {
      document.title = companyName;
    };
  }, [companyName]);

  return (
    <div className="flex w-full flex-col items-center">
      {/* Hero Section */}
      <section className="w-full bg-black px-6 py-20 text-white lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#c11c1d] sm:text-sm">
              YOU DREAM IT, WE DESIGN IT.
            </p>
            <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Creative Designs<br />That <span className="text-[#c11c1d]">Build Brands.</span>
            </h1>
            <p className="mb-8 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
              Daya Creatives is a creative design studio dedicated to helping businesses build strong and memorable brands.
            </p>
            <Link 
              to="/services"
              className="inline-flex items-center gap-2 rounded-lg bg-[#c11c1d] px-6 py-3 font-bold text-white transition-colors hover:bg-[#a01618]"
            >
              Explore Our Works <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 gap-4 place-items-center sm:place-items-end lg:place-items-center">
            {/* 4 Red Squares Grid */}
            <div className="h-32 w-32 shrink-0 rounded-[1.75rem] bg-[#c11c1d] sm:h-40 sm:w-40" />
            <div className="h-32 w-32 shrink-0 rounded-[1.75rem] bg-[#c11c1d] sm:h-40 sm:w-40" />
            <div className="h-32 w-32 shrink-0 rounded-[1.75rem] bg-[#c11c1d] sm:h-40 sm:w-40" />
            <div className="h-32 w-32 shrink-0 rounded-[1.75rem] bg-[#c11c1d] sm:h-40 sm:w-40" />
          </div>
        </div>
      </section>

      {/* Gray Divider */}
      <div className="h-16 w-full bg-[#c2c2c2] sm:h-24" />

      {/* Our Team Section */}
      <section className="w-full bg-white px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-3xl font-black uppercase tracking-tight text-black sm:text-4xl lg:text-5xl">
            OUR TEAM
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {/* 6 Gray Cards */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square w-full rounded-[2rem] bg-[#b3b3b3]" />
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="w-full bg-black px-6 py-6 text-white lg:py-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 place-items-center gap-6 text-center lg:grid-cols-4">
          
          <div className="flex flex-col items-center">
            <FolderGit2 className="mb-1 h-6 w-6 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-1 text-xl font-bold sm:text-2xl lg:text-3xl">5000+</p>
            <p className="text-[10px] font-medium text-slate-400 sm:text-xs">Projects Completed</p>
          </div>
          
          <div className="flex flex-col items-center">
            <Users className="mb-1 h-6 w-6 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-1 text-xl font-bold sm:text-2xl lg:text-3xl">450+</p>
            <p className="text-[10px] font-medium text-slate-400 sm:text-xs">Happy Clients</p>
          </div>
          
          <div className="flex flex-col items-center">
            <Briefcase className="mb-1 h-6 w-6 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-1 text-xl font-bold sm:text-2xl lg:text-3xl">7+</p>
            <p className="text-[10px] font-medium text-slate-400 sm:text-xs">Years Experience</p>
          </div>

          <div className="flex flex-col items-center">
            <Award className="mb-1 h-6 w-6 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-1 text-xl font-bold sm:text-2xl lg:text-3xl">20+</p>
            <p className="text-[10px] font-medium text-slate-400 sm:text-xs">Industries Served</p>
          </div>
          
        </div>
      </section>

      {/* Top Achievements Section */}
      <section className="w-full bg-white px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
            TOP ACHIEVEMENTS
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* 3 Gray Cards with Text */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col">
                <div className="mb-6 aspect-[4/5] w-full rounded-[2rem] bg-[#b3b3b3]" />
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-black">
                  WORLD RECORD
                </h3>
                <p className="pr-4 text-sm leading-relaxed text-slate-600">
                  From startups to established businesses, we provide creative solutions that leave a lasting impression.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
