import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { Compass } from "lucide-react";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

// Mirrors the server-side check in AuthService.js — kept in sync manually
// since this is plain client validation, not a shared package.
const PASSWORD_RULES = [
  { key: "length", label: "At least 6 characters", test: (pw) => pw.length >= 6 },
  { key: "uppercase", label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { key: "special", label: "One special character", test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/;']/.test(pw) },
];

export default function NewPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/auth/password-reset/reset", { email, newPassword });
      return response.data;
    },
    onSuccess: (response) => {
      toast.success(response.message || "Password reset successfully");
      navigate("/login");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to reset password");
    },
  });

  const passwordChecks = PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) }));
  const isPasswordValid = passwordChecks.every((rule) => rule.passed);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!isPasswordValid) {
      toast.error("Password doesn't meet the requirements below");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    mutate();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--p)/0.18),transparent_40%),radial-gradient(circle_at_80%_10%,hsl(var(--s)/0.2),transparent_40%)]"
    >
      <div className="glass-wrap flex flex-col lg:flex-row w-full max-w-5xl mx-auto overflow-hidden">
        <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col justify-center">
          <div className="mb-4 flex items-center gap-2">
            <Compass className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              InSell
            </span>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Set New Password</h2>
              <p className="text-sm opacity-70">
                Create a new password for your account
              </p>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="newPassword">
                <span className="label-text">New Password</span>
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="********"
                className="input input-bordered w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              {newPassword.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {passwordChecks.map((rule) => (
                    <li
                      key={rule.key}
                      className={`flex items-center gap-1.5 text-xs ${rule.passed ? "text-success" : "opacity-60"}`}
                    >
                      <span>{rule.passed ? "✓" : "○"}</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="confirmPassword">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="********"
                className="input input-bordered w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button className="btn btn-primary w-full rounded-xl" type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to login
              </Link>
            </div>
          </form>
        </div>

        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 items-center justify-center">
          <div className="max-w-md p-8 text-center space-y-3">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="New password illustration"
                className="w-full h-full"
              />
            </div>
            <h2 className="text-xl font-semibold">
              Secure your account
            </h2>
            <p className="opacity-70">
              Choose a strong password to protect your account — at least 6 characters, with one uppercase letter and one special character.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
