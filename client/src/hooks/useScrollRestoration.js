import { useEffect, useLayoutEffect, useRef } from "react";

// Disable the browser's own scroll restoration — we handle it ourselves.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

// Remembers the window scroll position for a given `key` and restores it the
// next time a component using this hook mounts with `ready === true`.
//
// Built for the marketplace feed: tapping a card navigates away and unmounts
// the page, and coming back would otherwise dump the user at the top of a
// feed they'd scrolled halfway through.
//
// Key insight: on unmount, reading window.scrollY is unreliable — React may
// have already torn down the tall feed DOM and replaced it with a short
// loader, collapsing scrollY to 0. So we track the last-known position in a
// ref (updated on every scroll event) and save THAT on unmount.
//
// Pass `key = null` to disable (e.g. when the feed isn't the visible view).
export function useScrollRestoration(key, ready) {
  const storageKey = key ? `feed-scroll:${key}` : null;
  const restoredForKey = useRef(null);
  const lastScrollY = useRef(0);

  // Track scroll position continuously via a ref.
  useEffect(() => {
    if (!storageKey) return undefined;
    lastScrollY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        lastScrollY.current = window.scrollY;
        try {
          sessionStorage.setItem(storageKey, String(Math.round(lastScrollY.current)));
        } catch { /* ignore */ }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const pos = Math.round(lastScrollY.current);
      if (pos > 0) {
        try { sessionStorage.setItem(storageKey, String(pos)); } catch { /* ignore */ }
      }
    };
  }, [storageKey]);

  // Restore once per key — useLayoutEffect so it runs before the paint.
  useLayoutEffect(() => {
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

    let done = false;
    const finish = () => { done = true; restoredForKey.current = storageKey; };

    const tryScroll = () => {
      if (done) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.max(0, Math.min(saved, maxScroll));
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - saved) < 5 || target >= maxScroll - 5) {
        finish();
      }
    };

    tryScroll();
    if (done) return undefined;

    const observer = new MutationObserver(() => {
      requestAnimationFrame(tryScroll);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let frameCount = 0;
    let frameId = 0;
    const frameRetry = () => {
      frameCount++;
      tryScroll();
      if (!done && frameCount < 60) {
        frameId = requestAnimationFrame(frameRetry);
      }
    };
    frameId = requestAnimationFrame(frameRetry);

    const timeout = setTimeout(() => {
      tryScroll();
      finish();
      observer.disconnect();
      cancelAnimationFrame(frameId);
    }, 4000);

    return () => {
      finish();
      observer.disconnect();
      cancelAnimationFrame(frameId);
      clearTimeout(timeout);
    };
  }, [storageKey, ready]);
}
