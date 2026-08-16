import { Navigate } from "react-router";
import { useStreamContext } from "../context/StreamProvider";

// The actual call UI lives in PersistentCallOverlay, mounted from
// StreamProvider outside of <Routes> so it survives navigation instead of
// unmounting (and disconnecting) whenever you leave this route. This page
// only exists so /call/live is a real, linkable/back-button-able URL —
// PersistentCallOverlay watches the current location itself and switches to
// its full-screen appearance whenever this route is active.
export default function LiveCallPage() {
  const { activeVideoCall } = useStreamContext();

  if (!activeVideoCall) {
    return <Navigate to="/marketplace?section=call" replace />;
  }

  return null;
}
