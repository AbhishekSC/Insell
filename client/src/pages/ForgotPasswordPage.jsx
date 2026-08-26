import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import logoDesktop from "../assets/brand/logo-desktop.png";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // Cooldown timer — same pattern as the signup-verification resend cooldown.
  useEffect(() => {
    if (cooldownRemaining <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/auth/password-reset/request", { email });
      return response.data;
    },
    onSuccess: (response) => {
      toast.success(response.message || "OTP sent to your email");
      if (response?.data?.cooldownSeconds) setCooldownRemaining(response.data.cooldownSeconds);
      if (typeof response?.data?.remainingAttempts === "number") setRemainingAttempts(response.data.remainingAttempts);
      // Navigate to OTP verification page with email
      navigate("/verify-otp", { state: { email } });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to send OTP");
      if (err?.response?.data?.cooldownRemaining) setCooldownRemaining(err.response.data.cooldownRemaining);
      if (typeof err?.response?.data?.remainingAttempts === "number") setRemainingAttempts(err.response.data.remainingAttempts);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    if (cooldownRemaining > 0) return;
    mutate();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--p)/0.18),transparent_40%),radial-gradient(circle_at_80%_10%,hsl(var(--s)/0.2),transparent_40%)]"
    >
      <div className="glass-wrap flex flex-col lg:flex-row w-full max-w-5xl mx-auto overflow-hidden">
        <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col justify-center">
          <div className="mb-4 flex items-center">
            <img src={logoDesktop} alt="NearMySpace" className="h-10 w-auto" />
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <p className="text-sm opacity-70">
                Enter your email to receive a password reset OTP
              </p>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="email">
                <span className="label-text">Email</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="john@gmail.com"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button className="btn btn-primary w-full rounded-xl" type="submit" disabled={isPending || cooldownRemaining > 0}>
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Sending OTP...
                </>
              ) : cooldownRemaining > 0 ? (
                `Resend in ${cooldownRemaining}s`
              ) : (
                "Send OTP"
              )}
            </button>

            {remainingAttempts !== null && (
              <p className="text-center text-xs opacity-60">
                {remainingAttempts > 0
                  ? `${remainingAttempts} request${remainingAttempts === 1 ? "" : "s"} left in the next 2 days`
                  : "No requests left — try again in up to 2 days"}
              </p>
            )}

            <div className="text-center mt-4">
              <p className="text-sm">
                Remember your password?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 items-center justify-center">
          <div className="max-w-md p-8 text-center space-y-3">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="Password reset illustration"
                className="w-full h-full"
              />
            </div>
            <h2 className="text-xl font-semibold">
              Secure password recovery
            </h2>
            <p className="opacity-70">
              We'll send you a secure OTP to verify your identity before resetting your password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
