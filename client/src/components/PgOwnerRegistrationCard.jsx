import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, ChevronDown, Shield, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const PG_AMENITIES = ["WiFi", "AC", "Laundry", "Parking", "Power Backup", "Water Purifier", "CCTV", "Security Guard", "Gym", "TV", "Fridge", "Microwave", "Cooking Allowed", "Study Room"];

export default function PgOwnerRegistrationCard({ authUser }) {
  const queryClient = useQueryClient();
  const existingProfile = authUser?.pgOwnerProfile;
  const isRegistered = existingProfile?.isRegistered;
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(1);
  const [pgForm, setPgForm] = useState({
    pgName: existingProfile?.pgName || "",
    pgAddress: existingProfile?.pgAddress || "",
    pgCity: existingProfile?.pgCity || "",
    pgLocality: existingProfile?.pgLocality || "",
    totalBeds: existingProfile?.totalBeds || "",
    genderPreference: existingProfile?.genderPreference || "",
    foodIncluded: existingProfile?.foodIncluded || false,
    foodType: existingProfile?.foodType || "",
    amenities: existingProfile?.amenities || [],
    priceRangeMin: existingProfile?.priceRangeMin || "",
    priceRangeMax: existingProfile?.priceRangeMax || "",
    yearsOperating: existingProfile?.yearsOperating || "",
    propertyOwnership: existingProfile?.propertyOwnership || "",
    idProofType: existingProfile?.idProofType || "",
    idProofNumber: existingProfile?.idProofNumber || "",
  });

  const { mutate: register, isPending } = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/users/pg-owner-register", data);
      return res.data;
    },
    onSuccess: (response) => {
      const user = response?.data?.user;
      queryClient.setQueryData(["authUser"], (prev) => {
        const prevData = prev?.data?.user || prev?.data || {};
        return { status: "success", data: { user: { ...prevData, ...user } } };
      });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success(isRegistered ? "PG Owner profile updated!" : "Registered as PG Owner!");
      setExpanded(false);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to register"),
  });

  function handleSubmit() {
    if (!pgForm.pgName.trim()) return toast.error("PG name is required");
    if (!pgForm.pgCity.trim()) return toast.error("City is required");
    register({
      ...pgForm,
      totalBeds: Number(pgForm.totalBeds) || 0,
      priceRangeMin: Number(pgForm.priceRangeMin) || 0,
      priceRangeMax: Number(pgForm.priceRangeMax) || 0,
      yearsOperating: Number(pgForm.yearsOperating) || 0,
    });
  }

  function toggleAmenity(a) {
    setPgForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a) ? prev.amenities.filter((x) => x !== a) : [...prev.amenities, a],
    }));
  }

  if (isRegistered && !expanded) {
    const status = existingProfile.approvalStatus;
    const statusConfig = {
      approved: { border: "border-success/30", bg: "bg-success/5", iconBg: "bg-success/15", iconColor: "text-success", label: "Approved PG Owner", labelColor: "text-success" },
      pending: { border: "border-amber-300/40", bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", label: "Approval Pending", labelColor: "text-amber-600" },
      rejected: { border: "border-error/30", bg: "bg-error/5", iconBg: "bg-error/15", iconColor: "text-error", label: "Application Rejected", labelColor: "text-error" },
    };
    const sc = statusConfig[status] || statusConfig.pending;

    return (
      <div className={`rounded-3xl border ${sc.border} ${sc.bg} p-5 shadow-sm space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${sc.iconBg} ${sc.iconColor}`}>
              {status === "approved" ? <CheckCircle2 className="size-5" /> : status === "rejected" ? <X className="size-5" /> : <Building2 className="size-5" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${sc.labelColor}`}>{sc.label}</p>
              <p className="text-xs text-base-content/60">{existingProfile.pgName} · {existingProfile.pgCity}</p>
              <p className="text-xs text-base-content/40 mt-0.5">
                {existingProfile.totalBeds} beds · {existingProfile.genderPreference || "Any"} · Registered {existingProfile.registeredAt ? new Date(existingProfile.registeredAt).toLocaleDateString("en-IN") : ""}
              </p>
            </div>
          </div>
          <button onClick={() => { setExpanded(true); setStep(1); }} className="btn btn-sm btn-ghost gap-1">
            Edit <ChevronDown className="size-3" />
          </button>
        </div>
        {status === "pending" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">Your PG Owner registration is under review. An admin will approve it shortly. Once approved, you can access PG Dashboard & Rental Tools and post PG listings.</p>
          </div>
        )}
        {status === "rejected" && (
          <div className="rounded-xl bg-error/5 border border-error/20 px-3 py-2 space-y-1">
            <p className="text-xs text-error font-medium">Your application was rejected.</p>
            {existingProfile.rejectionReason && <p className="text-xs text-base-content/60">Reason: {existingProfile.rejectionReason}</p>}
            <p className="text-xs text-base-content/50">You can update your profile and resubmit.</p>
          </div>
        )}
      </div>
    );
  }

  if (!expanded && !isRegistered) {
    return (
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Register as PG Owner</h3>
              <p className="text-sm text-base-content/60 mt-0.5">
                Register to get access to PG Dashboard, Rental Tools, and post PG listings. After admin approval, all PG features unlock.
              </p>
            </div>
          </div>
          <button onClick={() => setExpanded(true)} className="btn btn-primary btn-sm shrink-0 gap-1">
            <Building2 className="size-4" /> Register Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-primary/30 bg-base-100 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h3 className="text-base font-bold">{isRegistered ? "Update PG Owner Profile" : "Register as PG Owner"}</h3>
        </div>
        <button onClick={() => setExpanded(false)} className="btn btn-sm btn-ghost btn-circle">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <button key={s} onClick={() => setStep(s)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            step === s ? "bg-primary text-primary-content" : s < step ? "bg-success/15 text-success" : "bg-base-200 text-base-content/50"
          }`}>
            {s < step ? <CheckCircle2 className="size-3" /> : null}
            {s === 1 ? "PG Details" : s === 2 ? "Facilities" : "Verification"}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <label className="form-control">
            <span className="label-text mb-1">PG / Hostel Name *</span>
            <input type="text" className="input input-bordered" placeholder="e.g. Sunrise PG for Girls" value={pgForm.pgName} onChange={(e) => setPgForm((p) => ({ ...p, pgName: e.target.value }))} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Full Address</span>
            <textarea className="textarea textarea-bordered min-h-16" placeholder="Building, Street, Area..." value={pgForm.pgAddress} onChange={(e) => setPgForm((p) => ({ ...p, pgAddress: e.target.value }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1">City *</span>
              <input type="text" className="input input-bordered" placeholder="e.g. Pune" value={pgForm.pgCity} onChange={(e) => setPgForm((p) => ({ ...p, pgCity: e.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Locality / Area</span>
              <input type="text" className="input input-bordered" placeholder="e.g. Hinjewadi" value={pgForm.pgLocality} onChange={(e) => setPgForm((p) => ({ ...p, pgLocality: e.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="form-control">
              <span className="label-text mb-1">Total Beds</span>
              <input type="number" className="input input-bordered" min="0" placeholder="e.g. 50" value={pgForm.totalBeds} onChange={(e) => setPgForm((p) => ({ ...p, totalBeds: e.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Years Operating</span>
              <input type="number" className="input input-bordered" min="0" placeholder="e.g. 3" value={pgForm.yearsOperating} onChange={(e) => setPgForm((p) => ({ ...p, yearsOperating: e.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Property Ownership</span>
              <select className="select select-bordered" value={pgForm.propertyOwnership} onChange={(e) => setPgForm((p) => ({ ...p, propertyOwnership: e.target.value }))}>
                <option value="">Select</option>
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="managed">Managed</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} className="btn btn-primary btn-sm">Next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1">Gender Preference</span>
              <select className="select select-bordered" value={pgForm.genderPreference} onChange={(e) => setPgForm((p) => ({ ...p, genderPreference: e.target.value }))}>
                <option value="">Any</option>
                <option value="boys">Boys Only</option>
                <option value="girls">Girls Only</option>
                <option value="unisex">Co-ed / Unisex</option>
              </select>
            </label>
            <div>
              <span className="label-text mb-1 block">Food Included</span>
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={pgForm.foodIncluded} onChange={(e) => setPgForm((p) => ({ ...p, foodIncluded: e.target.checked }))} />
                  <span className="text-sm">{pgForm.foodIncluded ? "Yes" : "No"}</span>
                </label>
                {pgForm.foodIncluded && (
                  <select className="select select-bordered select-sm" value={pgForm.foodType} onChange={(e) => setPgForm((p) => ({ ...p, foodType: e.target.value }))}>
                    <option value="">Food type</option>
                    <option value="veg">Veg Only</option>
                    <option value="nonveg">Non-Veg</option>
                    <option value="both">Both</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1">Min Price (₹/month)</span>
              <input type="number" className="input input-bordered" min="0" placeholder="e.g. 5000" value={pgForm.priceRangeMin} onChange={(e) => setPgForm((p) => ({ ...p, priceRangeMin: e.target.value }))} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Max Price (₹/month)</span>
              <input type="number" className="input input-bordered" min="0" placeholder="e.g. 15000" value={pgForm.priceRangeMax} onChange={(e) => setPgForm((p) => ({ ...p, priceRangeMax: e.target.value }))} />
            </label>
          </div>

          <div>
            <span className="label-text mb-2 block">Amenities</span>
            <div className="flex flex-wrap gap-2">
              {PG_AMENITIES.map((a) => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  pgForm.amenities.includes(a) ? "bg-primary/15 text-primary border-primary/30" : "bg-base-200 text-base-content/60 border-transparent hover:border-base-300"
                }`}>
                  {pgForm.amenities.includes(a) ? "✓ " : ""}{a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm">← Back</button>
            <button onClick={() => setStep(3)} className="btn btn-primary btn-sm">Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <Shield className="size-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Identity Verification (Optional)</p>
                <p className="text-xs text-amber-700/70 mt-0.5">Adding ID proof helps build trust with tenants and gets your PG a verified badge.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1">ID Proof Type</span>
              <select className="select select-bordered" value={pgForm.idProofType} onChange={(e) => setPgForm((p) => ({ ...p, idProofType: e.target.value }))}>
                <option value="">Select (optional)</option>
                <option value="Aadhaar">Aadhaar Card</option>
                <option value="PAN">PAN Card</option>
                <option value="Driving License">Driving License</option>
                <option value="Passport">Passport</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1">ID Number</span>
              <input type="text" className="input input-bordered" placeholder="Enter ID number" value={pgForm.idProofNumber} onChange={(e) => setPgForm((p) => ({ ...p, idProofNumber: e.target.value }))} />
            </label>
          </div>

          <div className="rounded-xl bg-base-200/50 p-4 space-y-2">
            <p className="text-sm font-semibold">Registration Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-content/70">
              <span>PG Name:</span><span className="font-medium text-base-content">{pgForm.pgName || "—"}</span>
              <span>Location:</span><span className="font-medium text-base-content">{[pgForm.pgLocality, pgForm.pgCity].filter(Boolean).join(", ") || "—"}</span>
              <span>Beds:</span><span className="font-medium text-base-content">{pgForm.totalBeds || "—"}</span>
              <span>Gender:</span><span className="font-medium text-base-content capitalize">{pgForm.genderPreference || "Any"}</span>
              <span>Food:</span><span className="font-medium text-base-content">{pgForm.foodIncluded ? (pgForm.foodType || "Included") : "Not included"}</span>
              <span>Price Range:</span><span className="font-medium text-base-content">{pgForm.priceRangeMin && pgForm.priceRangeMax ? `₹${Number(pgForm.priceRangeMin).toLocaleString("en-IN")} - ₹${Number(pgForm.priceRangeMax).toLocaleString("en-IN")}` : "—"}</span>
              <span>Amenities:</span><span className="font-medium text-base-content">{pgForm.amenities.length > 0 ? pgForm.amenities.join(", ") : "—"}</span>
              <span>Ownership:</span><span className="font-medium text-base-content capitalize">{pgForm.propertyOwnership || "—"}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="btn btn-ghost btn-sm">← Back</button>
            <button onClick={handleSubmit} disabled={isPending} className="btn btn-primary btn-sm gap-1">
              {isPending ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle2 className="size-4" />}
              {isRegistered ? "Update Profile" : "Complete Registration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
