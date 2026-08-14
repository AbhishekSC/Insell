import {
  SpeakerLayout,
  StreamCall,
  StreamVideo,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { ArrowLeft, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";
import { Navigate, useNavigate } from "react-router";
import AppShell from "../components/AppShell";
import { useStreamContext } from "../context/StreamProvider";

function ActiveCallUi({ onEndCall, videoBusy }) {
  const call = useCall();
  const navigate = useNavigate();
  const { useMicrophoneState, useCameraState, useScreenShareState } = useCallStateHooks();
  const { isEnabled: micEnabled } = useMicrophoneState();
  const { isEnabled: cameraEnabled } = useCameraState();
  const { isEnabled: screenShareEnabled } = useScreenShareState();

  const leaveCall = async () => {
    try {
      await onEndCall();
      toast.success("Call ended");
    } catch {
      toast.error("Failed to end call");
    }
    navigate("/call", { replace: true });
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

      <div className="live-call-stage">
        <SpeakerLayout participantsBarPosition="bottom" />
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
          onClick={() => call?.screenShare.toggle()}
          aria-label={screenShareEnabled ? "Stop sharing screen" : "Share screen"}
          className={`live-call-btn ${screenShareEnabled ? "live-call-btn--active" : ""}`}
        >
          {screenShareEnabled ? <ScreenShareOff className="size-5" /> : <ScreenShare className="size-5" />}
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
      <div className="call-live-shell shell-panel h-full min-h-[560px] p-1.5 sm:p-2 xl:h-[calc(100dvh-6.5rem)]">
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
