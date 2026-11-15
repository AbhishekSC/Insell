import { useState } from "react";
import {
  FileText, Receipt, ClipboardCheck, Download, Plus, Camera,
  IndianRupee, Calendar, Building2, User, MapPin, ChevronDown, ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import {
  useGenerateReceipt, useRentHistory, useSaveRentPayment, useDownloadReceipt,
  useMyAgreements, useCreateAgreement, useDownloadAgreement,
  useMyConditionReports, useCreateConditionReport, useDownloadConditionReport,
} from "../hooks/useRentalTools";
import { formatINR, formatDate, INDIAN_STATES, downloadBlob } from "../lib/pgHelpers";

export default function RentalToolsPage() {
  const [tab, setTab] = useState("receipts");

  const tabs = [
    { id: "receipts", label: "Rent Receipts", icon: Receipt },
    { id: "agreements", label: "Agreements", icon: FileText },
    { id: "condition", label: "Condition Reports", icon: ClipboardCheck },
  ];

  return (
    <AppShell title="Rental Tools">
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Rental Tools</h1>
            <p className="text-sm text-base-content/50">Rent receipts, agreements & condition reports</p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-content shadow-sm"
                  : "bg-base-200/80 text-base-content/60 hover:bg-base-300 hover:text-base-content"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "receipts" && <ReceiptsTab />}
        {tab === "agreements" && <AgreementsTab />}
        {tab === "condition" && <ConditionTab />}
      </div>
    </AppShell>
  );
}

function ReceiptsTab() {
  const { data: historyData } = useRentHistory();
  const { mutate: savePayment, isPending: saving } = useSaveRentPayment();
  const { mutate: generateReceipt, isPending: generating } = useGenerateReceipt();
  const { mutate: downloadReceipt, isPending: downloading } = useDownloadReceipt();
  const [showForm, setShowForm] = useState(false);

  const payments = historyData?.payments || [];

  const [form, setForm] = useState({
    tenantName: "", landlordName: "", landlordPAN: "", propertyAddress: "",
    amount: "", month: new Date().getMonth() + 1,
    year: new Date().getFullYear(), paymentMode: "upi",
  });

  function handleSave(e) {
    e.preventDefault();
    const { tenantName: _tenantName, ...paymentData } = form;
    savePayment(
      { ...paymentData, amount: Number(paymentData.amount) },
      {
        onSuccess: () => { toast.success("Payment saved"); setShowForm(false); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed"),
      }
    );
  }

  function handleGenerate(e) {
    e.preventDefault();
    generateReceipt(
      { ...form, amount: Number(form.amount) },
      {
        onSuccess: (blob) => { downloadBlob(blob, `rent-receipt-${form.month}-${form.year}.pdf`); toast.success("Receipt downloaded"); },
        onError: () => toast.error("Failed to generate receipt"),
      }
    );
  }

  function handleDownload(paymentId) {
    downloadReceipt(paymentId, {
      onSuccess: (blob) => { downloadBlob(blob, `receipt-${paymentId}.pdf`); },
      onError: () => toast.error("Failed to download"),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Rent Receipts</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-sm btn-primary gap-1">
          <Plus size={14} /> New Receipt
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <input type="text" placeholder="Your Name (Tenant)" value={form.tenantName} onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Landlord Name" value={form.landlordName} onChange={(e) => setForm((f) => ({ ...f, landlordName: e.target.value }))} required className="input input-bordered input-sm" />
            <input type="text" placeholder="Landlord PAN" value={form.landlordPAN} onChange={(e) => setForm((f) => ({ ...f, landlordPAN: e.target.value }))} className="input input-bordered input-sm" />
          </div>
          <input type="text" placeholder="Property Address" value={form.propertyAddress} onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required className="input input-bordered input-sm" />
            <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))} className="select select-bordered select-sm">
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} className="select select-bordered select-sm">
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <select value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))} className="select select-bordered select-sm w-full">
            {[["upi","UPI"], ["bank_transfer","Bank Transfer"], ["cash","Cash"], ["cheque","Cheque"], ["other","Other"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-sm btn-primary flex-1 gap-1">
              <IndianRupee size={14} /> {saving ? "Saving..." : "Save Payment"}
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating} className="btn btn-sm btn-outline flex-1 gap-1">
              <Download size={14} /> {generating ? "Generating..." : "Download PDF"}
            </button>
          </div>
        </form>
      )}

      {/* Payment history */}
      {payments.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Receipt size={40} className="mx-auto text-base-content/15 mb-3" />
          <p className="text-sm text-base-content/50">No rent receipts yet</p>
          <p className="text-xs text-base-content/40 mt-1">Generate a receipt for your monthly rent payment</p>
        </div>
      )}
      {payments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-base-content/70">Payment History</h3>
          {payments.map((p) => (
            <div key={p._id} className="rounded-xl border border-base-200 bg-base-100 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][p.month]} {p.year}
                </div>
                <div className="text-xs text-base-content/60">{p.landlordName} · {p.paymentMode}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">{formatINR(p.amount)}</span>
                <button onClick={() => handleDownload(p._id)} disabled={downloading} className="btn btn-xs btn-ghost btn-circle">
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgreementsTab() {
  const { data: agData } = useMyAgreements();
  const { mutate: createAgreement, isPending: creating } = useCreateAgreement();
  const { mutate: downloadAg, isPending: downloading } = useDownloadAgreement();
  const [showForm, setShowForm] = useState(false);

  const agreements = agData?.agreements || [];

  const [form, setForm] = useState({
    landlordName: "", landlordAddress: "", landlordPhone: "",
    tenantName: "", tenantAddress: "", tenantPhone: "",
    propertyAddress: "", state: "maharashtra",
    monthlyRent: "", securityDeposit: "",
    leaseStartDate: "", durationMonths: 11,
    additionalTerms: "",
  });

  function handleCreate(e) {
    e.preventDefault();
    const start = new Date(form.leaseStartDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(form.durationMonths));
    const body = {
      ...form,
      monthlyRent: Number(form.monthlyRent),
      securityDeposit: Number(form.securityDeposit),
      leaseStartDate: start.toISOString(),
      leaseEndDate: end.toISOString(),
      additionalTerms: form.additionalTerms ? form.additionalTerms.split("\n").filter(Boolean) : [],
    };
    delete body.durationMonths;
    createAgreement(body, {
      onSuccess: () => { toast.success("Agreement created"); setShowForm(false); },
      onError: (err) => toast.error(err.response?.data?.message || "Failed"),
    });
  }

  function handleDownload(id) {
    downloadAg(id, {
      onSuccess: (blob) => downloadBlob(blob, `rental-agreement-${id}.pdf`),
      onError: () => toast.error("Download failed"),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Rental Agreements</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-sm btn-primary gap-1">
          <Plus size={14} /> New Agreement
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Landlord</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Landlord Name" value={form.landlordName} onChange={(e) => setForm((f) => ({ ...f, landlordName: e.target.value }))} required className="input input-bordered input-sm" />
            <input type="text" placeholder="Phone" value={form.landlordPhone} onChange={(e) => setForm((f) => ({ ...f, landlordPhone: e.target.value }))} className="input input-bordered input-sm" />
          </div>
          <input type="text" placeholder="Landlord Address" value={form.landlordAddress} onChange={(e) => setForm((f) => ({ ...f, landlordAddress: e.target.value }))} className="input input-bordered input-sm w-full" />

          <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Tenant</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Tenant Name" value={form.tenantName} onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))} required className="input input-bordered input-sm" />
            <input type="text" placeholder="Phone" value={form.tenantPhone} onChange={(e) => setForm((f) => ({ ...f, tenantPhone: e.target.value }))} className="input input-bordered input-sm" />
          </div>
          <input type="text" placeholder="Tenant Address" value={form.tenantAddress} onChange={(e) => setForm((f) => ({ ...f, tenantAddress: e.target.value }))} className="input input-bordered input-sm w-full" />

          <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Property</p>
          <input type="text" placeholder="Property Address" value={form.propertyAddress} onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="select select-bordered select-sm w-full">
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>

          <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Terms</p>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Rent (₹)" value={form.monthlyRent} onChange={(e) => setForm((f) => ({ ...f, monthlyRent: e.target.value }))} required className="input input-bordered input-sm" />
            <input type="number" placeholder="Deposit (₹)" value={form.securityDeposit} onChange={(e) => setForm((f) => ({ ...f, securityDeposit: e.target.value }))} required className="input input-bordered input-sm" />
            <input type="number" placeholder="Duration (months)" value={form.durationMonths} onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))} className="input input-bordered input-sm" />
          </div>
          <input type="date" value={form.leaseStartDate} onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <textarea placeholder="Additional terms (one per line)" value={form.additionalTerms} onChange={(e) => setForm((f) => ({ ...f, additionalTerms: e.target.value }))} rows={3} className="textarea textarea-bordered textarea-sm w-full" />

          <button type="submit" disabled={creating} className="btn btn-primary btn-sm w-full gap-1">
            <FileText size={14} /> {creating ? "Creating..." : "Create Agreement"}
          </button>
        </form>
      )}

      {agreements.length === 0 && !showForm && (
        <div className="text-center py-12">
          <FileText size={40} className="mx-auto text-base-content/15 mb-3" />
          <p className="text-sm text-base-content/50">No rental agreements</p>
          <p className="text-xs text-base-content/40 mt-1">Create a legally formatted agreement for your rental</p>
        </div>
      )}
      {agreements.length > 0 && (
        <div className="space-y-2">
          {agreements.map((ag) => (
            <div key={ag._id} className="rounded-xl border border-base-200 bg-base-100 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{ag.tenantName} — {ag.landlordName}</div>
                <div className="text-xs text-base-content/60">
                  {ag.propertyAddress?.slice(0, 40)}{ag.propertyAddress?.length > 40 ? "..." : ""} · {formatINR(ag.monthlyRent)}/mo
                </div>
                <div className="text-xs text-base-content/40">{formatDate(ag.startDate)} · {ag.durationMonths}mo</div>
              </div>
              <button onClick={() => handleDownload(ag._id)} disabled={downloading} className="btn btn-xs btn-ghost btn-circle">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionTab() {
  const { data: crData } = useMyConditionReports();
  const { mutate: createReport, isPending: creating } = useCreateConditionReport();
  const { mutate: downloadReport, isPending: downloading } = useDownloadConditionReport();
  const [showForm, setShowForm] = useState(false);

  const reports = crData?.reports || crData?.conditionReports || [];

  const [form, setForm] = useState({
    landlordName: "",
    propertyAddress: "",
    reportType: "move_in",
    rooms: [{ name: "Living Room", condition: "good", notes: "" }],
  });

  function addRoom() {
    setForm((f) => ({ ...f, rooms: [...f.rooms, { name: "", condition: "good", notes: "" }] }));
  }

  function updateRoom(i, field, value) {
    setForm((f) => {
      const rooms = [...f.rooms];
      rooms[i] = { ...rooms[i], [field]: value };
      return { ...f, rooms };
    });
  }

  function removeRoom(i) {
    setForm((f) => ({ ...f, rooms: f.rooms.filter((_, idx) => idx !== i) }));
  }

  function handleCreate(e) {
    e.preventDefault();
    createReport(form, {
      onSuccess: () => { toast.success("Condition report created"); setShowForm(false); },
      onError: (err) => toast.error(err.response?.data?.message || "Failed"),
    });
  }

  function handleDownload(id) {
    downloadReport(id, {
      onSuccess: (blob) => downloadBlob(blob, `condition-report-${id}.pdf`),
      onError: () => toast.error("Download failed"),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Condition Reports</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-sm btn-primary gap-1">
          <Plus size={14} /> New Report
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <input type="text" placeholder="Landlord Name" value={form.landlordName} onChange={(e) => setForm((f) => ({ ...f, landlordName: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <input type="text" placeholder="Property Address" value={form.propertyAddress} onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))} required className="input input-bordered input-sm w-full" />
          <select value={form.reportType} onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))} className="select select-bordered select-sm w-full">
            <option value="move_in">Move-in Report</option>
            <option value="move_out">Move-out Report</option>
          </select>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rooms</span>
              <button type="button" onClick={addRoom} className="btn btn-xs btn-ghost gap-1"><Plus size={12} /> Add Room</button>
            </div>
            {form.rooms.map((room, i) => (
              <div key={i} className="rounded-lg border border-base-200 p-3 space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="Room name" value={room.name} onChange={(e) => updateRoom(i, "name", e.target.value)} required className="input input-bordered input-xs flex-1" />
                  <select value={room.condition} onChange={(e) => updateRoom(i, "condition", e.target.value)} className="select select-bordered select-xs">
                    {["excellent", "good", "fair", "poor", "damaged"].map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  {form.rooms.length > 1 && (
                    <button type="button" onClick={() => removeRoom(i)} className="btn btn-xs btn-ghost text-error">Remove</button>
                  )}
                </div>
                <input type="text" placeholder="Notes" value={room.notes} onChange={(e) => updateRoom(i, "notes", e.target.value)} className="input input-bordered input-xs w-full" />
              </div>
            ))}
          </div>

          <button type="submit" disabled={creating} className="btn btn-primary btn-sm w-full gap-1">
            <ClipboardCheck size={14} /> {creating ? "Creating..." : "Create Report"}
          </button>
        </form>
      )}

      {reports.length === 0 && !showForm && (
        <div className="text-center py-12">
          <ClipboardCheck size={40} className="mx-auto text-base-content/15 mb-3" />
          <p className="text-sm text-base-content/50">No condition reports</p>
          <p className="text-xs text-base-content/40 mt-1">Document property condition at move-in or move-out</p>
        </div>
      )}
      {reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r._id} className="rounded-xl border border-base-200 bg-base-100 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{r.propertyAddress?.slice(0, 40)}</div>
                <div className="text-xs text-base-content/60">
                  {r.reportType === "move_in" ? "Move-in" : "Move-out"} · {r.rooms?.length || 0} rooms · {formatDate(r.createdAt)}
                </div>
              </div>
              <button onClick={() => handleDownload(r._id)} disabled={downloading} className="btn btn-xs btn-ghost btn-circle">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
