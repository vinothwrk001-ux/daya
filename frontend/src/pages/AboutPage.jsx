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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {/* 6 Gray Cards */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square w-full rounded-[2rem] bg-[#b3b3b3]" />
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="w-full bg-black px-2 py-6 text-white sm:px-6 lg:py-8">
        <div className="mx-auto grid max-w-6xl grid-cols-4 place-items-start sm:place-items-center gap-1 sm:gap-6 text-center">
          
          <div className="flex flex-col items-center w-full">
            <FolderGit2 className="mb-1 h-5 w-5 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-0.5 text-xs font-bold sm:mb-1 sm:text-2xl lg:text-3xl">5000+</p>
            <p className="text-[8px] font-medium leading-tight text-slate-400 sm:text-xs">Projects<br className="sm:hidden" /> Completed</p>
          </div>
          
          <div className="flex flex-col items-center w-full">
            <Users className="mb-1 h-5 w-5 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-0.5 text-xs font-bold sm:mb-1 sm:text-2xl lg:text-3xl">450+</p>
            <p className="text-[8px] font-medium leading-tight text-slate-400 sm:text-xs">Happy<br className="sm:hidden" /> Clients</p>
          </div>
          
          <div className="flex flex-col items-center w-full">
            <Briefcase className="mb-1 h-5 w-5 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-0.5 text-xs font-bold sm:mb-1 sm:text-2xl lg:text-3xl">7+</p>
            <p className="text-[8px] font-medium leading-tight text-slate-400 sm:text-xs">Years<br className="sm:hidden" /> Experience</p>
          </div>

          <div className="flex flex-col items-center w-full">
            <Award className="mb-1 h-5 w-5 text-[#c11c1d] sm:h-8 sm:w-8" strokeWidth={1.5} />
            <p className="mb-0.5 text-xs font-bold sm:mb-1 sm:text-2xl lg:text-3xl">20+</p>
            <p className="text-[8px] font-medium leading-tight text-slate-400 sm:text-xs">Industries<br className="sm:hidden" /> Served</p>
          </div>
          
        </div>
      </section>

      {/* Top Achievements Section */}
      <section className="w-full bg-white px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-16 text-center text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
            TOP ACHIEVEMENTS
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-8 lg:grid-cols-3">
            {/* 3 Gray Cards with Text */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col">
                <div className="mb-3 aspect-[4/5] w-full rounded-2xl bg-[#b3b3b3] sm:mb-6 sm:rounded-[2rem]" />
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                  WORLD RECORD
                </h3>
                <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
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
