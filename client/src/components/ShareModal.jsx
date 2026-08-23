import { useMemo, useState } from "react";
import { X, Copy, Check, Search, MessageCircle, Facebook, Send, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";
import UserAvatar from "./UserAvatar";

export default function ShareModal({ isOpen, onClose, postUrl, postTitle, postId, postImage }) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());
  const [isSending, setIsSending] = useState(false);
  const { streamClient, currentUserId } = useStreamContext();

  const { data: friends, isLoading: isLoadingFriends } = useQuery({
    queryKey: ["friends"],
    enabled: isOpen,
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const filteredFriends = useMemo(() => {
    const list = friends || [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((friend) => (friend.fullName || "").toLowerCase().includes(query));
  }, [friends, searchQuery]);

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
    setSearchQuery("");
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
      // Custom attachment type, not a plain-text link — ChatContent.jsx
      // renders "property" attachments as a proper card (image + title) and
      // navigates within the app on click, instead of relying on Stream's
      // generic URL-unfurl preview (which only reflects the SPA's static,
      // site-wide OG tags) or a plain external link that opens a new tab.
      await Promise.all(
        Array.from(selectedFriendIds).map(async (friendId) => {
          const channel = streamClient.channel("messaging", {
            members: [currentUserId, friendId],
          });
          await channel.watch();
          await channel.sendMessage({
            text: "",
            attachments: [
              {
                type: "property",
                title: postTitle,
                image_url: postImage || "",
                title_link: postUrl,
                property_id: postId,
              },
            ],
          });
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
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Share</h3>
          <button
            type="button"
            onClick={handleClose}
            className="absolute left-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="shrink-0 p-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-300"
            />
          </div>
        </div>

        <div className="max-h-[248px] shrink-0 overflow-y-auto p-4 pt-2">
          {isLoadingFriends ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading your friends...</p>
          ) : filteredFriends.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {friends?.length ? "No friends match your search." : "You don't have any friends to share with yet."}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend._id);
                return (
                  <button
                    key={friend._id}
                    type="button"
                    onClick={() => toggleFriend(friend._id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-center transition-colors ${
                      isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative">
                      <UserAvatar src={friend.profilePic} name={friend.fullName || "User"} sizeClass="size-16" />
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-white bg-indigo-600">
                          <Check className="size-3 text-white" />
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 max-w-16 text-xs font-medium text-slate-700">
                      {friend.fullName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedFriendIds.size > 0 && (
          <div className="shrink-0 px-4 pb-2">
            <button
              type="button"
              disabled={isSending}
              onClick={handleShareToFriends}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isSending ? "Sharing..." : `Share (${selectedFriendIds.size})`}
            </button>
          </div>
        )}

        <div className="shrink-0 border-t border-slate-200 p-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="grid size-11 place-items-center rounded-full bg-slate-100">
                {copied ? <Check className="size-5 text-emerald-600" /> : <Copy className="size-5" />}
              </span>
              <span className="text-xs font-medium">{copied ? "Copied" : "Copy Link"}</span>
            </button>
            <button
              type="button"
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="grid size-11 place-items-center rounded-full bg-slate-100">
                <MessageCircle className="size-5 text-green-600" />
              </span>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={shareToFacebook}
              className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="grid size-11 place-items-center rounded-full bg-slate-100">
                <Facebook className="size-5 text-blue-600" />
              </span>
              <span className="text-xs font-medium">Facebook</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
