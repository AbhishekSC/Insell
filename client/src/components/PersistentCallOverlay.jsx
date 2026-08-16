import { useRef, useState } from "react";
import {
  PaginatedGridLayout,
  ParticipantView,
  StreamCall,
  StreamVideo,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import {
  ArrowLeft,
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCcw,
  ScreenShare,
  ScreenShareOff,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";
import AddPeopleModal from "./AddPeopleModal";
import CallParticipantsModal from "./CallParticipantsModal";

const screenShareSupported =
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

const LIVE_CALL_ROUTE = "/call/live";

// Renders once, mounted from StreamProvider — outside <Routes> — so the call
// session and its video elements never unmount while navigating the rest of
// the app. It shows itself two ways depending on the current route: the
// full-screen call UI on /call/live, or a small floating "still on a call"
// widget everywhere else. Both share the exact same StreamCall/ParticipantView
// tree; only the CSS wrapper around them changes, so nothing ever
// re-subscribes or reconnects when you navigate away and back.
function CallUi({ onEndCall, videoBusy }) {
  const call = useCall();
  const navigate = useNavigate();
  const location = useLocation();
  const isFullView = location.pathname === LIVE_CALL_ROUTE;

  const [showAddPeople, setShowAddPeople] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const {
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
    useParticipants,
    useLocalParticipant,
    useRemoteParticipants,
  } = useCallStateHooks();
  const { isEnabled: micEnabled } = useMicrophoneState();
  const { isEnabled: cameraEnabled } = useCameraState();
  const { isEnabled: screenShareEnabled } = useScreenShareState();
  // Must match the participant list PaginatedGridLayout itself renders from
  // (not useParticipantCount, which is a server-computed stat that can lag
  // or disagree with the actual number of tiles in the DOM — using it here
  // previously caused the CSS grid's column count to mismatch the real tile
  // count, e.g. reserving 2 columns while 3 tiles were actually rendered).
  const participants = useParticipants();
  const participantCount = participants.length;
  const isGroupCall = participantCount > 2;
  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(participantCount || 1)));
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const mainRemoteParticipant = remoteParticipants[0];

  const toggleScreenShare = async () => {
    if (!screenShareSupported) {
      toast.error("Screen sharing isn't supported on this browser. Try it from a desktop browser instead.");
      return;
    }

    try {
      await call?.screenShare.toggle();
    } catch {
      toast.error("Unable to share screen. Check your browser's screen-recording permission and try again.");
    }
  };

  const leaveCall = async () => {
    try {
      await onEndCall();
      toast.success("Call ended");
    } catch {
      toast.error("Failed to end call");
    }
    navigate("/call", { replace: true });
  };

  const flipCamera = async () => {
    try {
      await call?.camera.flip();
    } catch (error) {
      console.error("Camera flip failed:", error);

      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        toast.error("Camera permission is required to switch cameras.");
      } else if (error?.name === "OverconstrainedError" || error?.name === "NotFoundError") {
        toast.error("No other camera was found on this device.");
      } else if (error?.name === "NotReadableError") {
        toast.error("The camera is busy in another app. Close it and try again.");
      } else {
        toast.error("Unable to switch camera");
      }
    }
  };

  // Dragging support for the minimized widget. Position capture (not the
  // default bottom-right CSS) kicks in only once the user actually drags —
  // dragInfo tracks the gesture via Pointer Events (mouse + touch in one
  // API), and setPointerCapture keeps move/up events firing on this element
  // even if the pointer leaves its bounds mid-drag.
  const widgetRef = useRef(null);
  const dragInfo = useRef({ dragging: false, moved: false, pointerId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const [widgetPosition, setWidgetPosition] = useState(null);

  const handleDragPointerDown = (e) => {
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragInfo.current = {
      dragging: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleDragPointerMove = (e) => {
    const info = dragInfo.current;
    if (!info.dragging) return;

    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      info.moved = true;
    }
    if (!info.moved) return;

    const el = widgetRef.current;
    const width = el?.offsetWidth || 184;
    const height = el?.offsetHeight || 104;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    setWidgetPosition({
      left: Math.min(Math.max(8, info.startLeft + dx), maxLeft),
      top: Math.min(Math.max(8, info.startTop + dy), maxTop),
    });
  };

  const handleDragPointerUp = (e) => {
    const info = dragInfo.current;
    const wasDrag = info.moved;
    dragInfo.current = { ...info, dragging: false, moved: false };
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (!wasDrag) {
      navigate(LIVE_CALL_ROUTE);
    }
  };

  // Minimized widget — visible on every other page while the call keeps
  // running unattended. Dragging it moves it anywhere on screen (clamped to
  // the viewport); tapping it without dragging returns to the full view.
  // Position is kept in this same persistent component, so it's remembered
  // across mini <-> full toggles for the rest of the call.
  if (!isFullView) {
    return (
      <div
        ref={widgetRef}
        className="call-mini-widget"
        style={widgetPosition ? { left: widgetPosition.left, top: widgetPosition.top, right: "auto", bottom: "auto" } : undefined}
      >
        <div
          role="button"
          tabIndex={0}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate(LIVE_CALL_ROUTE);
          }}
          className="call-mini-widget__video"
          aria-label="Return to call (drag to move)"
        >
          {localParticipant ? (
            <ParticipantView participant={localParticipant} className="call-mini-widget__participant" />
          ) : (
            <div className="call-mini-widget__placeholder">
              <Video className="size-5" />
            </div>
          )}
          <span className="call-mini-widget__badge">
            <Users className="size-3" />
            {participantCount}
          </span>
          <span className="call-mini-widget__expand">
            <Maximize2 className="size-3.5" />
          </span>
        </div>
        <button
          type="button"
          onClick={leaveCall}
          disabled={videoBusy}
          aria-label="Leave call"
          className="call-mini-widget__end disabled:opacity-60"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="live-call-shell">
      <div className="live-call-topbar">
        <button
          type="button"
          onClick={() => navigate("/call")}
          className="inline-flex items-center gap-1.5 text-white/85 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to Studio</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="live-call-badge">Live</span>
          <button
            type="button"
            onClick={() => setShowParticipants(true)}
            className="live-call-count"
            aria-label="View participants"
          >
            <Users className="size-3" />
            {participantCount}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddPeople(true)}
            className="live-call-end-badge live-call-add-badge"
          >
            <UserPlus className="size-3.5" />
            <span className="hidden sm:inline">Add people</span>
          </button>
          <button
            type="button"
            onClick={leaveCall}
            disabled={videoBusy}
            className="live-call-end-badge disabled:opacity-60"
          >
            <PhoneOff className="size-3.5" />
            End call
          </button>
        </div>
      </div>

      <AddPeopleModal isOpen={showAddPeople} onClose={() => setShowAddPeople(false)} />
      <CallParticipantsModal isOpen={showParticipants} onClose={() => setShowParticipants(false)} />

      <div className="live-call-stage" style={isGroupCall ? { "--tile-columns": gridColumns } : undefined}>
        {isGroupCall ? (
          <PaginatedGridLayout />
        ) : (
          <div className="live-call-pip-layout">
            {mainRemoteParticipant ? (
              <ParticipantView participant={mainRemoteParticipant} className="live-call-pip-main" />
            ) : (
              <div className="live-call-pip-waiting">Waiting for the other person to join...</div>
            )}
            {localParticipant ? (
              <ParticipantView participant={localParticipant} className="live-call-pip-self" />
            ) : null}
          </div>
        )}
      </div>

      <div className="live-call-controls">
        <button
          type="button"
          onClick={() => call?.microphone.toggle()}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
          className={`live-call-btn ${micEnabled ? "" : "live-call-btn--off"}`}
        >
          {micEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => call?.camera.toggle()}
          aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          className={`live-call-btn ${cameraEnabled ? "" : "live-call-btn--off"}`}
        >
          {cameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          disabled={!screenShareSupported}
          aria-label={
            screenShareSupported
              ? screenShareEnabled
                ? "Stop sharing screen"
                : "Share screen"
              : "Screen sharing isn't supported on this browser"
          }
          title={screenShareSupported ? undefined : "Screen sharing isn't supported on this browser"}
          className={`live-call-btn disabled:opacity-40 ${screenShareEnabled ? "live-call-btn--active" : ""}`}
        >
          {screenShareEnabled ? <ScreenShareOff className="size-5" /> : <ScreenShare className="size-5" />}
        </button>
        <button
          type="button"
          onClick={flipCamera}
          disabled={!cameraEnabled}
          aria-label="Switch camera"
          className="live-call-btn disabled:opacity-60"
        >
          <RefreshCcw className="size-5" />
        </button>
        <button
          type="button"
          onClick={leaveCall}
          disabled={videoBusy}
          aria-label="Leave call"
          className="live-call-btn live-call-btn--danger disabled:opacity-60"
        >
          <PhoneOff className="size-5" />
        </button>
      </div>
    </div>
  );
}

export default function PersistentCallOverlay({ videoClient, activeVideoCall, onEndCall, videoBusy }) {
  const location = useLocation();
  const isFullView = location.pathname === LIVE_CALL_ROUTE;

  if (!videoClient || !activeVideoCall) {
    return null;
  }

  return (
    <div className={isFullView ? "call-overlay-root call-overlay-root--full" : "call-overlay-root"}>
      <StreamVideo client={videoClient}>
        <StreamCall call={activeVideoCall}>
          <CallUi onEndCall={onEndCall} videoBusy={videoBusy} />
        </StreamCall>
      </StreamVideo>
    </div>
  );
}
