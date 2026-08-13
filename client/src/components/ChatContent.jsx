import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import {
  CheckCheck,
  Loader2,
  MessageCircleHeart,
  Radio,
  Search,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

const EMPTY_FRIENDS = [];

export default function ChatContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [isConversationOpenMobile, setIsConversationOpenMobile] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const { streamClient: chatClient, streamReady, streamConnecting, currentUserId, unreadCount } = useStreamContext();

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify");
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const authUser = authData?.data?.user || authData?.data || null;

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const friends = friendsData ?? EMPTY_FRIENDS;

  const filteredFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return friends;
    }

    return friends.filter((friend) => {
      const interests = Array.isArray(friend?.travelInterests) ? friend.travelInterests.join(" ") : "";
      const haystack = [
        friend?.fullName,
        friend?.travelStyle,
        interests,
        Array.isArray(friend?.favoriteDestinations) ? friend.favoriteDestinations.join(" ") : "",
        friend?.homeBase,
        friend?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [friends, searchQuery]);

  const openFriendChat = async (friend) => {
    const currentId = currentUserId || authUser?._id;

    if (!chatClient || !currentId) {
      toast.error("Chat is still loading");
      return;
    }

    try {
      const channel = chatClient.channel("messaging", {
        members: [currentId, friend._id],
      });

      await channel.watch();
      setSelectedFriendId(friend._id);
      setActiveChannel(channel);
      setIsConversationOpenMobile(true);
    } catch {
      toast.error("Failed to open conversation");
    }
  };

  const friendCountLabel = useMemo(() => {
    if (friends.length === 0) {
      return "No friends yet";
    }

    if (friends.length === 1) {
      return "1 active friend";
    }

    return `${friends.length} active friends`;
  }, [friends.length]);

  const selectedFriend = friends.find((friend) => friend._id === selectedFriendId) || null;
  const serviceReady = Boolean(chatClient && streamReady && !streamConnecting);
  const showSidebar = !isConversationOpenMobile;
  const showConversation = isConversationOpenMobile;
  const hasActiveConversation = Boolean(activeChannel);

  return (
    <div className="telegram-chat-layout h-full xl:h-[calc(100dvh-7.1rem)] xl:min-h-0 overflow-hidden">
      <section className={`telegram-sidebar min-h-0 overflow-hidden ${showSidebar ? "" : "hidden sm:block"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-slate-200 px-4 pb-4 pt-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Users className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Your inbox</h2>
                  <p className="text-[11px] text-slate-500">{friendCountLabel}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${serviceReady ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                <Radio className="size-3" />
                {serviceReady ? "Ready" : "Syncing"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Direct conversations</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium">
                <CheckCheck className="size-3.5 text-indigo-600" />
                {unreadCount ? `${unreadCount} unread` : "All caught up"}
              </span>
            </div>

            <label className="input input-bordered mt-4 flex h-11 items-center gap-2 rounded-xl border-slate-200 bg-slate-50 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:outline-none">
              <Search className="size-4 opacity-60" />
              <input
                type="text"
                className="grow"
                placeholder="Search chats"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100"></div>
              <div className="h-16 animate-pulse rounded-xl bg-slate-100"></div>
              <div className="h-16 animate-pulse rounded-xl bg-slate-100"></div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="m-4 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              {friends.length === 0
                ? "You have no connected users yet. Accept requests first."
                : "No users matched your search."}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 pb-6">
              {filteredFriends.map((friend) => {
                const isActive = selectedFriendId === friend._id;

                return (
                  <button
                    key={friend._id}
                    type="button"
                    className={`mb-1.5 w-full rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isActive
                        ? "border-indigo-300 bg-indigo-50 shadow-sm shadow-indigo-100"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                    }`}
                    onClick={() => openFriendChat(friend)}
                    disabled={!streamReady || streamConnecting || !chatClient}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar
                          src={friend.profilePic}
                          name={friend.fullName || "User"}
                          sizeClass="size-12"
                          userId={friend._id}
                        />
                        <span className="absolute bottom-0 right-0 grid size-3.5 place-items-center rounded-full border-2 border-white bg-emerald-500"></span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{friend.fullName || "User"}</p>
                          <p className="text-[10px] text-slate-400">2m</p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">Tap to start conversation</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className={`telegram-conversation-panel min-h-0 h-full overflow-hidden ${showConversation ? "" : "hidden sm:block"}`}>
        {!hasActiveConversation ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 grid size-20 place-items-center rounded-full bg-indigo-50">
              <MessageCircleHeart className="size-10 text-indigo-400" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">Your messages</h3>
            <p className="text-sm text-slate-500">Select a conversation to start chatting</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 h-full flex-col">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:hidden">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setIsConversationOpenMobile(false)}
              >
                Back
              </button>
              <p className="truncate text-sm font-semibold">{selectedFriend?.fullName || "Conversation"}</p>
            </div>
            <div className="flex-1 min-h-0 h-full overflow-hidden rounded-xl border border-slate-200 bg-white pb-6">
              <Chat client={chatClient}>
                <Channel channel={activeChannel}>
                  <Window>
                    <MessageList />
                    <MessageComposer />
                  </Window>
                  <Thread />
                </Channel>
              </Chat>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
