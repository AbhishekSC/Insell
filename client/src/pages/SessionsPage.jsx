import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  CalendarCheck2,
  Clock3,
  Compass,
  Copy,
  PhoneCall,
  Sparkles,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { guidedCallModes, normalizeText, useLocalStorageState } from "../lib/dashboardMvp";

export default function SessionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const previousInviteCountRef = useRef(0);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users");
      return response.data?.data?.users || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["mySessions"],
    queryFn: async () => {
      const response = await axiosInstance.get("/sessions/my");
      return response.data?.data || {};
    },
    enabled: Boolean(authUser?._id),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const [blockedUserIds] = useLocalStorageState("syncspace_blocked", []);
  const [reminderSentIds, setReminderSentIds] = useLocalStorageState("syncspace_scheduler_reminders", []);
  const [nowMs, setNowMs] = useState(Date.now());

  const [sessionForm, setSessionForm] = useState({
    title: "Trip planning call",
    partnerId: "",
    when: "",
    mode: guidedCallModes[0].id,
  });

  const minDateTimeValue = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const outgoingSessions = sessionsData?.outgoingSessions || [];
  const incomingSessions = sessionsData?.incomingSessions || [];
  const unreadInviteNotifications = sessionsData?.unreadInviteNotifications || [];

  const knownFriendIds = useMemo(() => new Set(friends.map((friend) => String(friend?._id))), [friends]);

  const matchSuggestions = useMemo(() => {
    const meStyle = normalizeText(authUser?.travelStyle || authUser?.learningLanguage);
    const meHomeBase = normalizeText(authUser?.homeBase || authUser?.location);
    const meInterest = normalizeText(authUser?.travelInterests?.[0] || authUser?.nativeLanguage);

    return users
      .filter((user) => user?._id && String(user._id) !== String(authUser?._id))
      .filter((user) => !blockedUserIds.includes(String(user._id)))
      .map((user) => {
        const style = normalizeText(user.travelStyle || user.learningLanguage);
        const homeBase = normalizeText(user.homeBase || user.location);
        const interest = normalizeText(user.travelInterests?.[0] || user.nativeLanguage);

        let score = 0;
        if (meStyle && style && meStyle === style) {
          score += 45;
        }
        if (meInterest && interest && meInterest === interest) {
          score += 45;
        }
        if (meHomeBase && homeBase && meHomeBase === homeBase) {
          score += 15;
        }
        if (knownFriendIds.has(String(user._id))) {
          score -= 35;
        }

        return { user, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [
    authUser?._id,
    authUser?.travelStyle,
    authUser?.homeBase,
    authUser?.travelInterests,
    authUser?.learningLanguage,
    authUser?.location,
    authUser?.nativeLanguage,
    blockedUserIds,
    knownFriendIds,
    users,
  ]);

  const schedulePartnerOptions = friends.length > 0 ? friends : users;

  const createSessionMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post("/sessions", payload);
      return response.data?.data?.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySessions"] });
      toast.success("Trip session scheduled. Invitee can see this in their Sessions page.");
      setSessionForm((prev) => ({ ...prev, when: "" }));
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to schedule session");
    },
  });

  const rescheduleSessionMutation = useMutation({
    mutationFn: async ({ sessionId, scheduledFor }) => {
      await axiosInstance.patch(`/sessions/${sessionId}/reschedule`, { scheduledFor });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySessions"] });
      toast.success("Session rescheduled.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to reschedule session");
    },
  });

  function getSessionTiming(scheduledFor) {
    const whenMs = new Date(scheduledFor).getTime();
    if (Number.isNaN(whenMs)) {
      return { label: "Invalid time", isNear: false, isPast: false, canJoin: false };
    }

    const diffMs = whenMs - nowMs;
    const minutes = Math.round(diffMs / 60000);
    const isPast = minutes < -5;
    const isNear = minutes >= 0 && minutes <= 15;
    const canJoin = minutes <= 15 && minutes >= -30;

    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return { label: `Starts in ${hours}h ${mins}m`, isNear, isPast, canJoin };
    }

    if (minutes > 0) {
      return { label: `Starts in ${minutes} min`, isNear, isPast, canJoin };
    }

    if (minutes >= -5) {
      return { label: "Starting now", isNear: true, isPast, canJoin: true };
    }

    return { label: "Session time passed", isNear, isPast, canJoin };
  }

  function getLocalDateTimeAfter(hours) {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function pickDateAfter(hours) {
    setSessionForm((prev) => ({ ...prev, when: getLocalDateTimeAfter(hours) }));
  }

  function addSession(event) {
    event.preventDefault();
    if (!sessionForm.partnerId) {
      toast.error("Please pick a partner for this session.");
      return;
    }

    if (!sessionForm.when) {
      toast.error("Please choose a schedule time.");
      return;
    }

    createSessionMutation.mutate({
      title: sessionForm.title || "Trip planning call",
      mode: sessionForm.mode,
      scheduledFor: new Date(sessionForm.when).toISOString(),
      inviteeIds: [sessionForm.partnerId],
    });
  }

  function partnerName(session) {
    const me = String(authUser?._id || "");
    if (String(session?.createdBy?._id || session?.createdBy) === me) {
      const firstInvitee = session?.invitees?.[0];
      return firstInvitee?.fullName || "Partner";
    }

    return session?.createdBy?.fullName || "Partner";
  }

  function partnerId(session) {
    const me = String(authUser?._id || "");
    if (String(session?.createdBy?._id || session?.createdBy) === me) {
      const firstInvitee = session?.invitees?.[0];
      return firstInvitee?._id ? String(firstInvitee._id) : "";
    }

    return session?.createdBy?._id ? String(session.createdBy._id) : "";
  }

  function modeTitleFromId(modeId) {
    return guidedCallModes.find((mode) => mode.id === modeId)?.title || "Trip planning call";
  }

  function joinScheduledCall(session) {
    const friendId = partnerId(session);
    if (!friendId) {
      toast.error("Could not find partner for this session.");
      return;
    }

    navigate(`/call?friendId=${friendId}&start=1`);
  }

  function rescheduleSession(session) {
    const newDateIso = getLocalDateTimeAfter(24);
    rescheduleSessionMutation.mutate({
      sessionId: session._id,
      scheduledFor: new Date(newDateIso).toISOString(),
    });
  }

  async function copyInvite(session) {
    const inviteText = [
      `Hey! Let us do a ${session.title}.`,
      `Time: ${new Date(session.scheduledFor).toLocaleString()}`,
      `Mode: ${modeTitleFromId(session.mode)}`,
      "Open SyncSpace and tap Join now from your trip session card.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(inviteText);
      toast.success("Invite copied. Paste it in chat.");
    } catch {
      toast.error("Could not copy invite.");
    }
  }

  useEffect(() => {
    const currentCount = unreadInviteNotifications.length;
    if (previousInviteCountRef.current > 0 && currentCount > previousInviteCountRef.current) {
      const newCount = currentCount - previousInviteCountRef.current;
      toast.success(newCount === 1 ? "You have 1 new trip session invite" : `You have ${newCount} new trip session invites`);
    }
    previousInviteCountRef.current = currentCount;
  }, [unreadInviteNotifications.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      [...outgoingSessions, ...incomingSessions].forEach((session) => {
        if (reminderSentIds.includes(session._id)) {
          return;
        }

        const whenMs = new Date(session.scheduledFor).getTime();
        if (Number.isNaN(whenMs)) {
          return;
        }

        if (whenMs > now && whenMs - now <= tenMinutes) {
          const message = `${session.title} starts at ${new Date(session.scheduledFor).toLocaleTimeString()}`;
          toast(message, { icon: "\u23f0" });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("SyncSpace session reminder", { body: message });
          }

          setReminderSentIds((prev) => [...prev, session._id]);
        }
      });
    }, 30000);

    return () => window.clearInterval(timer);
  }, [incomingSessions, outgoingSessions, reminderSentIds, setReminderSentIds]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(ticker);
  }, []);

  const sortedOutgoingSessions = useMemo(
    () => [...outgoingSessions].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    [outgoingSessions]
  );

  const sortedIncomingSessions = useMemo(
    () => [...incomingSessions].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    [incomingSessions]
  );

  const totalSessions = sortedOutgoingSessions.length + sortedIncomingSessions.length;
  const nearSessions = [...sortedOutgoingSessions, ...sortedIncomingSessions].filter((session) =>
    getSessionTiming(session.scheduledFor).isNear
  ).length;
  const expiredSessions = sortedOutgoingSessions.filter((session) => getSessionTiming(session.scheduledFor).isPast).length;

  function timingBadgeClass(timing) {
    if (timing.isNear) {
      return "border-success/40 bg-success/10 text-success";
    }

    if (timing.isPast) {
      return "border-warning/40 bg-warning/10 text-warning";
    }

    return "border-base-300 text-base-content/65";
  }

  return (
    <AppShell title="Matching and Trip Sessions" subtitle="Find the best travel partners and schedule focused planning blocks.">
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="shell-panel xl:col-span-7">
          <div className="p-6">
            <div className="rounded-2xl border border-base-300/70 bg-gradient-to-br from-primary/12 via-secondary/8 to-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/65">Session dashboard</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Total sessions</p>
                  <p className="mt-1 text-2xl font-black leading-none">{totalSessions}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Starting soon</p>
                  <p className="mt-1 text-2xl font-black leading-none">{nearSessions}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Need reschedule</p>
                  <p className="mt-1 text-2xl font-black leading-none">{expiredSessions}</p>
                </div>
              </div>
            </div>

            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" /> Smart partner matching
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Best people to plan with now</h2>
            <p className="mt-1 text-sm text-base-content/70">Sorted by travel style, interests, and location overlap.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {matchSuggestions.slice(0, 4).map(({ user, score }) => (
                <article key={user._id} className="rounded-2xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="truncate text-sm font-bold">{user.fullName}</p>
                  <p className="mt-1 text-xs text-base-content/65">
                    {user.travelStyle || user.learningLanguage || "Any style"} - {user.travelInterests?.[0] || user.nativeLanguage || "Any interest"}
                  </p>
                  <p className="text-xs text-base-content/65">{user.homeBase || user.location || "Unknown home base"}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="badge badge-outline">Match {Math.max(0, score)}%</span>
                    <Link to="/notification" className="btn btn-xs btn-ghost">
                      Connect
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-base-300/70 bg-base-100/85 p-4">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Bell className="size-3.5 text-primary" /> Session notifications
              </p>
              {unreadInviteNotifications.length === 0 ? (
                <p className="mt-2 text-sm text-base-content/70">No new session invites right now.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {unreadInviteNotifications.slice(0, 4).map((notification) => (
                    <div key={notification._id} className="rounded-lg border border-base-300/70 bg-base-100 p-2.5">
                      <p className="text-sm font-semibold">{notification.actor?.fullName || "A friend"} invited you</p>
                      <p className="text-xs text-base-content/65">{notification.session?.title || "Trip planning call"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5 xl:col-span-5">
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <CalendarCheck2 className="size-3.5 text-primary" /> Session scheduler
              </p>

              <div className="mt-2 rounded-xl border border-base-300/70 bg-gradient-to-br from-primary/12 via-secondary/8 to-accent/10 p-3">
                <p className="text-xs font-semibold text-base-content/80">Pick a slot quickly</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-xs btn-outline" onClick={() => pickDateAfter(2)}>
                    In 2 hours
                  </button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={() => pickDateAfter(24)}>
                    Tomorrow
                  </button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={() => pickDateAfter(48)}>
                    In 2 days
                  </button>
                </div>
              </div>

              <form className="mt-2 grid gap-2 rounded-xl border border-base-300/70 bg-base-100/80 p-3" onSubmit={addSession}>
                <input
                  className="input input-bordered input-sm"
                  value={sessionForm.title}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Trip session title"
                />
                <select
                  className="select select-bordered select-sm"
                  value={sessionForm.partnerId}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, partnerId: event.target.value }))}
                >
                  <option value="">Pick partner</option>
                  {schedulePartnerOptions.slice(0, 15).map((partner) => (
                    <option key={partner._id} value={partner._id}>
                      {partner.fullName}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={sessionForm.mode}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, mode: event.target.value }))}
                >
                  {guidedCallModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.title}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  className="input input-bordered input-sm"
                  min={minDateTimeValue}
                  value={sessionForm.when}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, when: event.target.value }))}
                />
                <button type="submit" className="btn btn-sm btn-primary" disabled={createSessionMutation.isPending}>
                  {createSessionMutation.isPending ? "Scheduling..." : "Schedule trip session"}
                </button>
              </form>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">My scheduled trip sessions</p>
              <div className="mt-3 space-y-2">
                {sortedOutgoingSessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300/70 bg-base-100/70 p-3 text-xs text-base-content/65">
                    No outgoing trip sessions yet.
                  </div>
                ) : null}

                {sortedOutgoingSessions.slice(0, 4).map((session) => {
                  const timing = getSessionTiming(session.scheduledFor);
                  const canJoin = timing.canJoin;
                  return (
                    <div key={session._id} className="rounded-xl border border-base-300/70 bg-base-100 p-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold">{session.title}</p>
                        <p className="inline-flex items-center gap-1 text-xs leading-relaxed text-base-content/65">
                          <Clock3 className="size-3.5" />
                          {new Date(session.scheduledFor).toLocaleString()} | {partnerName(session)}
                        </p>
                        <p
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${timingBadgeClass(
                            timing
                          )}`}
                        >
                          {timing.label}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-base-300/60 pt-2.5">
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => copyInvite(session)}>
                          <Copy className="size-3" /> Invite
                        </button>

                        {timing.isPast ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => rescheduleSession(session)}
                            disabled={rescheduleSessionMutation.isPending}
                          >
                            Reschedule
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="btn btn-xs btn-primary min-w-24"
                          onClick={() => joinScheduledCall(session)}
                          disabled={!canJoin}
                          title={canJoin ? "Join now" : "Join now is available when trip session time is near"}
                        >
                          <Video className="size-3" /> {canJoin ? "Join now" : "Waiting"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={async () => {
                    if (typeof window === "undefined" || !("Notification" in window)) {
                      toast.error("Browser notifications are not supported on this device.");
                      return;
                    }

                    const permission = await Notification.requestPermission();
                    if (permission === "granted") {
                      toast.success("Reminder notifications enabled.");
                    } else {
                      toast("Notifications not enabled. You will still see in-app reminders.");
                    }
                  }}
                >
                  Enable reminder notifications
                </button>
              </div>
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Compass className="size-3.5 text-secondary" /> Incoming trip session invites
              </p>
              <div className="mt-2 space-y-2">
                {sortedIncomingSessions.length === 0 ? (
                  <p className="text-sm text-base-content/70">No incoming trip sessions yet.</p>
                ) : null}
                {sortedIncomingSessions.slice(0, 4).map((session) => {
                  const timing = getSessionTiming(session.scheduledFor);
                  const canJoin = timing.canJoin;
                  return (
                    <div key={session._id} className="rounded-xl border border-base-300/70 bg-base-100 p-3">
                      <div className="space-y-1">
                      <p className="text-sm font-semibold leading-tight">{session.title}</p>
                      <p className="text-xs leading-relaxed text-base-content/65">
                        From {session.createdBy?.fullName || "Friend"} · {new Date(session.scheduledFor).toLocaleString()}
                      </p>
                      <p
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${timingBadgeClass(
                          timing
                        )}`}
                      >
                        {timing.label}
                      </p>
                      </div>
                      <div className="mt-3 border-t border-base-300/60 pt-2.5">
                      <button
                        type="button"
                        className="btn btn-primary btn-xs w-full sm:w-auto"
                        onClick={() => joinScheduledCall(session)}
                        disabled={!canJoin}
                      >
                        <PhoneCall className="size-3.5" /> {canJoin ? "Join now" : "Waiting"}
                      </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link to="/call" className="btn btn-outline btn-sm mt-3">
                Open calls page
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
