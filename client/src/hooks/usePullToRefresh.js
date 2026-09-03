import { useEffect, useRef, useState } from "react";

// Mobile pull-to-refresh for a window-scrolled page. When the user drags down
// while already at the top, `distance` grows (with resistance) and the caller
// renders an indicator; releasing past `threshold` runs `onRefresh` and keeps
// `refreshing` true until it settles.
//
// Touch listeners are passive — we never call preventDefault, so this can't
// break normal scrolling. On browsers with a native overscroll refresh the
// two may both trigger; that's harmless (both just reload the feed).
export function usePullToRefresh(onRefresh, { enabled = true, threshold = 72, maxPull = 110 } = {}) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const set = (v) => {
    distanceRef.current = v;
    setDistance(v);
  };

  useEffect(() => {
    if (!enabled) return undefined;

    const onStart = (e) => {
      if (!refreshingRef.current && window.scrollY <= 0 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY;
      } else {
        startYRef.current = null;
      }
    };

    const onMove = (e) => {
      if (startYRef.current == null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0 && window.scrollY <= 0) {
        // Rubber-band resistance.
        set(Math.min(maxPull, dy * 0.5));
      } else if (distanceRef.current !== 0) {
        set(0);
      }
    };

    const onEnd = async () => {
      if (startYRef.current == null) return;
      startYRef.current = null;
      const shouldRefresh = distanceRef.current >= threshold;
      if (!shouldRefresh) {
        set(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      set(threshold);
      try {
        await onRefreshRef.current?.();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        set(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, threshold, maxPull]);

  return { distance, refreshing, threshold };
}
