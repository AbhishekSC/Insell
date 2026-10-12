import { useState, useRef } from "react";
import { CheckCircle2, FileUp, Loader2, MapPin, Paperclip, X } from "lucide-react";
import toast from "react-hot-toast";

const DOCUMENT_CATEGORIES = [
  { value: "PROPERTY_TITLE", label: "Property Title Deed / 7-12 Extract" },
  { value: "IDENTITY_PROOF", label: "Identity Proof (Aadhaar / PAN / Passport)" },
  { value: "SALE_AGREEMENT", label: "Sale Agreement / Agreement to Sell / MOU" },
  { value: "PAYMENT_RECEIPT", label: "Payment Receipt / Bank Counterfoil / RTGS" },
  { value: "NOC_TAX_RECEIPT", label: "Society NOC / Municipal Tax Receipt" },
  { value: "SITE_INSPECTION", label: "Physical Site Inspection (Geo-Fenced Photo)" },
  { value: "OTHER", label: "Other Legal Document" },
];

export default function AttachDocumentModal({ onUpload, isUploading, onClose }) {
  const [category, setCategory] = useState("PROPERTY_TITLE");
  const [selectedFile, setSelectedFile] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef(null);

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocating(false);
        toast.success(`GPS location acquired (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setLocating(false);
        toast.error(`Could not get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please choose a file to attach");
      return;
    }
    onUpload({
      file: selectedFile,
      category,
      lat: coords?.lat,
      lng: coords?.lng,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl bg-base-100 p-6 shadow-2xl border border-base-300">
        <div className="flex items-center justify-between pb-4 border-b border-base-200">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileUp className="size-5" />
            </span>
            <div>
              <h3 className="font-bold text-base-content text-base">Attach Legal Document</h3>
              <p className="text-xs text-base-content/60">Upload title deeds, agreements, or KYC</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-semibold text-xs">Document Legal Category</span>
            </label>
            <select
              className="select select-bordered select-sm w-full rounded-xl"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {category === "SITE_INSPECTION" && (
            <div className="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-base-content flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" /> Physical Site Verification (GPS)
                </span>
                {coords ? (
                  <span className="badge badge-success badge-xs text-white gap-1 font-semibold">
                    <CheckCircle2 className="size-2.5" /> Acquired
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-base-content/60 leading-relaxed">
                Tag your device GPS coordinates to mathematically prove this inspection photo was taken on-site (within 150m of property).
              </p>
              {coords ? (
                <div className="flex items-center justify-between text-xs bg-base-100 p-2.5 rounded-xl border border-base-300 font-mono">
                  <span className="text-base-content/70">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    className="btn btn-xs btn-ghost text-primary"
                  >
                    Re-tag
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  disabled={locating}
                  className="btn btn-sm btn-outline btn-primary w-full rounded-xl gap-2 text-xs"
                >
                  {locating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Acquiring GPS Satellites...
                    </>
                  ) : (
                    <>
                      <MapPin className="size-3.5" /> Tag Device GPS Location
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-semibold text-xs">Document File (PDF or Image)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-base-300 hover:border-primary/50 p-4 rounded-2xl text-center cursor-pointer transition bg-base-200/30"
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2 text-primary text-sm font-semibold truncate">
                  <Paperclip className="size-4 shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <FileUp className="size-6 mx-auto text-base-content/40" />
                  <p className="text-xs font-semibold text-base-content">Click to select file</p>
                  <p className="text-[10px] text-base-content/50">PDF, PNG, JPG up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="btn btn-primary btn-sm flex-1 rounded-xl"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Document"
              )}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm rounded-xl">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
