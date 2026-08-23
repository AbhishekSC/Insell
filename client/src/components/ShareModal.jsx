import { useState } from "react";
import { X, Copy, Check, Share2, MessageCircle, Facebook, Send, ArrowLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";
import UserAvatar from "./UserAvatar";

export default function ShareModal({ isOpen, onClose, postUrl, postTitle }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState("main"); // "main" | "friends"
  const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());
  const [isSending, setIsSending] = useState(false);
  const { streamClient, currentUserId } = useStreamContext();

  const { data: friends, isLoading: isLoadingFriends } = useQuery({
    queryKey: ["friends"],
    enabled: mode === "friends",
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const handleClose = () => {
    setMode("main");
    setSelectedFriendIds(new Set());
    onClose();
  };

  const toggleFriend = (friendId) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  };

  const handleShareToFriends = async () => {
    if (!streamClient || !currentUserId) {
      toast.error("Chat is still loading");
      return;
    }
    if (selectedFriendIds.size === 0) return;

    setIsSending(true);
    try {
      const text = `Check out this property: ${postTitle}\n${postUrl}`;
      await Promise.all(
        Array.from(selectedFriendIds).map(async (friendId) => {
          const channel = streamClient.channel("messaging", {
            members: [currentUserId, friendId],
          });
          await channel.watch();
          await channel.sendMessage({ text });
        })
      );
      toast.success(selectedFriendIds.size === 1 ? "Shared with your friend" : "Shared with your friends");
      handleClose();
    } catch {
      toast.error("Failed to share with some friends");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            {mode === "friends" && (
              <button
                type="button"
                onClick={() => setMode("main")}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <Share2 className="size-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "friends" ? "Share to Friend" : "Share Property"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {mode === "main" ? (
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
                  onClick={() => setMode("friends")}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Send className="size-5 text-indigo-600" />
                  Share to Friend
                </button>
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
        ) : (
          <div className="p-4">
            {isLoadingFriends ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading your friends...</p>
            ) : (friends || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                You don&apos;t have any friends to share with yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.has(friend._id);
                  return (
                    <button
                      key={friend._id}
                      type="button"
                      onClick={() => toggleFriend(friend._id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <UserAvatar src={friend.profilePic} name={friend.fullName || "User"} sizeClass="size-10" />
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">{friend.fullName}</span>
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                          isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                        }`}
                      >
                        {isSelected && <Check className="size-3 text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 p-4">
          {mode === "friends" ? (
            <button
              type="button"
              disabled={selectedFriendIds.size === 0 || isSending}
              onClick={handleShareToFriends}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {isSending
                ? "Sharing..."
                : selectedFriendIds.size > 0
                ? `Share (${selectedFriendIds.size})`
                : "Share"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
