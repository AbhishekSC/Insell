import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "stream-chat-react/dist/css/index.css";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { StreamProvider } from "./context/StreamProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { StoryOverlayProvider } from "./context/StoryOverlayContext";
import { FeatureFlagProvider } from "./context/FeatureFlagContext";
import { initPostHog } from "./lib/posthog";
import Sentry, { initSentry } from "./lib/sentry";
import { setAuthToken } from "./lib/authToken";
import axiosInstance from "./lib/axios";

initPostHog();
initSentry();

// If this load is the browser landing back from the Google OAuth redirect,
// persist the token synchronously before anything renders. Doing this inside
// LoginPage's own effect (as before) was too late — App.jsx and other
// components fire their own queries on mount, which happens before a child
// route's effect runs, so those requests raced ahead with no token attached
// and each surfaced its own spurious "Unauthorized" toast.
const oauthParams = new URLSearchParams(window.location.search);
if (oauthParams.get("success") === "true") {
  const oauthToken = oauthParams.get("token");
  const oauthRefreshToken = oauthParams.get("refreshToken");
  if (oauthToken) setAuthToken(oauthToken, oauthRefreshToken);
}

// Create a client with optimized caching settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        if (queryKey[0] === "authUser") {
          try {
            const res = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
            return res.data;
          } catch {
            return null;
          }
        }
        return null;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes (reduced from 5)
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // Changed to true
      refetchOnMount: true, // Changed to true
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Create persistent cache for 0ms instant reload across browser sessions
const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "NEARMPSPACE_WEB_CACHE_V1",
  throttleTime: 1000,
});

const errorFallback = (
  <div className="grid min-h-screen place-items-center bg-base-200 p-6 text-center">
    <div>
      <h1 className="text-xl font-bold text-base-content">Something went wrong</h1>
      <p className="mt-2 text-sm text-base-content/70">
        We hit an unexpected error. Try refreshing the page.
      </p>
    </div>
  </div>
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <Sentry.ErrorBoundary fallback={errorFallback}>
        <ThemeProvider>
          <BrowserRouter>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: localStoragePersister,
                maxAge: 1000 * 60 * 60 * 24, // 24 hours
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) => {
                    const queryKey = query.queryKey;
                    if (!Array.isArray(queryKey)) return false;
                    const key = String(queryKey[0]);
                    if (key === "streamToken" || key === "activeVideoCalls" || key === "call") {
                      return false;
                    }
                    return query.state.status === "success";
                  },
                },
              }}
            >
              <StreamProvider>
                <StoryOverlayProvider>
                  <FeatureFlagProvider>
                    <App />
                  </FeatureFlagProvider>
                </StoryOverlayProvider>
              </StreamProvider>
            </PersistQueryClientProvider>
          </BrowserRouter>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </HelmetProvider>
  </StrictMode>
);
