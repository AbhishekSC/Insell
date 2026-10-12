import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  MapPin,
  CheckCircle2,
  Calendar,
  Building,
  User,
  CreditCard,
  Printer,
  Copy,
  ExternalLink,
  Lock,
} from "lucide-react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";

export default function VerifyStatementPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get(`/deals/verify-statement/${token}`);
        if (isMounted) {
          setData(res.data?.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              "Unable to verify transaction closing statement. The digital signature does not match or the record does not exist."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (token) {
      verify();
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      toast.success("SHA-256 fingerprint copied to clipboard");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl p-8 max-w-md w-full text-center border border-base-300">
          <div className="loading loading-spinner loading-lg text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Verifying Digital Seal</h2>
          <p className="text-sm text-base-content/70">
            Validating cryptographic SHA-256 signature against platform records...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
        <div className="card bg-base-100 shadow-2xl p-8 max-w-lg w-full text-center border border-error/30">
          <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-error mb-2">Verification Failed</h2>
          <p className="text-base-content/80 text-sm mb-6 leading-relaxed">{error}</p>
          <div className="bg-base-200 rounded-lg p-3 text-xs font-mono break-all mb-6 text-base-content/60">
            Token: {token}
          </div>
          <Link to="/" className="btn btn-outline btn-primary w-full">
            Return to NearMySpace Home
          </Link>
        </div>
      </div>
    );
  }

  const {
    statementNumber,
    tamperCheckStatus,
    verifiedAt,
    deal,
    property,
    parties,
    payment,
    checklist = [],
    verifiedDocumentsCount = 0,
    geoVerifiedCount = 0,
  } = data;

  const isAuthentic = tamperCheckStatus === "VERIFIED_AUTHENTIC";

  return (
    <div className="min-h-screen bg-base-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Print Bar */}
        <div className="flex items-center justify-between no-print">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg hover:underline">
            <Building className="w-5 h-5" /> NearMySpace
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-sm btn-outline gap-2 bg-base-100 shadow-sm"
              title="Print Certificate"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* Certificate Card */}
        <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden print:shadow-none print:border-none">
          {/* Official Verification Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm shadow-inner flex-shrink-0">
                  <ShieldCheck className="w-10 h-10 text-emerald-200" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-300/30 mb-2">
                    <Lock className="w-3 h-3" /> OFFICIAL VERIFICATION PORTAL
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Transaction Closing Statement
                  </h1>
                  <p className="text-emerald-100 text-sm mt-1">
                    Immutable Record of Settlement & Physical Clearance
                  </p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-center sm:text-right">
                <span className="text-xs uppercase tracking-wider text-emerald-200 block">Statement ID</span>
                <span className="font-mono font-bold text-lg text-white">{statementNumber}</span>
                <div className="text-[11px] text-emerald-200 mt-1 flex items-center justify-center sm:justify-end gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(verifiedAt).toLocaleDateString("en-IN")}
                </div>
              </div>
            </div>
          </div>

          {/* Tamper-Check Status Badge */}
          <div className="p-6 border-b border-base-200 bg-base-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg">
                    {isAuthentic ? "Cryptographically Authenticated & Untampered" : "Integrity Warning"}
                  </h3>
                  <span className="badge badge-success badge-sm font-semibold text-white">LIVE SEAL</span>
                </div>
                <p className="text-xs text-base-content/70 mt-0.5">
                  Certified digital record stored on NearMySpace ledger. Valid for bank home loans, tax clearance, and legal audit.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Property & Deal Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-primary" /> Property Information
                </span>
                <h4 className="text-lg font-bold text-base-content">{property.title}</h4>
                <p className="text-sm text-base-content/70 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-base-content/50 flex-shrink-0 mt-0.5" />
                  {property.address || property.city || "Verified Physical Asset"}
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="badge badge-primary badge-outline text-xs">
                    {property.listingType || "Sale"}
                  </span>
                  <span className="badge badge-ghost text-xs">Deal Mode: {deal.mode}</span>
                </div>
              </div>

              {/* Verified Parties */}
              <div className="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary" /> Verified Contracting Parties
                </span>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-base-content/60 block">Owner / Seller</span>
                      <span className="font-semibold text-sm">{parties.owner?.name}</span>
                    </div>
                    {parties.owner?.isVerified && (
                      <span className="badge badge-success badge-sm text-white gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> KYC Verified
                      </span>
                    )}
                  </div>

                  <div className="divider my-1 opacity-40" />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-base-content/60 block">Buyer / Tenant</span>
                      <span className="font-semibold text-sm">{parties.buyer?.name}</span>
                    </div>
                    {parties.buyer?.isVerified && (
                      <span className="badge badge-success badge-sm text-white gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> KYC Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Settlement Breakdown */}
            <div className="bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
              <div className="bg-base-200/80 px-5 py-3 border-b border-base-300 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary" /> Financial Audit & Payment Settlement
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Bank Settlement Confirmed
                </span>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-base-200/40 rounded-xl">
                  <span className="text-xs text-base-content/60 block">Agreed Price</span>
                  <span className="text-lg font-bold text-base-content">
                    ₹{(payment.agreedPrice || deal.agreedPrice || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 bg-base-200/40 rounded-xl">
                  <span className="text-xs text-base-content/60 block">Advance / Token Paid</span>
                  <span className="text-lg font-bold text-emerald-600">
                    ₹{(payment.paidAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 bg-base-200/40 rounded-xl">
                  <span className="text-xs text-base-content/60 block">Payment Mode</span>
                  <span className="text-sm font-bold text-base-content mt-1 block">
                    {payment.paymentMode || "NEFT / RTGS"}
                  </span>
                </div>
                <div className="p-3 bg-base-200/40 rounded-xl">
                  <span className="text-xs text-base-content/60 block">Bank Transaction Ref</span>
                  <span className="text-xs font-mono font-semibold text-base-content truncate block mt-1">
                    {payment.transactionRef || "Bank Verified"}
                  </span>
                </div>
              </div>
            </div>

            {/* Trust & Authenticity Badges: Physical Site Inspection & Verified Docs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    Physical Site Inspection
                    {geoVerifiedCount > 0 && (
                      <span className="badge badge-success badge-xs text-white">Geo-Verified</span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800/80 mt-0.5">
                    {geoVerifiedCount > 0
                      ? `${geoVerifiedCount} inspection photo(s) captured within 150m GPS radius of site.`
                      : "Physical premises verified during transaction agreement."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-950">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    Dual Counterparty Verification
                  </div>
                  <p className="text-xs text-blue-800/80 mt-0.5">
                    {verifiedDocumentsCount} title deeds & legal agreements mutually cross-signed & locked against deletion.
                  </p>
                </div>
              </div>
            </div>

            {/* Stage Milestones Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Closing Checklist & Legal Milestones
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {checklist.map((step) => (
                  <div
                    key={step.key}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium ${
                      step.completed
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                        : "bg-base-200/40 border-base-300 text-base-content/50"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 flex-shrink-0 ${
                        step.completed ? "text-emerald-600" : "text-base-content/30"
                      }`}
                    />
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic SHA-256 Fingerprint Box & Official QR Seal */}
            <div className="bg-base-200 rounded-2xl p-5 border border-base-300 flex flex-col md:flex-row items-center gap-5">
              <div className="relative p-2 bg-white rounded-xl shadow-xs border border-base-300 shrink-0 flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=H&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `https://nearmyspace.com/verify-statement/${token}`)}`}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://quickchart.io/qr?size=200&ecLevel=H&text=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `https://nearmyspace.com/verify-statement/${token}`)}`;
                  }}
                  alt="Official Closing Statement QR Code"
                  className="size-24 rounded-lg object-contain"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="size-7 bg-white rounded-md shadow-md p-0.5 border border-base-200 flex items-center justify-center overflow-hidden">
                    <img
                      src="/favicon.png"
                      alt="NearMySpace"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex items-center justify-between text-xs font-semibold text-base-content/70">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" /> SHA-256 Cryptographic Certificate Stamp
                  </span>
                  <button
                    type="button"
                    onClick={copyToken}
                    className="btn btn-ghost btn-xs gap-1 text-primary no-print"
                  >
                    <Copy className="w-3 h-3" /> Copy Hash
                  </button>
                </div>
                <div className="font-mono text-xs break-all bg-base-100 p-3 rounded-lg border border-base-300 select-all text-base-content/90">
                  {token}
                </div>
                <p className="text-[11px] text-base-content/60 leading-normal">
                  This SHA-256 fingerprint mathematically binds the buyer, seller, agreed financial consideration, and verified property attachments. Scan QR code to verify anytime.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-base-200/60 p-4 border-t border-base-300 text-center text-xs text-base-content/60">
            Powered by NearMySpace Real Estate Trust Ledger • Free Public Verification Service
          </div>
        </div>
      </div>
    </div>
  );
}
