import { useEffect, useRef } from "react";

// Remembers the window scroll position for a given `key` and restores it the
// next time a component using this hook mounts with `ready === true`.
//
// Built for the marketplace feed: tapping a card navigates away and unmounts
// the page, and coming back would otherwise dump the user at the top of a
// feed they'd scrolled halfway through. The saved offset lives in
// sessionStorage (per tab, cleared when the tab closes) keyed by the feed's
// filter signature, so switching category/search doesn't cross-restore.
//
// The infinite-scroll wrinkle: on remount the list may render its rows over
// several frames as React Query replays cached pages, so a single
// scrollTo() fires before the page is tall enough. We re-apply it over a
// short burst of animation frames until the position sticks or we give up.
//
// Pass `key = null` to disable (e.g. when the feed isn't the visible view).
export function useScrollRestoration(key, ready) {
  const storageKey = key ? `feed-scroll:${key}` : null;
  const restoredForKey = useRef(null);

  // Persist on scroll (rAF-throttled) and once more on unmount.
  useEffect(() => {
    if (!storageKey) return undefined;
    let ticking = false;
    const save = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
        } catch {
          /* private mode / storage disabled — restoration just won't happen */
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      try {
        sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
      } catch {
        /* ignore */
      }
    };
  }, [storageKey]);

  // Restore once per key, after the feed has content to scroll within.
  useEffect(() => {
    if (!storageKey || !ready || restoredForKey.current === storageKey) return undefined;

    let saved = NaN;
    try {
      saved = Number(sessionStorage.getItem(storageKey));
    } catch {
      saved = NaN;
    }
    if (!Number.isFinite(saved) || saved <= 0) {
      restoredForKey.current = storageKey;
      return undefined;
    }

    let frame = 0;
    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.max(0, Math.min(saved, maxScroll));
      window.scrollTo(0, target);
      // Keep retrying while the page is still growing under us (more rows
      // mounting) and we haven't reached the target yet.
      if (window.scrollY < saved - 4 && attempts < 25) {
        frame = requestAnimationFrame(apply);
      } else {
        restoredForKey.current = storageKey;
      }
    };
    frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [storageKey, ready]);
}
