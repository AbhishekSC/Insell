export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="w-24 h-8 bg-slate-200 rounded-full animate-pulse" />
            <div className="text-center">
              <div className="w-48 h-6 bg-slate-200 rounded animate-pulse mx-auto mb-1" />
              <div className="w-32 h-4 bg-slate-200 rounded animate-pulse mx-auto" />
            </div>
            <div className="w-24 h-8 bg-slate-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="w-3/4 h-8 bg-slate-200 rounded animate-pulse" />
                <div className="w-1/2 h-6 bg-slate-200 rounded animate-pulse" />
                <div className="w-full h-4 bg-slate-200 rounded animate-pulse" />
                <div className="flex gap-4">
                  <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                  <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
                    <div className="w-16 h-3 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table Skeleton */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="sticky top-0 bg-slate-50/95 border-b border-slate-200">
            <div className="grid grid-cols-5 divide-x divide-slate-200">
              <div className="col-span-1 px-6 py-4">
                <div className="w-20 h-5 bg-slate-200 rounded animate-pulse" />
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="col-span-1 px-6 py-4">
                  <div className="w-24 h-5 bg-slate-200 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className={`grid grid-cols-5 divide-x divide-slate-100 ${i % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}`}>
                <div className="col-span-1 px-6 py-4">
                  <div className="w-24 h-5 bg-slate-200 rounded animate-pulse" />
                </div>
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="col-span-1 px-6 py-4">
                    <div className="w-16 h-5 bg-slate-200 rounded animate-pulse mx-auto" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
