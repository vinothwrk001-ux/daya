import { ArrowUpRight, FolderGit2, Users, Award, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { useBranding } from "../context/BrandingContext";
import { Link } from "react-router-dom";
import { SEO } from "../components/SEO/SEO";
import { generateOrganizationSchema } from "../utils/seo/schema";

const recordImages = [
  "/assets/1 (1).JPG",
  "/assets/2 (1).JPG",
  "/assets/3.jpg",
  "/assets/4.jpg",
  "/assets/5.jpg",
  "/assets/6.jpg",
  "/assets/7.jpg",
];

const limcaImages = [
  "/assets/card 3(1).jpg",
  "/assets/card 3(2).jpg",
  "/assets/card 3(3).jpg"
];

const thirdCardImages = [
  "/assets/card 2 (1).jpg",
  "/assets/Card2 (2).jpg",
  "/assets/Card 2(3).jpg"
];

const fourthCardImages = [
  "/assets/Card 4(1).jpg",
  "/assets/Card 4 (2).jpg"
];

const fifthCardImages = [
  "/assets/card 5(1).jpg",
  "/assets/Card 5(2).jpg",
  "/assets/Card 5(3).jpg",
  "/assets/Card 5(4).jpg",
  "/assets/Card 5(5).jpg"
];

const sixthCardImages = [
  "/assets/card 6(1).jpg",
  "/assets/Card 6(2).jpg",
  "/assets/Card 6 (3).jpg",
  "/assets/Card 6(4).jpg"
];

export function AboutPage() {
  const { branding } = useBranding();
  const companyName = branding?.companyName || "Daya Creatives";

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <SEO 
        title="About Us" 
        description={[`Learn more about ${companyName}, a creative design studio dedicated to helping businesses build strong and memorable brands.`]}
        keywords={{ businessType: "Creative Design Studio" }}
        url="/about"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About Us" }
        ]}
        jsonLd={[
          generateOrganizationSchema({
            companyName: companyName,
            url: "https://dayacreatives.com/about"
          })
        ]}
      />
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

      {/* Client Logos Marquee Section */}
      <section className="relative flex w-full overflow-hidden bg-[#222222] py-4 sm:py-6">
        <div className="flex whitespace-nowrap">
          {Array.from({ length: 4 }).map((_, blockIndex) => (
            <div key={blockIndex} className="flex animate-marquee shrink-0 items-center gap-16 px-8 sm:gap-24 lg:px-12">
              {[
                { srcWhite: "/assets/1 GG (1).png", srcColor: "/assets/1 GG_C.png", alt: "GG Promoters" },
                { srcWhite: "/assets/2 FK (1).png", srcColor: "/assets/2 FK_C.png", alt: "Family Kitchen" },
                { srcWhite: "/assets/3 LYCA KOVAI KINGS (1).png", srcColor: "/assets/3 LYCA KOVAI KINGS_C.png", alt: "Lyca Kovai Kings" },
                { srcWhite: "/assets/4 TVS (1).png", srcColor: "/assets/4 TVS_C.png", alt: "TVS" },
                { srcWhite: "/assets/5 LYCA (1).png", srcColor: "/assets/5 LYCA_C.png", alt: "Lyca Productions" },
                { srcWhite: "/assets/6 AIMS (1).png", srcColor: "/assets/6 AIMS_C (1).png", alt: "AIMS" },
                { srcWhite: "/assets/7 AA Combo (1).png", srcColor: "/assets/7 AA Combo_C.png", alt: "AA Combo" },
                { srcWhite: "/assets/8 NSDC (2).png", srcColor: "/assets/8 NSDC_C.png", alt: "National Smile Dental Care" },
                { srcWhite: "/assets/9 McGans (1).png", srcColor: "/assets/9 McGans_C (1).png", alt: "McGan Ooty School of Architecture" },
              ].map((logo, index) => (
                <div key={index} className="relative flex h-8 items-center justify-center sm:h-12 md:h-14 group cursor-pointer">
                  {/* White Silhouette State */}
                  <img
                    src={logo.srcWhite}
                    alt={`${logo.alt} white`}
                    className="absolute h-full w-auto object-contain brightness-0 invert opacity-70 transition-opacity duration-300 group-hover:opacity-0"
                  />
                  {/* Color Hover State */}
                  <img
                    src={logo.srcColor}
                    alt={`${logo.alt} color`}
                    className="absolute h-full w-auto object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  {/* Invisible placeholder to maintain layout width */}
                  <img
                    src={logo.srcColor}
                    alt={logo.alt}
                    className="h-full w-auto object-contain opacity-0 pointer-events-none"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Our Team Section */}
      <section className="w-full bg-white px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-3xl font-black uppercase tracking-tight text-black sm:text-4xl lg:text-5xl">
            OUR TEAM
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {[
              { name: "Jai", image: "/assets/Jai.jpg" },
              { name: "Sanjay", image: "/assets/Sanjay (1).jpg" },
              { name: "Raj", image: "/assets/Raj.jpg" },
              { name: "Vinoth", image: "/assets/Vinoth.jpg" },
              { name: "Abdul", image: "/assets/Abdul.jpg" },
              { name: "Loki", image: "/assets/Loki.jpg" },
            ].map((member, i) => (
              <div key={i} className="group relative aspect-square w-full overflow-hidden rounded-[2rem] bg-[#b3b3b3] shadow-sm">
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
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
            {/* 6 Gray Cards with Text */}
            {Array.from({ length: 6 }).map((_, i) => {
              if (i === 0) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {recordImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % recordImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      🏆 7+ World Records
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      Recognized by the Indian Record Academy, Asian Records, Elite World Records, Tamilan Book of Records, and Unique World Records for contributing to world record-setting largest painting events, including a 1,214.60 sq. ft. (35×35 ft.) masterpiece.
                    </p>
                  </div>
                );
              } else if (i === 1) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {limcaImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Limca Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % limcaImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      🏆 Limca Book of Records
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      Official National Record Holder (2013) for creating 250 hand-drawn textile designs in just 30 hours, showcasing exceptional creativity, speed, and artistic excellence.
                    </p>
                  </div>
                );
              } else if (i === 2) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {thirdCardImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Third Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % thirdCardImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      WORLD RECORD
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      From startups to established businesses, we provide creative solutions that leave a lasting impression.
                    </p>
                  </div>
                );
              } else if (i === 3) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {fourthCardImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Fourth Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % fourthCardImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      🏆 National Award for Excellence in Painting (2016)
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      Honoured with a prestigious National Award for outstanding artistic talent, innovation, and significant contributions to the field of painting and visual arts. National award Painting was selected by veera Santhanam (Artist, Actor)
                    </p>
                  </div>
                );
              } else if (i === 4) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {fifthCardImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Fifth Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % fifthCardImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      WORLD RECORD
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      From startups to established businesses, we provide creative solutions that leave a lasting impression.
                    </p>
                  </div>
                );
              } else if (i === 5) {
                return (
                  <div key={i} className="flex flex-col">
                    <div className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-2xl sm:mb-6 sm:rounded-[2rem] relative bg-white">
                      {sixthCardImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Sixth Record ${idx + 1}`}
                          className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-1000 ${idx === (currentImageIndex % sixthCardImages.length) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}
                    </div>
                    <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                      WORLD RECORD
                    </h3>
                    <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                      From startups to established businesses, we provide creative solutions that leave a lasting impression.
                    </p>
                  </div>
                );
              }
              return (
                <div key={i} className="flex flex-col">
                  <div className="mb-3 aspect-[4/5] w-full rounded-2xl bg-[#b3b3b3] sm:mb-6 sm:rounded-[2rem]" />
                  <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-black sm:mb-3 sm:text-sm">
                    WORLD RECORD
                  </h3>
                  <p className="pr-0 text-[10px] leading-relaxed text-slate-600 sm:pr-4 sm:text-sm">
                    From startups to established businesses, we provide creative solutions that leave a lasting impression.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
