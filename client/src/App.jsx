import { Navigate, Route, Routes } from "react-router";
import { useLocation } from "react-router";
import "./App.css";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import ChatPage from "./pages/ChatPage";
import CallPage from "./pages/CallPage";
import LiveCallPage from "./pages/LiveCallPage";
import FriendDetailPage from "./pages/FriendDetailPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import PropertyToolsPage from "./pages/PropertyToolsPage";
import MarketplacePage from "./pages/MarketplacePage";
import MarketplaceDetailPage from "./pages/MarketplaceDetailPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import NewsPage from "./pages/NewsPage";
import TrendingLocalitiesPage from "./pages/TrendingLocalitiesPage";
import DiscoverCommunitiesPage from "./pages/DiscoverCommunitiesPage";
import RequestedCommunitiesPage from "./pages/RequestedCommunitiesPage";
import ActivityPage from "./pages/ActivityPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";
import NewPasswordPage from "./pages/NewPasswordPage";
import PropertyComparisonPage from "./pages/PropertyComparisonPage";
import PropertyMapView from "./pages/PropertyMapView";
import AdminPage from "./pages/AdminPage";
import HelpGuidePage from "./pages/HelpGuidePage";
import AccountBlockedModal from "./components/AccountBlockedModal";
import { Toaster } from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import axiosInstance from "./lib/axios";
import posthog, { isPostHogEnabled } from "./lib/posthog";
import Sentry, { isSentryEnabled } from "./lib/sentry";

function App() {
  const queryClient = useQueryClient();
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSwitchAccountFlow = searchParams.get("switchAccount") === "1";

  // TODO: Axios
  // TODO: react tanstack query
  const {
    data: authData,
    isLoading,
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
        return res.data;
      } catch (err) {
        if (err?.response?.data?.missingFields?.code === "ACCOUNT_BLOCKED") {
          // The session is still technically valid server-side (token not
          // expired) but the account got blocked after the fact — force a
          // real logout so the cookie/blacklist actually clear, instead of
          // just hiding the app while a still-authenticating cookie lingers.
          axiosInstance.post("/auth/logout").catch(() => {});
          setShowBlockedModal(true);
          return null;
        }

        if (err?.response?.status === 401) {
          return null;
        }

        throw err;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const authUser = authData?.data?.user || authData?.data || null;

  useEffect(() => {
    if (!isPostHogEnabled()) return;

    if (authUser?._id) {
      posthog.identify(authUser._id, {
        email: authUser.email,
        name: authUser.fullName,
        role: authUser.activeRole || authUser.primaryRole,
      });
    } else {
      posthog.reset();
    }

    if (isSentryEnabled()) {
      Sentry.setUser(authUser?._id ? { id: authUser._id, email: authUser.email } : null);
    }
    // Only re-run when the identity itself changes, not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?._id]);

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base-200">
        <div className="rounded-2xl border border-base-300 bg-base-100 px-6 py-5 text-center shadow-lg">
          <span className="loading loading-spinner loading-md"></span>
          <p className="mt-2 text-sm text-base-content/70">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const isOnboarded = Boolean(authUser?.isOnboarded);
  // Every account must confirm its email before it can use the app at all —
  // unverified users get bounced to /verify-email from any protected route.
  const isVerified = Boolean(authUser?.isVerified);
  const isAdmin = Boolean(authUser?.isAdmin);
  const guard = (page) => {
    if (!authUser) return <Navigate to="/login" />;
    if (!isVerified) return <Navigate to="/verify-email" />;
    return page;
  };
  const guardAdmin = (page) => {
    if (!authUser) return <Navigate to="/login" />;
    if (!isVerified) return <Navigate to="/verify-email" />;
    if (!isAdmin) return <Navigate to="/marketplace" />;
    return page;
  };

  return (
    <div className="min-h-screen app-ambient">
      <Routes>
        <Route
          path="/"
          element={authUser ? <Navigate to="/marketplace" replace /> : <Navigate to="/login" />}
        />
        <Route
          path="/signup"
          element={!authUser || isSwitchAccountFlow ? <SignupPage /> : <Navigate to="/marketplace" />}
        />
        <Route
          path="/login"
          element={!authUser || isSwitchAccountFlow ? <LoginPage /> : <Navigate to="/marketplace" />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />
        <Route
          path="/verify-otp"
          element={<VerifyOTPPage />}
        />
        <Route
          path="/new-password"
          element={<NewPasswordPage />}
        />
        {/* Mandatory email verification gate: every other authenticated route
            below bounces here via `guard()` until the account is verified.
            Also reachable with no session at all — a fresh signup has no
            User row (and therefore no login session) until its OTP is
            verified, so this route must work both signed-in-but-unverified
            (legacy accounts) and signed-out-with-a-pending-signup. */}
        <Route
          path="/verify-email"
          element={isVerified ? <Navigate to="/marketplace" /> : <VerifyEmailPage />}
        />
        <Route
          path="/compare-properties"
          element={guard(<PropertyComparisonPage />)}
        />
        <Route
          path="/map-view"
          element={guard(<PropertyMapView />)}
        />
        {/* Onboarding is opt-in, reachable from the profile page — not a
            forced gate on every other route. Still redirects away once
            already completed, so it doesn't get revisited by accident. */}
        <Route
          path="/onboarding"
          element={guard(isOnboarded ? <Navigate to="/marketplace" /> : <OnboardingPage />)}
        />
        <Route
          path="/notification"
          element={guard(<ConnectionsPage />)}
        />
        <Route
          path="/connections"
          element={guard(<ConnectionsPage />)}
        />
        <Route
          path="/chat"
          element={guard(<ChatPage />)}
        />
        <Route
          path="/call"
          element={guard(<CallPage />)}
        />
        <Route
          path="/call/live"
          element={guard(<LiveCallPage />)}
        />
        <Route
          path="/friends/:friendId"
          element={guard(<FriendDetailPage />)}
        />
        <Route
          path="/toolkit"
          element={guard(<PropertyToolsPage />)}
        />
        <Route
          path="/property-tools"
          element={guard(<PropertyToolsPage />)}
        />
        <Route
          path="/community"
          element={guard(<MarketplacePage />)}
        />
        <Route
          path="/marketplace"
          element={guard(<MarketplacePage />)}
        />
        <Route
          path="/community/:communityId"
          element={guard(<MarketplaceDetailPage />)}
        />
        <Route
          path="/marketplace/:communityId"
          element={guard(<MarketplaceDetailPage />)}
        />
        <Route
          path="/property/:id"
          element={guard(<PropertyDetailPage />)}
        />
        <Route
          path="/profile"
          element={guard(<ProfilePage />)}
        />
        <Route
          path="/users/:userId"
          element={guard(<UserProfilePage />)}
        />
        <Route
          path="/news"
          element={guard(<NewsPage />)}
        />
        <Route
          path="/trending-localities"
          element={guard(<TrendingLocalitiesPage />)}
        />
        <Route
          path="/discover-communities"
          element={guard(<DiscoverCommunitiesPage />)}
        />
        <Route
          path="/requested-communities"
          element={guard(<RequestedCommunitiesPage />)}
        />
        <Route
          path="/activity"
          element={guard(<ActivityPage />)}
        />
        <Route
          path="/admin"
          element={guardAdmin(<AdminPage />)}
        />
        <Route
          path="/help"
          element={guard(<HelpGuidePage />)}
        />
      </Routes>

      {showBlockedModal ? (
        <AccountBlockedModal
          onClose={() => {
            setShowBlockedModal(false);
            queryClient.setQueryData(["authUser"], null);
          }}
        />
      ) : null}

      <Toaster />
    </div>
  );
}

export default App;
