import { useNavigate } from "react-router-dom";

/**
 * BackButton Component
 * 
 * Reusable back navigation button
 * Navigates to previous page or optional fallback route
 */
export function BackButton({ fallbackTo = null }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (fallbackTo) {
      navigate(fallbackTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      aria-label="Go back to previous page"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back
    </button>
  );
}
