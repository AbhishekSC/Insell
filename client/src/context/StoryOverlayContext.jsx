import { createContext, useContext, useState } from "react";

// Signals whether a full-screen story/highlight viewer is currently open,
// anywhere in the app. Feed videos (PropertyPostCard) use this to pause
// themselves while a story is open — the story viewer is just a layer on
// top, so a feed video's own scroll-visibility check (IntersectionObserver)
// never notices it's now covered and would otherwise keep autoplaying (and
// its audio, if unmuted) underneath the story.
const StoryOverlayContext = createContext({ isActive: false, setActive: () => {} });

export function StoryOverlayProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  return (
    <StoryOverlayContext.Provider value={{ isActive, setActive: setIsActive }}>
      {children}
    </StoryOverlayContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located with StoryOverlayProvider by design
export function useStoryOverlay() {
  return useContext(StoryOverlayContext);
}
