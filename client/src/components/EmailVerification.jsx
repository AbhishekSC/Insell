import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, CheckCircle, Clock, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

export default function EmailVerification({ onClose }) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
  const hasMountedRef = useRef(false);
  const mutationCallCountRef = useRef(0);
  const queryClient = useQueryClient();

  // Check verification status
  const { data: verificationStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["verificationStatus"],
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
      const res = await axiosInstance.post("/verification/send-code");
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Verification code sent to your email");
      console.log("📧 Check your email for the verification code");
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
        toast.error("Failed to send verification code");
      }
      console.error("Error sending code:", error);
    },
  });

  // Verify code
  const verifyMutation = useMutation({
    mutationFn: async (verificationCode) => {
      const res = await axiosInstance.post("/verification/verify", { code: verificationCode });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Email verified successfully!");
      refetchStatus();
      // Invalidate authUser query to trigger hot reload across the app
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

  // Auto-send verification code when modal opens (only once per session)
  useEffect(() => {
    let isMounted = true;
    
    const autoSendCode = async () => {
      // Only auto-send if conditions are met
      if (isMounted && !verificationStatus?.isVerified && !hasAutoSent && cooldownRemaining === 0 && !isSendingRef.current) {
        isSendingRef.current = true;
        try {
          await sendCodeMutation.mutateAsync();
          if (isMounted) {
            setHasAutoSent(true);
          }
        } catch (error) {
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
  }, []);

  const handleVerify = (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    verifyMutation.mutate(code);
  };

  if (verificationStatus?.isVerified) {
    return (
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle className="size-5" />
        <span className="text-sm font-medium">Email Verified</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Mail className="size-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Verify Your Email</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Get the verified badge by confirming your email address
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-widest"
              maxLength={6}
              disabled={verifyMutation.isPending}
            />
          </div>

          <button
            type="submit"
            disabled={verifyMutation.isPending || code.length !== 6}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sendCodeMutation.isPending || cooldownRemaining > 0}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={`size-4 ${sendCodeMutation.isPending ? "animate-spin" : ""}`} />
            {cooldownRemaining > 0
              ? `Wait ${cooldownRemaining}s`
              : sendCodeMutation.isPending
              ? "Sending..."
              : "Resend Code"}
          </button>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Clock className="size-3" />
              Code expires in 10 minutes
            </p>
            {remainingAttempts < 3 && remainingAttempts > 0 && (
              <p className="text-xs text-amber-600">
                {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining today
              </p>
            )}
            {remainingAttempts === 0 && (
              <p className="text-xs text-red-600">
                Daily limit reached. Try again tomorrow.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
