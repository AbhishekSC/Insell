import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { usePreferencePrompt } from "../hooks/usePreferencePrompt";

// A single, dismissible onboarding question shown inline in the feed. One
// question at a time — the server picks which; this just renders the right
// input for prompt.kind and posts the answer.
export default function PreferencePrompt() {
  const { prompt, submitting, answer, skip } = usePreferencePrompt();
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [chips, setChips] = useState([]);
  const [draft, setDraft] = useState("");

  if (!prompt) return null;

  const toggleChip = (v) =>
    setChips((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const addDraft = () => {
    const v = draft.trim();
    if (v && !chips.includes(v)) setChips((prev) => [...prev, v]);
    setDraft("");
  };

  return (
    <div className="my-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
          <Sparkles className="size-4 text-primary" />
          {prompt.question}
        </p>
        <button
          type="button"
          className="btn btn-xs btn-ghost btn-circle -mr-1 -mt-1"
          onClick={skip}
          disabled={submitting}
          aria-label="Skip"
        >
          <X className="size-4" />
        </button>
      </div>
      {prompt.hint && <p className="mt-1 text-xs text-base-content/60">{prompt.hint}</p>}

      {prompt.kind === "choice" && (
        <div className="mt-3 flex gap-2">
          {prompt.options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="btn btn-sm flex-1 border-none bg-primary text-white hover:bg-primary disabled:bg-base-300"
              disabled={submitting}
              onClick={() => answer(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {prompt.kind === "range" && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min ₹"
            className="input input-sm input-bordered w-full border-base-300"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <span className="text-base-content/40">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max ₹"
            className="input input-sm input-bordered w-full border-base-300"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm shrink-0 border-none bg-primary text-white hover:bg-primary"
            disabled={submitting || (!min && !max)}
            onClick={() => answer({ min: Number(min || 0), max: Number(max || 0) })}
          >
            Save
          </button>
        </div>
      )}

      {(prompt.kind === "chips" || prompt.kind === "chips-free") && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(prompt.options || []).map((o) => (
              <button
                key={o.value}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  chips.includes(o.value)
                    ? "border-primary bg-primary text-white"
                    : "border-base-300 text-base-content/70 hover:border-primary/40"
                }`}
                onClick={() => toggleChip(o.value)}
              >
                {o.label}
              </button>
            ))}
            {chips
              .filter((c) => !(prompt.options || []).some((o) => o.value === c))
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-white"
                  onClick={() => toggleChip(c)}
                >
                  {c} ✕
                </button>
              ))}
          </div>
          {prompt.kind === "chips-free" && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Add an area…"
                className="input input-sm input-bordered w-full border-base-300"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
              />
              <button type="button" className="btn btn-sm border-base-300" onClick={addDraft}>
                Add
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn btn-sm mt-3 w-full border-none bg-primary text-white hover:bg-primary disabled:bg-base-300"
            disabled={submitting || chips.length === 0}
            onClick={() => answer(chips)}
          >
            Save
          </button>
        </>
      )}
    </div>
  );
}
