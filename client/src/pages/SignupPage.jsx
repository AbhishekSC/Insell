import { useState, useEffect } from "react";
import { Compass } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

const SignupPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errorMsg, setErrorMsg] = useState("");

  // Handle Google OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // Store token and redirect
      localStorage.setItem('token', token);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      navigate('/');
      toast.success('Successfully signed up with Google');
    } else if (error) {
      toast.error(error === 'google_auth_failed' ? 'Google authentication failed' : 'Authentication failed');
      // Remove error from URL
      navigate('/signup');
    }
  }, [searchParams, navigate, queryClient]);

  const handleGoogleSignup = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/google`;
  };

  // handle input changes generically
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // );

      const response = await axiosInstance.post("/auth/signup", signupData);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Check your email for a 6-digit verification code");
      // No account exists yet — it's only created once the code is
      // verified. Persist the pending email to sessionStorage as a
      // fallback for router state (lost on a hard refresh of /verify-email).
      sessionStorage.setItem("pendingSignupEmail", signupData.email);
      navigate("/verify-email", { state: { email: signupData.email } });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Something went wrong");
    },
  });

  // handle submit
  const handleSignup = async (e) => {
    e.preventDefault();
    mutate();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--p)/0.18),transparent_40%),radial-gradient(circle_at_80%_10%,hsl(var(--s)/0.2),transparent_40%)]"
    >
      <div className="glass-wrap flex flex-col lg:flex-row w-full max-w-5xl mx-auto overflow-hidden">
        {/* LEFT SIDE FORM */}
        <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col">
          {/* Logo */}
          <div className="mb-4 flex items-center gap-2">
            <Compass className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              SyncSpace
            </span>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="alert alert-error mb-4">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Signup form */}
          <form onSubmit={handleSignup} className="w-full space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Create an Account</h2>
              <p className="text-sm opacity-70">
                Step into SyncSpace and turn travel planning into an epic journey.
              </p>
            </div>

            {/* Full name */}
            <div className="form-control w-full">
              <label className="label" htmlFor="fullName">
                <span className="label-text">Full Name</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="John Doe"
                className="input input-bordered w-full"
                value={signupData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            {/* Email */}
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
                value={signupData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password */}
            <div className="form-control w-full">
              <label className="label" htmlFor="password">
                <span className="label-text">Password</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="********"
                className="input input-bordered w-full"
                value={signupData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
              <p className="text-xs opacity-70 mt-1">
                Password must be at least 6 characters long
              </p>
            </div>

            {/* Terms checkbox */}
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  required
                />
                <span className="text-xs leading-tight">
                  I agree to the{" "}
                  <span className="text-primary hover:underline">
                    terms of service
                  </span>{" "}
                  and{" "}
                  <span className="text-primary hover:underline">
                    privacy policy
                  </span>
                </span>
              </label>
            </div>

            {/* Submit button */}
            <button
              className="btn btn-primary w-full rounded-xl"
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Signing up...
                </>
              ) : (
                "Create Account"
              )}
            </button>

            <div className="divider text-xs opacity-70">OR</div>

            <button
              type="button"
              onClick={handleGoogleSignup}
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

            <div className="text-center mt-4">
              <p className="text-sm">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE Illustration */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="Travel connection illustration"
                className="w-full h-full"
              />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">
                Sync up with travel lovers across the globe.
              </h2>
              <p className="opacity-70">
                Make friends, share routes, and build better trips together.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
