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
        className="group inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        onClick={() => navigate(`/compare-properties?ids=${selected.join(",")}`)}
      >
        <span>Compare {selected.length} Properties</span>
      </button>
    </div>
  );
}
