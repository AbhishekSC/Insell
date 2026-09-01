import { Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function EmptyComparisonState({ message = "No properties found for comparison" }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
            <Building2 className="size-16 text-primary" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-warning rounded-full flex items-center justify-center animate-bounce">
            <span className="text-warning font-bold text-sm">!</span>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl font-bold text-base-content mb-3">
          No Properties to Compare
        </h2>
        <p className="text-base-content/70 mb-8 leading-relaxed">
          {message}
        </p>

        {/* CTA Button */}
        <button
          onClick={() => navigate("/marketplace")}
          className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold shadow-lg shadow-primary/20 hover:bg-primary hover:shadow-xl hover:shadow-primary/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <ArrowLeft className="size-5" />
          <span>Back to Marketplace</span>
        </button>

        {/* Helper Text */}
        <p className="mt-6 text-sm text-base-content/60">
          Select 2-4 properties from the marketplace to compare them side by side
        </p>
      </div>
    </div>
  );
}
