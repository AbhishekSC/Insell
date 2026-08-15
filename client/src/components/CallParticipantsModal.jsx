import { useCallStateHooks } from "@stream-io/video-react-sdk";
import { Mic, MicOff, Users, X } from "lucide-react";

export default function CallParticipantsModal({ isOpen, onClose }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
              <Users className="size-4" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {participants.length} {participants.length === 1 ? "participant" : "participants"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {participants.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nobody here yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {participants.map((participant) => (
                <li key={participant.sessionId} className="flex items-center gap-3 p-2">
                  {participant.image ? (
                    <img
                      src={participant.image}
                      alt={participant.name || "Participant"}
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-600">
                      {(participant.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {participant.name || "Unknown"}
                    {participant.isLocalParticipant ? " (You)" : ""}
                  </span>
                  {/* 1 === TrackType.AUDIO in the SFU model */}
                  {participant.publishedTracks?.includes(1) ? (
                    <Mic className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <MicOff className="size-4 shrink-0 text-slate-400" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
