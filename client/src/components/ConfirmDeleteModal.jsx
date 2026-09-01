import { Trash2 } from "lucide-react";

export default function ConfirmDeleteModal({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pendingLabel = "Deleting...",
  isPending = false,
  onConfirm,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="grid size-10 place-items-center rounded-full bg-error/10 text-error">
          <Trash2 className="size-5" />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-base-content">{title}</h3>
        {description && <p className="mt-1 text-sm text-base-content/60">{description}</p>}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            className="btn flex-1 border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn flex-1 border-none bg-error text-white hover:bg-error"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
