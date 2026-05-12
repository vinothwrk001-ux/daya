import { memo, useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as subcategoryService from "../services/subcategoryService";

function CategoryNavigationComponent({ categories = [], onSelect, selectedCategory }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [subcategories, setSubcategories] = useState({});
  const [loadingSubcategories, setLoadingSubcategories] = useState(null);
  const scrollContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);

  // Handle window scroll with throttling
  useEffect(() => {
    let ticking = false;

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 100);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check scroll position of category container
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [categories]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(checkScroll, 400);
    }
  };

  const handleCategorySelect = (category) => {
    onSelect?.(category);
    setTimeout(checkScroll, 50);
  };

  const handleCategoryHover = async (categoryId) => {
    if (isScrolled) return; // Don't show dropdown in scrolled mode

    setHoveredCategoryId(categoryId);
    
    // Clear previous timeout
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }

    // Don't fetch if already cached
    if (subcategories[categoryId]) return;

    try {
      setLoadingSubcategories(categoryId);
      const response = await subcategoryService.getSubcategoriesByCategory(categoryId);
      setSubcategories((prev) => ({
        ...prev,
        [categoryId]: response.data || [],
      }));
    } catch (error) {
      console.error("Failed to load subcategories:", error);
    } finally {
      setLoadingSubcategories(null);
    }
  };

  const handleHoverLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setHoveredCategoryId(null);
    }, 100);
  };

  const categoryList = Array.isArray(categories) ? categories : [];

  return (
    <div
      className={`sticky top-16 z-40 border-b bg-white/95 backdrop-blur-xl will-change-none transition-all duration-300 dark:border-slate-800/50 dark:bg-slate-950/95 ${
        isScrolled ? "border-slate-200/70 shadow-lg" : "border-slate-200/30 shadow-sm"
      }`}
    >
      <div className="mx-auto w-full max-w-[88rem] px-3 lg:px-8 relative">
        {/* Category Navigation */}
        <div className="flex items-center gap-2 py-2 relative">
          {/* Left scroll button */}
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className={`flex-shrink-0 rounded-lg p-2 transition-all duration-200 ${
              canScrollLeft
                ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-600"
            } ${isScrolled ? "opacity-0 w-0 pointer-events-none" : "opacity-100"}`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Categories Container */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex-1 overflow-x-auto scrollbar-hide"
            style={{ scrollBehavior: "smooth" }}
          >
            <div
              className={`flex px-2 py-2 will-change-none transition-all duration-300 ${
                isScrolled ? "gap-1" : "gap-4"
              }`}
            >
              {categoryList.map((category) => {
                const isSelected = selectedCategory?.id === category.id || selectedCategory?.slug === category.slug;
                
                // Scrolled mode: compact text-only buttons
                if (isScrolled) {
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`flex items-center gap-1 flex-shrink-0 px-3 py-1 text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap rounded-full ${
                        isSelected
                          ? "text-blue-600 font-bold border-b-2 border-blue-600"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                }

                // Normal mode: vertical icon + label layout with hover dropdown
                return (
                  <div
                    key={category.id}
                    onMouseEnter={() => handleCategoryHover(category.id)}
                    onMouseLeave={handleHoverLeave}
                  >
                    <button
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`flex flex-col items-center justify-center gap-2 flex-shrink-0 rounded-lg px-4 py-2 text-center transition-colors duration-200 whitespace-nowrap group ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      }`}
                    >
                      {/* Icon */}
                      {category?.IconComponent ? (
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
                          isSelected 
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" 
                            : "bg-white text-slate-600 group-hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
                        }`}>
                          <category.IconComponent className="h-5 w-5" />
                        </span>
                      ) : null}
                      {/* Label */}
                      <span className={`text-xs font-semibold transition-colors duration-200 ${
                        isSelected
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}>
                        {category.name.length > 12 ? `${category.name.substring(0, 10)}...` : category.name}
                      </span>
                      {/* Active indicator */}
                      {isSelected ? (
                        <div className="h-1 w-8 rounded-full bg-blue-600"></div>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right scroll button */}
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className={`flex-shrink-0 rounded-lg p-2 transition-all duration-200 ${
              canScrollRight
                ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-slate-900/50 dark:text-slate-600"
            } ${isScrolled ? "opacity-0 w-0 pointer-events-none" : "opacity-100"}`}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dropdown Submenu - Flipkart Style */}
        {hoveredCategoryId && !isScrolled && (
          <div
            className="fixed left-0 right-0 top-[7.5rem] z-40 animate-in fade-in duration-200"
            onMouseEnter={() => {
              if (dropdownTimeoutRef.current) {
                clearTimeout(dropdownTimeoutRef.current);
              }
            }}
            onMouseLeave={handleHoverLeave}
          >
            <div className="mx-auto w-full max-w-[88rem] px-3 lg:px-8 py-4">
              <div className="bg-white shadow-xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 overflow-hidden backdrop-blur-xl">
                {loadingSubcategories === hoveredCategoryId ? (
                  <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
                ) : (subcategories[hoveredCategoryId] || []).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0">
                    {(subcategories[hoveredCategoryId] || []).map((subcategory) => (
                      <button
                        key={subcategory._id || subcategory.id}
                        type="button"
                        onClick={() => {
                          onSelect?.(subcategory);
                          setHoveredCategoryId(null);
                        }}
                        className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors duration-100 group cursor-pointer border-slate-100 dark:border-slate-800"
                      >
                        <span className="block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-100 line-clamp-2">
                          {subcategory.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No subcategories</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smooth scroll styling */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-12px) scale(0.95);
          }
        }
        
        .animate-in {
          animation: fadeInScale 300ms ease-out forwards;
        }
        
        .fade-in {
          animation: fadeInScale 300ms ease-out;
        }
      `}</style>
    </div>
  );
}

export const CategoryNavigation = memo(CategoryNavigationComponent);
