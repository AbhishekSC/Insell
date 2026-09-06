import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Clock, FileText, Loader2, Paperclip, Star, ThumbsUp, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!n) return "Price on request";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function fmtWhen(d) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Turn a raw history entry into a readable line.
function describeEntry(h, { stageLabel, whoBy }) {
  const stage = h.stage ? stageLabel(h.stage) : "";
  const who = whoBy(h.by);
  switch (h.action) {
    case "create":
      return "Deal opened — offer accepted";
    case "propose":
      return `${who} marked “${stage}” done — awaiting confirmation`;
    case "confirm":
      return `${who} confirmed “${stage}”`;
    case "dispute":
      return `${who} flagged “${stage}”${h.message ? `: ${h.message}` : " as not done"}`;
    case "revert":
      return `${who} reopened “${stage}”`;
    case "attach":
      return `${who} attached ${h.message || "a document"}`;
    case "note":
      return `${who}: ${h.message}`;
    case "cancel":
      return `${who} cancelled the deal${h.message ? `: ${h.message}` : ""}`;
    case "complete":
      return "Deal completed 🎉";
    default:
      return `${who} — ${h.action} ${stage}`.trim();
  }
}

// Buyer + seller, once an offer is accepted. Stages advance turn-based: one
// party marks a step done, the other confirms (or flags it).
export default function TransactionTracker({ deal, postId, meId, alreadyReviewed, onReview }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const fileRef = useRef(null);

  const [payAmount, setPayAmount] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deal", postId] });

  const { mutate, isPending } = useMutation({
    mutationFn: async (body) =>
      (await axiosInstance.patch(`/deals/${deal._id}`, { ...body, requestId: crypto.randomUUID() })).data?.data?.deal,
    onSuccess: (_d, vars) => {
      refresh();
      setNote(""); setShowCancel(false); setCancelReason(""); setDisputing(false); setDisputeReason("");
      setPayAmount(""); setShowReport(false); setReportReason("");
      if (vars?.action === "report") toast.success("Reported — the team will look into it");
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Couldn't update the deal"),
  });

  const { mutate: upload, isPending: uploading } = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stage", deal.currentStage || "");
      return (
        await axiosInstance.post(`/deals/${deal._id}/attachments`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data?.data?.deal;
    },
    onSuccess: () => { refresh(); toast.success("Document attached"); },
    onError: (e) => toast.error(e?.response?.data?.message || "Upload failed"),
  });

  if (!deal) return null;

  const stages = deal.stages || [];
  const nextKey = deal.nextStage;
  const nextLabel = stages.find((s) => s.key === nextKey)?.label;
  const isActive = deal.status === "ACTIVE";
  const pending = deal.pendingStage;
  const iProposed = pending && String(pending.proposedBy) === String(meId);
  const paymentDone = (deal.completedStages || []).includes("payment");
  const nextIsPayment = nextKey === "payment";
  const pc = deal.pendingCancel;
  const iRequestedCancel = pc && String(pc.requestedBy) === String(meId);

  const counterpartyName =
    String(deal.buyer?._id || deal.buyer) === String(meId)
      ? deal.owner?.fullName || "the owner"
      : deal.buyer?.fullName || "the buyer";

  const stageLabel = (k) => stages.find((s) => s.key === k)?.label || k;
  const whoBy = (byId) => {
    if (String(byId) === String(meId)) return "You";
    if (String(byId) === String(deal.buyer?._id || deal.buyer)) return (deal.buyer?.fullName || "The buyer").split(" ")[0];
    if (String(byId) === String(deal.owner?._id || deal.owner)) return (deal.owner?.fullName || "The owner").split(" ")[0];
    return "Someone";
  };

  const statusBanner =
    deal.status === "COMPLETED"
      ? { text: "Deal completed 🎉", cls: "bg-success/10 text-success" }
      : deal.status === "CANCELLED"
        ? { text: `Deal cancelled${deal.cancelledReason ? ` — ${deal.cancelledReason}` : ""}`, cls: "bg-error/10 text-error" }
        : null;

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 md:p-6">
      <h3 className="text-lg font-semibold text-base-content">Deal progress</h3>
      <p className="text-sm text-base-content/60">
        {deal.mode === "RENT" ? "Rent" : "Sale"} agreed at{" "}
        <span className="font-semibold text-primary">{fmtMoney(deal.agreedPrice)}</span> with {counterpartyName}
      </p>

      {statusBanner && <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${statusBanner.cls}`}>{statusBanner.text}</p>}

      {deal.status === "COMPLETED" && onReview && !alreadyReviewed && (
        <button
          type="button"
          className="btn btn-sm mt-3 w-full border-none bg-success text-white hover:bg-success"
          onClick={() => onReview(counterpartyName)}
        >
          <Star className="size-4" /> Rate {counterpartyName}
        </button>
      )}
      {isActive && deal.disputed && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
          You two disagree on a step — sort it out in the notes, or report the deal if something's wrong.
        </p>
      )}
      {deal.paymentAmount > 0 && (
        <p className="mt-2 text-xs text-base-content/60">Payment recorded: <span className="font-semibold text-base-content">{fmtMoney(deal.paymentAmount)}</span></p>
      )}

      <ol className="mt-4">
        {stages.map((stage, i) => {
          const done = stage.done;
          const isPendingHere = pending?.key === stage.key;
          const isNext = isActive && !pending && stage.key === nextKey;
          const last = i === stages.length - 1;
          const stageDocs = (deal.attachments || []).filter((a) => a.stage === stage.key);
          return (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${done ? "bg-success" : "bg-base-300"}`} aria-hidden />}
              <span
                className={`z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                  done ? "border-success bg-success text-white"
                    : isPendingHere ? "border-warning text-warning"
                    : isNext ? "border-primary text-primary"
                    : "border-base-300 text-base-content/30"
                }`}
              >
                {done ? <Check className="size-3.5" /> : <Circle className="size-2 fill-current" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${done ? "text-base-content" : isNext || isPendingHere ? "text-primary" : "text-base-content/50"}`}>
                  {stage.label}
                  {isPendingHere && <span className="ml-2 text-xs font-medium text-warning">awaiting confirmation</span>}
                </p>
                {stage.hint && !done && <p className="text-xs text-base-content/50">{stage.hint}</p>}
                {stageDocs.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {stageDocs.map((a) => (
                      <li key={a._id}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="size-3" /> {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isActive && (
        <div className="mt-1 space-y-2">
          {/* Someone's proposal is waiting */}
          {pending && iProposed && (
            <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Waiting for {counterpartyName} to confirm “{deal.pendingStageLabel}”.
              <button type="button" className="ml-2 underline" disabled={isPending} onClick={() => mutate({ action: "revert" })}>
                Withdraw
              </button>
            </div>
          )}
          {pending && !iProposed && !disputing && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
              <p className="text-sm text-base-content">
                {counterpartyName} marked <strong>“{deal.pendingStageLabel}”</strong> done{pending.message ? ` — “${pending.message}”` : ""}.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-sm border-none bg-success text-white hover:bg-success" disabled={isPending} onClick={() => mutate({ action: "confirm" })}>
                  <ThumbsUp className="size-4" /> Confirm
                </button>
                <button type="button" className="btn btn-sm btn-ghost text-error" onClick={() => setDisputing(true)}>
                  It isn’t done
                </button>
              </div>
            </div>
          )}
          {pending && !iProposed && disputing && (
            <div className="rounded-lg border border-error/30 bg-error/5 p-3">
              <input
                className="input input-sm input-bordered w-full border-base-300"
                placeholder={`Why isn't "${deal.pendingStageLabel}" done?`}
                maxLength={500}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-sm border-none bg-error text-white hover:bg-error" disabled={isPending} onClick={() => mutate({ action: "dispute", message: disputeReason })}>
                  Send
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDisputing(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* A cancellation request is on the table (post-payment) */}
          {pc && (
            <div className="rounded-lg border border-error/40 bg-error/5 p-3">
              {iRequestedCancel ? (
                <p className="text-sm text-base-content">
                  You asked to cancel this deal — waiting for {counterpartyName} to agree.{pc.reason ? ` (“${pc.reason}”)` : ""}
                  <button type="button" className="ml-2 underline" disabled={isPending} onClick={() => mutate({ action: "cancel_withdraw" })}>
                    Withdraw
                  </button>
                </p>
              ) : (
                <>
                  <p className="text-sm text-base-content">{counterpartyName} wants to cancel this deal.{pc.reason ? ` Reason: “${pc.reason}”.` : ""} Payment has already been made.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-sm border-none bg-error text-white hover:bg-error" disabled={isPending} onClick={() => mutate({ action: "cancel_confirm" })}>
                      Agree to cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" disabled={isPending} onClick={() => mutate({ action: "note", message: "I don't agree to cancelling — let's talk." })}>
                      I don’t agree
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Nothing pending → propose the next step */}
          {!pending && !pc && nextKey && (
            <>
              {nextIsPayment && (
                <input
                  type="number"
                  inputMode="numeric"
                  className="input input-sm input-bordered w-full border-base-300"
                  placeholder="Amount paid (₹)"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              )}
              <textarea
                className="textarea textarea-bordered min-h-14 w-full border-base-300 text-sm"
                placeholder={`Optional note (e.g. "signed at the lawyer's office")`}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm border-none bg-primary text-white hover:bg-primary"
                  disabled={isPending || (nextIsPayment && !Number(payAmount))}
                  onClick={() => mutate({ action: "propose", message: note, ...(nextIsPayment ? { amount: Number(payAmount) } : {}) })}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Mark “{nextLabel}” done
                </button>
                {deal.completedStages?.some((k) => k !== "agreed") && !paymentDone && (
                  <button type="button" className="btn btn-sm btn-ghost" disabled={isPending} onClick={() => mutate({ action: "revert" })}>
                    <Undo2 className="size-4" /> Undo last step
                  </button>
                )}
              </div>
            </>
          )}

          {/* Attach / cancel / report */}
          {!pc && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              <button type="button" className="btn btn-sm btn-ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />} Attach document
              </button>
              <button type="button" className="btn btn-sm btn-ghost text-error hover:bg-error/10" disabled={isPending} onClick={() => setShowCancel((v) => !v)}>
                <X className="size-4" /> Cancel deal
              </button>
              <button type="button" className="btn btn-sm btn-ghost text-base-content/60" onClick={() => setShowReport((v) => !v)}>
                Report an issue
              </button>
            </div>
          )}
        </div>
      )}

      {showReport && (
        <div className="mt-3 rounded-lg border border-base-300 bg-base-100 p-3">
          <p className="text-sm font-medium text-base-content">Report this deal to the team</p>
          <textarea
            className="textarea textarea-bordered mt-2 min-h-16 w-full border-base-300 text-sm"
            placeholder="What's wrong? (fraud, harassment, the other party isn't real…)"
            maxLength={1000}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-sm border-none bg-primary text-white hover:bg-primary" disabled={isPending || !reportReason.trim()} onClick={() => mutate({ action: "report", reason: reportReason })}>
              Send report
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowReport(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="mt-3 rounded-lg border border-error/30 bg-error/5 p-3">
          <p className="text-sm font-medium text-base-content">{paymentDone ? "Request to cancel this deal?" : "Cancel this deal?"}</p>
          <p className="text-xs text-base-content/60">
            {paymentDone ? (
              <span className="font-semibold text-error">Payment has already been made — {counterpartyName} has to agree before it's cancelled. Cancelling here doesn't refund anything.</span>
            ) : (
              <>The listing goes back on the market and {counterpartyName} is notified.</>
            )}
          </p>
          <input className="input input-sm input-bordered mt-2 w-full border-base-300" placeholder="Reason (e.g. buyer's loan rejected)" maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn btn-sm border-none bg-error text-white hover:bg-error"
              disabled={isPending}
              onClick={() => mutate({ action: paymentDone ? "cancel_request" : "cancel", reason: cancelReason })}
            >
              {paymentDone ? "Request cancellation" : "Cancel deal"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowCancel(false)}>Keep it</button>
          </div>
        </div>
      )}

      {deal.history?.length > 1 && (
        <div className="mt-4 border-t border-base-200 pt-3">
          <button
            type="button"
            className="btn btn-sm btn-ghost gap-1.5 text-base-content/70"
            onClick={() => setShowActivity(true)}
          >
            <Clock className="size-4" />
            Activity ({deal.history.length})
          </button>
        </div>
      )}

      {showActivity && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setShowActivity(false)}>
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-5 shadow-xl sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-base-content">Deal activity</h4>
              <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowActivity(false)}>
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-3">
              {[...deal.history].reverse().map((h, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-base-300" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-base-content/80">{describeEntry(h, { stageLabel, whoBy })}</p>
                    <p className="text-xs text-base-content/40">{fmtWhen(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
