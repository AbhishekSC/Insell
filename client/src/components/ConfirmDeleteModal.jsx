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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
          <Trash2 className="size-5" />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-slate-800">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            className="btn flex-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn flex-1 border-none bg-red-600 text-white hover:bg-red-500"
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
