import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Heart,
  MapPin,
  MoonStar,
  SunMedium,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "../context/authStore";
import { CartDrawerProvider } from "../context/CartDrawerContext";
import { UserMenu } from "./UserMenu";
import { Footer } from "./Footer";
import { SearchBar } from "./SearchBar";
import { LocationSelector } from "./LocationSelector";
import { CategoryNavigation } from "./CategoryNavigation";
import { CartDrawer } from "./CartDrawer";
import { CartDrawerOverlay } from "./CartDrawerOverlay";
import { useDarkMode } from "../hooks/useDarkMode";
import { useCategories } from "../hooks/useCategories";
import { categoryRedirectsToServices } from "../utils/categoryLinks";
import { usePresentedCategories } from "../utils/categoryPresentation";
import { BrandLogo } from "./BrandLogo";
import { HeaderShopActions } from "./HeaderShopActions";
import { RouteScrollManager } from "./RouteScrollManager";

export function Layout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { categories } = useCategories();
  const presentedCategories = usePresentedCategories(categories);
  const isAdminRoute =
    location.pathname === "/dashboard/admin" ||
    location.pathname.startsWith("/admin");
  const isStaffWorkspace = location.pathname.startsWith("/staff/");
  const isReelsPage = location.pathname === "/reels" || location.pathname.startsWith("/reels/");
  const isHomePage = location.pathname === "/";
  const hideShopChrome = isAdminRoute || isStaffWorkspace || isReelsPage;
  const showShopActions = !user || user?.role === "user";

  // Detect scroll with requestAnimationFrame for smooth performance
  useEffect(() => {
    let ticking = false;

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/shop" },
    // { label: "Categories", href: "/#categories" },
    { label: "Reels", href: "/reels" },
    { label: "Services", href: "/services" },
    // { label: "Campaigns", href: "/collections/deals" },
    { label: "About Us", href: "/terms-and-conditions" },
    // { label: "Compare", href: "/compare" },
    { label: "Track order", href: user?.role === "user" ? "/orders" : user ? "/dashboard" : "/login" },
  ];

  return (
    <CartDrawerProvider>
      <div className="enterprise-shell flex min-h-screen flex-col transition-colors">
      {!hideShopChrome && location.pathname !== "/" ? (
        <header className="enterprise-header sticky top-0 z-30 backdrop-blur-xl">
          <div className="w-full px-3 py-3 sm:px-4 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                <Link
                  to="/"
                  className={`inline-flex min-w-fit shrink-0 items-center transition hover:opacity-90 ${
                    isScrolled ? "pointer-events-none w-0 opacity-0" : "opacity-100"
                  }`}
                >
                  <BrandLogo
                    showName={false}
                    className="text-slate-950"
                    imgClassName="branding-logo-image max-w-[140px]"
                  />
                </Link>

                <div className="order-3 w-full lg:order-none lg:flex-1">
                  <div className="group mx-auto w-full max-w-5xl transition-all duration-300 focus-within:max-w-6xl">
                    <SearchBar />
                  </div>
                </div>

                <nav className="enterprise-nav-pill hidden items-center gap-1 rounded-full p-1 backdrop-blur lg:flex">
                  {navItems.map((item) => {
                    const isActive =
                      location.pathname === item.href ||
                      (item.href !== "/" && location.pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`group relative rounded-full px-4 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-brand-primary text-white"
                            : "text-slate-700 hover:text-brand-primary"
                        }`}
                      >
                        {item.label}
                        {!isActive ? (
                          <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-current transition duration-300 group-hover:scale-x-100" />
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="enterprise-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95"
                    aria-label={isDarkMode ? "Enable light mode" : "Enable dark mode"}
                  >
                    {isDarkMode ? <SunMedium className="h-4.5 w-4.5" /> : <MoonStar className="h-4.5 w-4.5" />}
                  </button>

                  <div className="hidden xl:block xl:w-[280px]">
                    <div className="enterprise-nav-pill rounded-full p-1 backdrop-blur">
                      <LocationSelector />
                    </div>
                  </div>

                  {authReady && user ? (
                    <>
                      <HeaderShopActions />
                      <UserMenu />
                    </>
                  ) : authReady ? (
                    <>
                      <HeaderShopActions />
                      <Link
                        className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-brand-primary sm:inline-flex"
                        to="/login"
                      >
                        Login
                      </Link>
                      <Link
                        className="enterprise-primary-button inline-flex rounded-full px-4 py-2.5 text-sm font-semibold shadow-brandMd transition hover:shadow-brandLg active:scale-95"
                        to="/role"
                        style={{ background: "var(--color-primary)" }}
                      >
                        Start
                      </Link>
                    </>
                  ) : (
                    <span className="inline-block h-10 w-24 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 xl:hidden">
                <div className="enterprise-nav-pill min-w-0 flex-1 rounded-full p-1 backdrop-blur">
                  <LocationSelector />
                </div>
                {user ? (
                  <Link
                    to={showShopActions ? "/wishlist" : "/profile"}
                    className="enterprise-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95"
                    aria-label={showShopActions ? "Saved items" : "Profile"}
                  >
                    {showShopActions ? <Heart className="h-4.5 w-4.5" /> : <UserRound className="h-4.5 w-4.5" />}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <HeaderShopActions />
                    <Link
                      to="/login"
                      className="enterprise-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95"
                      aria-label="Login"
                    >
                      <MapPin className="h-4.5 w-4.5" />
                    </Link>
                  </div>
                )}
              </div>

              <nav className="enterprise-nav-pill flex gap-2 overflow-x-auto rounded-full p-1 backdrop-blur lg:hidden">
                {navItems.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/" && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-brand-primary text-white"
                          : "text-slate-700 hover:text-brand-primary"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>
      ) : null}

      {!hideShopChrome && location.pathname !== "/" ? (
        <CategoryNavigation 
          categories={presentedCategories}
          onSelect={(item) => {
            setSelectedCategory(item);
            if (categoryRedirectsToServices(item)) {
              navigate("/services");
              return;
            }
            // Check if it's a subcategory or category based on presence of categoryId property
            if (item.categoryId) {
              // It's a subcategory
              navigate(`/shop?categoryId=${item.categoryId}&subCategoryId=${item._id || item.id}`);
            } else {
              // It's a category
              navigate(`/shop?categoryId=${item._id || item.id}`);
            }
          }}
          selectedCategory={selectedCategory}
        />
      ) : null}

      <main
        className={
          hideShopChrome
            ? isReelsPage
              ? "flex-1 p-0"
              : "flex-1"
            : isHomePage
              ? "w-full flex-1 p-0"
              : "w-full flex-1 px-3 py-5 sm:px-4 sm:py-7 lg:px-8 lg:py-10"
        }
      >
        <RouteScrollManager />
      </main>

      {!hideShopChrome ? <Footer /> : null}

      {/* Cart Drawer System */}
      <CartDrawerOverlay />
      <CartDrawer />
    </div>
    </CartDrawerProvider>
  );
}
