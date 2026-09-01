import { useEffect, useMemo, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

const EMPTY_FRIENDS = [];

export default function AddPeopleModal({ isOpen, onClose }) {
  const { useParticipants, useCallMembers } = useCallStateHooks();
  const participants = useParticipants();
  const callMembers = useCallMembers();
  const { inviteToActiveCall, currentUserId } = useStreamContext();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isInviting, setIsInviting] = useState(false);
  const [justInvitedIds, setJustInvitedIds] = useState([]);

  // "Invited" is a short-lived, in-session hint to stop rapid double-clicks
  // from double-inviting — not a permanent lock. Resetting it whenever the
  // modal reopens means a declined/expired invite can be sent again without
  // waiting for the whole call to end; true "already in the call" status
  // still comes from the live members/participants lists below regardless.
  useEffect(() => {
    if (isOpen) {
      setJustInvitedIds([]);
      setSelectedIds([]);
      setSearch("");
    }
  }, [isOpen]);

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    enabled: isOpen,
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const friends = friendsData ?? EMPTY_FRIENDS;

  // Anyone already joined in the live session, or already invited/pending
  // as a call member (even if they haven't accepted yet) — both cases are
  // "already in this call" for invite purposes, so re-inviting is blocked.
  const joinedIds = useMemo(() => new Set(participants.map((p) => String(p.userId))), [participants]);
  const memberIds = useMemo(
    () => new Set(callMembers.map((member) => String(member.user_id ?? member.user?.id))),
    [callMembers]
  );

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((friend) => friend.fullName?.toLowerCase().includes(query));
  }, [friends, search]);

  const toggleSelect = (friendId) => {
    setSelectedIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]
    );
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;

    setIsInviting(true);
    try {
      const invited = await inviteToActiveCall(selectedIds);
      if (invited.length > 0) {
        toast.success(`Invited ${invited.length} ${invited.length === 1 ? "person" : "people"} to the call`);
        setJustInvitedIds((current) => [...current, ...invited]);
      }
      setSelectedIds([]);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-base-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
              <UserPlus className="size-4" />
            </div>
            <h3 className="text-lg font-semibold text-base-content">Add people</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content/70"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-base-300 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search friends..."
              className="w-full rounded-lg border border-base-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-base-content/50" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/60">
              {friends.length === 0 ? "No friends to invite yet." : "No friends match your search."}
            </p>
          ) : (
            <ul className="divide-y divide-base-300">
              {filteredFriends.map((friend) => {
                const friendId = String(friend._id);
                if (friendId === String(currentUserId)) return null;

                const isJoined = joinedIds.has(friendId);
                const isPendingMember = !isJoined && memberIds.has(friendId);
                const isJustInvited = justInvitedIds.includes(friendId);
                const isUnavailable = isJoined || isPendingMember || isJustInvited;
                const isSelected = selectedIds.includes(friendId);

                return (
                  <li key={friendId}>
                    <button
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => toggleSelect(friendId)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                        isUnavailable ? "cursor-not-allowed opacity-60" : "hover:bg-base-200"
                      }`}
                    >
                      <UserAvatar src={friend.profilePic} name={friend.fullName} sizeClass="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-base-content">
                          {friend.fullName}
                        </span>
                        {isJoined ? (
                          <span className="text-xs font-medium text-success">Already in call</span>
                        ) : isPendingMember || isJustInvited ? (
                          <span className="text-xs font-medium text-warning">Invited</span>
                        ) : (
                          <span className="text-xs text-base-content/60">
                            {friend.travelStyle || friend.learningLanguage || "Friend"}
                          </span>
                        )}
                      </span>
                      {!isUnavailable ? (
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                            isSelected ? "border-primary bg-primary" : "border-base-300"
                          }`}
                        >
                          {isSelected ? <Check className="size-3.5 text-white" /> : null}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-base-300 p-4">
          <button
            type="button"
            onClick={handleInvite}
            disabled={selectedIds.length === 0 || isInviting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:opacity-50"
          >
            {isInviting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isInviting
              ? "Inviting..."
              : selectedIds.length > 0
                ? `Invite ${selectedIds.length} ${selectedIds.length === 1 ? "person" : "people"}`
                : "Select friends to invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
