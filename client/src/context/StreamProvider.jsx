import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StreamChat } from "stream-chat";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

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
      } catch (error) {
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
      await call.update({
        settings_override: {
          screensharing: {
            enabled: true,
            access_request_enabled: true,
          },
        },
      });

      // If the room already existed from a previous session, ensure both users are members
      // before attempting to ring. Otherwise Stream can return "no users to ring".
      await call.updateCallMembers({
        update_members: [{ user_id: authUser._id }, { user_id: peerUserId }],
      });

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

      await call.join({ video: true });

      await Promise.allSettled([call.camera.enable(), call.microphone.enable()]);
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

      await call.update({
        settings_override: {
          screensharing: {
            enabled: true,
            access_request_enabled: true,
          },
        },
      });

      await call.updateCallMembers({ update_members: members });

      const others = uniqueMemberIds.filter((userId) => String(userId) !== String(authUser._id));
      if (others.length > 0) {
        try {
          await call.ring({ members_ids: others, video: true });
        } catch {
          await call.notify();
        }
      }

      await call.join({ video: true });
      await Promise.allSettled([call.camera.enable(), call.microphone.enable()]);
      setIncomingVideoCall(null);
      setIncomingCallerName("");
      setActiveVideoCall(call);
      return call;
    } finally {
      setVideoBusy(false);
    }
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

      await incomingVideoCall.join({ video: true });
      await Promise.allSettled([
        incomingVideoCall.camera.enable(),
        incomingVideoCall.microphone.enable(),
      ]);
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
      await call.join({ video: true });
      await Promise.allSettled([call.camera.enable(), call.microphone.enable()]);

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
    </StreamContext.Provider>
  );
}

export function useStreamContext() {
  return useContext(StreamContext);
}
