import { useNavigate } from "react-router";

// Bottom-center pill that appears once 2+ properties are selected for
// comparison, navigating to the shared /compare-properties view — same
// wherever CompareToggleButton is used (Marketplace, profile grids, ...).
export default function CompareFloatingBar({ selected }) {
  const navigate = useNavigate();

  if (selected.length < 2) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
      <button
        type="button"
        className="group inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold shadow-lg shadow-primary/20 hover:bg-primary hover:shadow-xl hover:shadow-primary/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={() => navigate(`/compare-properties?ids=${selected.join(",")}`)}
      >
        <span>Compare {selected.length} Properties</span>
      </button>
    </div>
  );
}
