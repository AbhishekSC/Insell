import { useEffect, useState } from "react";

export const guidedCallModes = [
  {
    id: "intro",
    title: "Quick trip sync",
    description: "2 minutes each: current city, next destination, and travel status.",
  },
  {
    id: "roleplay",
    title: "Travel scenario planning",
    description: "Plan transport, stays, or a day itinerary together.",
  },
  {
    id: "debate",
    title: "Destination debate",
    description: "Compare two destinations and pick the best route.",
  },
];

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

export function defaultGoals() {
  return {
    weeklyMinutes: 90,
    weeklyCalls: 3,
  };
}

export function defaultStreak() {
  return {
    current: 0,
    lastCompleted: "",
    totalPracticeMinutes: 0,
  };
}

export function defaultChallenges() {
  return {
    calls: 0,
    plans: 0,
    sessions: 0,
  };
}

export function getChallengeCards(challengeProgress) {
  return [
    {
      key: "calls",
      title: "Complete 3 travel calls",
      current: challengeProgress.calls,
      target: 3,
      actionLabel: "+1 call",
    },
    {
      key: "plans",
      title: "Capture 20 travel plans",
      current: challengeProgress.plans,
      target: 20,
      actionLabel: "+1 plan",
    },
    {
      key: "sessions",
      title: "Finish 5 trip sessions",
      current: challengeProgress.sessions,
      target: 5,
      actionLabel: "+1 session",
    },
  ];
}
