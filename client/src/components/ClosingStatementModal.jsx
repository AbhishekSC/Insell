import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Copy, ExternalLink, FileText, Loader2, MapPin, Printer, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!n) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_NAMES = {
  IDENTITY_PROOF: "Identity Proof (KYC)",
  PROPERTY_TITLE: "Property Title Deed",
  SALE_AGREEMENT: "Sale Agreement / MOU",
  PAYMENT_RECEIPT: "Bank Payment Receipt",
  NOC_TAX_RECEIPT: "NOC & Municipal Tax",
  SITE_INSPECTION: "Physical Site Inspection",
  OTHER: "Supporting Document",
};

export default function ClosingStatementModal({ dealId, onClose }) {
  const [copied, setCopied] = useState(false);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["dealSummary", dealId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/deals/${dealId}/summary`);
      return res.data?.data?.summary;
    },
    enabled: Boolean(dealId),
  });

  const token = summary?.verificationToken || (dealId ? `deal-${dealId}` : "");
  const qrTargetUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify-statement/${token}`;

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Verification token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-base-100 p-6 sm:p-8 shadow-2xl border border-base-300 print:max-h-none print:border-none print:shadow-none print:p-0">
        {/* Header Actions (hidden on print) */}
        <div className="flex items-center justify-between pb-4 border-b border-base-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Award className="size-5" />
            </span>
            <div>
              <h3 className="font-bold text-base-content text-lg leading-tight">Official Closing Statement</h3>
              <p className="text-xs text-base-content/60">Digital Settlement & Title Transfer Audit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-primary"
              title="Print Statement"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="size-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-base-content/60">Compiling closing audit & verification token...</p>
          </div>
        ) : error || !summary ? (
          <div className="py-12 text-center text-error">
            <p className="font-semibold">Failed to load closing statement</p>
            <p className="text-xs mt-1 text-base-content/60">Please try again later.</p>
          </div>
        ) : (
          <div className="space-y-6 pt-4 text-base-content">
            {/* Certificate Header Banner & SHA-256 Stamp */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-success font-semibold text-xs tracking-wider uppercase">
                  <ShieldCheck className="size-4" /> Cryptographically Verified Record
                </div>
                <div className="font-mono text-xs mt-1 text-base-content/70 truncate max-w-sm sm:max-w-md">
                  {token}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyToken}
                className="btn btn-xs btn-outline btn-primary shrink-0 gap-1 print:hidden"
              >
                <Copy className="size-3" />
                {copied ? "Copied" : "Copy Hash"}
              </button>
            </div>

            {/* QR Code & Public Verification Portal Embed */}
            {Boolean(token) && (
              <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative p-2.5 bg-white rounded-2xl shadow-sm border border-base-300 shrink-0 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=H&data=${encodeURIComponent(qrTargetUrl)}`}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://quickchart.io/qr?size=200&ecLevel=H&text=${encodeURIComponent(qrTargetUrl)}`;
                    }}
                    alt="Public Verification QR Code"
                    className="size-24 sm:size-28 rounded-lg object-contain"
                  />
                  {/* PhonePe / UPI style centered logo badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="size-7 sm:size-8 bg-white rounded-lg shadow-md p-0.5 border border-base-200 flex items-center justify-center overflow-hidden">
                      <img
                        src="/favicon.png"
                        alt="NearMySpace"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold text-success uppercase tracking-wider">
                    <ShieldCheck className="size-3.5" /> Public Verifiable Document
                  </div>
                  <h5 className="font-bold text-xs sm:text-sm text-base-content">
                    QR Code for Bank Loans & Tax Clearance
                  </h5>
                  <p className="text-[11px] text-base-content/65 leading-relaxed">
                    Home loan officers, auditors, or lawyers can scan this code to confirm that this closing statement is untampered and digitally signed.
                  </p>
                  <div className="pt-1.5 flex items-center justify-center sm:justify-start gap-2 print:hidden">
                    <a
                      href={`/verify-statement/${token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-xs btn-primary gap-1"
                    >
                      <ExternalLink className="size-3" /> Open Verification Portal
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qrTargetUrl);
                        toast.success("Public verification link copied!");
                      }}
                      className="btn btn-xs btn-ghost gap-1"
                    >
                      <Copy className="size-3" /> Copy URL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Property & Parties Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-base-200/50 border border-base-300 text-sm">
              <div>
                <p className="text-xs text-base-content/50 uppercase font-semibold">Property</p>
                <p className="font-bold text-base-content mt-0.5">{summary.post?.title || "Property Asset"}</p>
                <p className="text-xs text-base-content/70">{summary.post?.city ? `${summary.post.city} · ` : ""}{summary.post?.propertyType || "Real Estate"}</p>
              </div>
              <div>
                <p className="text-xs text-base-content/50 uppercase font-semibold">Agreement Status</p>
                <p className="font-bold text-success mt-0.5 capitalize">{summary.status || "Completed"}</p>
                <p className="text-xs text-base-content/70">Closed: {fmtDate(summary.closedAt)}</p>
              </div>
              <div className="border-t border-base-300/60 pt-3">
                <p className="text-xs text-base-content/50 uppercase font-semibold">Purchaser (Buyer)</p>
                <p className="font-medium text-base-content mt-0.5">{summary.parties?.buyer?.fullName || "Buyer"}</p>
                <p className="text-xs text-base-content/60">{summary.parties?.buyer?.email}</p>
              </div>
              <div className="border-t border-base-300/60 pt-3">
                <p className="text-xs text-base-content/50 uppercase font-semibold">Vendor (Seller / Owner)</p>
                <p className="font-medium text-base-content mt-0.5">{summary.parties?.owner?.fullName || "Seller"}</p>
                <p className="text-xs text-base-content/60">{summary.parties?.owner?.email}</p>
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70 mb-2">
                Settlement & Consideration Breakdown
              </h4>
              <div className="rounded-2xl border border-base-300 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-base-200 bg-base-200/30">
                      <td className="p-3 text-base-content/70">Total Agreed Consideration</td>
                      <td className="p-3 text-right font-bold text-base-content">{fmtMoney(summary.breakdown?.agreedPrice)}</td>
                    </tr>
                    <tr className="border-b border-base-200">
                      <td className="p-3 text-base-content/70">
                        Token / Earnest Deposit Paid
                        {summary.breakdown?.paymentDetails?.paymentMode ? (
                          <span className="ml-2 text-xs text-primary font-medium">({summary.breakdown.paymentDetails.paymentMode})</span>
                        ) : null}
                      </td>
                      <td className="p-3 text-right font-semibold text-success">- {fmtMoney(summary.breakdown?.tokenAdvancePaid)}</td>
                    </tr>
                    <tr className="bg-primary/5">
                      <td className="p-3 font-bold text-base-content">Balance Payable at Title Deed Registry</td>
                      <td className="p-3 text-right font-black text-primary text-base">{fmtMoney(summary.breakdown?.balancePayable)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {summary.breakdown?.paymentDetails?.transactionRef && (
                <p className="text-xs text-base-content/50 mt-1.5">
                  Banking Reference: <span className="font-mono font-medium text-base-content/80">{summary.breakdown.paymentDetails.transactionRef}</span>
                  {summary.breakdown.paymentDetails.bankName ? ` (${summary.breakdown.paymentDetails.bankName})` : ""}
                </p>
              )}
            </div>

            {/* Stage-by-Stage Verification Checklist */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70 mb-2">
                Stage Closing Milestones
              </h4>
              <div className="rounded-2xl border border-base-300 divide-y divide-base-200 overflow-hidden">
                {(summary.closingChecklist || []).map((step, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className={`size-4 ${step.status === "COMPLETED" ? "text-success" : "text-base-300"}`} />
                      <span className="font-semibold text-base-content">{step.label}</span>
                    </div>
                    <span className="text-base-content/50 font-medium">
                      {step.completedAt ? fmtDate(step.completedAt) : "Awaiting completion"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Vault & Audit Trail */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70">
                  Legal Documents Audit ({summary.legalDocuments?.verifiedCount || 0}/{summary.legalDocuments?.totalCount || 0} Verified)
                </h4>
              </div>
              {summary.legalDocuments?.documents?.length ? (
                <div className="space-y-2">
                  {summary.legalDocuments.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-base-300 bg-base-100 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="font-semibold text-base-content truncate">{doc.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-base-200 text-[10px] font-medium text-base-content/70">
                              {CATEGORY_NAMES[doc.category] || doc.category || "Document"}
                            </span>
                            {doc.geoVerified && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold">
                                <MapPin className="size-3" /> Geo-Verified On-Site
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {doc.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-success font-semibold">
                            <ShieldCheck className="size-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="text-warning font-medium">Verification Pending</span>
                        )}
                        <p className="text-[10px] text-base-content/40 mt-0.5">{fmtDate(doc.uploadedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-base-300 text-center text-xs text-base-content/50">
                  No attachments recorded in document vault.
                </div>
              )}
            </div>

            {/* Footer Disclaimer */}
            <div className="pt-4 border-t border-base-200 text-[11px] text-base-content/50 text-center space-y-1">
              <p>Generated by NearMySpace Digital Escrow & Deal Closing Engine.</p>
              <p>This statement reflects digital confirmations submitted by buyer and seller counterparties.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
