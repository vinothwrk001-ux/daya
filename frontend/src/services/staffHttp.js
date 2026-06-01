import axios from "axios";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { attachCsrfHeader } from "./csrf";

export const staffHttp = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 20000,
  withCredentials: true,
});

staffHttp.interceptors.request.use(attachCsrfHeader);

let refreshPromise = null;

staffHttp.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const requestPath = originalRequest?.url || "";
    const isAuthEndpoint =
      requestPath.includes("/api/staff/auth/login") ||
      requestPath.includes("/api/staff/auth/refresh") ||
      requestPath.includes("/api/staff/auth/logout");

    if (isAuthEndpoint || status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { setAuth, logout } = useStaffAuthStore.getState();
    originalRequest._retry = true;

    try {
      refreshPromise =
        refreshPromise ||
        staffHttp.post("/api/staff/auth/refresh", {});

      const response = await refreshPromise;
      refreshPromise = null;
      setAuth(response.data.data);
      return staffHttp(originalRequest);
    } catch (refreshError) {
      refreshPromise = null;
      logout();
      return Promise.reject(refreshError);
    }
  }
);
