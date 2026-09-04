import { useQuery } from "@tanstack/react-query";
import { Info, TriangleAlert } from "lucide-react";
import axiosInstance from "../lib/axios";

function compactINR(n) {
  const a = Math.round(Math.abs(Number(n) || 0));
  if (a >= 10000000) return `₹${(a / 10000000).toFixed(a % 10000000 === 0 ? 0 : 2)}Cr`;
  if (a >= 100000) return `₹${(a / 100000).toFixed(a % 100000 === 0 ? 0 : 1)}L`;
  if (a >= 1000) return `₹${Math.round(a / 1000)}K`;
  return `₹${a}`;
}

const RENT_TYPES = new Set(["PROPERTY_RENT"]);

// Shows what similar live listings are priced at while the seller types their
// price on Create Post. Purely informational — never blocks submit.
export default function PriceSuggestion({ draft }) {
  const city = String(draft?.city || "").trim();
  const propertyType = String(draft?.propertyType || "").trim();
  const area = Number(draft?.areaSqft) || Number(draft?.carpetArea) || 0;
  const bedrooms = Number(draft?.bedrooms) || 0;
  const intent =
    RENT_TYPES.has(String(draft?.postType || "").toUpperCase()) || String(draft?.listingType || "").toLowerCase() === "rent"
      ? "rent"
      : "buy";
  const price = Number(draft?.price) || 0;

  const enabled = Boolean(city && propertyType && area >= 50);

  const { data: suggestion } = useQuery({
    queryKey: ["priceSuggestion", city.toLowerCase(), propertyType, bedrooms, area, intent],
    queryFn: async () => {
      const res = await axiosInstance.get("/posts/price-suggestion", {
        params: { city, propertyType, bedrooms, areaSqft: area, intent },
        skipErrorToast: true,
      });
      return res.data?.data?.suggestion || null;
    },
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!enabled || !suggestion?.available) return null;

  const { low, high, mid, sampleSize, medianPricePerSqft } = suggestion;
  const perMonth = intent === "rent" ? "/mo" : "";
  const wayOff = price > 0 && (price < low * 0.5 || price > high * 2);

  return (
    <div
      className={`mt-2 rounded-lg border p-2.5 text-xs ${
        wayOff ? "border-amber-300 bg-amber-50 text-amber-800" : "border-base-300 bg-base-100 text-base-content/70"
      }`}
    >
      <p className="flex items-start gap-1.5 font-medium">
        {wayOff ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />}
        <span>
          Similar {bedrooms ? `${bedrooms} BHK ` : ""}
          {propertyType.toLowerCase()} in {city} list around{" "}
          <strong>
            {compactINR(low)}–{compactINR(high)}
            {perMonth}
          </strong>{" "}
          <span className="font-normal opacity-70">
            (~{compactINR(medianPricePerSqft)}/sqft · {sampleSize} listings)
          </span>
        </span>
      </p>
      {wayOff && (
        <p className="mt-1 pl-5">
          Your {compactINR(price)} is well outside that. Double-check the amount — a typo here means buyers filter it out.
          Typical: <strong>{compactINR(mid)}{perMonth}</strong>.
        </p>
      )}
    </div>
  );
}
