import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Attachment,
  Channel,
  Chat,
  ComponentProvider,
  MessageComposer,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import {
  ArrowLeft,
  Building2,
  Loader2,
  MessageCircleHeart,
  PhoneCall,
  Radio,
  Search,
  Users,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

const EMPTY_FRIENDS = [];

// Renders a shared property (see ShareModal.jsx) as a proper card — image,
// title, and a click that navigates inside the app — instead of Stream's
// default generic link-preview card or an external <a> that opens a new tab.
// Falls back to Stream's own Attachment component for every other kind of
// attachment (images someone actually uploads, etc).
//
// The override component receives `attachments` (plural, an array) — NOT a
// singular `attachment` — that's the actual prop stream-chat-react passes.
function CustomAttachment(props) {
  const navigate = useNavigate();
  const propertyAttachment = props.attachments?.find((attachment) => attachment.type === "property") || null;

  if (!propertyAttachment) {
    return <Attachment {...props} />;
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/property/${propertyAttachment.property_id}`)}
      className="block w-full max-w-xs overflow-hidden rounded-xl border border-base-300 bg-base-100 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-video w-full overflow-hidden bg-base-200">
        {propertyAttachment.image_url ? (
          <img
            src={propertyAttachment.image_url}
            alt={propertyAttachment.title || "Property"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-base-content/40">
            <Building2 className="size-8" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-semibold tracking-wide text-primary">NearMySpace PROPERTY</p>
        <p className="mt-0.5 line-clamp-2 text-sm font-medium text-base-content">{propertyAttachment.title}</p>
      </div>
    </button>
  );
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}

export default function ChatContent({ deepLinkUserId } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [isConversationOpenMobile, setIsConversationOpenMobile] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [directChatUser, setDirectChatUser] = useState(null);
  const processedDirectChatIds = useRef(new Set());
  const { streamClient: chatClient, streamReady, streamConnecting, currentUserId, videoClient, startVideoCallWithUser, videoBusy } = useStreamContext();
  const navigateToCall = useNavigate();

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
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
  const friendIds = useMemo(() => friends.map((friend) => friend._id), [friends]);

  // "In a call" red dot — same Presence-based approximation used on the
  // Calls page (see StreamProvider.jsx's busy/ready auto-update on call
  // start/end). Distinct from the green online dot below, which is Stream's
  // own chat presence, not this.
  const { data: callPresenceData } = useQuery({
    queryKey: ["friendsPresence", friendIds],
    queryFn: async () => {
      const response = await axiosInstance.get("/community/presence", { params: { userIds: friendIds.join(",") } });
      return response.data?.data?.presence || {};
    },
    enabled: friendIds.length > 0,
    refetchInterval: 10000,
  });
  const presenceByFriendId = callPresenceData || {};

  const [onlineFriendIds, setOnlineFriendIds] = useState(() => new Set());

  // Forces the relative "2m/8h/3d" labels below to advance even when
  // nothing else re-renders the list.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Stream only reports presence for users it's actively watching, so we
  // opt in via queryUsers({ presence: true }) for the friend list, then keep
  // it live with user.presence.changed events (fired on connect/disconnect).
  useEffect(() => {
    if (!chatClient || !currentUserId || friends.length === 0) {
      setOnlineFriendIds(new Set());
      return;
    }

    let cancelled = false;
    const friendIds = friends.map((friend) => friend._id);

    chatClient
      .queryUsers({ id: { $in: friendIds } }, {}, { presence: true })
      .then((response) => {
        if (cancelled) return;
        const online = new Set((response.users || []).filter((u) => u.online).map((u) => u.id));
        setOnlineFriendIds(online);
      })
      .catch(() => {});

    const handlePresenceChanged = (event) => {
      const userId = event.user?.id;
      if (!userId || !friendIds.includes(userId)) return;
      setOnlineFriendIds((prev) => {
        const next = new Set(prev);
        if (event.user.online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    chatClient.on("user.presence.changed", handlePresenceChanged);

    return () => {
      cancelled = true;
      chatClient.off("user.presence.changed", handlePresenceChanged);
    };
  }, [chatClient, currentUserId, friends]);

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

  // Deep link support: opening this section with a userId (e.g. from the
  // "Chat" button on a property page) starts a direct conversation with that
  // user immediately, even if they aren't in the friends list yet.
  useEffect(() => {
    if (!deepLinkUserId || !chatClient || !currentUserId) return;
    if (processedDirectChatIds.current.has(deepLinkUserId)) return;
    processedDirectChatIds.current.add(deepLinkUserId);

    const existingFriend = friends.find((friend) => friend._id === deepLinkUserId);
    if (existingFriend) {
      openFriendChat(existingFriend);
      return;
    }

    axiosInstance
      .get(`/users/${deepLinkUserId}/profile`)
      .then((response) => {
        const user = response.data?.data?.user;
        if (!user) {
          toast.error("User not found");
          return;
        }
        const profile = { ...user, _id: deepLinkUserId };
        setDirectChatUser(profile);
        openFriendChat(profile);
      })
      .catch(() => toast.error("Could not start chat with this user"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkUserId, chatClient, currentUserId, friends]);

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

  const oneToOneCallRoomId =
    currentUserId && selectedFriend?._id ? [currentUserId, selectedFriend._id].sort().join("-") : null;

  // Same predictable-id "is there already a live call here" check used for
  // community calls — lets the header button show "Join call" instead of
  // "Call" when the other person already started one.
  const { data: isOneToOneCallActive = false } = useQuery({
    queryKey: ["oneToOneCallActive", oneToOneCallRoomId],
    queryFn: async () => {
      const call = videoClient.call("default", oneToOneCallRoomId);
      const details = await call.get();
      const liveParticipants = details?.call?.session?.participants?.length || 0;
      return liveParticipants > 0 && !details?.call?.ended_at;
    },
    enabled: Boolean(videoClient && oneToOneCallRoomId),
    refetchInterval: 5000,
    retry: false,
  });

  const startCallWithSelectedFriend = async () => {
    if (!selectedFriend?._id) return;
    try {
      await startVideoCallWithUser(selectedFriend._id);
      toast.success(isOneToOneCallActive ? `Joined call with ${selectedFriend.fullName}` : `Connected with ${selectedFriend.fullName}`);
      navigateToCall("/call/live");
    } catch (error) {
      toast.error(error?.message || "Unable to start call right now");
    }
  };

  return (
    <div className="telegram-chat-layout h-full xl:h-[calc(100dvh-7.1rem)] xl:min-h-0 overflow-hidden">
      <section className={`telegram-sidebar min-h-0 overflow-hidden ${showSidebar ? "" : "hidden sm:block"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-base-300 px-4 pb-4 pt-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Users className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-base-content">Your inbox</h2>
                  <p className="text-[11px] text-base-content/60">{friendCountLabel}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${serviceReady ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                <Radio className="size-3" />
                {serviceReady ? "Ready" : "Syncing"}
              </span>
            </div>

            <label className="input input-bordered mt-4 flex h-11 items-center gap-2 rounded-xl border-base-300 bg-base-200 transition focus-within:border-primary/30 focus-within:bg-base-100 focus-within:outline-none">
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
            <div className="m-4 rounded-xl border border-base-300 bg-base-100 p-8 text-center text-sm text-base-content/60">
              {friends.length === 0
                ? "You have no connected users yet. Accept requests first."
                : "No users matched your search."}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 pb-6">
              {filteredFriends.map((friend) => {
                const isActive = selectedFriendId === friend._id;
                const isOnline = onlineFriendIds.has(friend._id);
                const lastMessageAt = lastMessageByFriendId?.[friend._id];
                const lastMessageLabel = formatRelativeTime(lastMessageAt);

                return (
                  <button
                    key={friend._id}
                    type="button"
                    className={`mb-1.5 w-full rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isActive
                        ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/20"
                        : "border-transparent bg-base-100 hover:border-base-300 hover:bg-base-200 hover:shadow-sm"
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
                        {presenceByFriendId[friend._id]?.status === "busy" ? (
                          <span
                            className="absolute bottom-0 right-0 grid size-3.5 place-items-center rounded-full border-2 border-white bg-error"
                            title="In a call"
                          ></span>
                        ) : isOnline ? (
                          <span className="absolute bottom-0 right-0 grid size-3.5 place-items-center rounded-full border-2 border-white bg-success"></span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-base-content">{friend.fullName || "User"}</p>
                          {lastMessageLabel && <p className="text-[10px] text-base-content/50">{lastMessageLabel}</p>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-base-content/60">Tap to start conversation</p>
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
            <div className="mb-4 grid size-20 place-items-center rounded-full bg-primary/10">
              <MessageCircleHeart className="size-10 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-base-content">Your messages</h3>
            <p className="text-sm text-base-content/60">Select a conversation to start chatting</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-base-100 xl:rounded-xl xl:border xl:border-base-300">
            <div className="flex items-center gap-2 border-b border-base-200 px-3 py-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 sm:hidden"
                onClick={() => setIsConversationOpenMobile(false)}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              {selectedFriend?._id && (
                <UserAvatar src={selectedFriend.profilePic} name={selectedFriend.fullName} sizeClass="size-7" userId={selectedFriend._id} />
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{selectedFriend?.fullName || "Conversation"}</p>
              {selectedFriend?._id && videoClient && (
                <button
                  type="button"
                  className={`btn btn-ghost btn-xs gap-1 ${
                    isOneToOneCallActive ? "text-success hover:bg-success/10" : "text-primary hover:bg-primary/10"
                  }`}
                  onClick={startCallWithSelectedFriend}
                  disabled={videoBusy || !serviceReady}
                  title={isOneToOneCallActive ? "Join the ongoing call" : "Start a video call"}
                >
                  {videoBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isOneToOneCallActive ? (
                    <PhoneCall className="size-4" />
                  ) : (
                    <Video className="size-4" />
                  )}
                  <span className="hidden sm:inline">{isOneToOneCallActive ? "Join call" : "Call"}</span>
                </button>
              )}
            </div>
            <div className="telegram-chat-shell flex-1 min-h-0 overflow-hidden">
              <Chat client={chatClient}>
                <Channel channel={activeChannel}>
                  <ComponentProvider value={{ Attachment: CustomAttachment }}>
                    <Window>
                      <MessageList />
                      <MessageComposer />
                    </Window>
                    <Thread />
                  </ComponentProvider>
                </Channel>
              </Chat>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
