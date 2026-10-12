import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Check, CheckCheck, Circle, Clock, FileText, Loader2, MapPin, Paperclip, Scale, ShieldCheck, Star, ThumbsUp, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import ClosingStatementModal from "./ClosingStatementModal";
import AttachDocumentModal from "./AttachDocumentModal";

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!n) return "Price on request";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function fmtWhen(d) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const CATEGORY_LABELS = {
  PROPERTY_TITLE: "Title Deed",
  IDENTITY_PROOF: "KYC / ID",
  SALE_AGREEMENT: "Agreement",
  PAYMENT_RECEIPT: "Bank Receipt",
  NOC_TAX_RECEIPT: "NOC / Tax",
  SITE_INSPECTION: "Site Inspection",
  OTHER: "Document",
};

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
    case "propose_amendment":
      return `${who} proposed amendment: ${h.message || "Contract adjustment"}`;
    case "accept_amendment":
      return `${who} accepted amendment: ${h.message || "Dispute resolved"}`;
    case "reject_amendment":
      return `${who} declined amendment: ${h.message || "Dispute ongoing"}`;
    case "revert":
      return `${who} reopened “${stage}”`;
    case "attach":
      return `${who} attached ${h.message || "a document"}`;
    case "verify_attachment":
      return `${who} verified legal document`;
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
  const [showClosingStatement, setShowClosingStatement] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  // 48-Hour Dispute & Contract Amendment States
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentType, setAmendmentType] = useState("PRICE_ADJUSTMENT");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [extensionDays, setExtensionDays] = useState("5");
  const [amendmentNote, setAmendmentNote] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("NEFT");
  const [transactionRef, setTransactionRef] = useState("");
  const [bankName, setBankName] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deal", postId] });

  const { mutate, isPending } = useMutation({
    mutationFn: async (body) =>
      (await axiosInstance.patch(`/deals/${deal._id}`, { ...body, requestId: crypto.randomUUID() })).data?.data?.deal,
    onSuccess: (_d, vars) => {
      refresh();
      setNote(""); setShowCancel(false); setCancelReason(""); setDisputing(false); setDisputeReason("");
      setPayAmount(""); setTransactionRef(""); setBankName(""); setShowReport(false); setReportReason("");
      if (vars?.action === "report") toast.success("Reported — the team will look into it");
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Couldn't update the deal"),
  });

  const { mutate: uploadWithCategory, isPending: uploading } = useMutation({
    mutationFn: async ({ file, category, lat, lng }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category || "PROPERTY_TITLE");
      fd.append("stage", deal.currentStage || deal.nextStage || "");
      if (lat != null && lng != null) {
        fd.append("lat", lat);
        fd.append("lng", lng);
      }
      return (
        await axiosInstance.post(`/deals/${deal._id}/attachments`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data?.data?.deal;
    },
    onSuccess: () => {
      refresh();
      setShowAttachModal(false);
      toast.success("Document attached to legal vault");
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Upload failed"),
  });

  const { mutate: verifyDoc, isPending: verifyingDoc } = useMutation({
    mutationFn: async (attId) =>
      (await axiosInstance.post(`/deals/${deal._id}/attachments/${attId}/verify`)).data?.data?.deal,
    onSuccess: () => {
      refresh();
      toast.success("Document verified successfully ✓");
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Verification failed"),
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-base-content">Deal progress</h3>
          <p className="text-sm text-base-content/60 flex items-center gap-1.5 flex-wrap">
            <span>
              {deal.mode === "RENT" ? "Rent" : "Sale"} agreed at{" "}
              <span className="font-semibold text-primary">{fmtMoney(deal.agreedPrice)}</span> with {counterpartyName}
            </span>
            <span className="badge badge-sm badge-outline font-semibold text-primary/80 border-primary/30">
              You: {String(deal.owner?._id || deal.owner) === String(meId?._id || meId) ? "Owner / Seller" : "Buyer"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowClosingStatement(true)}
          className="btn btn-sm btn-outline btn-primary rounded-xl gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
        >
          <Award className="size-4 text-primary" />
          <span>Closing Statement</span>
        </button>
      </div>

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
        <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-warning/20 text-warning">
                <Scale className="size-4" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-base-content">
                  Structured 48-Hour Dispute Resolution
                </h4>
                <p className="text-xs text-base-content/60">
                  Mutual in-app mediation window active before platform conciliation.
                </p>
              </div>
            </div>
            {deal.disputeDeadline && (
              <span className="badge badge-warning badge-sm font-semibold shrink-0">
                ⏱️ {Math.max(0, Math.floor((new Date(deal.disputeDeadline).getTime() - Date.now()) / (3600 * 1000)))}h {Math.max(0, Math.floor(((new Date(deal.disputeDeadline).getTime() - Date.now()) % (3600 * 1000)) / (60 * 1000)))}m left
              </span>
            )}
          </div>

          {deal.pendingAmendment ? (
            <div className="p-3 rounded-xl bg-base-100 border border-base-300 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary">
                  Proposed Amendment: {deal.pendingAmendment.amendmentType?.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-base-content/50">
                  By {String(deal.pendingAmendment.proposedBy) === String(meId) ? "You" : counterpartyName}
                </span>
              </div>
              <div className="text-xs text-base-content/80">
                {deal.pendingAmendment.amendmentType === "PRICE_ADJUSTMENT" && (
                  <span className="font-bold text-success block">
                    Price Deduction: -₹{(deal.pendingAmendment.adjustmentAmount || 0).toLocaleString("en-IN")}
                  </span>
                )}
                {deal.pendingAmendment.amendmentType === "TIMELINE_EXTENSION" && (
                  <span className="font-bold text-info block">
                    Timeline Extension: +{deal.pendingAmendment.extensionDays} days
                  </span>
                )}
                {deal.pendingAmendment.note && (
                  <span className="text-xs text-base-content/70 italic block mt-0.5">
                    "{deal.pendingAmendment.note}"
                  </span>
                )}
              </div>

              {String(deal.pendingAmendment.proposedBy) !== String(meId) ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => mutate({ action: "accept_amendment" })}
                    className="btn btn-xs btn-success text-white rounded-lg gap-1"
                  >
                    <CheckCheck className="size-3" /> Accept Amendment & Clear Dispute
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => mutate({ action: "reject_amendment" })}
                    className="btn btn-xs btn-ghost text-error rounded-lg"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-base-content/50 italic">
                  Awaiting {counterpartyName}'s acceptance to update contract and resolve dispute.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <p className="text-xs text-base-content/70">
                Agree on a price reduction (e.g. for repairs) or timeline extension to move forward.
              </p>
              <button
                type="button"
                onClick={() => setShowAmendmentModal(true)}
                className="btn btn-xs btn-outline btn-warning rounded-lg gap-1 self-start sm:self-auto shrink-0"
              >
                <Scale className="size-3" /> Propose Amendment
              </button>
            </div>
          )}
        </div>
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
                  <ul className="mt-2 space-y-1.5">
                    {stageDocs.map((a) => {
                      const uploaderId = String(a.uploadedBy?._id || a.uploadedBy || "");
                      const currentUserId = String(meId?._id || meId || "");
                      const isUploadedByMe = Boolean(uploaderId && currentUserId && uploaderId === currentUserId);
                      const isVerified = Boolean(a.verifiedBy);
                      const uploaderLabel = isUploadedByMe
                        ? "You"
                        : uploaderId === String(deal.owner?._id || deal.owner)
                        ? `${(deal.owner?.fullName || "Owner").split(" ")[0]} (Owner)`
                        : `${(deal.buyer?.fullName || "Buyer").split(" ")[0]} (Buyer)`;

                      return (
                        <li key={a._id} className="p-2.5 rounded-xl bg-base-200/50 border border-base-300/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <FileText className="size-3.5 shrink-0 text-primary" />
                              <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline truncate max-w-[160px] sm:max-w-xs">
                                {a.name}
                              </a>
                              <span className="badge badge-ghost badge-xs shrink-0 font-medium text-[10px]">
                                {CATEGORY_LABELS[a.category] || a.category || "Document"}
                              </span>
                              {a.geoVerified && (
                                <span className="badge badge-success badge-xs shrink-0 font-medium text-[10px] text-white gap-0.5">
                                  <MapPin className="size-2.5" /> Geo-Verified
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-base-content/50 mt-0.5">
                              Uploaded by: <strong className="text-base-content/70">{uploaderLabel}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                                <ShieldCheck className="size-3.5" /> Verified ✓
                              </span>
                            ) : !isUploadedByMe && isActive ? (
                              <button
                                type="button"
                                disabled={verifyingDoc}
                                onClick={() => verifyDoc(a._id)}
                                className="btn btn-xs btn-outline btn-success rounded-lg gap-1"
                              >
                                <CheckCheck className="size-3" /> Verify Document
                              </button>
                            ) : (
                              <span className="text-[10px] text-base-content/60 italic bg-base-100 px-2 py-0.5 rounded-md border border-base-300/50">
                                Waiting for {counterpartyName.split(" ")[0]} to verify
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
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
                <div className="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                    Banking Settlement Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-base-content/60">Amount Paid (₹)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="input input-sm input-bordered w-full rounded-xl border-base-300"
                        placeholder="e.g. 500000"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-base-content/60">Payment Mode</label>
                      <select
                        className="select select-sm select-bordered w-full rounded-xl border-base-300"
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                      >
                        <option value="NEFT">NEFT (National Electronic Transfer)</option>
                        <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                        <option value="IMPS">IMPS (Immediate Payment)</option>
                        <option value="UPI">UPI / Digital Transfer</option>
                        <option value="CHEQUE">Banker's Cheque / Demand Draft</option>
                        <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-base-content/60">UTR / Ref Number</label>
                      <input
                        type="text"
                        className="input input-sm input-bordered w-full rounded-xl border-base-300 font-mono text-xs"
                        placeholder="e.g. HDFC000123456789"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-base-content/60">Remitting / Beneficiary Bank</label>
                      <input
                        type="text"
                        className="input input-sm input-bordered w-full rounded-xl border-base-300 text-xs"
                        placeholder="e.g. HDFC Bank, SBI"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
              <textarea
                className="textarea textarea-bordered min-h-14 w-full border-base-300 text-sm rounded-xl"
                placeholder={`Optional note (e.g. "Signed at sub-registrar office, UTR verified")`}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm border-none bg-primary text-white hover:bg-primary rounded-xl"
                  disabled={isPending || (nextIsPayment && !Number(payAmount))}
                  onClick={() =>
                    mutate({
                      action: "propose",
                      message: note,
                      ...(nextIsPayment
                        ? {
                            amount: Number(payAmount),
                            paymentDetails: {
                              amount: Number(payAmount),
                              paymentMode: payMode,
                              transactionRef: transactionRef.trim(),
                              bankName: bankName.trim(),
                              paidAt: new Date(),
                            },
                          }
                        : {}),
                    })
                  }
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Mark “{nextLabel}” done
                </button>
                {deal.completedStages?.some((k) => k !== "agreed") && !paymentDone && (
                  <button type="button" className="btn btn-sm btn-ghost rounded-xl" disabled={isPending} onClick={() => mutate({ action: "revert" })}>
                    <Undo2 className="size-4" /> Undo last step
                  </button>
                )}
              </div>
            </>
          )}

          {/* Attach / cancel / report */}
          {!pc && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-sm btn-ghost gap-1.5 rounded-xl hover:bg-primary/10 hover:text-primary"
                disabled={uploading}
                onClick={() => setShowAttachModal(true)}
              >
                <Paperclip className="size-4" /> Attach Legal Document
              </button>
              <button type="button" className="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-xl" disabled={isPending} onClick={() => setShowCancel((v) => !v)}>
                <X className="size-4" /> Cancel deal
              </button>
              <button type="button" className="btn btn-sm btn-ghost text-base-content/60 rounded-xl" onClick={() => setShowReport((v) => !v)}>
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

      {showClosingStatement && (
        <ClosingStatementModal
          dealId={deal._id}
          onClose={() => setShowClosingStatement(false)}
        />
      )}

      {showAttachModal && (
        <AttachDocumentModal
          deal={deal}
          onUpload={uploadWithCategory}
          isUploading={uploading}
          onClose={() => setShowAttachModal(false)}
        />
      )}

      {/* Propose Contract Amendment Modal */}
      {showAmendmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAmendmentModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-base-100 p-6 shadow-2xl border border-base-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-warning/10 text-warning">
                  <Scale className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-base-content">Propose Contract Amendment</h3>
                  <p className="text-xs text-base-content/60">Mutual dispute resolution terms</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAmendmentModal(false)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate({
                  action: "propose_amendment",
                  amendmentType,
                  adjustmentAmount: amendmentType === "PRICE_ADJUSTMENT" ? Number(adjustmentAmount) || 0 : 0,
                  extensionDays: amendmentType === "TIMELINE_EXTENSION" ? Number(extensionDays) || 5 : 0,
                  note: amendmentNote,
                });
                setShowAmendmentModal(false);
              }}
              className="space-y-4"
            >
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold text-xs">Amendment Type</span>
                </label>
                <select
                  className="select select-bordered select-sm w-full rounded-xl"
                  value={amendmentType}
                  onChange={(e) => setAmendmentType(e.target.value)}
                >
                  <option value="PRICE_ADJUSTMENT">Price Deduction (e.g. Repairs / Work Allowance)</option>
                  <option value="TIMELINE_EXTENSION">Timeline Extension (e.g. Registry / NOC Delay)</option>
                  <option value="CONDITION_RESOLUTION">Condition Resolution (Mutual Agreement Note)</option>
                </select>
              </div>

              {amendmentType === "PRICE_ADJUSTMENT" && (
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-semibold text-xs">Deduction Amount (₹)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 25000"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    required
                    className="input input-bordered input-sm rounded-xl font-mono"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      New agreed price will become ₹{Math.max(0, (deal.agreedPrice || 0) - (Number(adjustmentAmount) || 0)).toLocaleString("en-IN")}
                    </span>
                  </label>
                </div>
              )}

              {amendmentType === "TIMELINE_EXTENSION" && (
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-semibold text-xs">Extension (Days)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    placeholder="e.g. 7"
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(e.target.value)}
                    required
                    className="input input-bordered input-sm rounded-xl font-mono"
                  />
                </div>
              )}

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold text-xs">Explanation / Condition Note</span>
                </label>
                <textarea
                  className="textarea textarea-bordered textarea-sm rounded-xl h-20 text-xs"
                  placeholder="Explain why this amendment is requested (e.g. Water seepage found in kitchen, deduct ₹25,000 to cover repair before signing)..."
                  value={amendmentNote}
                  onChange={(e) => setAmendmentNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-warning btn-sm flex-1 rounded-xl"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Send Amendment Proposal"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(false)}
                  className="btn btn-ghost btn-sm rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
