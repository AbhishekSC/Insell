import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "stream-chat-react/dist/css/index.css";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StreamProvider } from "./context/StreamProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { initPostHog } from "./lib/posthog";
import Sentry, { initSentry } from "./lib/sentry";

initPostHog();
initSentry();

// Create a client with optimized caching settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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
    <Sentry.ErrorBoundary fallback={errorFallback}>
      <ThemeProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <StreamProvider>
              <App />
            </StreamProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
