import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Upload, CheckCircle2, FileText, X, Loader2, Plus, Check, ShieldCheck } from "lucide-react";
import { FIELD_KIND, getFields } from "../config/postTypeConfig";
import { uploadPropertyMedia } from "../lib/cloudinaryUpload";

function ElectricityBillVerificationShutter({ field, value, onChange, autoExpand }) {
  const { name } = field;
  const [isOpen, setIsOpen] = useState(() => Boolean(value || autoExpand));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (autoExpand) {
      setIsOpen(true);
    }
  }, [autoExpand]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(10);
      const urls = await uploadPropertyMedia([file], (percent) => setUploadProgress(percent));
      if (urls?.[0]) {
        onChange(name, urls[0]);
      }
    } catch (err) {
      console.error("Document upload failed:", err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to upload document";
      alert(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    onChange(name, "");
  };

  return (
    <div className="form-control sm:col-span-2">
      <div className="rounded-xl border border-base-300 bg-base-100 p-3 transition-all">
        {/* Clean Header Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-base-content">
              Verify Address
            </span>
            <span className="text-[11px] text-base-content/50">
              (Electricity bill · Optional)
            </span>
            {value && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 className="size-3" /> Attached
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="btn btn-ghost btn-xs text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
          >
            {isOpen ? (
              <>Less <ChevronUp className="size-3.5" /></>
            ) : (
              <>{value ? "View" : "Upload"} <ChevronDown className="size-3.5" /></>
            )}
          </button>
        </div>

        {/* Shutter Body (when expanded) */}
        {isOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-base-200 space-y-2">
            <p className="text-[11px] text-base-content/60">
              Upload an electricity bill for admin verification to earn the <strong className="text-emerald-600 dark:text-emerald-400">"✓ Address Verified"</strong> trust badge.
            </p>

            {value ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-semibold text-emerald-800 dark:text-emerald-300">Bill attached</span>
                  <a
                    href={value.endsWith(".pdf") ? value.replace(/\.pdf$/i, ".jpg") : value}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline text-[11px] font-medium hover:text-primary/80 ml-1"
                  >
                    View
                  </a>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0"
                  onClick={handleRemove}
                  title="Remove document"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label
                className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-base-300 hover:border-primary bg-base-200/40 hover:bg-base-200/70 py-3 px-4 cursor-pointer transition text-xs font-medium text-base-content/75 hover:text-base-content ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                    <span>Uploading bill ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-4 text-primary shrink-0" />
                    <span>Upload Electricity Bill (PDF, PNG, JPG)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FileUploadField({ field, value, onChange }) {
  const { name, label, description } = field;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(10);
      const urls = await uploadPropertyMedia([file], (percent) => setUploadProgress(percent));
      if (urls?.[0]) {
        onChange(name, urls[0]);
      }
    } catch (err) {
      console.error("Document upload failed:", err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to upload document";
      alert(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    onChange(name, "");
  };

  return (
    <div className="form-control sm:col-span-2">
      <div className="flex items-center justify-between mb-1">
        <span className="label-text text-xs text-base-content/70 font-medium">{label}</span>
        {description && <span className="text-[11px] text-base-content/50">{description}</span>}
      </div>

      {value ? (
        <div className="flex items-center justify-between p-3 bg-success/10 border border-success/30 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-success font-medium truncate">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="truncate">Document uploaded</span>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-primary underline shrink-0 hover:text-primary/80"
            >
              View file
            </a>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error shrink-0 gap-1"
            onClick={handleRemove}
          >
            <X className="size-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-base-300 rounded-xl cursor-pointer hover:border-primary/50 bg-base-200/40 transition-colors ${
            uploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <Loader2 className="size-5 text-primary animate-spin" />
              <span className="text-xs font-medium text-base-content/80">
                Uploading document ({uploadProgress}%)...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-1">
              <Upload className="size-5 text-base-content/40 mb-0.5" />
              <span className="text-xs font-semibold text-base-content/80">
                Click to upload electricity bill
              </span>
              <span className="text-[11px] text-base-content/50">
                Supports PDF, PNG, JPG (used for address verification)
              </span>
            </div>
          )}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

function CheckboxGridField({ field, value, onChange }) {
  const { name, label, options = [] } = field;
  const selected = Array.isArray(value) ? value : [];

  const toggleOption = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter((item) => item !== opt)
      : [...selected, opt];
    onChange(name, next);
  };

  return (
    <div className="form-control sm:col-span-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-text text-xs text-base-content/70 font-semibold">{label}</span>
        {selected.length > 0 && (
          <span className="text-[11px] text-primary font-medium">
            {selected.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-base-200/50 rounded-xl border border-base-300 max-h-64 overflow-y-auto">
        {options.map((opt) => {
          const isChecked = selected.includes(opt);
          return (
            <label
              key={opt}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors border select-none ${
                isChecked
                  ? "bg-primary/10 border-primary/40 text-primary font-medium shadow-xs"
                  : "bg-base-100 border-base-300 text-base-content/80 hover:bg-base-200/80"
              }`}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={isChecked}
                onChange={() => toggleOption(opt)}
              />
              <span className="truncate">{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function HouseRulesField({ field, value, onChange }) {
  const { name, label, placeholder, suggestions = [] } = field;
  const [inputText, setInputText] = useState("");

  const currentRules = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

  const addRule = (ruleToAdd) => {
    const trimmed = (ruleToAdd || inputText).trim();
    if (!trimmed) return;
    if (!currentRules.includes(trimmed)) {
      onChange(name, [...currentRules, trimmed]);
    }
    setInputText("");
  };

  const removeRule = (ruleToRemove) => {
    onChange(name, currentRules.filter((r) => r !== ruleToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRule();
    }
  };

  return (
    <div className="form-control sm:col-span-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-text text-xs text-base-content/70 font-medium">{label}</span>
        {currentRules.length > 0 && (
          <span className="text-[11px] text-primary font-medium">
            {currentRules.length} rule{currentRules.length > 1 ? "s" : ""} added
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="input input-bordered border-base-300 flex-1 text-sm"
          placeholder={placeholder || "Type a rule (e.g. No smoking) and press Enter"}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={() => addRule()}
          disabled={!inputText.trim()}
          className="btn btn-primary btn-sm h-auto px-4 text-xs font-semibold gap-1"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      {currentRules.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {currentRules.map((rule) => (
            <span
              key={rule}
              className="inline-flex items-center gap-1.5 rounded-lg bg-base-200 border border-base-300 px-3 py-1.5 text-xs font-medium text-base-content shadow-xs group"
            >
              <span>{rule}</span>
              <button
                type="button"
                onClick={() => removeRule(rule)}
                className="text-base-content/40 hover:text-error transition-colors ml-0.5"
                title="Remove rule"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-base-content/50 font-medium mb-1.5">Quick Suggestions (click to add):</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => {
              const isAdded = currentRules.includes(suggestion);
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => (isAdded ? removeRule(suggestion) : addRule(suggestion))}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    isAdded
                      ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                      : "bg-base-200/70 text-base-content/70 hover:bg-base-200 hover:text-base-content border border-base-300/60"
                  }`}
                >
                  {isAdded ? <Check className="size-3 shrink-0" /> : <Plus className="size-3 shrink-0 opacity-60" />}
                  {suggestion}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders the type-specific inputs on the Create Post "details" step from
// postTypeConfig — essential fields inline, the rest behind an "Add more
// details" expander. Every field binds to a flat key on `draft` via
// updateDraft, so the existing payload builder is unaffected.
function FieldInput({ field, value, onChange, draft }) {
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

  if (kind === FIELD_KIND.CHECKBOX_GRID) {
    return <CheckboxGridField field={field} value={value} onChange={onChange} />;
  }

  if (kind === FIELD_KIND.HOUSE_RULES) {
    return <HouseRulesField field={field} value={value} onChange={onChange} />;
  }

  if (kind === FIELD_KIND.TEXTAREA) {
    return (
      <label className="form-control sm:col-span-2">
        <span className="label-text mb-1 text-xs text-base-content/60">{label}</span>
        <textarea
          className="textarea textarea-bordered border-base-300 w-full text-sm leading-relaxed"
          rows={3}
          placeholder={placeholder || ""}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
        />
      </label>
    );
  }

  if (kind === FIELD_KIND.FILE) {
    if (name === "electricityBillUrl") {
      return (
        <ElectricityBillVerificationShutter
          field={field}
          value={value}
          onChange={onChange}
          autoExpand={Boolean(draft?.expandVerificationShutter)}
        />
      );
    }
    return <FileUploadField field={field} value={value} onChange={onChange} />;
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
  const hasAdvancedValues = Boolean(
    draft?.expandVerificationShutter ||
    draft?.electricityBillUrl ||
    draft?.furnishing ||
    draft?.facing ||
    draft?.floorNumber ||
    draft?.totalFloors ||
    draft?.ageOfProperty ||
    draft?.maintenanceCharges ||
    (Array.isArray(draft?.houseRules) && draft.houseRules.length > 0) ||
    (Array.isArray(draft?.preferredTenants) && draft.preferredTenants.length > 0) ||
    (Array.isArray(draft?.amenities) && draft.amenities.length > 0)
  );
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValues);

  useEffect(() => {
    if (draft?.expandVerificationShutter) {
      setShowAdvanced(true);
    }
  }, [draft?.expandVerificationShutter]);

  const essential = getFields(postType, "essential").map((f) =>
    f.name === "price" && priceLabel ? { ...f, label: priceLabel } : f
  );
  const advanced = getFields(postType, "advanced");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {essential.map((field) => (
        <FieldInput key={field.name} field={field} value={draft[field.name]} onChange={updateDraft} draft={draft} />
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
                <FieldInput key={field.name} field={field} value={draft[field.name]} onChange={updateDraft} draft={draft} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
