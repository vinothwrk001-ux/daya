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
import { PlatformFeaturesProvider } from "../context/PlatformFeaturesContext";
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
  const token = useAuthStore((s) => s.token);
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
  const isVendorWorkspace = location.pathname.startsWith("/vendor/");
  const isStaffWorkspace = location.pathname.startsWith("/staff/");
  const isInfluencerWorkspace = location.pathname.startsWith("/influencer");
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
    { label: "Track order", href: user?.role === "user" ? "/orders" : user ? "/dashboard" : "/login" },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadCartCount() {
      if (!showShopActions) {
        setCartCount(0);
        return;
      }

      if (!token) {
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
  }, [guestCartCount, showShopActions, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadWishlistCount() {
      if (!showShopActions) {
        setWishlistCount(0);
        return;
      }

      if (!token) {
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
  }, [guestWishlistCount, showShopActions, token]);

  return (
    <CartDrawerProvider>
      <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.16),_transparent_34%),linear-gradient(to_bottom,_#ffffff,_#f8fafc_32%,_#eef2ff_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(to_bottom,_#020617,_#020617_28%,_#0f172a_100%)] dark:text-white">
      {!isAdminRoute && !isVendorWorkspace && !isStaffWorkspace && !isInfluencerWorkspace ? (
        <header className="sticky top-0 z-30 border-b border-white/50 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60">
          <div className="w-full px-3 py-3 sm:px-4 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                <Link
                  to="/"
                  className={`inline-flex min-w-fit items-center gap-2 rounded-lg border border-white/60 bg-white/75 px-3 py-2 font-semibold tracking-[-0.03em] text-slate-950 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-white transition hover:shadow-lg ${
                    isScrolled ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <BrandLogo
                    showName={false}
                    className="text-slate-950 dark:text-white"
                    imgClassName="h-8 w-auto max-w-[140px] object-contain"
                  />
                </Link>

                <div className="order-3 w-full lg:order-none lg:flex-1">
                  <div className="group mx-auto w-full max-w-5xl transition-all duration-300 focus-within:max-w-6xl">
                    <SearchBar />
                  </div>
                </div>

                <nav className="hidden items-center gap-1 rounded-full border border-white/60 bg-white/70 p-1 backdrop-blur dark:border-white/10 dark:bg-slate-900/65 lg:flex">
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
                            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                            : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
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
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                    aria-label={isDarkMode ? "Enable light mode" : "Enable dark mode"}
                  >
                    {isDarkMode ? <SunMedium className="h-4.5 w-4.5" /> : <MoonStar className="h-4.5 w-4.5" />}
                  </button>

                  <div className="hidden xl:block xl:w-[280px]">
                    <div className="rounded-full border border-white/60 bg-white/75 p-1 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
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
                        className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/60 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-white sm:inline-flex"
                        to="/login"
                      >
                        Login
                      </Link>
                      <Link
                        className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_-20px_rgba(129,140,248,0.9)] transition hover:shadow-[0_24px_60px_-20px_rgba(129,140,248,0.95)] active:scale-95"
                        to="/role"
                        style={{ backgroundImage: `linear-gradient(90deg, ${branding?.brandColors?.primaryColor || "#6366f1"}, ${branding?.brandColors?.accentColor || "#ec4899"})` }}
                      >
                        Start
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 xl:hidden">
                <div className="min-w-0 flex-1 rounded-full border border-white/60 bg-white/75 p-1 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                  <LocationSelector />
                </div>
                {user ? (
                  <Link
                    to={showShopActions ? "/wishlist" : "/profile"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                    aria-label={showShopActions ? "Saved items" : "Profile"}
                  >
                    {showShopActions ? <Heart className="h-4.5 w-4.5" /> : <UserRound className="h-4.5 w-4.5" />}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/wishlist"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                      aria-label="Wishlist"
                    >
                      <Heart className="h-4.5 w-4.5" />
                    </Link>
                    <Link
                      to="/cart"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                      aria-label="Cart"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                      aria-label="Login"
                    >
                      <MapPin className="h-4.5 w-4.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      ) : null}

      {!isAdminRoute && !isVendorWorkspace && !isStaffWorkspace && !isInfluencerWorkspace ? (
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
          isAdminRoute || isVendorWorkspace || isStaffWorkspace || isInfluencerWorkspace
            ? "flex-1"
            : "w-full flex-1 px-3 py-5 sm:px-4 sm:py-7 lg:px-8 lg:py-10"
        }
      >
        <PlatformFeaturesProvider>
          <Outlet />
        </PlatformFeaturesProvider>
      </main>

      {!isAdminRoute && !isVendorWorkspace && !isStaffWorkspace && !isInfluencerWorkspace ? <Footer /> : null}

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
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-slate-600 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur transition hover:-translate-y-0.5 hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
