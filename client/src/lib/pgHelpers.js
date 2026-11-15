export function formatINR(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ratingColor(rating) {
  if (rating >= 4) return "text-green-600";
  if (rating >= 3) return "text-yellow-600";
  return "text-red-500";
}

export function ratingBg(rating) {
  if (rating >= 4) return "bg-green-100 text-green-800";
  if (rating >= 3) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function statusBadge(status) {
  const map = {
    open: "bg-red-100 text-red-700",
    acknowledged: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-600",
    active: "bg-green-100 text-green-700",
    notice_period: "bg-yellow-100 text-yellow-700",
    moved_out: "bg-gray-100 text-gray-600",
    evicted: "bg-red-100 text-red-700",
    paid: "bg-green-100 text-green-700",
    unpaid: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

export function humanStatus(status) {
  return (status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const REVIEW_CATEGORIES = [
  { key: "food", label: "Food" },
  { key: "cleanliness", label: "Cleanliness" },
  { key: "wifi", label: "WiFi" },
  { key: "water", label: "Water" },
  { key: "safety", label: "Safety" },
  { key: "landlord", label: "Landlord" },
  { key: "value_for_money", label: "Value" },
  { key: "location", label: "Location" },
];

export const ISSUE_CATEGORIES = [
  "wifi", "water", "electricity", "maintenance", "food", "cleanliness", "safety", "noise", "other",
];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"];

export const INDIAN_STATES = [
  "maharashtra", "karnataka", "delhi", "tamil_nadu", "telangana",
  "uttar_pradesh", "rajasthan", "gujarat", "west_bengal", "madhya_pradesh", "other",
];

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
