import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, Plus, X } from "lucide-react";
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

function SlotPicker({ title, submitLabel, isPending, onClose, onSubmit }) {
  const [slots, setSlots] = useState([defaultSlot(2, 11)]);
  const [note, setNote] = useState("");
  const chosen = slots.map((s) => s && new Date(s)).filter((d) => d && !Number.isNaN(d.getTime()) && d.getTime() > Date.now());

  const setAt = (i, v) => setSlots((prev) => prev.map((x, j) => (j === i ? v : x)));
  const addSlot = () => setSlots((prev) => (prev.length < 3 ? [...prev, defaultSlot(prev.length + 2, 11)] : prev));
  const removeSlot = (i) => setSlots((prev) => prev.filter((_, j) => j !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-5 shadow-xl sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-content">{title}</h3>
          <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-sm text-base-content/60">
          Pick a time you can visit. Add a couple of alternatives so the owner can choose one that works for both of you.
        </p>

        <div className="mt-4 space-y-3">
          {slots.map((s, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-base-content/60">
                  {i === 0 ? "Preferred time" : `Alternative ${i}`}
                </span>
                {i > 0 && (
                  <button type="button" className="text-xs text-error hover:underline" onClick={() => removeSlot(i)}>
                    Remove
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={s}
                min={toLocalInput(new Date())}
                onChange={(e) => setAt(i, e.target.value)}
                className="input input-bordered w-full border-base-300"
              />
            </div>
          ))}
          {slots.length < 3 && (
            <button
              type="button"
              onClick={addSlot}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="size-4" /> Add another time
            </button>
          )}
        </div>

        <textarea
          className="textarea textarea-bordered mt-4 min-h-16 w-full border-base-300"
          placeholder="Note for the owner (optional)"
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
          <p className="mt-3 text-xs font-medium text-base-content/60">
            {myTurn ? "Pick a time to confirm" : "Proposed times"}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {visit.proposedSlots.map((s) => {
              const val = new Date(s).toISOString();
              const picked = confirmSlot === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => setConfirmSlot(picked ? "" : val)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    picked ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/80 hover:border-primary/40"
                  } ${myTurn ? "" : "cursor-default opacity-70"}`}
                >
                  <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${picked ? "border-primary bg-primary text-white" : "border-base-300"}`}>
                    {picked && <Check className="size-3" />}
                  </span>
                  {fmt(s)}
                </button>
              );
            })}
          </div>

          {myTurn ? (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                className="btn btn-sm w-full border-none bg-success text-white hover:bg-success disabled:bg-base-300 disabled:text-base-content/40"
                disabled={pending || !confirmSlot}
                onClick={() => onAct(visit._id, { action: "confirm", slot: confirmSlot })}
              >
                <Check className="size-4" /> {confirmSlot ? "Confirm this time" : "Select a time above"}
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm flex-1 border-base-300" onClick={() => setShowPropose(true)}>
                  Propose new time
                </button>
                {isOwner && (
                  <button type="button" className="btn btn-sm flex-1 border-error/40 text-error hover:bg-error/10" disabled={pending} onClick={() => onAct(visit._id, { action: "decline" })}>
                    Decline
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-base-content/60">Waiting for {isOwner ? "the visitor" : "the owner"} to respond.</p>
          )}
        </>
      )}

      {!isOwner && ["PENDING", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(visit.status) && (
        <button
          type="button"
          className="mt-3 w-full text-center text-xs font-medium text-error hover:underline"
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
