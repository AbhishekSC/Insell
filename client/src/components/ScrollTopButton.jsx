import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Floating "back to top" button that appears once the user has scrolled past
// a couple of screens. Sits above the Create Post FAB on mobile.
export default function ScrollTopButton({ className = "" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > window.innerHeight * 2);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`btn btn-circle fixed z-40 h-11 w-11 border border-base-300 bg-base-100 text-base-content shadow-lg hover:bg-base-200 ${className}`}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
