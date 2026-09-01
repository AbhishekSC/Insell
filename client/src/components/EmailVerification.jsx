import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import { Mail, CheckCircle, Clock, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { setAuthToken } from "../lib/authToken";
import posthog, { isPostHogEnabled } from "../lib/posthog";

const PENDING_SIGNUP_EMAIL_KEY = "pendingSignupEmail";

export default function EmailVerification({ onClose, dismissible = true }) {
  const location = useLocation();
  const queryClient = useQueryClient();

  // Two distinct callers land here: (1) an already-logged-in account that's
  // somehow still unverified (legacy accounts from before signup required
  // verification up front), which uses the original session-based
  // /verification/* endpoints; (2) a brand new signup, which has no User
  // row — and therefore no session — until its code is verified, so it
  // must use the newer email-keyed /auth/verify-signup endpoints instead.
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const isAuthenticatedMode = Boolean(authUser);
  const pendingEmail = isAuthenticatedMode
    ? ""
    : location.state?.email || sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || "";

  const [code, setCode] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(() => {
    // Restore cooldown from localStorage on mount
    const savedCooldown = localStorage.getItem("verificationCooldown");
    if (savedCooldown) {
      const cooldownEnd = parseInt(savedCooldown, 10);
      const now = Date.now();
      if (now < cooldownEnd) {
        return Math.ceil((cooldownEnd - now) / 1000);
      } else {
        localStorage.removeItem("verificationCooldown");
      }
    }
    return 0;
  });
  const [remainingAttempts, setRemainingAttempts] = useState(() => {
    // Restore attempts from localStorage on mount
    const savedAttempts = localStorage.getItem("verificationAttempts");
    return savedAttempts ? parseInt(savedAttempts, 10) : 3;
  });
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const isSendingRef = useRef(false);

  // Check verification status — only meaningful (and only reachable) for
  // an already-authenticated session.
  const { data: verificationStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["verificationStatus"],
    enabled: isAuthenticatedMode,
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/verification/status");
        return res.data.data;
      } catch (error) {
        console.error("Error fetching verification status:", error);
        return { isVerified: false };
      }
    },
  });

  // Send verification code
  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const res = isAuthenticatedMode
        ? await axiosInstance.post("/verification/send-code")
        : await axiosInstance.post("/auth/resend-signup-code", { email: pendingEmail });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Verification code sent to your email");
      setCooldownRemaining(60); // Start 60 second cooldown
      localStorage.setItem("verificationCooldown", String(Date.now() + 60 * 1000));
      setRemainingAttempts(prev => Math.max(0, prev - 1));
      localStorage.setItem("verificationAttempts", String(Math.max(0, remainingAttempts - 1)));
      isSendingRef.current = false;
    },
    onError: (error) => {
      isSendingRef.current = false;
      if (error.response?.status === 429) {
        const { cooldownRemaining: cooldown, remainingAttempts: attempts } = error.response.data;
        setCooldownRemaining(cooldown || 60);
        if (cooldown) {
          localStorage.setItem("verificationCooldown", String(Date.now() + cooldown * 1000));
        }
        setRemainingAttempts(attempts || 0);
        localStorage.setItem("verificationAttempts", String(attempts || 0));
        toast.error(error.response.data.message || "Too many requests. Please wait.");
      } else {
        toast.error(error.response?.data?.message || "Failed to send verification code");
      }
      console.error("Error sending code:", error);
    },
  });

  // Verify code
  const verifyMutation = useMutation({
    mutationFn: async (verificationCode) => {
      const res = isAuthenticatedMode
        ? await axiosInstance.post("/verification/verify", { code: verificationCode })
        : await axiosInstance.post("/auth/verify-signup", { email: pendingEmail, code: verificationCode });
      return res.data;
    },
    onSuccess: (data) => {
      if (isAuthenticatedMode) {
        toast.success("Email verified successfully!");
        refetchStatus();
      } else {
        toast.success("Account created! Welcome to NearMySpace.");
        sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
        setAuthToken(data?.data?.token);
        // verify-signup just created the account and logged it in — seed
        // the auth cache directly instead of waiting on a refetch.
        queryClient.setQueryData(["authUser"], {
          status: "success",
          data: { user: data?.data || null },
        });
        if (isPostHogEnabled()) {
          posthog.capture("signup_completed");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      if (onClose) onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Invalid verification code");
    },
  });

  const handleSendCode = () => {
    if (cooldownRemaining > 0) {
      toast.error(`Please wait ${cooldownRemaining} seconds before requesting another code`);
      return;
    }
    if (sendCodeMutation.isPending) {
      return; // Prevent duplicate requests while one is in progress
    }
    sendCodeMutation.mutate();
  };

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            localStorage.removeItem("verificationCooldown");
            return 0;
          }
          const newCooldown = prev - 1;
          localStorage.setItem("verificationCooldown", String(Date.now() + newCooldown * 1000));
          return newCooldown;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  // Auto-send verification code when modal opens — authenticated mode only.
  // A pending signup already gets its first code from /auth/signup itself,
  // so auto-sending here too would fire a redundant second email and burn
  // one of the 3 daily resend attempts for nothing.
  useEffect(() => {
    let isMounted = true;

    const autoSendCode = async () => {
      if (
        isMounted &&
        isAuthenticatedMode &&
        !verificationStatus?.isVerified &&
        !hasAutoSent &&
        cooldownRemaining === 0 &&
        !isSendingRef.current
      ) {
        isSendingRef.current = true;
        try {
          await sendCodeMutation.mutateAsync();
          if (isMounted) {
            setHasAutoSent(true);
          }
        } catch {
          // Error is handled by mutation onError
          if (isMounted) {
            isSendingRef.current = false;
          }
        }
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      autoSendCode();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticatedMode]);

  const handleVerify = (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    verifyMutation.mutate(code);
  };

  if (isAuthenticatedMode && verificationStatus?.isVerified) {
    return (
      <div className="flex items-center gap-2 text-success">
        <CheckCircle className="size-5" />
        <span className="text-sm font-medium">Email Verified</span>
      </div>
    );
  }

  // No session and no pending signup to verify — e.g. a hard refresh that
  // lost router state and had no sessionStorage fallback either, or direct
  // navigation to this page out of context.
  if (!isAuthenticatedMode && !pendingEmail) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-base-100 rounded-2xl p-6 shadow-2xl border border-base-300 max-w-md w-full text-center">
          <div className="w-10 h-10 bg-warning/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="size-5 text-warning" />
          </div>
          <h3 className="text-lg font-bold text-base-content mb-2">No pending signup found</h3>
          <p className="text-sm text-base-content/70 mb-6">
            We couldn't find a signup to verify. Please sign up again.
          </p>
          <Link to="/signup" className="btn btn-primary rounded-xl w-full">
            Go to Signup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-2xl p-6 shadow-2xl border border-base-300 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center">
              <Mail className="size-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-base-content">
              {isAuthenticatedMode ? "Verify Your Email" : "Verify Your Account"}
            </h3>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <p className="text-sm text-base-content/70 mb-6">
          {isAuthenticatedMode
            ? dismissible
              ? "Get the verified badge by confirming your email address"
              : "Confirm your email address to start using NearMySpace — we've sent a 6-digit code to your inbox."
            : `Enter the 6-digit code we sent to ${pendingEmail} to finish creating your account.`}
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-center text-2xl tracking-widest"
              maxLength={6}
              disabled={verifyMutation.isPending}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={verifyMutation.isPending || code.length !== 6}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifyMutation.isPending
              ? isAuthenticatedMode ? "Verifying..." : "Creating account..."
              : isAuthenticatedMode ? "Verify Email" : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sendCodeMutation.isPending || cooldownRemaining > 0}
            className="text-sm text-primary hover:text-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={`size-4 ${sendCodeMutation.isPending ? "animate-spin" : ""}`} />
            {cooldownRemaining > 0
              ? `Wait ${cooldownRemaining}s`
              : sendCodeMutation.isPending
              ? "Sending..."
              : "Resend Code"}
          </button>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-base-content/60 flex items-center justify-center gap-1">
              <Clock className="size-3" />
              Code expires in 10 minutes
            </p>
            {remainingAttempts < 3 && remainingAttempts > 0 && (
              <p className="text-xs text-warning">
                {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining today
              </p>
            )}
            {remainingAttempts === 0 && (
              <p className="text-xs text-error">
                Daily limit reached. Try again tomorrow.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
