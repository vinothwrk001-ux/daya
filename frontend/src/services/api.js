import axios from "axios";
import { useAuthStore } from "../context/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 20000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Get the most current token from the store
  const { token } = useAuthStore.getState();
  
  // Always add token if it exists, even if no headers exist yet
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

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
      const { refreshToken, setAuth, logout } = useAuthStore.getState();

      originalRequest._retry = true;

      try {
        refreshPromise =
          refreshPromise ||
          api.post("/api/auth/refresh", refreshToken ? { refreshToken } : {}, { headers: { Authorization: undefined } });

        const response = await refreshPromise;
        refreshPromise = null;
        setAuth(response.data.data);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken || response.data.data.token}`;
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
