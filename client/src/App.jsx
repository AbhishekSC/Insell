import { Navigate, Route, Routes } from "react-router";
import { useLocation } from "react-router";
import "./App.css";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
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
import ActivityPage from "./pages/ActivityPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";
import NewPasswordPage from "./pages/NewPasswordPage";
import PropertyComparisonPage from "./pages/PropertyComparisonPage";
import PropertyMapView from "./pages/PropertyMapView";
import { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "./lib/axios";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./context/ThemeProvider";

function App() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSwitchAccountFlow = searchParams.get("switchAccount") === "1";
  const shellRoutes = ["/notification", "/connections", "/chat", "/toolkit", "/property-tools", "/community", "/marketplace", "/profile", "/news", "/activity"];
  const isCallRoute = location.pathname.startsWith("/call");
  const isFriendDetailRoute = location.pathname.startsWith("/friends/");
  const isUserProfileRoute = location.pathname.startsWith("/users/");
  const isPropertyDetailRoute = location.pathname.startsWith("/property/");
  const showFloatingThemeToggle =
    !shellRoutes.includes(location.pathname) &&
    !isCallRoute &&
    !isFriendDetailRoute &&
    !isUserProfileRoute &&
    !isPropertyDetailRoute;

  // TODO: Axios
  // TODO: react tanstack query
  const {
    data: authData,
    isLoading,
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/auth/verify");
        return res.data;
      } catch (err) {
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

  return (
    <div className="min-h-screen app-ambient">
      {showFloatingThemeToggle ? (
        <button
          type="button"
          className="btn btn-sm btn-circle fixed right-4 top-4 z-50 border border-base-300/80 bg-base-100/90 shadow-lg backdrop-blur sm:right-6 sm:top-6"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
      ) : null}

      <Routes>
        <Route
          path="/"
          element={
            authUser ? (isOnboarded ? <Navigate to="/marketplace" replace /> : <Navigate to="/onboarding" />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/signup"
          element={!authUser || isSwitchAccountFlow ? <SignupPage /> : <Navigate to={isOnboarded ? "/marketplace" : "/onboarding"} />}
        />
        <Route
          path="/login"
          element={!authUser || isSwitchAccountFlow ? <LoginPage /> : <Navigate to={isOnboarded ? "/marketplace" : "/onboarding"} />}
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
        <Route
          path="/compare-properties"
          element={authUser ? <PropertyComparisonPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/map-view"
          element={authUser ? <PropertyMapView /> : <Navigate to="/login" />}
        />
        <Route
          path="/onboarding"
          element={authUser ? (isOnboarded ? <Navigate to="/marketplace" /> : <OnboardingPage />) : <Navigate to="/login" />}
        />
        <Route
          path="/notification"
          element={authUser && isOnboarded ? <ConnectionsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/connections"
          element={authUser && isOnboarded ? <ConnectionsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/chat"
          element={authUser && isOnboarded ? <ChatPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/call"
          element={authUser && isOnboarded ? <CallPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/call/live"
          element={authUser && isOnboarded ? <LiveCallPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/friends/:friendId"
          element={authUser && isOnboarded ? <FriendDetailPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/toolkit"
          element={authUser && isOnboarded ? <PropertyToolsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/property-tools"
          element={authUser && isOnboarded ? <PropertyToolsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/community"
          element={authUser && isOnboarded ? <MarketplacePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/marketplace"
          element={authUser && isOnboarded ? <MarketplacePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/community/:communityId"
          element={authUser && isOnboarded ? <MarketplaceDetailPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/marketplace/:communityId"
          element={authUser && isOnboarded ? <MarketplaceDetailPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/property/:id"
          element={authUser && isOnboarded ? <PropertyDetailPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={authUser && isOnboarded ? <ProfilePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/users/:userId"
          element={authUser && isOnboarded ? <UserProfilePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/news"
          element={authUser && isOnboarded ? <NewsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/activity"
          element={authUser && isOnboarded ? <ActivityPage /> : <Navigate to="/login" />}
        />
      </Routes>

      <Toaster />
    </div>
  );
}

export default App;
