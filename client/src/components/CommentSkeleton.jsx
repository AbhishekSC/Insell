import { memo } from "react";

function CommentSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="size-8 rounded-full bg-slate-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-slate-100 px-4 py-2">
          <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-full bg-slate-200 rounded mb-1" />
          <div className="h-4 w-3/4 bg-slate-200 rounded" />
        </div>
        <div className="mt-1 flex items-center gap-4 px-2">
          <div className="h-2 w-12 bg-slate-200 rounded" />
          <div className="h-2 w-8 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export default memo(CommentSkeleton);
