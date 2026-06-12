import { logger } from "../services/logger/logger.js";
import { memo, useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as subcategoryService from "../services/subcategoryService";

/**
 * CategoryNavigation Component
 * Premium marketplace-style horizontal category navigation navbar.
 * Inspired by Noon, Amazon, and Flipkart category navigation.
 */
function CategoryNavigationComponent({ categories = [], onSelect, selectedCategory }) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [subcategories, setSubcategories] = useState({});
  const [loadingSubcategories, setLoadingSubcategories] = useState(null);
  const scrollContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);

  // Check scroll position for arrow visibility
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

  // Smooth horizontal scroll
  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
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

  // Lazy load subcategories on hover
  const handleCategoryHover = async (categoryId) => {
    setHoveredCategoryId(categoryId);
    
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }

    if (subcategories[categoryId]) return;

    try {
      setLoadingSubcategories(categoryId);
      const response = await subcategoryService.getSubcategoriesByCategory(categoryId);
      setSubcategories((prev) => ({
        ...prev,
        [categoryId]: response.data || [],
      }));
    } catch (error) {
      logger.error("Failed to load subcategories:", { error: error });
    } finally {
      setLoadingSubcategories(null);
    }
  };

  const handleHoverLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setHoveredCategoryId(null);
    }, 150);
  };

  const categoryList = Array.isArray(categories) ? categories : [];

  if (categoryList.length === 0) {
    return null;
  }

  return (
    <>
      <nav
        className="sticky top-20 z-30 border-b border-brand-border bg-brand-secondary text-white backdrop-blur-md will-change-none"
        style={{ height: "48px" }}
      >
        <div className="w-full px-2 lg:px-4 h-full flex items-center relative">
          {/* Left Arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("left")}
              className="hidden lg:flex absolute left-0 z-10 h-full w-12 items-center justify-center bg-gradient-to-r from-brand-secondary to-transparent transition-colors duration-200 flex-shrink-0"
              aria-label="Scroll categories left"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}

          {/* Categories Container */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex-1 overflow-x-auto scrollbar-hide flex items-center"
            style={{ scrollBehavior: "smooth", msOverflowStyle: "none" }}
          >
            <div className="flex items-center gap-1 px-2 h-full whitespace-nowrap lg:px-12">
              {categoryList.map((category) => {
                const isSelected = selectedCategory?.id === category.id || selectedCategory?.slug === category.slug;
                
                return (
                  <div
                    key={category.id}
                    onMouseEnter={() => handleCategoryHover(category.id)}
                    onMouseLeave={handleHoverLeave}
                    className="relative group"
                  >
                    <button
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`flex items-center gap-2 px-3 py-2 h-full text-xs sm:text-sm font-medium transition-all duration-200 relative group/btn ${
                        isSelected
                          ? "text-white"
                          : "text-white/78 hover:text-white"
                      }`}
                    >
                      <span className="flex-shrink-0">{category.name}</span>

                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
                      )}

                      {!isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full transform scale-x-0 group-hover/btn:scale-x-100 transition-transform duration-300 origin-center" />
                      )}
                    </button>

                    {/* Dropdown Submenu */}
                    {hoveredCategoryId === category.id && (
                      <div
                        className="absolute top-full left-0 pt-0 z-50 animate-in fade-in duration-150"
                        onMouseEnter={() => {
                          if (dropdownTimeoutRef.current) {
                            clearTimeout(dropdownTimeoutRef.current);
                          }
                        }}
                        onMouseLeave={handleHoverLeave}
                      >
                        <div className="bg-white shadow-brandMd border border-brand-border rounded-b-lg min-w-[200px] overflow-hidden">
                          {loadingSubcategories === category.id ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-500">
                              Loading...
                            </div>
                          ) : (subcategories[category.id] || []).length > 0 ? (
                            <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
                              {(subcategories[category.id] || []).slice(0, 8).map((sub) => (
                                <button
                                  key={sub._id || sub.id}
                                  type="button"
                                  onClick={() => {
                                    onSelect?.(sub);
                                    setHoveredCategoryId(null);
                                  }}
                                  className="px-4 py-2 text-xs sm:text-sm text-left text-slate-700 hover:bg-red-50 hover:text-brand-primary transition-colors duration-150 font-medium"
                                >
                                  {sub.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-4 py-6 text-center text-xs text-slate-500">
                              No subcategories
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="hidden lg:flex absolute right-0 z-10 h-full w-12 items-center justify-center bg-gradient-to-l from-brand-secondary to-transparent transition-colors duration-200 flex-shrink-0"
              aria-label="Scroll categories right"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      </nav>

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
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-in {
          animation: fadeInScale 200ms ease-out forwards;
        }

        .fade-in {
          animation: fadeInScale 200ms ease-out;
        }
      `}</style>
    </>
  );
}

export const CategoryNavigation = memo(CategoryNavigationComponent);
