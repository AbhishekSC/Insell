import { Toaster, ToastBar, toast, resolveValue } from "react-hot-toast";
import { Check, Info, X } from "lucide-react";

// One place that styles every toast in the app.
//   - toast.custom(...)  → rendered exactly as given (the error ToastCard)
//   - toast.success/error/loading/blank → wrapped in a consistent opaque
//     card so they're always readable, whatever is behind them (maps,
//     photos, dark sections).
//
// Note: we do NOT rely on `hsl(var(--b1))` inline styles — DaisyUI now
// emits OKLCH values, so that produced an invalid (transparent) colour.
// Tailwind tokens (`bg-base-100`) resolve correctly in every theme.
export default function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      containerClassName="!bottom-20 sm:!bottom-6"
      gutter={10}
    >
      {(t) => {
        if (t.type === "custom") {
          // The error service's ToastCard already brings its own shell +
          // animation — render it raw, no wrapper.
          return resolveValue(t.message, t);
        }

        const tone =
          t.type === "success"
            ? { ring: "bg-success/15 text-success", Icon: Check }
            : t.type === "error"
              ? { ring: "bg-error/12 text-error", Icon: X }
              : { ring: "bg-info/12 text-info", Icon: Info };
        const ToneIcon = tone.Icon;

        return (
          <ToastBar toast={t} style={{ background: "transparent", boxShadow: "none", padding: 0 }}>
            {({ message }) => (
              <div
                className={`pointer-events-auto flex w-[min(90vw,21rem)] items-start gap-2.5 rounded-xl border border-base-300 bg-base-100 p-3 shadow-lg ${
                  t.visible ? "animate-[toast-in_0.16s_ease-out]" : "opacity-0"
                }`}
                role="status"
              >
                {t.type === "loading" ? (
                  <span className="mt-px size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <span className={`mt-px grid size-6 shrink-0 place-items-center rounded-full ${tone.ring}`}>
                    <ToneIcon className="size-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 text-[13px] leading-snug text-base-content [&>*]:!m-0">
                  {message}
                </div>
                {t.type !== "loading" && (
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="-m-0.5 shrink-0 rounded-md p-0.5 text-base-content/35 transition hover:bg-base-200 hover:text-base-content"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        );
      }}
    </Toaster>
  );
}
