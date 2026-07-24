import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Heart,
  MapPin,
  Menu,
  MoonStar,
  SunMedium,
  UserRound,
  X,
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { categories } = useCategories();
  const presentedCategories = usePresentedCategories(categories);
  const isAdminRoute =
    location.pathname === "/dashboard/admin" ||
    location.pathname.startsWith("/admin");
  const isStaffWorkspace = location.pathname.startsWith("/staff/");
  const isReelsPage = location.pathname === "/reels" || location.pathname.startsWith("/reels/");
  const isAuthPage = ["/login", "/register", "/role", "/forgot-password"].includes(location.pathname);
  const isHomePage = location.pathname === "/";
  const isContentPage = location.pathname === "/services" || location.pathname === "/about";
  const hideShopChrome = isAdminRoute || isStaffWorkspace || isReelsPage || isAuthPage;
  const showShopActions = !user || user?.role === "user";


  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/shop" },
    // { label: "Categories", href: "/#categories" },
    { label: "Reels", href: "/reels" },
    { label: "Services", href: "/services" },
    // { label: "Campaigns", href: "/collections/deals" },
    { label: "About Us", href: "/about" },
    // { label: "Compare", href: "/compare" },
    { label: "Track order", href: user?.role === "user" ? "/orders" : user ? "/dashboard" : "/login" },
  ];

  return (
    <CartDrawerProvider>
      <div className="enterprise-shell flex min-h-screen flex-col transition-colors">
      {!hideShopChrome && location.pathname !== "/" ? (
        <header className="enterprise-header sticky top-0 z-30 backdrop-blur-xl">
          <div className="w-full px-3 pt-3 pb-4 sm:px-4 lg:px-8 lg:py-3">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-center gap-3 lg:flex-wrap">
                <Link
                  to="/"
                  className="inline-flex min-w-fit shrink-0 items-center transition hover:opacity-90 opacity-100"
                >
                  <BrandLogo
                    showName={false}
                    className="text-slate-950"
                    imgClassName="branding-logo-image max-w-[140px]"
                  />
                </Link>

                <div className="order-2 flex w-full justify-center lg:hidden">
                  <div className="w-full max-w-[420px]">
                    <SearchBar />
                  </div>
                </div>

                <div className="order-3 hidden w-full justify-center lg:flex lg:order-none lg:flex-1">
                  <div className="group mx-auto w-full max-w-[500px] transition-all duration-300 focus-within:max-w-[560px] lg:translate-x-[5.5rem]">
                    <SearchBar />
                  </div>
                </div>

                <nav className="enterprise-nav-pill order-3 flex flex-nowrap w-full items-center justify-start gap-3 overflow-x-auto scroll-smooth rounded-full border-0 bg-transparent p-1 shadow-none backdrop-blur mt-4 lg:order-10 lg:w-full lg:justify-center lg:flex-wrap lg:overflow-visible lg:mt-3">
                  {navItems.map((item) => {
                    const isActive =
                      location.pathname === item.href ||
                      (item.href !== "/" && location.pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        state={item.href === "/reels" ? { background: location } : undefined}
                        className={`group relative shrink-0 rounded-full px-3 py-1.5 text-xs lg:px-4 lg:py-2 lg:text-sm font-bold transition ${
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
                  <div className="hidden shrink-0 xl:block xl:max-w-[280px] xl:min-w-[200px]">
                    <LocationSelector />
                  </div>

                  {showShopActions ? <HeaderShopActions /> : null}
                  {authReady && user ? (
                    <UserMenu />
                  ) : authReady ? (
                    <>
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

              {/* Mobile menu drawer */}
              {mobileMenuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <nav
                    className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw,20rem)] flex-col safe-area-inset border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden"
                    aria-label="Mobile navigation"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">Menu</span>
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(false)}
                        className="touch-target inline-flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Close menu"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                      <div className="grid gap-1">
                        {navItems.map((item) => {
                          const isActive =
                            location.pathname === item.href ||
                            (item.href !== "/" && location.pathname.startsWith(item.href));
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              state={item.href === "/reels" ? { background: location } : undefined}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`touch-target rounded-2xl px-4 py-3 text-sm font-bold transition ${
                                isActive
                                  ? "bg-brand-primary text-white"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                              }`}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </nav>
                </>
              ) : null}
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
              : isContentPage
                ? "w-full flex-1 px-3 py-0 sm:px-4 md:px-0 lg:px-0"
                : "w-full flex-1 px-3 py-0 sm:px-4 md:px-6 lg:px-8"
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
