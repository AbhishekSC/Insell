import axios from "axios";
import { toast } from "react-hot-toast";
import { getAuthToken } from "./authToken";

// In dev, VITE_API_URL is unset so this resolves to the relative "/api",
// which vite.config.js proxies to localhost:5001. In production, set
// VITE_API_URL to the deployed backend's origin (e.g. https://insell-api.onrender.com).
const axiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ""}/api`,
  withCredentials: true,
});

// Request interceptor — also send the token as a header, not just the
// cookie. Safari blocks third-party cookies from the backend's own domain
// by default, which otherwise silently breaks auth for every Safari/iOS
// user (frontend and backend are on different domains here).
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Blocked-account errors get a dedicated modal (see AccountBlockedModal /
    // App.jsx and LoginPage.jsx) — skip the generic toast so it doesn't fire
    // alongside that more informative UI.
    if (error.response?.data?.missingFields?.code !== "ACCOUNT_BLOCKED") {
      const message = error.response?.data?.message || error.message || "Something went wrong";
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
