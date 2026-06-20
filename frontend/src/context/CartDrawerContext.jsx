import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export const CartDrawerContext = createContext(null);

const DRAWER_ANIMATION_MS = 300;

/**
 * Cart Drawer Context Provider
 * Manages the state of the side cart drawer
 * 
 * Features:
 * - Open/close drawer with animation
 * - Store recently added product
 * - Smooth transitions
 * - Accessible focus management
 */
export function CartDrawerProvider({ children }) {
  const location = useLocation();
  const lastLocationKeyRef = useRef(location.key);
  const closeTimerRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const bodyOverflowRef = useRef("");
  const bodyPaddingRightRef = useRef("");
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const [toast, setToast] = useState(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback((message, type = "error") => {
    if (!message) return;
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const clearLastAddedItem = useCallback(() => {
    setLastAddedItem(null);
  }, []);

  const openDrawer = useCallback((product, variant = null, quantity = 1) => {
    clearCloseTimer();
    previousActiveElementRef.current = typeof document !== "undefined" ? document.activeElement : null;
    setLastAddedItem({
      product: product || null,
      variant: variant || null,
      quantity: Number(quantity || 1),
      openedAt: Date.now(),
    });
    setOpenCount((count) => count + 1);
    setIsRendered(true);
    setIsOpen(true);
    setToast(null);
  }, [clearCloseTimer]);

  const closeDrawer = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsRendered(false);
      setToast(null);
      const previousActiveElement = previousActiveElementRef.current;
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === "function" &&
        document.contains(previousActiveElement)
      ) {
        previousActiveElement.focus({ preventScroll: true });
      }
    }, DRAWER_ANIMATION_MS);
  }, [clearCloseTimer]);

  const toggleDrawer = useCallback(() => {
    if (isRendered && isOpen) {
      closeDrawer();
      return;
    }

    openDrawer(lastAddedItem?.product || null, lastAddedItem?.variant || null, lastAddedItem?.quantity || 1);
  }, [closeDrawer, isOpen, isRendered, lastAddedItem, openDrawer]);

  useEffect(() => {
    if (!isRendered || typeof document === "undefined") return undefined;

    const scrollbarWidth = Math.max(window.innerWidth - document.documentElement.clientWidth, 0);
    bodyOverflowRef.current = document.body.style.overflow;
    bodyPaddingRightRef.current = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = bodyOverflowRef.current;
      document.body.style.paddingRight = bodyPaddingRightRef.current;
    };
  }, [isRendered]);

  useEffect(() => {
    if (!isRendered) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDrawer, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      lastLocationKeyRef.current = location.key;
      return;
    }

    if (lastLocationKeyRef.current !== location.key) {
      lastLocationKeyRef.current = location.key;
      closeDrawer();
    }
  }, [closeDrawer, isRendered, location.key]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const value = useMemo(() => ({
    isOpen,
    isRendered,
    isAnimating: isOpen,
    openCount,
    lastAddedProduct: lastAddedItem?.product || null,
    lastAddedVariant: lastAddedItem?.variant || null,
    lastAddedQuantity: lastAddedItem?.quantity || 1,
    lastAddedItem,
    toast,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    showToast,
    clearToast,
    clearLastAddedItem,
  }), [clearLastAddedItem, clearToast, closeDrawer, isOpen, isRendered, lastAddedItem, openCount, openDrawer, toast, toggleDrawer, showToast]);

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
    </CartDrawerContext.Provider>
  );
}
