import { Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function EmptyComparisonState({ message = "No properties found for comparison" }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
            <Building2 className="size-16 text-indigo-400" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center animate-bounce">
            <span className="text-amber-900 font-bold text-sm">!</span>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          No Properties to Compare
        </h2>
        <p className="text-slate-600 mb-8 leading-relaxed">
          {message}
        </p>

        {/* CTA Button */}
        <button
          onClick={() => navigate("/marketplace")}
          className="group inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <ArrowLeft className="size-5" />
          <span>Back to Marketplace</span>
        </button>

        {/* Helper Text */}
        <p className="mt-6 text-sm text-slate-500">
          Select 2-4 properties from the marketplace to compare them side by side
        </p>
      </div>
    </div>
  );
}
