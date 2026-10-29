import { useState, useMemo } from "react";
import { Users, X, Briefcase, ChevronRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

const DISMISS_KEY = "nms:flatmateOnboardDismissed";
const WORK_NUDGE_KEY = "nms:workLocationNudgeCount";
const MAX_WORK_NUDGES = 2;

function getDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
function getWorkNudgeCount() {
  try { return parseInt(localStorage.getItem(WORK_NUDGE_KEY) || "0", 10); } catch { return 0; }
}

const STEPS = [
  {
    key: "gender",
    question: "What's your gender?",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
      { label: "Other", value: "Other" },
    ],
  },
  {
    key: "foodPreference",
    question: "Food preference?",
    options: [
      { label: "Veg", value: "veg" },
      { label: "Non-Veg", value: "nonveg" },
      { label: "Eggetarian", value: "eggetarian" },
    ],
  },
  {
    key: "smoking",
    question: "Do you smoke?",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
      { label: "Occasionally", value: "occasionally" },
    ],
  },
  {
    key: "occupation",
    question: "What do you do?",
    options: [
      { label: "Working", value: "working" },
      { label: "Student", value: "student" },
      { label: "Freelancer", value: "freelancer" },
    ],
  },
];

export default function FlatmateOnboardingPrompt({ authUser }) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(getDismissed);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const hasProfile = useMemo(() => {
    const fp = authUser?.flatmateProfile;
    return fp?.gender && fp?.foodPreference && fp?.updatedAt;
  }, [authUser]);

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: (profile) =>
      axiosInstance.patch("/users/profile", { flatmateProfile: profile }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["authUser"] });
      dismiss();
    },
  });

  if (!authUser?._id || dismissed || hasProfile) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const current = STEPS[step];

  const pick = (value) => {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      saveProfile({ ...next, updatedAt: new Date().toISOString() });
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-base-100 to-violet-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
          <Users className="size-4 text-violet-600" />
          Quick profile setup ({step + 1}/{STEPS.length})
        </p>
        <button
          type="button"
          className="-mr-1 -mt-1 rounded-lg p-1 text-base-content/35 hover:bg-base-200 hover:text-base-content"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-base-content/60">
        Help us match you with compatible flatmates
      </p>

      <p className="mt-3 text-[13px] font-medium text-base-content/80">{current.question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {current.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={isPending}
            onClick={() => pick(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
              answers[current.key] === o.value
                ? "border-violet-400 bg-violet-100 text-violet-700"
                : "border-base-300 bg-base-100 text-base-content/70 hover:border-violet-300 hover:bg-violet-50"
            }`}
          >
            {o.label}
            {step === STEPS.length - 1 && <ChevronRight className="size-3" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkLocationNudge({ authUser }) {
  const [dismissed, setDismissed] = useState(() => {
    const count = getWorkNudgeCount();
    return count >= MAX_WORK_NUDGES;
  });
  const shouldShow = useMemo(() => Math.random() < 0.5, []);

  const hasWorkLocation = authUser?.workLocation?.latitude && authUser?.workLocation?.longitude;

  if (!authUser?._id || dismissed || hasWorkLocation || !shouldShow) return null;

  const dismiss = () => {
    try {
      const count = getWorkNudgeCount() + 1;
      localStorage.setItem(WORK_NUDGE_KEY, String(count));
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <Briefcase className="size-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-[12px] leading-snug text-base-content/70">
        <span className="font-semibold text-base-content/80">Add your work location</span>{" "}
        in Edit Profile to see commute distances on flatmate listings.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-[11px] font-semibold text-base-content/40 hover:text-base-content/60"
      >
        Got it
      </button>
    </div>
  );
}
