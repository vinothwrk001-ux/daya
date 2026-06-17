/**
 * Hook for managing active viewers tracking
 * Handles viewer session management and periodic polling with realistic updates
 */

import { useEffect, useRef, useState } from "react";
import * as activeViewersService from "../services/activeViewersService";

const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000; // Keep alive every 2 minutes
const POLLING_INTERVAL = 3 * 1000; // Poll for count every 3 seconds for realistic updates

/**
 * useActiveViewers
 * Manages real-time active viewer tracking for a product
 *
 * @param {string} productId - The product ID to track viewers for
 * @returns {Object} - { count: number, isLoading: boolean, sessionId: string | null }
 */
export function useActiveViewers(productId) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Initial viewer tracking
  useEffect(() => {
    if (!productId) return;

    async function initializeViewer() {
      try {
        setIsLoading(true);
        const result = await activeViewersService.trackActiveViewer(
          productId,
          sessionIdRef.current
        );
        sessionIdRef.current = result.sessionId;
        setCount(result.count);
      } catch (error) {
        console.error("Failed to initialize viewer tracking:", error);
      } finally {
        setIsLoading(false);
      }
    }

    initializeViewer();

    // Set up keep-alive interval
    keepAliveIntervalRef.current = setInterval(async () => {
      if (sessionIdRef.current) {
        try {
          const count = await activeViewersService.keepViewerAlive(
            productId,
            sessionIdRef.current
          );
          setCount(count);
        } catch (error) {
          console.error("Failed to keep viewer alive:", error);
        }
      }
    }, KEEP_ALIVE_INTERVAL);

    // Set up polling interval for count updates with realistic frequency
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const count = await activeViewersService.getActiveViewerCount(productId);
        setCount(count);
      } catch (error) {
        console.error("Failed to fetch active viewer count:", error);
      }
    }, POLLING_INTERVAL);

    // Cleanup on unmount or product change
    return () => {
      // Keep the session alive one more time when leaving
      if (sessionIdRef.current && productId) {
        activeViewersService.removeViewerSession(productId, sessionIdRef.current).catch(
          (error) => console.error("Failed to remove viewer session:", error)
        );
      }

      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [productId]);

  // Keep viewer alive when page gains focus
  useEffect(() => {
    const handleFocus = async () => {
      if (sessionIdRef.current && productId) {
        try {
          const count = await activeViewersService.keepViewerAlive(
            productId,
            sessionIdRef.current
          );
          setCount(count);
        } catch (error) {
          console.error("Failed to refresh viewer on focus:", error);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [productId]);

  return {
    count,
    isLoading,
    sessionId: sessionIdRef.current,
  };
}
