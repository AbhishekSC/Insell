import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ShieldCheck, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const DOC_TYPES = [
  { value: "AADHAAR", label: "Aadhaar card" },
  { value: "PAN", label: "PAN card" },
  { value: "PROPERTY_TAX_RECEIPT", label: "Property tax receipt" },
  { value: "SALE_DEED", label: "Sale deed" },
  { value: "OTHER", label: "Other ownership proof" },
];

const STATUS_STYLE = {
  PENDING: { label: "Under review", className: "bg-warning/15 text-warning" },
  APPROVED: { label: "Verified", className: "bg-success/15 text-success" },
  REJECTED: { label: "Not approved", className: "bg-error/15 text-error" },
};

// "Verified Owner" trust badge — submit an ID/ownership document, an admin
// reviews it. Lives on the profile page; see server modules/owner-verification.
export default function OwnerVerificationCard() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState("AADHAAR");
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ownerVerificationStatus"],
    queryFn: async () => {
      const res = await axiosInstance.get("/owner-verification/status");
      return res.data?.data;
    },
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a document to upload");
      const payload = new FormData();
      payload.append("docType", docType);
      payload.append("note", note);
      payload.append("document", file);
      const res = await axiosInstance.post("/owner-verification", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Submitted — we'll review it shortly");
      setFile(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["ownerVerificationStatus"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || "Couldn't submit that");
    },
  });

  if (isLoading) return null;

  const isVerified = Boolean(data?.isOwnerVerified);
  const request = data?.request;
  const statusInfo = request ? STATUS_STYLE[request.status] : null;

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content/80">
        <ShieldCheck className="size-4 text-primary" />
        Verified Owner badge
      </div>

      {isVerified ? (
        <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          <BadgeCheck className="size-5" />
          You're a Verified Owner — this badge now shows on your listings and profile.
        </div>
      ) : (
        <>
          <p className="text-sm text-base-content/65">
            Upload an ID or ownership document to earn the Verified Owner badge — the strongest trust
            signal buyers look for. Reviewed by our team, usually within a day or two.
          </p>

          {request?.status === "PENDING" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              <span className={`rounded-full px-2 py-0.5 ${statusInfo.className}`}>{statusInfo.label}</span>
              Submitted {new Date(request.createdAt).toLocaleDateString()} — we'll notify you once it's reviewed.
            </div>
          )}
          {request?.status === "REJECTED" && (
            <div className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-xs text-error">
              <p className="font-semibold">Not approved{request.reviewNote ? ":" : "."}</p>
              {request.reviewNote && <p className="mt-0.5">{request.reviewNote}</p>}
              <p className="mt-1 text-base-content/60">You can submit a new document below.</p>
            </div>
          )}

          {request?.status !== "PENDING" && (
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text mb-1">Document type</span>
                <select
                  className="select select-bordered select-sm"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1">Upload document (image or PDF)</span>
                <input
                  type="file"
                  className="file-input file-input-bordered file-input-sm"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1">Note (optional)</span>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="Anything the reviewer should know"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </label>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isPending || !file}
                onClick={() => submit()}
              >
                <UploadCloud className="size-4" />
                {isPending ? "Submitting…" : "Submit for review"}
              </button>
              <p className="text-[11px] text-base-content/50">
                Only used for verification — never shown publicly. Reviewed by an admin, not automated.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
