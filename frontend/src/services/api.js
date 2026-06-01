import axios from "axios";
import { useAuthStore } from "../context/authStore";
import { attachCsrfHeader } from "./csrf";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 20000,
  withCredentials: true,
});

api.interceptors.request.use(attachCsrfHeader);

let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const originalRequest = err?.config;
    const requestPath = originalRequest?.url || "";

    // Don't retry logout/logout-all requests - let them fail naturally
    // These endpoints now handle 401 gracefully
    const isAuthEndpoint =
      requestPath.includes("/api/auth/login") ||
      requestPath.includes("/api/auth/register") ||
      requestPath.includes("/api/auth/refresh") ||
      requestPath.includes("/api/auth/logout");
    if (isAuthEndpoint) {
      return Promise.reject(err);
    }

    if (status === 401 && originalRequest && !originalRequest._retry) {
      const { setAuth, logout } = useAuthStore.getState();

      originalRequest._retry = true;

      try {
        refreshPromise =
          refreshPromise ||
          api.post("/api/auth/refresh", {});

        const response = await refreshPromise;
        refreshPromise = null;
        setAuth(response.data.data);
        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);
