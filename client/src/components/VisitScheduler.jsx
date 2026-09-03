import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

function fmt(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
// value for <input type="datetime-local"> — local time, no timezone suffix
function toLocalInput(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}
const defaultSlot = (plusDays, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d);
};

function SlotPicker({ title, initial, submitLabel, isPending, onClose, onSubmit }) {
  const [slots, setSlots] = useState(initial || [defaultSlot(2, 11), "", ""]);
  const [note, setNote] = useState("");
  const chosen = slots.map((s) => s && new Date(s)).filter((d) => d && !Number.isNaN(d.getTime()) && d.getTime() > Date.now());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-6 shadow-xl sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-content">{title}</h3>
          <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-sm text-base-content/60">Offer up to 3 times that work for you.</p>
        <div className="mt-4 space-y-2">
          {slots.map((s, i) => (
            <input
              key={i}
              type="datetime-local"
              value={s}
              min={toLocalInput(new Date())}
              onChange={(e) => setSlots((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              className="input input-bordered w-full border-base-300"
            />
          ))}
        </div>
        <textarea
          className="textarea textarea-bordered mt-3 min-h-16 w-full border-base-300"
          placeholder="Note (optional)"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          className="btn mt-4 w-full border-none bg-primary text-white hover:bg-primary"
          disabled={isPending || chosen.length === 0}
          onClick={() => onSubmit({ slots: chosen.map((d) => d.toISOString()), note })}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
        </button>
      </div>
    </div>
  );
}

// One visit-request card with the actions available to the current viewer.
function VisitCard({ visit, meId, isOwner, onAct, pending }) {
  const myTurn = String(visit.lastActionBy) !== String(meId);
  const [confirmSlot, setConfirmSlot] = useState("");
  const [showPropose, setShowPropose] = useState(false);
  const active = ["PENDING", "RESCHEDULE_PROPOSED"].includes(visit.status);
  const who = isOwner ? visit.requester?.fullName || "Someone" : "You";

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-base-content">
          {visit.status === "CONFIRMED" ? "Visit confirmed" : visit.status === "DECLINED" ? "Visit declined" : visit.status === "CANCELLED" ? "Visit cancelled" : `${who} requested a visit`}
        </p>
        <span className="text-[11px] uppercase tracking-wide text-base-content/50">{visit.status.replace("_", " ")}</span>
      </div>

      {visit.status === "CONFIRMED" && (
        <p className="mt-1 text-sm text-primary">{fmt(visit.confirmedSlot)} · {visit.mode === "VIDEO" ? "Video tour" : "In person"}</p>
      )}

      {active && (
        <>
          <p className="mt-2 text-xs text-base-content/60">Proposed times</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {visit.proposedSlots.map((s) => {
              const val = new Date(s).toISOString();
              const picked = confirmSlot === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => setConfirmSlot(picked ? "" : val)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${picked ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/80"} ${myTurn ? "" : "opacity-60"}`}
                >
                  {fmt(s)}
                </button>
              );
            })}
          </div>

          {myTurn ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm flex-1 border-none bg-success text-white hover:bg-success"
                disabled={pending || !confirmSlot}
                onClick={() => onAct(visit._id, { action: "confirm", slot: confirmSlot })}
              >
                <Check className="size-4" /> Confirm
              </button>
              <button type="button" className="btn btn-sm border-base-300" onClick={() => setShowPropose(true)}>
                Propose new time
              </button>
              {isOwner && (
                <button type="button" className="btn btn-sm btn-ghost text-error" disabled={pending} onClick={() => onAct(visit._id, { action: "decline" })}>
                  Decline
                </button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-base-content/60">Waiting for {isOwner ? "the visitor" : "the owner"} to respond.</p>
          )}
        </>
      )}

      {!isOwner && ["PENDING", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(visit.status) && (
        <button
          type="button"
          className="mt-2 w-full text-center text-xs font-medium text-error hover:text-error"
          disabled={pending}
          onClick={() => onAct(visit._id, { action: "cancel" })}
        >
          Cancel visit
        </button>
      )}

      {showPropose && (
        <SlotPicker
          title="Propose new times"
          submitLabel="Send new times"
          isPending={pending}
          onClose={() => setShowPropose(false)}
          onSubmit={({ slots }) => { setShowPropose(false); onAct(visit._id, { action: "propose", slots }); }}
        />
      )}
    </div>
  );
}

export default function VisitScheduler({ post, authUser, isOwner }) {
  const queryClient = useQueryClient();
  const postId = post?._id;
  const meId = authUser?._id;
  const [showRequest, setShowRequest] = useState(false);

  const isRequirement = String(post?.postType || "").startsWith("REQUIREMENT_");

  const { data: visits = [] } = useQuery({
    queryKey: ["visitRequests", postId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/visits/posts/${postId}/visits`, { skipErrorToast: true });
      return res.data?.data?.visits || [];
    },
    enabled: Boolean(postId && meId && !isRequirement),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["visitRequests", postId] });

  const { mutate: createVisit, isPending: creating } = useMutation({
    mutationFn: async ({ slots, note }) => {
      const res = await axiosInstance.post(`/visits/posts/${postId}/visits`, { slots, note, requestId: crypto.randomUUID() });
      return res.data?.data?.visit;
    },
    onSuccess: () => { toast.success("Visit request sent"); setShowRequest(false); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Couldn't send visit request"),
  });

  const { mutate: act, isPending: acting } = useMutation({
    mutationFn: async ({ visitId, body }) => {
      const res = await axiosInstance.patch(`/visits/${visitId}`, { ...body, requestId: crypto.randomUUID() });
      return res.data?.data?.visit;
    },
    onSuccess: (v) => { toast.success(v?.status === "CONFIRMED" ? "Visit confirmed" : "Updated"); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Couldn't update visit"),
  });

  const onAct = (visitId, body) => act({ visitId, body });

  const myActive = useMemo(
    () => visits.find((v) => String(v.requester?._id || v.requester) === String(meId) && ["PENDING", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(v.status)),
    [visits, meId]
  );
  const ownerActionable = useMemo(
    () => visits.filter((v) => ["PENDING", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(v.status)),
    [visits]
  );

  if (!postId || !meId || isRequirement) return null;

  // Owner view
  if (isOwner) {
    if (ownerActionable.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-base-content">Visit requests ({ownerActionable.length})</p>
        {ownerActionable.map((v) => (
          <VisitCard key={v._id} visit={v} meId={meId} isOwner onAct={onAct} pending={acting} />
        ))}
      </div>
    );
  }

  // Visitor view
  if (myActive) {
    return <VisitCard visit={myActive} meId={meId} isOwner={false} onAct={onAct} pending={acting} />;
  }

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 py-3 font-semibold text-base-content transition-colors hover:bg-base-200"
        onClick={() => setShowRequest(true)}
      >
        <CalendarClock className="size-5" />
        Request a Visit
      </button>
      {showRequest && (
        <SlotPicker
          title="Request a visit"
          submitLabel="Send request"
          isPending={creating}
          onClose={() => setShowRequest(false)}
          onSubmit={createVisit}
        />
      )}
    </>
  );
}
