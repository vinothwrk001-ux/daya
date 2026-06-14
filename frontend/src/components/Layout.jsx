import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Heart,
  MapPin,
  MoonStar,
  ShoppingCart,
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
import { usePresentedCategories } from "../utils/categoryPresentation";
import * as cartService from "../services/cartService";
import * as wishlistService from "../services/wishlistService";
import useGuestCartStore from "../context/guestCartStore";
import useGuestWishlistStore from "../context/guestWishlistStore";
import { normalizeCartPayload } from "../utils/cartState";
import { useBranding } from "../context/BrandingContext";
import { BrandLogo } from "./BrandLogo";

export function Layout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const guestCartCount = useGuestCartStore((s) => s.getTotalQuantity());
  const guestWishlistCount = useGuestWishlistStore((s) => s.getItemCount());
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const { categories } = useCategories();
  const presentedCategories = usePresentedCategories(categories);
  const { branding } = useBranding();
  const isAdminRoute =
    location.pathname === "/dashboard/admin" ||
    location.pathname.startsWith("/admin");
  const isStaffWorkspace = location.pathname.startsWith("/staff/");
  const isHomePage = location.pathname === "/";
  const hideShopChrome = isAdminRoute || isStaffWorkspace;
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
    { label: "Shop", href: "/shop" },
    { label: "Compare", href: "/compare" },
    { label: "Track order", href: user?.role === "user" ? "/orders" : user ? "/dashboard" : "/login" },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadCartCount() {
      if (!showShopActions) {
        setCartCount(0);
        return;
      }

      if (!isAuthenticated) {
        setCartCount(guestCartCount);
        return;
      }

      try {
        const response = await cartService.getCart();
        const normalized = normalizeCartPayload(response);
        const nextCount = normalized.totalQuantity;
        if (!cancelled) {
          setCartCount(nextCount);
        }
      } catch {
        if (!cancelled) {
          setCartCount(0);
        }
      }
    }

    loadCartCount();

    function handleCartChanged(event) {
      setCartCount(normalizeCartPayload(event?.detail).totalQuantity);
    }

    window.addEventListener("cart:changed", handleCartChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("cart:changed", handleCartChanged);
    };
  }, [guestCartCount, isAuthenticated, showShopActions]);

  useEffect(() => {
    let cancelled = false;

    async function loadWishlistCount() {
      if (!showShopActions) {
        setWishlistCount(0);
        return;
      }

      if (!isAuthenticated) {
        setWishlistCount(guestWishlistCount);
        return;
      }

      try {
        const response = await wishlistService.getWishlist();
        const items = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          setWishlistCount(items.length);
        }
      } catch {
        if (!cancelled) {
          setWishlistCount(0);
        }
      }
    }

    loadWishlistCount();

    function handleWishlistChanged(event) {
      const items = Array.isArray(event?.detail?.items) ? event.detail.items : [];
      setWishlistCount(items.length);
    }

    window.addEventListener("wishlist:changed", handleWishlistChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("wishlist:changed", handleWishlistChanged);
    };
  }, [guestWishlistCount, isAuthenticated, showShopActions]);

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
                  className={`enterprise-nav-pill inline-flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 font-semibold tracking-normal backdrop-blur transition hover:shadow-lg ${
                    isScrolled ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <BrandLogo
                    showName={false}
                    className="text-slate-950"
                    imgClassName="h-8 w-auto max-w-[140px] object-contain"
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

                  {user ? (
                    <>
                      {showShopActions ? (
                        <>
                          <HeaderIconLink to="/wishlist" label="Wishlist" badge={wishlistCount}>
                            <Heart className="h-4.5 w-4.5" />
                          </HeaderIconLink>
                          <HeaderIconLink to="/cart" label="Cart" badge={cartCount}>
                            <ShoppingCart className="h-4.5 w-4.5" />
                          </HeaderIconLink>
                        </>
                      ) : null}
                      <UserMenu />
                    </>
                  ) : (
                    <>
                      <HeaderIconLink to="/wishlist" label="Wishlist" badge={wishlistCount}>
                        <Heart className="h-4.5 w-4.5" />
                      </HeaderIconLink>
                      <HeaderIconLink to="/cart" label="Cart" badge={cartCount}>
                        <ShoppingCart className="h-4.5 w-4.5" />
                      </HeaderIconLink>
                      <Link
                        className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-brand-primary sm:inline-flex"
                        to="/login"
                      >
                        Login
                      </Link>
                      <Link
                        className="enterprise-primary-button inline-flex rounded-full px-4 py-2.5 text-sm font-semibold shadow-brandMd transition hover:shadow-brandLg active:scale-95"
                        to="/role"
                        style={{ background: branding?.brandColors?.primaryColor || "var(--color-primary)" }}
                      >
                        Start
                      </Link>
                    </>
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
                    <Link
                      to="/wishlist"
                      className="enterprise-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95"
                      aria-label="Wishlist"
                    >
                      <Heart className="h-4.5 w-4.5" />
                    </Link>
                    <Link
                      to="/cart"
                      className="enterprise-icon-button inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition active:scale-95"
                      aria-label="Cart"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                    </Link>
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
            ? "flex-1"
            : isHomePage
              ? "w-full flex-1 p-0"
              : "w-full flex-1 px-3 py-5 sm:px-4 sm:py-7 lg:px-8 lg:py-10"
        }
      >
        <Outlet />
      </main>

      {!hideShopChrome && !isHomePage ? <Footer /> : null}

      {/* Cart Drawer System */}
      <CartDrawerOverlay />
      <CartDrawer />
    </div>
    </CartDrawerProvider>
  );
}

function HeaderIconLink({ to, label, badge, children }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="enterprise-icon-button relative inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition hover:-translate-y-0.5 active:scale-95"
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
