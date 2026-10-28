import axios from "axios";
import {
  getAuthToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
} from "./authToken";
import { showError } from "./errorService.jsx";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

const axiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

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

// Concurrency queue to prevent thundering herd on token refresh
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || "";

    const isAuthRoute =
      url.includes("/auth/refresh") ||
      url.includes("/auth/login") ||
      url.includes("/auth/signup") ||
      url.includes("/auth/verify-signup") ||
      url.includes("/auth/otp-login");

    // If 401 and eligible for refresh
    if (status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const storedRefreshToken = getRefreshToken();
        // If there is no refresh token in storage, don't make a pointless request
        if (!storedRefreshToken) {
          return Promise.reject(error);
        }

        // The endpoint accepts refresh token in body or in httpOnly cookie
        const res = await axios.post(
          `${API_BASE}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const data = res.data?.data;
        const newAccessToken = data?.accessToken || data?.token;
        const newRefreshToken = data?.refreshToken;

        if (newAccessToken) {
          setAuthTokens({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });

          processQueue(null, newAccessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return axiosInstance(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthTokens();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Retry once on 429 (rate-limited) after the server's Retry-After delay
    if (status === 429 && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = true;
      const retryAfter = error.response?.data?.retryAfter
        || parseInt(error.response?.headers?.["retry-after"], 10)
        || 2;
      const delay = Math.min(retryAfter, 10) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return axiosInstance(originalRequest);
    }

    // Blocked-account errors get a dedicated modal
    const isAccountBlocked = error.response?.data?.missingFields?.code === "ACCOUNT_BLOCKED";
    const isSilenced = error.config?.skipErrorToast;
    const componentOwns = [400, 409, 422].includes(status) && !error.config?.forceErrorToast;
    if (!isAccountBlocked && !isSilenced && !componentOwns) {
      showError(error);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
