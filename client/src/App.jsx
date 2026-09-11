import { Navigate, Route, Routes } from "react-router";
import { useLocation } from "react-router";
import { lazy, Suspense } from "react";
import "./App.css";
import AccountBlockedModal from "./components/AccountBlockedModal";
import AppToaster from "./components/AppToaster";
import BrandLoader from "./components/BrandLoader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import axiosInstance from "./lib/axios";
import posthog, { isPostHogEnabled } from "./lib/posthog";
import Sentry, { isSentryEnabled } from "./lib/sentry";

// Every route below is its own chunk, fetched only when a visitor actually
// navigates there. Before this, ALL of these — Admin, the Stream video/chat
// SDKs pulled in by CallPage/ChatPage, Leaflet in PropertyMapView, the
// property comparison tool — shipped in one ~4.5MB bundle on first load,
// regardless of which single page someone opened. A guest landing on "/"
// downloaded the entire admin panel; that's the fix.
const SignupPage = lazy(() => import("./pages/SignupPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const LiveCallPage = lazy(() => import("./pages/LiveCallPage"));
const FriendDetailPage = lazy(() => import("./pages/FriendDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const PublicUserProfilePage = lazy(() => import("./pages/PublicUserProfilePage"));
const GuestLandingPage = lazy(() => import("./pages/GuestLandingPage"));
const PropertyToolsPage = lazy(() => import("./pages/PropertyToolsPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const MarketplaceDetailPage = lazy(() => import("./pages/MarketplaceDetailPage"));
const PropertyDetailPage = lazy(() => import("./pages/PropertyDetailPage"));
const PublicPropertyDetailPage = lazy(() => import("./pages/PublicPropertyDetailPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const TrendingLocalitiesPage = lazy(() => import("./pages/TrendingLocalitiesPage"));
const RecommendedForYouPage = lazy(() => import("./pages/RecommendedForYouPage"));
const TrendingNearYouPage = lazy(() => import("./pages/TrendingNearYouPage"));
const MyDealsPage = lazy(() => import("./pages/MyDealsPage"));
const SavedSearchesPage = lazy(() => import("./pages/SavedSearchesPage"));
const DiscoverCommunitiesPage = lazy(() => import("./pages/DiscoverCommunitiesPage"));
const RequestedCommunitiesPage = lazy(() => import("./pages/RequestedCommunitiesPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const VerifyOTPPage = lazy(() => import("./pages/VerifyOTPPage"));
const NewPasswordPage = lazy(() => import("./pages/NewPasswordPage"));
const PropertyComparisonPage = lazy(() => import("./pages/PropertyComparisonPage"));
const PropertyMapView = lazy(() => import("./pages/PropertyMapView"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const HelpGuidePage = lazy(() => import("./pages/HelpGuidePage"));

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
    return <BrandLoader />;
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
      <Suspense fallback={<BrandLoader />}>
        <Routes>
          <Route
            path="/"
            element={authUser ? <Navigate to="/marketplace" replace /> : <GuestLandingPage />}
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
            element={authUser ? guard(<PropertyDetailPage />) : <PublicPropertyDetailPage />}
          />
          <Route
            path="/profile"
            element={guard(<ProfilePage />)}
          />
          <Route
            path="/users/:userId"
            element={authUser ? guard(<UserProfilePage />) : <PublicUserProfilePage />}
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
            path="/trending-near-you"
            element={guard(<TrendingNearYouPage />)}
          />
          <Route
            path="/recommended"
            element={guard(<RecommendedForYouPage />)}
          />
          <Route
            path="/deals"
            element={guard(<MyDealsPage />)}
          />
          <Route
            path="/saved-searches"
            element={guard(<SavedSearchesPage />)}
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
      </Suspense>

      {showBlockedModal ? (
        <AccountBlockedModal
          onClose={() => {
            setShowBlockedModal(false);
            queryClient.setQueryData(["authUser"], null);
          }}
        />
      ) : null}

      <AppToaster />
    </div>
  );
}

export default App;
