import { MapPin, Bed, Bath, Square, IndianRupee, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";

export default function RecommendationCard({ property, formatPrice, matchReason }) {
  const navigate = useNavigate();

  return (
    <div 
      className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-300 cursor-pointer"
      onClick={() => navigate(`/property/${property.id}`)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {property.mediaUrls?.[0] ? (
          <img
            src={property.mediaUrls[0]}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <MapPin className="size-12 text-slate-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <div className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="size-3" />
            <span>{Math.round(property.recommendationScore)}% Match</span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 text-sm">
          {property.title}
        </h3>
        <p className="text-lg font-bold text-indigo-600 mb-2">
          {formatPrice(property.price)}
        </p>
        <div className="flex items-center gap-1 text-xs text-slate-600 mb-3">
          <MapPin className="size-3" />
          <span className="truncate">{property.city}, {property.locality}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600 mb-3">
          {property.bedrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bed className="size-3" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bath className="size-3" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.areaSqft > 0 && (
            <div className="flex items-center gap-1">
              <Square className="size-3" />
              <span>{property.areaSqft.toLocaleString()} sqft</span>
            </div>
          )}
        </div>
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
            <Sparkles className="size-3" />
            {matchReason}
          </p>
        </div>
      </div>
    </div>
  );
}
