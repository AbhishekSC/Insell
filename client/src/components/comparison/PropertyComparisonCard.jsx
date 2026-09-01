import { MapPin, Bed, Bath, Square, IndianRupee, User, CheckCircle, Trophy } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

export default function PropertyComparisonCard({ property, formatPrice, isBest = false }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/property/${property.id}`)}
      className={`group bg-base-100 rounded-2xl shadow-sm border overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
        isBest 
          ? 'border-warning ring-2 ring-warning shadow-md' 
          : 'border-base-300 hover:border-primary/30'
      }`}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-base-200">
        {isBest && (
          <div className="absolute top-3 left-3 bg-warning text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10">
            <Trophy className="size-3" />
            <span>Best Choice</span>
          </div>
        )}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-base-300 to-base-300 animate-pulse" />
        )}
        {property.mediaUrls?.[0] ? (
          <img
            src={property.mediaUrls[0]}
            alt={property.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-300 to-base-300">
            <MapPin className="size-12 text-base-content/40" />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5">
        {/* Price */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-base-content tracking-tight">
            {formatPrice(property.price)}
          </p>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base-content mb-2 line-clamp-2 leading-snug">
          {property.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-sm text-base-content/70 mb-4">
          <MapPin className="size-4 text-base-content/50 flex-shrink-0" />
          <span className="truncate">
            {property.city}
            {property.locality && `, ${property.locality}`}
          </span>
        </div>

        {/* Specifications Row */}
        <div className="flex items-center gap-4 text-sm text-base-content/70 mb-4">
          {property.bedrooms > 0 && (
            <div className="flex items-center gap-1.5">
              <Bed className="size-4 text-base-content/50" />
              <span className="font-medium">{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms > 0 && (
            <div className="flex items-center gap-1.5">
              <Bath className="size-4 text-base-content/50" />
              <span className="font-medium">{property.bathrooms}</span>
            </div>
          )}
          {property.areaSqft > 0 && (
            <div className="flex items-center gap-1.5">
              <Square className="size-4 text-base-content/50" />
              <span className="font-medium">{property.areaSqft.toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        {/* Author Section */}
        {property.author && (
          <div className="flex items-center gap-3 pt-4 border-t border-base-200">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/users/${property.author.id}`);
              }}
              className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
              {property.author.profilePic ? (
                <img
                  src={property.author.profilePic}
                  alt={property.author.fullName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center">
                  <User className="size-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/users/${property.author.id}`);
                }}
                className="font-medium text-base-content truncate cursor-pointer hover:text-primary transition-colors"
              >
                {property.author.fullName}
              </p>
              {property.author.isVerified && (
                <div className="flex items-center gap-1 text-xs text-base-content/60">
                  <CheckCircle className="size-3 text-info" />
                  <span>Verified</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
