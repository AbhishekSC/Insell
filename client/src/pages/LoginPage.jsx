import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { notify } from "../lib/errorService.jsx";
import AccountBlockedModal from "../components/AccountBlockedModal";
import { setAuthToken } from "../lib/authToken";
import posthog, { isPostHogEnabled } from "../lib/posthog";
import logoDesktop from "../assets/brand/logo-desktop.png";

export default function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  // Handle Google OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      // Google auth was successful — also grab the token that rode along in
      // the redirect URL (see googleAuthCallback), since Safari blocks the
      // cross-site cookie the backend also tried to set.
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refreshToken');
      if (token) setAuthToken(token, refreshToken);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success('Successfully logged in with Google');
      // Remove success/token from URL
      navigate('/login');
    } else if (error) {
      toast.error(error === 'google_auth_failed' ? 'Google authentication failed' : 'Authentication failed');
      // Remove error from URL
      navigate('/login');
    }
  }, [searchParams, navigate, queryClient]);

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/google?intent=login`;
  };

  const [loginMode, setLoginMode] = useState("password"); // "password" | "otp"
  const [otpStep, setOtpStep] = useState("request"); // "request" | "verify"
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const completeLogin = (response) => {
    setAuthToken(response?.data?.token, response?.data?.refreshToken);
    toast.success("Welcome back to NearMySpace");
    queryClient.setQueryData(["authUser"], {
      status: "success",
      data: {
        user: response?.data || null,
      },
    });
    queryClient.invalidateQueries({ queryKey: ["authUser"] });
    if (isPostHogEnabled()) {
      posthog.capture("login_completed");
    }
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      navigate(next);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // Login owns its own error copy below (wrong password, blocked, etc.),
      // so skip the generic global error card.
      const response = await axiosInstance.post("/auth/login", loginData, { skipErrorToast: true });
      return response.data;
    },
    onSuccess: (response) => {
      completeLogin(response);
    },
    onError: (err) => {
      if (err?.response?.data?.missingFields?.code === "ACCOUNT_BLOCKED") {
        setShowBlockedModal(true);
        return;
      }
      notify.warning("Login failed", err?.response?.data?.message || "Check your email and password.");
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const email = (otpEmail || loginData.email).trim().toLowerCase();
      const response = await axiosInstance.post("/auth/otp-login/request", { email }, { skipErrorToast: true });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Login code sent to your email");
      setOtpStep("verify");
      setCooldown(data?.data?.cooldownSeconds || 60);
    },
    onError: (err) => {
      if (err?.response?.data?.missingFields?.code === "ACCOUNT_BLOCKED") {
        setShowBlockedModal(true);
        return;
      }
      const msg = err?.response?.data?.message || "Failed to send login code.";
      if (err?.response?.status === 404) {
        notify.warning("Account not found", "No account found with this email. Please sign up first.");
      } else {
        notify.warning("Request failed", msg);
      }
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      const email = (otpEmail || loginData.email).trim().toLowerCase();
      const response = await axiosInstance.post("/auth/otp-login/verify", { email, otp: otpCode.trim() }, { skipErrorToast: true });
      return response.data;
    },
    onSuccess: (response) => {
      completeLogin(response);
    },
    onError: (err) => {
      if (err?.response?.data?.missingFields?.code === "ACCOUNT_BLOCKED") {
        setShowBlockedModal(true);
        return;
      }
      notify.warning("Verification failed", err?.response?.data?.message || "Invalid or expired login code.");
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    mutate();
  };

  const handleRequestOtp = (e) => {
    e.preventDefault();
    const emailToUse = (otpEmail || loginData.email).trim();
    if (!emailToUse) {
      notify.warning("Email required", "Please enter your registered email address.");
      return;
    }
    requestOtpMutation.mutate();
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      notify.warning("Code required", "Please enter the 6-digit verification code sent to your email.");
      return;
    }
    verifyOtpMutation.mutate();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--p)/0.18),transparent_40%),radial-gradient(circle_at_80%_10%,hsl(var(--s)/0.2),transparent_40%)]"
    >
      <div className="glass-wrap flex flex-col lg:flex-row w-full max-w-5xl mx-auto overflow-hidden">
        <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col justify-center">
          <div className="mb-4 flex items-center">
            <img src={logoDesktop} alt="NearMySpace" className="h-10 w-auto " />
          </div>

          <div className="w-full space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Welcome Back</h2>
              <p className="text-sm opacity-70">
                Log in and continue your NearMySpace journey.
              </p>
            </div>

            {/* Mode Switcher: Password | OTP */}
            <div className="flex bg-base-200/90 p-1 rounded-2xl border border-base-300">
              <button
                type="button"
                onClick={() => setLoginMode("password")}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                  loginMode === "password"
                    ? "bg-primary text-primary-content shadow-sm"
                    : "text-base-content/70 hover:text-base-content"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("otp");
                  if (!otpEmail && loginData.email) setOtpEmail(loginData.email);
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                  loginMode === "otp"
                    ? "bg-primary text-primary-content shadow-sm"
                    : "text-base-content/70 hover:text-base-content"
                }`}
              >
                Instant OTP
              </button>
            </div>

            {loginMode === "password" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="form-control w-full">
                  <label className="label" htmlFor="email">
                    <span className="label-text">Email</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@gmail.com"
                    className="input input-bordered w-full rounded-xl"
                    value={loginData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label" htmlFor="password">
                    <span className="label-text">Password</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="********"
                    className="input input-bordered w-full rounded-xl"
                    value={loginData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                  />
                </div>

                <button className="btn btn-primary w-full rounded-xl" type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Logging in...
                    </>
                  ) : (
                    "Log In"
                  )}
                </button>

                <div className="text-center mt-2">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {otpStep === "request" ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="form-control w-full">
                      <label className="label" htmlFor="otpEmail">
                        <span className="label-text">Registered Email</span>
                      </label>
                      <input
                        id="otpEmail"
                        type="email"
                        placeholder="john@gmail.com"
                        className="input input-bordered w-full rounded-xl"
                        value={otpEmail || loginData.email}
                        onChange={(e) => {
                          setOtpEmail(e.target.value);
                          setLoginData((prev) => ({ ...prev, email: e.target.value }));
                        }}
                        required
                      />
                      <label className="label">
                        <span className="label-text-alt text-xs opacity-60">
                          We will send a 6-digit login code to your registered email.
                        </span>
                      </label>
                    </div>

                    <button
                      className="btn btn-primary w-full rounded-xl"
                      type="submit"
                      disabled={requestOtpMutation.isPending}
                    >
                      {requestOtpMutation.isPending ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          Sending Code...
                        </>
                      ) : (
                        "Send Login Code"
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-base-200/60 rounded-xl text-xs space-y-1 border border-base-300">
                      <div className="font-semibold text-base-content">Code sent to:</div>
                      <div className="text-primary font-mono text-sm break-all">{otpEmail || loginData.email}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep("request");
                          setOtpCode("");
                        }}
                        className="text-primary hover:underline inline-block mt-1"
                      >
                        Change email
                      </button>
                    </div>

                    <div className="form-control w-full">
                      <label className="label" htmlFor="otpCode">
                        <span className="label-text">Enter 6-Digit Code</span>
                      </label>
                      <input
                        id="otpCode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="input input-bordered w-full rounded-xl tracking-widest text-center text-xl font-bold font-mono"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                      />
                    </div>

                    <button
                      className="btn btn-primary w-full rounded-xl"
                      type="submit"
                      disabled={verifyOtpMutation.isPending || otpCode.length < 6}
                    >
                      {verifyOtpMutation.isPending ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          Verifying...
                        </>
                      ) : (
                        "Verify & Log In"
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="opacity-60">Didn't receive the code?</span>
                      <button
                        type="button"
                        onClick={() => requestOtpMutation.mutate()}
                        disabled={cooldown > 0 || requestOtpMutation.isPending}
                        className={`font-semibold ${
                          cooldown > 0
                            ? "opacity-50 cursor-not-allowed"
                            : "text-primary hover:underline cursor-pointer"
                        }`}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="divider text-xs opacity-70">OR</div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn btn-outline w-full rounded-xl gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="mt-4 text-center">
              <p className="text-sm opacity-70 mb-2">New to NearMySpace?</p>
              <Link to="/signup" className="btn btn-outline btn-primary w-full rounded-xl">
                Create New Account
              </Link>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 items-center justify-center">
          <div className="max-w-md p-8 text-center space-y-3">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="Social real estate marketplace illustration"
                className="w-full h-full"
              />
            </div>
            <h2 className="text-xl font-semibold">
              Where real estate meets real conversations.
            </h2>
            <p className="opacity-70">
              Rejoin your network of buyers, sellers, and brokers on NearMySpace.
            </p>
          </div>
        </div>
      </div>

      {showBlockedModal ? <AccountBlockedModal onClose={() => setShowBlockedModal(false)} /> : null}
    </div>
  );
}
