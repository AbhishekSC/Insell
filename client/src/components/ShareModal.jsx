import { useState } from "react";
import { X, Copy, Check, Share2, MessageCircle, Facebook } from "lucide-react";
import toast from "react-hot-toast";

export default function ShareModal({ isOpen, onClose, postUrl, postTitle }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`Check out this property: ${postTitle}`);
    window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(postUrl)}`, "_blank");
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Share Property</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Copy Link Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Property Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={postUrl}
                readOnly
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 bg-slate-50"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Share Options */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Share to</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={shareToWhatsApp}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <MessageCircle className="size-5 text-green-600" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={shareToFacebook}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Facebook className="size-5 text-blue-600" />
                Facebook
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
