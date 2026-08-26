import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import logoDesktop from "../assets/brand/logo-desktop.png";

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/auth/password-reset/verify-otp", { email, otp });
      return response.data;
    },
    onSuccess: (response) => {
      toast.success(response.message || "OTP verified successfully");
      // Navigate to new password page with email
      navigate("/new-password", { state: { email } });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Invalid or expired OTP");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!otp) {
      toast.error("Please enter the OTP");
      return;
    }
    if (otp.length !== 6) {
      toast.error("OTP must be 6 digits");
      return;
    }
    mutate();
  };

  const handleResendOTP = () => {
    // Navigate back to forgot password to request new OTP
    navigate("/forgot-password", { state: { email } });
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
              <h2 className="text-xl font-semibold">Verify OTP</h2>
              <p className="text-sm opacity-70">
                Enter the 6-digit OTP sent to {email}
              </p>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="otp">
                <span className="label-text">One-Time Password</span>
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                placeholder="123456"
                className="input input-bordered w-full text-center text-2xl tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
              />
              <label className="label">
                <span className="label-text-alt text-xs opacity-70">
                  OTP expires in 10 minutes
                </span>
              </label>
            </div>

            <button className="btn btn-primary w-full rounded-xl" type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </button>

            <div className="text-center mt-4 space-y-2">
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-sm text-primary hover:underline"
              >
                Didn't receive OTP? Resend
              </button>
              <div>
                <Link to="/login" className="text-sm text-primary hover:underline">
                  Back to login
                </Link>
              </div>
            </div>
          </form>
        </div>

        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 items-center justify-center">
          <div className="max-w-md p-8 text-center space-y-3">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="OTP verification illustration"
                className="w-full h-full"
              />
            </div>
            <h2 className="text-xl font-semibold">
              Secure verification
            </h2>
            <p className="opacity-70">
              Enter the OTP sent to your email to verify your identity and proceed with password reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
