import axios from "axios";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { attachCsrfHeader } from "./csrf";

function resolveAuthContext() {
  const authState = useAuthStore.getState();
  const role = String(authState?.user?.role || "").trim().toLowerCase();
  const isLegacyAdmin = ["admin", "super_admin", "support_admin", "finance_admin"].includes(role);

  if (authState.user && isLegacyAdmin) {
    return { type: "legacy", ...authState };
  }

  const staffState = useStaffAuthStore.getState();
  if (staffState.user) {
    return { type: "staff", ...staffState };
  }

  if (authState.user) {
    return { type: "legacy", ...authState };
  }

  return { type: "legacy", ...authState };
}

export const adminHttp = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 20000,
  withCredentials: true,
});

adminHttp.interceptors.request.use(async (config) => {
  const auth = resolveAuthContext();
  config.headers = config.headers || {};
  config.__authType = auth.type;
  return attachCsrfHeader(config);
});

let refreshPromise = null;

adminHttp.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const requestPath = originalRequest?.url || "";
    const isAuthEndpoint =
      requestPath.includes("/api/auth/refresh") ||
      requestPath.includes("/api/staff/auth/refresh") ||
      requestPath.includes("/api/auth/logout") ||
      requestPath.includes("/api/staff/auth/logout");

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (originalRequest.__authType === "staff") {
        const { setAuth, logout } = useStaffAuthStore.getState();

        try {
          refreshPromise =
            refreshPromise ||
            adminHttp.post("/api/staff/auth/refresh", {}, { __authType: "staff_refresh" });

          const response = await refreshPromise;
          refreshPromise = null;
          setAuth(response.data.data);
          return adminHttp(originalRequest);
        } catch (refreshError) {
          refreshPromise = null;
          logout();
          return Promise.reject(refreshError);
        }
      }

      const { setAuth, logout } = useAuthStore.getState();

      try {
        refreshPromise =
          refreshPromise ||
          adminHttp.post("/api/auth/refresh", {}, { __authType: "legacy_refresh" });

        const response = await refreshPromise;
        refreshPromise = null;
        setAuth(response.data.data);
        return adminHttp(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
