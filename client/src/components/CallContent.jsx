import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Loader2,
  PhoneIncoming,
  PhoneOff,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
  VideoIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

const EMPTY_FRIENDS = [];

export default function CallContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const {
    streamReady,
    streamConnecting,
    currentUserId,
    videoClient,
    activeVideoCall,
    incomingVideoCall,
    startVideoCallWithUser,
    joinVideoCallByCid,
    acceptIncomingVideoCall,
    endActiveVideoCall,
    videoBusy,
  } = useStreamContext();

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
  });

  const friends = friendsData ?? EMPTY_FRIENDS;

  const { data: activeCallsData = [], isFetching: activeCallsFetching, refetch: refetchActiveCalls } = useQuery({
    queryKey: ["activeVideoCalls", currentUserId],
    enabled: Boolean(videoClient && currentUserId),
    refetchInterval: 5000,
    queryFn: async () => {
      if (!videoClient || !currentUserId) {
        return [];
      }

      const response = await videoClient.queryCalls({
        filter_conditions: {
          members: { $in: [currentUserId] },
        },
        sort: [{ field: "updated_at", direction: -1 }],
        limit: 10,
        watch: false,
      });

      const callsWithState = await Promise.all(
        (response.calls || []).map(async (call) => {
          try {
            const details = await call.get();
            const sessionParticipants = details?.call?.session?.participants || [];
            const liveParticipantsCount = sessionParticipants.length;
            const endedAt = details?.call?.ended_at;

            return {
              cid: call.cid,
              id: call.id,
              endedAt,
              liveParticipantsCount,
              members: (call.state?.members || []).map((member) => ({
                userId: member?.user_id || member?.user?.id,
                name: member?.user?.name || member?.user?.id || member?.user_id || "Unknown",
              })),
            };
          } catch {
            return null;
          }
        })
      );

      return callsWithState.filter((call) => call && !call.endedAt && call.liveParticipantsCount > 0);
    },
  });

  const selectedFriend = friends.find((friend) => friend._id === selectedFriendId);
  const serviceReady = Boolean(streamReady && videoClient && !streamConnecting);
  const scheduledFriendId = searchParams.get("friendId") || "";
  const shouldAutoStart = searchParams.get("start") === "1";

  const callId = useMemo(() => {
    if (!selectedFriend?._id || !currentUserId) {
      return null;
    }
    return [currentUserId, selectedFriend._id].sort().join("-");
  }, [selectedFriend?._id, currentUserId]);

  useEffect(() => {
    if (!scheduledFriendId) {
      return;
    }

    setSelectedFriendId((current) => (current === scheduledFriendId ? current : scheduledFriendId));
  }, [scheduledFriendId]);

  useEffect(() => {
    if (!shouldAutoStart || autoStartAttempted) {
      return;
    }

    if (!scheduledFriendId || !selectedFriend || selectedFriend._id !== scheduledFriendId) {
      return;
    }

    if (!serviceReady || videoBusy || !callId) {
      return;
    }

    setAutoStartAttempted(true);

    const run = async () => {
      try {
        await startVideoCallWithUser(selectedFriend._id);
        toast.success(`Connected with ${selectedFriend.fullName}`);
        navigate("/call/live");
      } catch {
        toast.error("Unable to auto-join scheduled call. Please press Start video call.");
      }
    };

    run();
  }, [
    autoStartAttempted,
    callId,
    navigate,
    scheduledFriendId,
    selectedFriend,
    serviceReady,
    shouldAutoStart,
    startVideoCallWithUser,
    videoBusy,
  ]);

  const startCall = async () => {
    if (!selectedFriend) {
      toast.error("Select a friend to start a call");
      return;
    }

    if (!streamReady || streamConnecting || !videoClient || !callId) {
      toast.error("Call service is not ready yet. Please wait a moment.");
      return;
    }

    try {
      await startVideoCallWithUser(selectedFriend._id);
      toast.success(`Connected with ${selectedFriend.fullName}`);
      navigate("/call/live");
    } catch {
      toast.error("Unable to start call right now");
    }
  };

  const joinIncoming = async () => {
    try {
      await acceptIncomingVideoCall();
      toast.success("Joined incoming call");
      navigate("/call/live");
    } catch {
      toast.error("Unable to join incoming call");
    }
  };

  const endCall = async () => {
    if (!activeVideoCall) {
      return;
    }

    try {
      await endActiveVideoCall();
      toast.success("Call ended");
    } catch {
      toast.error("Failed to end call");
    }
  };

  const joinFromList = async (callCid) => {
    try {
      await joinVideoCallByCid(callCid);
      toast.success("Joined call");
      navigate("/call/live");
    } catch {
      toast.error("Unable to join this call");
    }
  };

  return (
    <div className="xl:h-full xl:min-h-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Calls</h2>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            onClick={startCall}
            disabled={videoBusy}
            title={videoBusy ? "Joining call..." : "Start video call"}
          >
            {videoBusy ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
            <span className="hidden sm:inline">New call</span>
          </button>

          {incomingVideoCall ? (
            <button className="btn btn-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-500" onClick={joinIncoming} disabled={videoBusy}>
              <PhoneIncoming className="size-4" />
              Join incoming
            </button>
          ) : null}

          <button
            className="btn btn-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-70"
            onClick={endCall}
            disabled={!activeVideoCall}
          >
            <PhoneOff className="size-4" />
            End call
          </button>

          {activeVideoCall ? (
            <button type="button" className="btn btn-sm rounded-xl bg-slate-600 text-white hover:bg-slate-500" onClick={() => navigate("/call/live")}>
              <Video className="size-4" />
              Video controls
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:h-full xl:min-h-0">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 p-8 text-white">
            <div className="relative z-10 max-w-lg">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${serviceReady ? "bg-white/20" : "bg-white/10"}`}>
                <Radio className="size-3.5" />
                {serviceReady ? "Video service ready" : "Connecting video service"}
              </span>
              <h2 className="mt-3 text-2xl font-bold">{activeVideoCall ? "Your call is live" : "Ready when you are."}</h2>
              <p className="mt-2 text-sm text-white/90">
                {activeVideoCall
                  ? "Your private room is open. Jump in to manage your camera, microphone, and screen share."
                  : selectedFriend
                    ? `Start a private video call with ${selectedFriend.fullName}.`
                    : "Choose someone from your friends to begin a private video call."}
              </p>
            </div>
            <div className="absolute bottom-0 right-0 size-32 opacity-20" aria-hidden="true"><VideoIcon className="size-full" /></div>
          </div>

          <div className="flex flex-1 flex-col">
            {incomingVideoCall ? (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><PhoneIncoming className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">Incoming call</p><p className="text-xs text-slate-500">Someone is waiting for you to join.</p></div>
                <button className="btn btn-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-500" onClick={joinIncoming} disabled={videoBusy}>Join now</button>
              </div>
            ) : null}

            {!videoClient ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>
            ) : activeVideoCall ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                <div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><Check className="size-7" /></div><h3 className="mt-4 text-lg font-bold text-slate-800">Connected and ready</h3><p className="mt-1 text-sm text-slate-500">Open the call room for a full-screen experience.</p><button type="button" className="btn btn-sm mt-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => navigate("/call/live")}>Open live room <ChevronRight className="size-4" /></button></div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-10">
                {selectedFriend ? (
                  <div className="mx-auto w-full max-w-sm text-center"><UserAvatar src={selectedFriend.profilePic} name={selectedFriend.fullName} sizeClass="size-20" className="mx-auto ring-4 ring-indigo-100" /><p className="mt-4 text-lg font-bold text-slate-800">Call {selectedFriend.fullName}</p><p className="mt-1 text-sm text-slate-500">{selectedFriend.travelStyle || selectedFriend.learningLanguage || "Travel partner"} · {selectedFriend.homeBase || selectedFriend.location || "Planning together"}</p><button type="button" className="btn btn-sm mt-6 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={startCall} disabled={videoBusy || !serviceReady}>{videoBusy ? <Loader2 className="size-5 animate-spin" /> : <Video className="size-5" />} Start video call</button><p className="mt-3 text-xs text-slate-400">A private room will be created for both of you.</p></div>
                ) : (
                  <div className="mx-auto max-w-sm text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-indigo-100 text-indigo-600"><Video className="size-7" /></div><h3 className="mt-5 text-lg font-bold text-slate-800">Pick someone to call</h3><p className="mt-1 text-sm text-slate-500">Your call will open in a private, secure room.</p></div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:min-h-0 xl:overflow-y-auto">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600"><Users className="size-4" /></div>
            <div><h3 className="font-semibold text-slate-800">Start a call</h3><p className="text-xs text-slate-500">Choose a travel partner</p></div>
          </div>
          {isLoading ? (
            <div className="mt-4 h-28 animate-pulse rounded-2xl bg-slate-100" />
          ) : friends.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No friends available yet. Build your network from Requests.</div>
          ) : (
            <div className="space-y-1">
              {friends.map((friend) => {
                const isSelected = selectedFriendId === friend._id;
                return (
                  <button key={friend._id} type="button" className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all ${isSelected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50 border border-transparent"}`} onClick={() => setSelectedFriendId(friend._id)}>
                    <UserAvatar src={friend.profilePic} name={friend.fullName} sizeClass="size-10" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-slate-800">{friend.fullName}</span>
                      <span className="block truncate text-xs text-slate-500">{friend.travelStyle || friend.learningLanguage || "Travel partner"}</span>
                    </span>
                    {isSelected ? <Check className="size-4 text-indigo-600" /> : <ChevronRight className="size-4 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="size-4 flex-shrink-0" />
            <span>Private rooms are only visible to invited members.</span>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Active rooms</h3>
              <p className="text-xs text-slate-500">Join a conversation in progress</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => refetchActiveCalls()} disabled={activeCallsFetching} aria-label="Refresh active calls">
              <RefreshCw className={`size-4 ${activeCallsFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
          {activeCallsData.length === 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">No live rooms right now.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {activeCallsData.map((call) => (
                <div key={call.cid} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><span className="size-1.5 rounded-full bg-emerald-600" /> Live now</span>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{call.liveParticipantsCount} participant{call.liveParticipantsCount === 1 ? "" : "s"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{call.members.map((member) => member.name).join(", ") || "Private room"}</p>
                  </div>
                  <button type="button" className="btn btn-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => joinFromList(call.cid)} disabled={videoBusy}>Join</button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
