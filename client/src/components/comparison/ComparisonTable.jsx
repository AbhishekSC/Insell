import { MapPin, Bed, Bath, Square, Heart, Eye, IndianRupee, Building2, Calendar } from "lucide-react";
import ComparisonBadge from "./ComparisonBadge";

export default function ComparisonTable({ properties, comparisonItems, getBestValue }) {
  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
      {/* Table Header */}
      <div className="sticky top-0 bg-base-200/95 backdrop-blur-sm border-b border-base-300">
        <div className="grid grid-cols-5 divide-x divide-base-300">
          <div className="col-span-1 px-6 py-4">
            <span className="font-semibold text-base-content">Feature</span>
          </div>
          {properties.map((property) => (
            <div key={property.id} className="col-span-1 px-6 py-4 text-center">
              <span className="font-semibold text-base-content text-sm line-clamp-2">
                {property.title?.split(' ').slice(0, 3).join(' ')}...
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-base-300">
        {comparisonItems.map((item, index) => {
          const bestValue = item.highlight ? getBestValue(item.key, item.best) : null;
          const isEven = index % 2 === 0;

          return (
            <div
              key={item.key}
              className={`grid grid-cols-5 divide-x divide-base-300 transition-colors duration-150 ${
                isEven ? 'bg-base-100' : 'bg-base-200/30'
              } hover:bg-primary/10`}
            >
              {/* Feature Label */}
              <div className="col-span-1 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  {item.icon && (
                    <item.icon className="size-4 text-base-content/50 flex-shrink-0" />
                  )}
                  <span className="font-medium text-base-content">{item.label}</span>
                </div>
              </div>

              {/* Property Values */}
              {properties.map((property) => {
                const value = property[item.key];
                const formattedValue = item.customFormat 
                  ? item.customFormat(value, property)
                  : item.format 
                    ? item.format(value) 
                    : (value || 'N/A');
                const displayValue = item.suffix ? `${formattedValue} ${item.suffix}` : formattedValue;
                const isBest = item.highlight && value === bestValue;

                return (
                  <div key={property.id} className="col-span-1 px-6 py-4 text-center">
                    {isBest ? (
                      <ComparisonBadge variant="best">
                        {displayValue}
                      </ComparisonBadge>
                    ) : (
                      <span className="text-base-content/70">{displayValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
