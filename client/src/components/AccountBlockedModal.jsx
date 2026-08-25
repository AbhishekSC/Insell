import { Mail, ShieldOff, X } from "lucide-react";

export const SUPPORT_EMAIL = "aschauhan1801@gmail.com";

export default function AccountBlockedModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mx-auto -mt-2 grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
          <ShieldOff className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-slate-800">Account blocked</h3>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          Your account has been blocked from NearMySpace. If you think this is a mistake, please contact our support
          team for help.
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Mail className="size-4" />
          {SUPPORT_EMAIL}
        </a>
      </div>
    </div>
  );
}
