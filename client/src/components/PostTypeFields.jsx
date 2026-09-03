import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FIELD_KIND, getFields } from "../config/postTypeConfig";

// Renders the type-specific inputs on the Create Post "details" step from
// postTypeConfig — essential fields inline, the rest behind an "Add more
// details" expander. Every field binds to a flat key on `draft` via
// updateDraft, so the existing payload builder is unaffected.
function FieldInput({ field, value, onChange }) {
  const { name, label, kind, options, placeholder } = field;

  if (kind === FIELD_KIND.BOOLEAN) {
    return (
      <label className="form-control">
        <span className="label-text mb-1 text-xs text-base-content/60">{label}</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={Boolean(value)}
          onChange={(e) => onChange(name, e.target.checked)}
        />
      </label>
    );
  }

  if (kind === FIELD_KIND.SELECT) {
    return (
      <label className="form-control">
        <span className="label-text mb-1 text-xs text-base-content/60">{label}</span>
        <select
          className="select select-bordered border-base-300"
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
        >
          <option value="">Select option</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="form-control">
      <span className="label-text mb-1 text-xs text-base-content/60">{label}</span>
      <input
        type={kind === FIELD_KIND.NUMBER ? "number" : kind === FIELD_KIND.DATE ? "date" : "text"}
        className="input input-bordered border-base-300"
        placeholder={placeholder || ""}
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </label>
  );
}

export default function PostTypeFields({ postType, draft, updateDraft, priceLabel }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const essential = getFields(postType, "essential").map((f) =>
    f.name === "price" && priceLabel ? { ...f, label: priceLabel } : f
  );
  const advanced = getFields(postType, "advanced");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {essential.map((field) => (
        <FieldInput key={field.name} field={field} value={draft[field.name]} onChange={updateDraft} />
      ))}

      {advanced.length > 0 && (
        <div className="sm:col-span-2">
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-primary"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <ChevronDown className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Hide extra details" : "Add more details (optional)"}
          </button>
          {showAdvanced && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {advanced.map((field) => (
                <FieldInput key={field.name} field={field} value={draft[field.name]} onChange={updateDraft} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
