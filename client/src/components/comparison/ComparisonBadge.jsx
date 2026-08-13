import { Star } from "lucide-react";

export default function ComparisonBadge({ children, variant = "best" }) {
  const variants = {
    best: "bg-emerald-50 text-emerald-700 border-emerald-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${variants[variant]}`}>
      {variant === "best" && <Star className="size-3.5 fill-emerald-600" />}
      {children}
    </div>
  );
}
