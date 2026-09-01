import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function ComparisonHeader({ propertyCount }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-xl border-b border-base-300/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => navigate("/marketplace")}
            className="group flex items-center gap-2 px-4 py-2 rounded-full hover:bg-base-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Back to Marketplace"
          >
            <ArrowLeft className="size-5 text-base-content/70 group-hover:text-base-content transition-colors" />
            <span className="font-medium text-base-content group-hover:text-base-content transition-colors">
              Back
            </span>
          </button>

          <div className="text-center">
            <h1 className="text-xl font-bold text-base-content tracking-tight">
              Property Comparison
            </h1>
            <p className="text-sm text-base-content/60 mt-0.5">
              Comparing {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
            </p>
          </div>

          <div className="w-32" />
        </div>
      </div>
    </header>
  );
}
