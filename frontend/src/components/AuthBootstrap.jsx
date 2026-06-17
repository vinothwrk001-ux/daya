import { useEffect } from "react";
import { useAuthStore } from "../context/authStore";
import * as authService from "../services/authService";

/**
 * Restores the authenticated session once on app mount so header auth state
 * is correct before the first paint of protected UI (no Login flicker).
 */
export function AuthBootstrap({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authReady = useAuthStore((s) => s.authReady);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (isAuthenticated) {
        if (!authReady) setAuthReady(true);
        return;
      }

      try {
        const response = await authService.refreshSession();
        if (!cancelled) setAuth(response?.data || response);
      } catch {
        // Unauthenticated visitors are expected.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return children;
}
