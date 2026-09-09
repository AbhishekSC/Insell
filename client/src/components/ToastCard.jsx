import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Info,
  RotateCw,
  ServerCrash,
  WifiOff,
  X,
} from "lucide-react";

const KIND_STYLES = {
  error: { icon: ServerCrash, ring: "bg-error/12 text-error", bar: "bg-error" },
  warning: { icon: AlertTriangle, ring: "bg-warning/15 text-warning", bar: "bg-warning" },
  offline: { icon: WifiOff, ring: "bg-base-300 text-base-content/70", bar: "bg-base-content/40" },
  blocked: { icon: Ban, ring: "bg-error/12 text-error", bar: "bg-error" },
  rate: { icon: Clock, ring: "bg-warning/15 text-warning", bar: "bg-warning" },
  info: { icon: Info, ring: "bg-info/12 text-info", bar: "bg-info" },
};

// Compact notice card, rendered through react-hot-toast's `toast.custom`
// (so it gets the toast handle `t`). Copy is kept to a title + one short
// line; recovery lives in the action button.
export default function ToastCard({ t, info, duration = 5000, onRetry, onDismissed }) {
  const style = KIND_STYLES[info.kind] || KIND_STYLES.error;
  const Icon = style.icon;

  const close = () => {
    onDismissed?.();
    toast.dismiss(t.id);
  };

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cooldown, setCooldown] = useState(Math.ceil((info.retryAfterMs || 0) / 1000));
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => {
      const left = Math.ceil((info.retryAfterMs - (Date.now() - startedAt.current)) / 1000);
      setCooldown(left > 0 ? left : 0);
    }, 250);
    return () => clearInterval(id);
  }, [cooldown, info.retryAfterMs]);

  const canRetry = Boolean(onRetry) && cooldown <= 0 && !retrying;

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
      close();
    } catch {
      setRetrying(false);
      startedAt.current = Date.now();
      setCooldown(Math.ceil((info.retryAfterMs || 0) / 1000));
    }
  };

  const copyRef = async () => {
    try {
      const text = [
        `Ref: ${info.ref}`,
        info.meta?.method && info.meta?.url ? `${info.meta.method} ${info.meta.url}` : null,
        info.meta?.status ? `Status: ${info.meta.status}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const hasDetails = Boolean(info.ref || info.meta?.url);
  const hasActions = Boolean(onRetry || info.secondary);

  return (
    <div
      className={`pointer-events-auto w-[min(90vw,21rem)] overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg ${
        t.visible ? "animate-[toast-in_0.16s_ease-out]" : "opacity-0"
      }`}
      role="alert"
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className={`mt-px grid size-6 shrink-0 place-items-center rounded-full ${style.ring}`}>
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-base-content">{info.title}</p>
          {info.message && (
            <p className="mt-0.5 text-[12px] leading-snug text-base-content/60">{info.message}</p>
          )}

          {hasActions && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {onRetry && (
                <button
                  type="button"
                  disabled={!canRetry}
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-content transition hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCw className={`size-3 ${retrying ? "animate-spin" : ""}`} />
                  {retrying ? "Retrying…" : cooldown > 0 ? `Retry ${cooldown}s` : "Try again"}
                </button>
              )}
              {info.secondary && (
                <button
                  type="button"
                  onClick={() => {
                    info.secondary.onClick?.();
                    close();
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {info.secondary.label}
                </button>
              )}
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-base-content/40 hover:text-base-content/70"
                >
                  <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  Details
                </button>
              )}
            </div>
          )}

          {!hasActions && hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-base-content/40 hover:text-base-content/70"
            >
              <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              Details
            </button>
          )}

          {expanded && hasDetails && (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-base-200 px-2 py-1 text-[10px] font-mono text-base-content/55">
              <span className="truncate">
                {info.meta?.status ? `${info.meta.status} · ` : ""}
                {info.ref}
              </span>
              <button
                type="button"
                onClick={copyRef}
                className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-semibold text-base-content/70 hover:bg-base-300"
              >
                {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          className="-m-0.5 shrink-0 rounded-md p-0.5 text-base-content/35 transition hover:bg-base-200 hover:text-base-content"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {t.visible && duration > 0 && (
        <div className="h-0.5 w-full bg-base-200">
          <div
            className={`h-full ${style.bar} opacity-40`}
            style={{ animation: `toast-progress ${duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}
