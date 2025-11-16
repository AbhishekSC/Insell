import { useState } from "react";
import { Languages } from "lucide-react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import axios from "axios";

const SignupPage = () => {
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // handle input changes generically
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  // Tenstack query

  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      // const response = await axios.post(
      //   "http://localhost:5001/api/auth/signup",
      //   signupData,
      //   // { withCredentials: true }
      // );

      const response = await axiosInstance.post("/auth/signup", signupData);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Signed-up to SyncSpace");
      console.log("Redirecting to /api/auth/verify");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
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
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden"
      data-theme="forest"
    >
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* LEFT SIDE FORM */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* Logo */}
          <div className="mb-4 flex items-center gap-2">
            <Languages className="size-9 text-primary" />
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
                Step into SyncSpace and turn language learning into an epic
                journey!
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
              className="btn btn-primary w-full"
              type="submit"
              disabled={isLoading}
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
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/video-call-signup.png"
                alt="Language connection illustration"
                className="w-full h-full"
              />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">
                Sync up with language lovers across the globe.
              </h2>
              <p className="opacity-70">
                Make friends, share stories, and speak like a native.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
