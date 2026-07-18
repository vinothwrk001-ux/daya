import { Portal } from "./Portal";
import { useCartDrawer } from "../hooks/useCartDrawer";

/**
 * CartDrawer Overlay Component
 * 
 * Renders:
 * - Semi-transparent dark overlay
 * - Smooth fade in/out animations
 * - Click-to-close functionality
 * - ESC key support
 */
export function CartDrawerOverlay() {
  const { isRendered, isAnimating, closeDrawer } = useCartDrawer();

  if (!isRendered) return null;

  return (
    <Portal>
      <div
        role="presentation"
        onClick={closeDrawer}
        className={`fixed inset-0 transition-all duration-300 ${
          isAnimating ? "bg-slate-950/55 backdrop-blur-[4px]" : "pointer-events-none bg-slate-950/0"
        }`}
        style={{
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
          zIndex: 2147483646,
        }}
        aria-hidden="true"
      />
    </Portal>
  );
}
