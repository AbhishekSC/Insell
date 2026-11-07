import React from "react";
import * as Sentry from "@sentry/react";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    try {
      Sentry.captureException(error, { extra: errorInfo });
    } catch {
      // Sentry may not be initialized — silently ignore
    }
  }

  render() {
    if (this.state.hasError) {
      const pageName = this.props.name || "This page";
      return (
        <div className="flex min-h-screen items-center justify-center bg-base-100 px-4">
          <div className="mx-auto max-w-md rounded-xl bg-base-200 p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-error/10 text-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-base-content">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-base-content/60">
              {pageName} ran into an unexpected error. You can try reloading or
              head back to the marketplace.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline btn-sm rounded-xl"
              >
                Try again
              </button>
              <a href="/marketplace" className="btn btn-primary btn-sm rounded-xl">
                Go back to Marketplace
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
