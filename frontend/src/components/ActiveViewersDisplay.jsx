/**
 * Active Viewers Display Component
 * Shows the number of people currently viewing the product with animated transitions
 */

import { useEffect, useState } from "react";
import { useActiveViewers } from "../hooks/useActiveViewers";

/**
 * ActiveViewersDisplay
 * Displays real-time count of active viewers for a product with smooth animations
 *
 * @param {string} productId - The product ID to track
 * @param {string} className - Additional CSS classes
 */
export function ActiveViewersDisplay({ productId, className = "" }) {
  const { count, isLoading } = useActiveViewers(productId);
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate count changes
  useEffect(() => {
    if (count !== displayCount) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayCount(count);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [count, displayCount]);

  // Only show if we have at least 1 viewer (including this user)
  if (displayCount === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 transition-all duration-300 ${
        isAnimating ? "opacity-75 scale-105" : "opacity-100 scale-100"
      } ${className}`}
    >
      {/* Eye Icon */}
      <svg
        className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>

      {/* Text */}
      <span className="font-semibold">
        {isLoading ? (
          "..."
        ) : displayCount > 1 ? (
          <span>
            <span className="text-slate-900 dark:text-white font-bold">
              {displayCount}
            </span>
            {" People are viewing this right now"}
          </span>
        ) : (
          <span>
            <span className="text-slate-900 dark:text-white font-bold">1</span>
            {" Person is viewing this right now"}
          </span>
        )}
      </span>
    </div>
  );
}

export default ActiveViewersDisplay;
