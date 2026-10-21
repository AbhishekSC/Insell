import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { uploadPropertyMedia } from "../lib/cloudinaryUpload";

export default function VerifyAddressModal({
  isOpen,
  onClose,
  post,
  onSuccess,
}) {
  const queryClient = useQueryClient();

  const [billUrl, setBillUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resMeta = post?.postMeta?.residential || {};
  const flatMeta =
    post?.postMeta && typeof post.postMeta === "object" && !Array.isArray(post.postMeta)
      ? post.postMeta
      : {};

  const currentStatus =
    resMeta.electricityBillStatus ||
    flatMeta.electricityBillStatus ||
    post?.electricityBillStatus ||
    (resMeta.electricityBillUrl || flatMeta.electricityBillUrl ? "PENDING" : "NONE");

  const rejectionReason =
    resMeta.electricityBillRejectionReason ||
    flatMeta.electricityBillRejectionReason ||
    post?.electricityBillRejectionReason ||
    "";

  useEffect(() => {
    if (isOpen && post) {
      const existingUrl =
        post?.postMeta?.residential?.electricityBillUrl ||
        post?.postMeta?.electricityBillUrl ||
        post?.electricityBillUrl ||
        "";
      setBillUrl(existingUrl);
      setUploading(false);
      setUploadProgress(0);
      setIsSubmitting(false);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF document or an image (JPG, PNG, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size cannot exceed 10MB");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);
      const urls = await uploadPropertyMedia([file], (percent) => setUploadProgress(percent));
      if (urls?.[0]) {
        setBillUrl(urls[0]);
        toast.success("Document uploaded successfully");
      }
    } catch (err) {
      console.error("Failed to upload bill:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to upload document");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!billUrl) {
      toast.error("Please upload an electricity bill to verify your address");
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosInstance.put(`/posts/${post._id}`, {
        electricityBillUrl: billUrl,
      });

      toast.success("Electricity bill submitted for verification!");

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
      queryClient.invalidateQueries({ queryKey: ["propertyPost", post._id] });
      queryClient.invalidateQueries({ queryKey: ["myPosts"] });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to submit verification:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to submit verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPdf = billUrl?.toLowerCase().includes(".pdf");
  const locationLabel = [post.locality, post.city].filter(Boolean).join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-base-300 bg-base-100 shadow-2xl transition-all my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-base-200 p-5 bg-base-200/40">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base-content text-lg leading-tight">
                Verify Property Address
              </h3>
              <p className="text-xs text-base-content/60 mt-0.5">
                Upload electricity bill for admin verification & feed boost
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Property snippet */}
          <div className="rounded-xl border border-base-200 bg-base-200/50 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-base-content truncate">
                {post.title || "Untitled Property"}
              </p>
              {locationLabel && (
                <p className="text-[11px] text-base-content/60 truncate mt-0.5">
                  📍 {locationLabel}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs font-bold text-primary">
              {post.listingType || "Sale"}
            </span>
          </div>

          {/* Verification Status Alerts */}
          {currentStatus === "REJECTED" && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Previous Submission Rejected</p>
                <p className="mt-0.5 text-error/90">
                  {rejectionReason ? `Reason: ${rejectionReason}` : "The bill was rejected. Please upload a clearer bill showing the address and consumer name."}
                </p>
              </div>
            </div>
          )}

          {currentStatus === "PENDING" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
              <Clock className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Under Admin Review</p>
                <p className="mt-0.5 opacity-85">
                  Your electricity bill is currently waiting for admin review. You can upload a new document to replace it if needed.
                </p>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Why verify your property?
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs text-base-content/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <span>Get <strong>"✓ Address Verified"</strong> trust badge</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <span><strong>25% higher algorithm ranking</strong> in buyer feed</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <span>Admin verifies your bill within 24 hours</span>
              </div>
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-base-content/70 mb-1.5">
              Upload Electricity Bill (PDF, JPG, PNG · Max 10MB)
            </label>

            {billUrl ? (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-base-content truncate">
                      {isPdf ? "Electricity Bill (PDF)" : "Electricity Bill Document"}
                    </p>
                    <p className="text-[10px] text-success font-medium">
                      ✓ Document ready for submission
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label
                    htmlFor="replace-bill-input"
                    className="btn btn-xs btn-ghost text-primary cursor-pointer"
                  >
                    Replace
                  </label>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost btn-circle text-error hover:bg-error/15"
                    onClick={() => setBillUrl("")}
                    title="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                  <input
                    id="replace-bill-input"
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
            ) : (
              <label
                htmlFor="bill-file-input"
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-base-300 bg-base-200/50 hover:bg-base-200 hover:border-primary/50 cursor-pointer transition text-center ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="size-8 text-primary animate-spin" />
                    <p className="mt-2 text-xs font-bold text-base-content">
                      Uploading… {uploadProgress}%
                    </p>
                    <div className="w-32 bg-base-300 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary mb-2">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-xs font-bold text-base-content">
                      Click or drag & drop electricity bill
                    </p>
                    <p className="text-[10px] text-base-content/50 mt-0.5">
                      PDF, JPG, PNG up to 10MB
                    </p>
                  </>
                )}
                <input
                  id="bill-file-input"
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            )}
            <p className="text-[10px] text-base-content/50 mt-1.5">
              * Document will only be visible to admin staff for address verification.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-base-200 p-4 bg-base-200/30">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            disabled={isSubmitting || uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSubmit}
            disabled={!billUrl || isSubmitting || uploading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit for Verification"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
