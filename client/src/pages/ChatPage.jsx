import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
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
  Compass,
  Loader2,
  MessageCircleHeart,
  MessageSquare,
  Radio,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

const EMPTY_FRIENDS = [];

export default function ChatPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [isConversationOpenMobile, setIsConversationOpenMobile] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [directChatUser, setDirectChatUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const processedDirectChatIds = useRef(new Set());
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

  // Drives the "most recently messaged first" ordering below — a map of
  // friendId -> last message timestamp, built from Stream's own channel
  // list rather than anything our backend tracks. Invalidated by
  // StreamProvider whenever a message.new/notification.message_new event
  // arrives, so the list reorders live as conversations happen.
  const { data: lastMessageByFriendId } = useQuery({
    queryKey: ["streamChannelsLastMessage", currentUserId],
    queryFn: async () => {
      const channels = await chatClient.queryChannels(
        { type: "messaging", members: { $in: [currentUserId] } },
        { last_message_at: -1 },
        { limit: 50, state: true }
      );
      const map = {};
      channels.forEach((channel) => {
        const lastMessageAt = channel.state.last_message_at ? new Date(channel.state.last_message_at).getTime() : 0;
        if (!lastMessageAt) return;
        const otherId = Object.keys(channel.state.members || {}).find((id) => id !== currentUserId);
        if (otherId) {
          map[otherId] = Math.max(map[otherId] || 0, lastMessageAt);
        }
      });
      return map;
    },
    enabled: Boolean(chatClient && currentUserId),
    staleTime: 5000,
  });

  const filteredFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matched = !query
      ? friends
      : friends.filter((friend) => {
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

    const lastMap = lastMessageByFriendId || {};
    return [...matched].sort((a, b) => (lastMap[b._id] || 0) - (lastMap[a._id] || 0));
  }, [friends, searchQuery, lastMessageByFriendId]);

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

  // Deep link support: /chat?userId=<id> opens a direct conversation with that
  // user immediately, even if they aren't in the friends list yet (e.g. coming
  // from the "Chat" button on a property page).
  useEffect(() => {
    const targetUserId = searchParams.get("userId");
    if (!targetUserId || !chatClient || !currentUserId) return;
    if (processedDirectChatIds.current.has(targetUserId)) return;
    processedDirectChatIds.current.add(targetUserId);

    const clearUserIdParam = () => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("userId");
        return next;
      }, { replace: true });
    };

    const existingFriend = friends.find((friend) => friend._id === targetUserId);
    if (existingFriend) {
      openFriendChat(existingFriend);
      clearUserIdParam();
      return;
    }

    axiosInstance
      .get(`/users/${targetUserId}/profile`)
      .then((response) => {
        const user = response.data?.data?.user;
        if (!user) {
          toast.error("User not found");
          return;
        }
        const profile = { ...user, _id: targetUserId };
        setDirectChatUser(profile);
        openFriendChat(profile);
      })
      .catch(() => toast.error("Could not start chat with this user"))
      .finally(clearUserIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, chatClient, currentUserId, friends]);

  const friendCountLabel = useMemo(() => {
    if (friends.length === 0) {
      return "No friends yet";
    }

    if (friends.length === 1) {
      return "1 active friend";
    }

    return `${friends.length} active friends`;
  }, [friends.length]);

  const selectedFriend =
    friends.find((friend) => friend._id === selectedFriendId) ||
    (directChatUser?._id === selectedFriendId ? directChatUser : null);
  const serviceReady = Boolean(chatClient && streamReady && !streamConnecting);
  const showSidebar = !isConversationOpenMobile;
  const showConversation = isConversationOpenMobile;
  const hasActiveConversation = Boolean(activeChannel);

  return (
    <AppShell
      title="Messages"
      subtitle="Stay in touch with your travel community."
      lockPageScroll
    >
      <div className="telegram-chat-layout h-full min-h-[calc(100dvh-14rem)] overflow-hidden sm:min-h-[580px]">
        <section className={`telegram-sidebar min-h-0 overflow-hidden ${showSidebar ? "" : "hidden sm:block"}`}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-base-300/80 px-4 pb-4 pt-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Users className="size-4.5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Your inbox</h2>
                    <p className="text-[11px] text-base-content/55">{friendCountLabel}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${serviceReady ? "bg-success/12 text-success" : "bg-warning/15 text-warning"}`}>
                  <Radio className="size-3" />
                  {serviceReady ? "Ready" : "Syncing"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-base-content/65">
                <span>Direct conversations</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-1 font-medium">
                  <CheckCheck className="size-3.5 text-primary" />
                  {unreadCount ? `${unreadCount} unread` : "All caught up"}
                </span>
              </div>

              <label className="input input-bordered mt-4 flex h-11 items-center gap-2 rounded-xl border-base-300/80 bg-base-200/55 transition focus-within:border-primary/50 focus-within:bg-base-100 focus-within:outline-none">
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
                <div className="h-16 animate-pulse rounded-xl bg-base-200"></div>
                <div className="h-16 animate-pulse rounded-xl bg-base-200"></div>
                <div className="h-16 animate-pulse rounded-xl bg-base-200"></div>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="empty-box m-4">
                {friends.length === 0
                  ? "You have no connected users yet. Accept requests first."
                  : "No users matched your search."}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
                {filteredFriends.map((friend) => {
                  const isActive = selectedFriendId === friend._id;

                  return (
                    <button
                      key={friend._id}
                      type="button"
                      className={`mb-1.5 w-full rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        isActive
                          ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/5"
                          : "border-transparent bg-base-100/60 hover:border-base-300/90 hover:bg-base-100 hover:shadow-sm"
                      }`}
                      onClick={() => openFriendChat(friend)}
                      disabled={!streamReady || streamConnecting || !chatClient}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <UserAvatar
                            src={friend.profilePic}
                            name={friend.fullName}
                            sizeClass="size-11"
                            roundedClass="rounded-full"
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-base-100 ${isActive ? "bg-success" : "bg-base-300/80"}`}></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{friend.fullName}</p>
                          <p className="truncate text-xs text-base-content/60 mt-0.5">
                            {friend.travelStyle || friend.learningLanguage || "Traveler"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-base-content/50">{friend.homeBase || friend.location || "Home base not set"}</p>
                        </div>
                        {isActive ? <MessageSquare className="size-4 text-primary" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className={`telegram-conversation-panel min-h-0 overflow-hidden ${showConversation ? "" : "hidden sm:block"}`}>
          <div className={`flex h-full min-h-0 flex-col ${hasActiveConversation ? "p-0" : "gap-3 p-4 sm:gap-4 sm:p-5"}`}>
            {!hasActiveConversation ? (
              <div className="rounded-2xl border border-base-300/70 bg-base-100/80 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="card-title text-xl sm:text-2xl">
                      {selectedFriend ? selectedFriend.fullName : "Conversation"}
                    </h3>
                    <p className="mt-1 text-sm text-base-content/65">
                      {selectedFriend
                        ? "Direct messages with clean focus mode"
                        : "Choose a user from the left panel to start chatting"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge badge-ghost">{unreadCount} unread</span>
                    {streamConnecting ? (
                      <span className="badge badge-warning">Connecting...</span>
                    ) : streamReady ? (
                      <span className="badge badge-success">Online</span>
                    ) : (
                      <span className="badge badge-error">Offline</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {!chatClient || streamConnecting ? (
              <div className="grid flex-1 min-h-0 place-items-center rounded-2xl border border-dashed border-base-300 bg-gradient-to-b from-base-100/95 to-base-200/60 p-6 text-center">
                <div className="space-y-2">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                  <p className="text-sm text-base-content/70">Preparing chat client...</p>
                </div>
              </div>
            ) : !activeChannel ? (
              <div className="chat-welcome grid flex-1 min-h-0 place-items-center rounded-2xl border border-dashed border-base-300 p-8 text-center">
                <div className="max-w-sm space-y-2">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
                    <MessageCircleHeart className="size-6" />
                  </div>
                  <p className="pt-2 text-lg font-bold">Start a meaningful conversation</p>
                  <p className="text-sm text-base-content/65">
                    Select a friend from the left panel to start messaging instantly.
                  </p>
                  <div className="mt-3 grid gap-2 text-left text-xs">
                    <p className="inline-flex items-center gap-2 rounded-xl border border-base-300/70 bg-base-100/80 px-3 py-2 text-base-content/70">
                      <Compass className="size-3.5 text-primary" />
                      Pick any friend from the list to open a direct channel.
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-xl border border-base-300/70 bg-base-100/80 px-3 py-2 text-base-content/70">
                      <Sparkles className="size-3.5 text-secondary" />
                      Use search to quickly filter by name, style, or destination.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-base-300/70 bg-base-100/85 px-3 py-2 sm:hidden">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setIsConversationOpenMobile(false)}
                  >
                    Back
                  </button>
                  <p className="truncate text-sm font-semibold">{selectedFriend?.fullName || "Conversation"}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-base-300/70 bg-base-100/85">
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
          </div>
        </section>
      </div>
    </AppShell>
  );
}
