import {
  PaginatedGridLayout,
  ParticipantView,
  StreamCall,
  StreamVideo,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { ArrowLeft, Mic, MicOff, PhoneOff, RefreshCcw, ScreenShare, ScreenShareOff, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";
import { Navigate, useNavigate } from "react-router";
import AppShell from "../components/AppShell";
import { useStreamContext } from "../context/StreamProvider";

const screenShareSupported =
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

function ActiveCallUi({ onEndCall, videoBusy }) {
  const call = useCall();
  const navigate = useNavigate();
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
    } catch {
      toast.error("Unable to switch camera");
    }
  };

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
        <span className="live-call-badge">Live</span>
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

export default function LiveCallPage() {
  const { videoClient, activeVideoCall, endActiveVideoCall, videoBusy } = useStreamContext();

  if (!activeVideoCall) {
    return <Navigate to="/call" replace />;
  }

  return (
    <AppShell hideHero lockPageScroll>
      <div className="call-live-shell shell-panel h-[calc(100dvh-10.5rem)] min-h-[420px] p-1.5 sm:p-2 md:h-[calc(100dvh-6.5rem)]">
        {!videoClient ? (
          <div className="grid h-full min-h-[360px] place-items-center rounded-2xl border border-base-300/70 bg-base-100/70 p-6 text-sm text-base-content/70">
            Preparing video client...
          </div>
        ) : (
          <StreamVideo client={videoClient}>
            <StreamCall call={activeVideoCall}>
              <div className="live-call-room-layout">
                <ActiveCallUi onEndCall={endActiveVideoCall} videoBusy={videoBusy} />
              </div>
            </StreamCall>
          </StreamVideo>
        )}
      </div>
    </AppShell>
  );
}
