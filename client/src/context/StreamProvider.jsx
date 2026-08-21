import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StreamChat } from "stream-chat";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import PersistentCallOverlay from "../components/PersistentCallOverlay";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const StreamContext = createContext({
  streamClient: null,
  streamReady: false,
  streamConnecting: false,
  unreadCount: 0,
  streamToken: null,
  currentUser: null,
  videoClient: null,
  activeVideoCall: null,
  incomingVideoCall: null,
  startVideoCallWithUser: async () => null,
  startGroupVideoCall: async () => null,
  inviteToActiveCall: async () => [],
  joinVideoCallByCid: async () => null,
  acceptIncomingVideoCall: async () => null,
  rejectIncomingVideoCall: async () => null,
  endActiveVideoCall: async () => null,
});

function notifyBrowser(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

const MEDIA_ACCESS_ERROR_NAMES = new Set([
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
  "SecurityError",
]);

// Camera access on mobile browsers is a common failure point (permission
// denied, camera already in use by another app/tab, no camera present).
// Previously call.join({ video: true }) would reject outright in that case
// and the whole call-start attempt failed with a generic "Unable to start
// call" toast — even though the mic usually still works fine. This retries
// audio-only so the call still connects, and surfaces a specific reason
// instead of swallowing the real error.
async function joinCallWithMediaFallback(call) {
  try {
    await call.join({ video: true });
    await Promise.allSettled([call.camera.enable(), call.microphone.enable()]);
    return { videoOnly: false };
  } catch (error) {
    if (!MEDIA_ACCESS_ERROR_NAMES.has(error?.name)) {
      throw error;
    }

    await call.join({ video: false });
    const micResult = await call.microphone.enable().catch((micError) => micError);
    if (micResult instanceof Error) {
      throw micResult;
    }

    toast.error("Camera unavailable — joined with audio only. Check your browser's camera permission to enable video.");
    return { videoOnly: true };
  }
}

export function StreamProvider({ children }) {
  const [streamClient, setStreamClient] = useState(null);
  const [streamReady, setStreamReady] = useState(false);
  const [streamConnecting, setStreamConnecting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [videoClient, setVideoClient] = useState(null);
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [incomingVideoCall, setIncomingVideoCall] = useState(null);
  const [incomingCallerName, setIncomingCallerName] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const connectedUserIdRef = useRef(null);
  const activeVideoCallRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    activeVideoCallRef.current = activeVideoCall;
  }, [activeVideoCall]);

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify");
      return response.data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const authUser = authData?.data?.user || authData?.data || null;

  const { data: streamToken } = useQuery({
    queryKey: ["streamToken"],
    queryFn: async () => {
      const response = await axiosInstance.get("/chat/token");
      return response.data?.data?.token;
    },
    enabled: Boolean(authUser?._id),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {
          // No-op: browser denied or user ignored permission prompt.
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!STREAM_API_KEY || !authUser?._id || !streamToken) {
      return;
    }

    let isMounted = true;

    const connectStream = async () => {
      try {
        setStreamConnecting(true);
        const client = StreamChat.getInstance(STREAM_API_KEY);

        if (client.userID && client.userID !== authUser._id) {
          await client.disconnectUser();
          connectedUserIdRef.current = null;
        }

        if (!client.userID || connectedUserIdRef.current !== authUser._id) {
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic || undefined,
            },
            streamToken
          );
          connectedUserIdRef.current = authUser._id;
        }

        const handleEvent = (event) => {
          if (typeof event.total_unread_count === "number") {
            setUnreadCount(event.total_unread_count);
          }

          // "message.new" only fires for channels currently being watched
          // (i.e. an open conversation). For every other channel — which is
          // the common case when browsing the rest of the app — Stream sends
          // "notification.message_new" instead, with the sender nested under
          // event.message.user rather than event.user. Handling only the
          // former is why notifications previously worked solely inside the
          // Messages tab.
          const isNewMessageEvent = event.type === "message.new" || event.type === "notification.message_new";
          if (isNewMessageEvent) {
            const sender = event.user || event.message?.user;
            if (sender?.id !== authUser._id && event.message?.custom_type !== "community_destroyed") {
              const senderName = sender?.name || "New message";
              const messageText = event.message?.text || "You received a new message.";
              toast.success(`${senderName}: ${messageText}`);
              notifyBrowser(senderName, messageText);
            }
            queryClient.invalidateQueries({ queryKey: ["streamChannelsLastMessage"] });
          }

          // Pushed via stream.service.js's pushRealtimeNotification (e.g. a post
          // was reported/blocked) — refetch the dismissible notice modal instead
          // of polling for it.
          if (event.type === "post_moderation_notice") {
            queryClient.invalidateQueries({ queryKey: ["notifications", "postModeration", "unread"] });
          }

          // Pushed via admin.controller.js's createAnnouncement — same
          // instant-refetch pattern as the moderation notice above.
          if (event.type === "admin_announcement") {
            queryClient.invalidateQueries({ queryKey: ["notifications", "announcement", "unread"] });
          }
        };

        client.on(handleEvent);

        if (isMounted) {
          setStreamClient(client);
          setStreamReady(true);
          setUnreadCount(client.user?.total_unread_count || 0);
        }

        return () => {
          client.off(handleEvent);
        };
      } catch {
        if (isMounted) {
          setStreamReady(false);
        }
      } finally {
        if (isMounted) {
          setStreamConnecting(false);
        }
      }
    };

    const cleanupPromise = connectStream();

    return () => {
      isMounted = false;
      Promise.resolve(cleanupPromise).then((cleanupFn) => {
        if (typeof cleanupFn === "function") {
          cleanupFn();
        }
      });
    };
  }, [authUser?._id, authUser?.fullName, authUser?.profilePic, streamToken, queryClient]);

  useEffect(() => {
    if (authUser) {
      return;
    }

    if (!STREAM_API_KEY) {
      connectedUserIdRef.current = null;
      setStreamClient(null);
      setStreamReady(false);
      setUnreadCount(0);
      return;
    }

    const client = StreamChat.getInstance(STREAM_API_KEY);
    if (client.userID) {
      client.disconnectUser().catch(() => {
        // ignore disconnect errors on logout
      });
    }
    connectedUserIdRef.current = null;
    setStreamClient(null);
    setStreamReady(false);
    setUnreadCount(0);
  }, [authUser]);

  useEffect(() => {
    if (!STREAM_API_KEY || !authUser?._id || !streamToken) {
      return;
    }

    const client = StreamVideoClient.getOrCreateInstance({
      apiKey: STREAM_API_KEY,
      user: {
        id: authUser._id,
        name: authUser.fullName,
        image: authUser.profilePic || undefined,
      },
      token: streamToken,
    });

    const unsubscribeRing = client.on("call.ring", async (event) => {
      if (!event.call_cid || event.user?.id === authUser._id) {
        return;
      }

      if (activeVideoCallRef.current) {
        return;
      }

      try {
        const ringingCall = await client.onRingingCall(event.call_cid);
        setIncomingVideoCall(ringingCall);

        const callerName = event.user?.name || "Friend";
        setIncomingCallerName(callerName);
        toast.success(`Incoming call from ${callerName}`);
        notifyBrowser("Incoming call", `${callerName} is calling you`);
      } catch {
        toast.error("Failed to load incoming call");
      }
    });

    setVideoClient(client);

    return () => {
      unsubscribeRing?.();
    };
  }, [authUser?._id, authUser?.fullName, authUser?.profilePic, streamToken]);

  useEffect(() => {
    if (authUser) {
      return;
    }

    setIncomingVideoCall(null);
    setIncomingCallerName("");
    setActiveVideoCall(null);

    if (videoClient) {
      videoClient.disconnectUser().catch(() => {
        // ignore disconnect errors on logout
      });
    }

    setVideoClient(null);
  }, [authUser, videoClient]);

  const startVideoCallWithUser = async (peerUserId) => {
    if (!videoClient || !authUser?._id || !peerUserId) {
      throw new Error("Video service is not ready");
    }

    const roomId = [authUser._id, peerUserId].sort().join("-");

    setVideoBusy(true);
    try {
      if (activeVideoCall) {
        await activeVideoCall.leave();
      }

      const call = videoClient.call("default", roomId);
      await call.getOrCreate({
        video: true,
        settings_override: {
          screensharing: {
            enabled: true,
            access_request_enabled: true,
          },
        },
        data: {
          video: true,
          members: [{ user_id: authUser._id }, { user_id: peerUserId }],
        },
      });

      // Room IDs are deterministic, so older rooms can exist with stale settings.
      // Keep screensharing enabled for this call to make the button actionable.
      // Best-effort only: call.update requires the caller to be the call's
      // original creator/host under Stream's default roles — if this room was
      // first created by the other person, a plain "user" doesn't have
      // UpdateCall permission and this throws a 403. That shouldn't block the
      // call from connecting, so failures here are only logged.
      try {
        await call.update({
          settings_override: {
            screensharing: {
              enabled: true,
              access_request_enabled: true,
            },
          },
        });
      } catch (error) {
        console.warn("Could not update call settings (non-fatal):", error);
      }

      // If the room already existed from a previous session, ensure both users are members
      // before attempting to ring. Otherwise Stream can return "no users to ring".
      // Same permission caveat as above — non-fatal if it fails.
      //
      // Room IDs are deterministic per pair, so re-starting a 1:1 call reuses
      // the exact same room a prior "Add people" call may have expanded —
      // membership persists on Stream's backend even after everyone leaves.
      // Without pruning it back down to just the two of us here, anyone
      // added last time (e.g. via Add People) would still show as
      // "Invited"/already a member in AddPeopleModal on this "new" call,
      // even though from the user's perspective this is a fresh 1:1.
      const intendedMemberIds = new Set([String(authUser._id), String(peerUserId)]);
      const staleMemberIds = (call.state.members || [])
        .map((member) => String(member.user_id))
        .filter((id) => !intendedMemberIds.has(id));

      try {
        await call.updateCallMembers({
          update_members: [{ user_id: authUser._id }, { user_id: peerUserId }],
          ...(staleMemberIds.length > 0 ? { remove_members: staleMemberIds } : {}),
        });
      } catch (error) {
        console.warn("Could not update call members (non-fatal):", error);
      }

      try {
        await call.ring({
          members_ids: [peerUserId],
          video: true,
        });
      } catch (error) {
        const message = error?.response?.data?.message || "";
        if (message.toLowerCase().includes("no users to ring")) {
          // Fallback notification path when callee is online state/membership is stale.
          await call.notify();
        } else {
          throw error;
        }
      }

      await joinCallWithMediaFallback(call);
      setIncomingVideoCall(null);
      setIncomingCallerName("");
      setActiveVideoCall(call);
      return call;
    } finally {
      setVideoBusy(false);
    }
  };

  const startGroupVideoCall = async ({ roomId, memberIds = [], label = "Community call" }) => {
    if (!videoClient || !authUser?._id || !roomId) {
      throw new Error("Video service is not ready");
    }

    const uniqueMemberIds = [...new Set([authUser._id, ...memberIds].filter(Boolean))];
    if (uniqueMemberIds.length < 2) {
      throw new Error("At least one more member is required");
    }

    setVideoBusy(true);
    try {
      if (activeVideoCall) {
        await activeVideoCall.leave();
      }

      const call = videoClient.call("default", roomId);
      const members = uniqueMemberIds.map((userId) => ({ user_id: userId }));

      await call.getOrCreate({
        video: true,
        settings_override: {
          screensharing: {
            enabled: true,
            access_request_enabled: true,
          },
        },
        data: {
          video: true,
          custom: { label },
          members,
        },
      });

      // Best-effort only — see the comment in startVideoCallWithUser for why
      // these can 403 for a non-owner on a pre-existing room and must not
      // block the call from connecting.
      try {
        await call.update({
          settings_override: {
            screensharing: {
              enabled: true,
              access_request_enabled: true,
            },
          },
        });
      } catch (error) {
        console.warn("Could not update call settings (non-fatal):", error);
      }

      try {
        await call.updateCallMembers({ update_members: members });
      } catch (error) {
        console.warn("Could not update call members (non-fatal):", error);
      }

      const others = uniqueMemberIds.filter((userId) => String(userId) !== String(authUser._id));
      if (others.length > 0) {
        try {
          await call.ring({ members_ids: others, video: true });
        } catch {
          await call.notify();
        }
      }

      await joinCallWithMediaFallback(call);
      setIncomingVideoCall(null);
      setIncomingCallerName("");
      setActiveVideoCall(call);
      return call;
    } finally {
      setVideoBusy(false);
    }
  };

  // Adds people to the call that's already live, without touching anyone
  // currently joined — updateCallMembers/ring are plain REST calls against
  // the call's member list and don't renegotiate any existing participant's
  // WebRTC session.
  const inviteToActiveCall = async (userIds = []) => {
    if (!activeVideoCall || !authUser?._id) {
      throw new Error("No active call to invite people to");
    }

    const existingMemberIds = new Set(
      (activeVideoCall.state.members || []).map((member) => String(member.user_id ?? member.user?.id))
    );
    const newUserIds = [...new Set(userIds.filter(Boolean).map(String))].filter(
      (userId) => userId !== String(authUser._id) && !existingMemberIds.has(userId)
    );

    if (newUserIds.length === 0) {
      return [];
    }

    await activeVideoCall.updateCallMembers({
      update_members: newUserIds.map((userId) => ({ user_id: userId })),
    });

    try {
      await activeVideoCall.ring({ members_ids: newUserIds, video: true });
    } catch (error) {
      console.warn("Could not ring invited members, falling back to notify (non-fatal):", error);
      await activeVideoCall.notify();
    }

    return newUserIds;
  };

  const acceptIncomingVideoCall = async () => {
    if (!incomingVideoCall) {
      return null;
    }

    setVideoBusy(true);
    try {
      if (activeVideoCall) {
        await activeVideoCall.leave();
      }

      await joinCallWithMediaFallback(incomingVideoCall);
      setActiveVideoCall(incomingVideoCall);
      setIncomingVideoCall(null);
      setIncomingCallerName("");
      return incomingVideoCall;
    } finally {
      setVideoBusy(false);
    }
  };

  const joinVideoCallByCid = async (callCid) => {
    if (!videoClient || !callCid || !callCid.includes(":")) {
      throw new Error("Invalid call id");
    }

    const [callType, ...idParts] = callCid.split(":");
    const callId = idParts.join(":");

    if (!callType || !callId) {
      throw new Error("Invalid call id");
    }

    setVideoBusy(true);
    try {
      if (activeVideoCall) {
        await activeVideoCall.leave();
      }

      const call = videoClient.call(callType, callId);
      await call.get();
      await joinCallWithMediaFallback(call);

      setIncomingVideoCall(null);
      setIncomingCallerName("");
      setActiveVideoCall(call);
      return call;
    } finally {
      setVideoBusy(false);
    }
  };

  const rejectIncomingVideoCall = async () => {
    if (!incomingVideoCall) {
      return;
    }

    setVideoBusy(true);
    try {
      await incomingVideoCall.reject();
      setIncomingVideoCall(null);
      setIncomingCallerName("");
    } finally {
      setVideoBusy(false);
    }
  };

  const endActiveVideoCall = async () => {
    if (!activeVideoCall) {
      return;
    }

    setVideoBusy(true);
    try {
      // Explicitly release the camera/mic before leaving. disable() without
      // forceStop only pauses/mutes the track by default and can leave the
      // underlying MediaStream (and the browser's recording indicator) alive
      // for a fast re-enable — forceStop actually stops the hardware device.
      await Promise.allSettled([
        activeVideoCall.camera.disable(true),
        activeVideoCall.microphone.disable(true),
        activeVideoCall.screenShare.disable(true),
      ]);
      await activeVideoCall.leave();
      setActiveVideoCall(null);
    } finally {
      setVideoBusy(false);
    }
  };

  const value = useMemo(
    () => ({
      streamClient,
      streamReady,
      streamConnecting,
      unreadCount,
      streamToken: streamToken || null,
      currentUser: authUser || null,
      currentUserId: authUser?._id || null,
      videoClient,
      activeVideoCall,
      incomingVideoCall,
      videoBusy,
      startVideoCallWithUser,
      startGroupVideoCall,
      inviteToActiveCall,
      joinVideoCallByCid,
      acceptIncomingVideoCall,
      rejectIncomingVideoCall,
      endActiveVideoCall,
    }),
    [
      streamClient,
      streamReady,
      streamConnecting,
      unreadCount,
      streamToken,
      authUser,
      videoClient,
      activeVideoCall,
      incomingVideoCall,
      videoBusy,
      startGroupVideoCall,
      inviteToActiveCall,
    ]
  );

  return (
    <StreamContext.Provider value={value}>
      {children}

      {videoClient && incomingVideoCall && !activeVideoCall ? (
        <div className="fixed inset-x-0 top-4 z-[1000] flex justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-base-300 bg-base-100/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-primary">Incoming call</p>
                <p className="text-sm text-base-content/80">
                  {incomingCallerName || "A friend"} is inviting you to join a call.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn btn-outline btn-sm" onClick={rejectIncomingVideoCall} disabled={videoBusy}>
                  Decline
                </button>
                <button className="btn btn-success btn-sm" onClick={acceptIncomingVideoCall} disabled={videoBusy}>
                  {videoBusy ? "Joining..." : "Join call"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <PersistentCallOverlay
        videoClient={videoClient}
        activeVideoCall={activeVideoCall}
        onEndCall={endActiveVideoCall}
        videoBusy={videoBusy}
      />
    </StreamContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located with StreamProvider by design
export function useStreamContext() {
  return useContext(StreamContext);
}
