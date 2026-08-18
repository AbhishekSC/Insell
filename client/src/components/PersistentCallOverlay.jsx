import { useEffect, useMemo, useState } from "react";
import {
  hasScreenShare,
  PaginatedGridLayout,
  ParticipantsAudio,
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
import { useDraggableWidget } from "../hooks/useDraggableWidget";

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
    useCallStartedAt,
  } = useCallStateHooks();
  const { isEnabled: micEnabled } = useMicrophoneState();
  const { isEnabled: cameraEnabled, direction: cameraDirection } = useCameraState();
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

  // ParticipantView defaults to the camera track — screen share is a
  // separate track (trackType="screenShareTrack") that has to be rendered
  // explicitly, or an active share is transmitted but never shown to anyone.
  const screenSharingParticipant = participants.find(hasScreenShare);
  const isScreenShareActive = Boolean(screenSharingParticipant);

  // WhatsApp-style running call timer, ticking off the call's real
  // server-recorded start time (not our own mount time) so it stays correct
  // even if this component remounts mid-call.
  const callStartedAt = useCallStartedAt();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!callStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt.getTime()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [callStartedAt]);

  const callDurationLabel = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }, [elapsedSeconds]);

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
    // The old standalone /call page is legacy — everyday use goes through the
    // Calls tab embedded in Marketplace, so land back there instead of
    // dropping the user into a different, outdated call-list UI.
    navigate("/marketplace?section=call", { replace: true });
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

  // Both floating widgets — the minimized call bar and the in-call self-view
  // bubble — are freely draggable via the same Pointer Events logic (see
  // useDraggableWidget). The mini widget also navigates to the full call
  // view on a plain tap; the self-view bubble just repositions, no tap
  // behavior needed.
  const miniWidget = useDraggableWidget({ onTap: () => navigate(LIVE_CALL_ROUTE) });
  const selfViewPip = useDraggableWidget();

  // Minimized widget — visible on every other page while the call keeps
  // running unattended. Dragging it moves it anywhere on screen (clamped to
  // the viewport); tapping it without dragging returns to the full view.
  // Position is kept in this same persistent component, so it's remembered
  // across mini <-> full toggles for the rest of the call.
  if (!isFullView) {
    return (
      <>
        {/* Neither the mini widget nor the full view render at the same time
            (this is a straight `if`, not conditional CSS), so unlike the
            full view — where ParticipantView/PaginatedGridLayout already
            play remote audio internally — nothing here would otherwise play
            it while minimized. Without this, the other person's audio
            silently stopped the moment you navigated away from /call/live. */}
        {remoteParticipants.length > 0 ? <ParticipantsAudio participants={remoteParticipants} /> : null}
        <div ref={miniWidget.elementRef} className="call-mini-widget" style={miniWidget.style}>
          <div
            role="button"
            tabIndex={0}
            {...miniWidget.dragHandlers}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate(LIVE_CALL_ROUTE);
            }}
            className="call-mini-widget__video"
            aria-label="Return to call (drag to move)"
          >
            {mainRemoteParticipant ? (
              <ParticipantView participant={mainRemoteParticipant} muteAudio className="call-mini-widget__participant" />
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
      </>
    );
  }

  return (
    <div className="live-call-shell">
      <div className="live-call-topbar">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-white/85 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to Studio</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="live-call-badge">Live</span>
          {callStartedAt ? <span className="live-call-timer">{callDurationLabel}</span> : null}
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
        {isScreenShareActive ? (
          <div className="live-call-screenshare-layout">
            {/* muteAudio here — the sharer's mic still plays via their own
                tile in the camera strip below; without this their audio
                would play twice. */}
            <ParticipantView
              participant={screenSharingParticipant}
              trackType="screenShareTrack"
              muteAudio
              className="live-call-screenshare-main"
            />
            <div className="live-call-screenshare-camstrip">
              {participants.map((participant) => (
                <div key={participant.sessionId} className="live-call-screenshare-camtile">
                  <ParticipantView participant={participant} className="live-call-screenshare-camtile__video" />
                </div>
              ))}
            </div>
          </div>
        ) : isGroupCall ? (
          // Same remount-on-flip defense as the 1:1 self-view below, applied
          // to the whole grid since individual tiles aren't ours to key.
          <PaginatedGridLayout key={cameraDirection} />
        ) : (
          <div className="live-call-pip-layout">
            {mainRemoteParticipant ? (
              <ParticipantView participant={mainRemoteParticipant} className="live-call-pip-main" />
            ) : (
              <div className="live-call-pip-waiting">Waiting for the other person to join...</div>
            )}
            {localParticipant ? (
              // A plain wrapper div (no SDK classes) owns all sizing/position
              // here — the SDK's own .str-video__participant-view stylesheet
              // rule kept out-specifying className-based overrides directly
              // on that element, so this sidesteps the fight entirely: the
              // wrapper is small and positioned, the ParticipantView inside
              // just fills 100% of whatever box the wrapper gives it. It's
              // also draggable (useDraggableWidget), same as the minimized
              // call bar.
              // key={cameraDirection} forces a clean remount on camera flip —
              // without it, the video sometimes stayed blank after switching
              // front/back camera instead of picking up the new track.
              <div
                ref={selfViewPip.elementRef}
                className="live-call-pip-self"
                style={selfViewPip.style}
                {...selfViewPip.dragHandlers}
              >
                <ParticipantView key={cameraDirection} participant={localParticipant} className="live-call-pip-self__video" />
              </div>
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
