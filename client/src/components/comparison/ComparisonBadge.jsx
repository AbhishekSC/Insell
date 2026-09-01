import { Star } from "lucide-react";

export default function ComparisonBadge({ children, variant = "best" }) {
  const variants = {
    best: "bg-success/10 text-success border-success/30",
    neutral: "bg-base-200 text-base-content border-base-300",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${variants[variant]}`}>
      {variant === "best" && <Star className="size-3.5 fill-success" />}
      {children}
    </div>
  );
}
