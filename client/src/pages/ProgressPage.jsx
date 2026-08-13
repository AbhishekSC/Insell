import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flame, Star, Target, TrendingUp } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";
import {
  defaultChallenges,
  defaultGoals,
  defaultStreak,
  getChallengeCards,
  todayKey,
  useLocalStorageState,
  yesterdayKey,
} from "../lib/dashboardMvp";

export default function ProgressPage() {
  const queryClient = useQueryClient();
  const { unreadCount } = useStreamContext();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: incomingRequests = [] } = useQuery({
    queryKey: ["incomingRequests"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friend-requests");
      return response.data?.data?.incomingRequests || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: outgoingRequests = [] } = useQuery({
    queryKey: ["outgoingRequests"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/outgoing-friend-requests");
      return response.data?.data?.outgoingRequests || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const [goals, setGoals] = useLocalStorageState("syncspace_goals", defaultGoals());
  const [streak, setStreak] = useLocalStorageState("syncspace_streak", defaultStreak());
  const [feedbackLog, setFeedbackLog] = useLocalStorageState("syncspace_feedback", []);
  const [challengeProgress, setChallengeProgress] = useLocalStorageState("syncspace_challenges", defaultChallenges());

  const [feedbackForm, setFeedbackForm] = useState({
    fluency: 3,
    confidence: 3,
    minutes: 15,
    note: "",
  });

  const completionScore = Math.min(
    100,
    friends.length * 8 + unreadCount * 3 + incomingRequests.length * 10 + outgoingRequests.length * 4
  );

  const totalFeedbackMinutes = feedbackLog.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const weeklyMinutesCompleted = Math.min(999, streak.totalPracticeMinutes + totalFeedbackMinutes);
  const weeklyGoalProgress = goals.weeklyMinutes
    ? Math.min(100, Math.round((weeklyMinutesCompleted / goals.weeklyMinutes) * 100))
    : 0;

  const challengeCards = getChallengeCards(challengeProgress);

  function markPlanningDay(minutes) {
    const today = todayKey();
    const yesterday = yesterdayKey();

    setStreak((prev) => {
      const current =
        prev.lastCompleted === today ? prev.current : prev.lastCompleted === yesterday ? prev.current + 1 : 1;

      return {
        ...prev,
        current,
        lastCompleted: today,
        totalPracticeMinutes: Number(prev.totalPracticeMinutes || 0) + Number(minutes || 0),
      };
    });
  }

  function addFeedback(event) {
    event.preventDefault();

    setFeedbackLog((prev) => [
      {
        id: crypto.randomUUID(),
        ...feedbackForm,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    markPlanningDay(Number(feedbackForm.minutes));
    setFeedbackForm({ fluency: 3, confidence: 3, minutes: 15, note: "" });
  }

  function updateChallengeProgress(key) {
    setChallengeProgress((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  }

  const latestFeedback = feedbackLog[0];

  return (
    <AppShell
      title="Growth and Progress"
      subtitle="Track trip goals, streaks, and post-call planning improvements in one place."
    >
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="shell-panel xl:col-span-8">
          <div className="p-6">
            <div className="rounded-2xl border border-base-300/70 bg-gradient-to-br from-primary/12 via-secondary/8 to-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/65">This week at a glance</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Minutes planned</p>
                  <p className="mt-1 text-2xl font-black">{weeklyMinutesCompleted}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Current streak</p>
                  <p className="mt-1 text-2xl font-black">{streak.current} days</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Feedback entries</p>
                  <p className="mt-1 text-2xl font-black">{feedbackLog.length}</p>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-black tracking-tight">Travel goals and streaks</h2>
            <p className="mt-1 text-sm text-base-content/70">Set your weekly planning targets and keep consistency visible.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-xs">Weekly planning minutes</span>
                <input
                  type="number"
                  className="input input-bordered"
                  min="30"
                  value={goals.weeklyMinutes}
                  onChange={(event) =>
                    setGoals((prev) => ({ ...prev, weeklyMinutes: Number(event.target.value || 0) }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Weekly travel call target</span>
                <input
                  type="number"
                  className="input input-bordered"
                  min="1"
                  value={goals.weeklyCalls}
                  onChange={(event) => setGoals((prev) => ({ ...prev, weeklyCalls: Number(event.target.value || 0) }))}
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-base-300/70 bg-base-100/85 p-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="size-4 text-success" /> Weekly goal progress
                </span>
                <span>{weeklyGoalProgress}%</span>
              </div>
              <progress className="progress progress-primary mt-2 h-2.5" value={weeklyGoalProgress} max="100"></progress>
              <div className="mt-2 flex items-center justify-between text-xs text-base-content/70">
                <span>{weeklyMinutesCompleted} minutes completed</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-base-300 px-2 py-0.5">
                  <Flame className="size-3.5 text-warning" /> {streak.current} day streak
                </span>
              </div>
              <button type="button" className="btn btn-sm btn-primary mt-3" onClick={() => markPlanningDay(10)}>
                Mark today as planned
              </button>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-xs btn-outline" onClick={() => markPlanningDay(15)}>
                  +15 min
                </button>
                <button type="button" className="btn btn-xs btn-outline" onClick={() => markPlanningDay(30)}>
                  +30 min
                </button>
                <button type="button" className="btn btn-xs btn-outline" onClick={() => markPlanningDay(45)}>
                  +45 min
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-base-300/70 bg-base-100/85 p-4">
              <p className="text-sm font-bold">Weekly momentum snapshot</p>
              <progress className="progress progress-secondary mt-2 h-2" value={completionScore} max="100"></progress>
              <p className="mt-1 text-xs text-base-content/65">Score from friends, requests, and chat activity.</p>
            </div>
          </div>
        </section>

        <aside className="space-y-5 xl:col-span-4">
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Star className="size-3.5 text-warning" /> Post-call trip feedback
              </p>
              <form className="mt-2" onSubmit={addFeedback}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="form-control">
                    <span className="label-text text-xs">Fluency</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="input input-bordered input-sm"
                      value={feedbackForm.fluency}
                      onChange={(event) =>
                        setFeedbackForm((prev) => ({ ...prev, fluency: Number(event.target.value || 1) }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">Confidence</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="input input-bordered input-sm"
                      value={feedbackForm.confidence}
                      onChange={(event) =>
                        setFeedbackForm((prev) => ({ ...prev, confidence: Number(event.target.value || 1) }))
                      }
                    />
                  </label>
                </div>
                <label className="form-control mt-2">
                  <span className="label-text text-xs">Trip call minutes</span>
                  <input
                    type="number"
                    min="5"
                    className="input input-bordered input-sm"
                    value={feedbackForm.minutes}
                    onChange={(event) =>
                      setFeedbackForm((prev) => ({ ...prev, minutes: Number(event.target.value || 5) }))
                    }
                  />
                </label>
                <textarea
                  className="textarea textarea-bordered mt-2 h-20"
                  value={feedbackForm.note}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="One trip planning improvement note"
                ></textarea>
                <button type="submit" className="btn btn-primary btn-sm mt-2">
                  Save feedback
                </button>
              </form>
              {latestFeedback ? (
                <p className="mt-2 text-xs text-base-content/65">
                  Last: fluency {latestFeedback.fluency}/5, confidence {latestFeedback.confidence}/5
                </p>
              ) : null}
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Target className="size-3.5 text-primary" /> Community challenges
              </p>
              <div className="mt-2 space-y-2">
                {challengeCards.map((challenge) => {
                  const progress = Math.min(100, Math.round((challenge.current / challenge.target) * 100));

                  return (
                    <div key={challenge.key} className="rounded-lg border border-base-300/60 p-2">
                      <p className="text-xs font-semibold">{challenge.title}</p>
                      <progress className="progress progress-accent mt-1 h-1.5" value={progress} max="100"></progress>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-base-content/65">
                        <span>
                          {challenge.current}/{challenge.target}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => updateChallengeProgress(challenge.key)}
                        >
                          {challenge.actionLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl border border-base-300/70 bg-base-100/85 p-3 text-xs text-base-content/70">
                <p className="inline-flex items-center gap-1.5 font-semibold text-base-content/80">
                  <CheckCircle2 className="size-3.5 text-success" /> Focus hint
                </p>
                <p className="mt-1">Log feedback immediately after calls to keep your planning trend accurate.</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
