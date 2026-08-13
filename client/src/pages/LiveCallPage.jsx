import {
  CancelCallButton,
  ParticipantView,
  ScreenShareButton,
  SpeakerLayout,
  StreamCall,
  StreamVideo,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { PhoneOff, Radio, Video } from "lucide-react";
import toast from "react-hot-toast";
import { Link, Navigate } from "react-router";
import AppShell from "../components/AppShell";
import { useStreamContext } from "../context/StreamProvider";

function ActiveCallUi() {
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  return (
    <div className="zoom-call-shell">
      <div className="zoom-call-topbar">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success"></span>
          Secure video call
        </span>
        <span className="zoom-live-badge">Live</span>
      </div>

      <div className="zoom-call-stage">
        <SpeakerLayout participantsBarPosition="bottom" />

        {localParticipant ? (
          <div className="zoom-local-preview">
            <ParticipantView participant={localParticipant} mirror trackType="videoTrack" />
          </div>
        ) : null}
      </div>

      <div className="zoom-call-controls">
        <div className="zoom-call-controls-custom">
          <ToggleAudioPublishingButton caption="Mic" />
          <ToggleVideoPublishingButton caption="Camera" />
          <div className="zoom-screen-share-control">
            <ScreenShareButton caption="Share screen" />
          </div>
          <CancelCallButton caption="Leave" />
        </div>
      </div>
    </div>
  );
}

export default function LiveCallPage() {
  const { videoClient, activeVideoCall, incomingVideoCall, endActiveVideoCall, videoBusy } = useStreamContext();

  const endCall = async () => {
    if (!activeVideoCall) {
      return;
    }

    try {
      await endActiveVideoCall();
      toast.success("Call ended");
    } catch {
      toast.error("Failed to end call");
    }
  };

  if (!activeVideoCall) {
    return <Navigate to="/call" replace />;
  }

  return (
    <AppShell
      title="Live call"
      subtitle="Your private room is active. Manage controls below without losing focus."
      lockPageScroll
      actions={
        <>
          <span className={`badge gap-1 ${incomingVideoCall ? "badge-accent" : "badge-ghost"}`}>
            <Radio className="size-3.5" />
            {incomingVideoCall ? "Incoming call waiting" : "Call in progress"}
          </span>

          <button
            className="btn btn-error btn-outline btn-sm disabled:opacity-70 disabled:text-base-content/70"
            onClick={endCall}
            disabled={!activeVideoCall || videoBusy}
          >
            <PhoneOff className="size-4" />
            End call
          </button>

          <Link to="/call" className="btn btn-primary btn-sm">
            <Video className="size-4" />
            Back to Studio
          </Link>
        </>
      }
    >
      <div className="call-live-shell shell-panel h-full min-h-[520px] p-3 sm:p-4 xl:h-[calc(100dvh-13.2rem)]">
        {!videoClient ? (
          <div className="grid h-full min-h-[360px] place-items-center rounded-2xl border border-base-300/70 bg-base-100/70 p-6 text-sm text-base-content/70">
            Preparing video client...
          </div>
        ) : (
          <StreamVideo client={videoClient}>
            <StreamCall call={activeVideoCall}>
              <div className="live-call-room-layout">
                <ActiveCallUi />
              </div>
            </StreamCall>
          </StreamVideo>
        )}
      </div>
    </AppShell>
  );
}
