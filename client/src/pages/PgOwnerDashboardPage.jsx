import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, Users, IndianRupee, AlertTriangle, Star, UtensilsCrossed,
  Bed, ChevronDown, ChevronUp, Clock, CheckCircle2, Phone, Receipt,
  TrendingUp, TrendingDown, ArrowRight, FileText, Plus, UserRoundPlus, X, Mail,
  LogOut, ShieldAlert, Eye, Settings, DoorOpen, CalendarDays, BarChart3,
} from "lucide-react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import { usePgDashboard, usePgOverview } from "../hooks/usePgDashboard";
import { useCreateBill } from "../hooks/usePgBills";
import { useUpdateIssue } from "../hooks/useIssueReports";
import {
  useRecordDepositRefund, useBookingRequests, useApproveBooking, useRejectBooking,
  usePgResidents, useRegisterMoveOut, useGenerateFormalNotice, useAllBookingRequests,
} from "../hooks/usePgResidency";
import { formatINR, formatDate, statusBadge, humanStatus, ratingBg } from "../lib/pgHelpers";

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-base-content/50 mb-1.5 uppercase tracking-wide">
        <Icon size={14} className={accent || ""} />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-base-content">{value}</div>
      {sub && <div className="text-xs text-base-content/50 mt-1">{sub}</div>}
    </div>
  );
}

export default function PgOwnerDashboardPage() {
  const qc = useQueryClient();
  const authUser = qc.getQueryData(["authUser"])?.data?.user || qc.getQueryData(["authUser"])?.data || null;

  const { data: overviewData, isLoading: loadingOverview, isError: overviewError } = usePgOverview();
  const pgs = overviewData?.overview || [];

  const [selectedPg, setSelectedPg] = useState(null);
  const activePgId = selectedPg || pgs[0]?._id;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: dashData, isLoading: loadingDash } = usePgDashboard(
    { pgId: activePgId, month, year },
    { enabled: Boolean(activePgId) }
  );

  const dash = dashData?.dashboard;
  const [tab, setTab] = useState("overview");

  if (loadingOverview) {
    return (
      <AppShell title="PG Dashboard">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="loading loading-spinner loading-lg" />
        </div>
      </AppShell>
    );
  }

  if (overviewError || pgs.length === 0) {
    return (
      <AppShell title="PG Dashboard">
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Building2 size={48} className="mx-auto text-base-content/20 mb-4" />
          <h2 className="text-xl font-bold mb-2">No PG/Hostel Listings</h2>
          <p className="text-sm text-base-content/60 mb-6">Create a PG/Hostel post to start managing your property. Your occupancy, rent collection, and issue tracking will appear here.</p>
          <Link to="/marketplace?openComposer=1&postType=PG_HOSTEL" className="btn btn-primary btn-sm gap-1"><Plus size={14} /> Create PG Listing</Link>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "requests", label: "Requests", icon: UserRoundPlus },
    { id: "residents", label: "Residents", icon: Users },
    { id: "rent", label: "Rent", icon: IndianRupee },
    { id: "complaints", label: "Issues", icon: AlertTriangle },
    { id: "ratings", label: "Ratings", icon: Star },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "billing", label: "Create Bill", icon: Receipt },
  ];

  return (
    <AppShell title="PG Dashboard">
      <div className="max-w-5xl mx-auto px-4 pb-24">
        {/* Dashboard Header */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 border border-primary/20 p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                <Building2 size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold leading-tight truncate">{pgs.find((p) => p._id === activePgId)?.title || "Dashboard"}</h1>
                <p className="text-sm text-base-content/50">Owner Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* PG Selector */}
              {pgs.length > 1 && (
                <select
                  value={activePgId || ""}
                  onChange={(e) => setSelectedPg(e.target.value)}
                  className="select select-bordered select-sm"
                >
                  {pgs.map((pg) => (
                    <option key={pg._id} value={pg._id}>{pg.title} — {pg.locality}</option>
                  ))}
                </select>
              )}
              {/* Month selector */}
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="select select-bordered select-sm">
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="select select-bordered select-sm">
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                  : "bg-base-200/80 text-base-content/60 hover:bg-base-300 hover:text-base-content"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tabs that fetch their own data — render even if dash hasn't loaded */}
        {tab === "requests" && <BookingRequestsTab pgId={activePgId} />}
        {tab === "residents" && <ResidentsTab pgId={activePgId} />}
        {tab === "billing" && <CreateBillTab pgId={activePgId} />}

        {/* Tabs that depend on the dashboard data */}
        {!["requests", "residents", "billing"].includes(tab) && (
          loadingDash ? (
            <div className="flex justify-center py-12"><div className="loading loading-spinner" /></div>
          ) : !dash ? (
            <p className="text-center text-base-content/50 py-12">No data available</p>
          ) : (
            <>
              {tab === "overview" && <OwnerOverview dash={dash} pgId={activePgId} />}
              {tab === "rent" && <RentTab dash={dash} pgId={activePgId} />}
              {tab === "complaints" && <ComplaintsTab dash={dash} />}
              {tab === "ratings" && <RatingsTab dash={dash} />}
              {tab === "analytics" && <AnalyticsTab dash={dash} />}
            </>
          )
        )}
      </div>
    </AppShell>
  );
}

function OccupancyRing({ percent, size = 90, strokeWidth = 8 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent >= 80 ? "#22c55e" : percent >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-base-200" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="absolute text-lg font-bold">{percent}%</span>
    </div>
  );
}

function OwnerOverview({ dash, pgId }) {
  const v = dash.vacancy || {};
  const r = dash.rentCollection || {};
  const c = dash.complaints?.stats || {};
  const occupancy = v.totalBeds ? Math.round(((v.totalBeds - v.availableBeds) / v.totalBeds) * 100) : 0;
  const collectionRate = r.totalBilled ? Math.round((r.totalCollected / r.totalBilled) * 100) : 0;
  const openIssues = (c.open || 0) + (c.acknowledged || 0) + (c.in_progress || 0);

  return (
    <div className="space-y-5">
      {/* Top row: 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Bed} label="Total Beds" value={v.totalBeds || 0} sub={`${v.availableBeds || 0} available`} accent="text-primary" />
        <StatCard icon={Users} label="Occupancy" value={`${occupancy}%`} sub={`${v.occupiedBeds || 0} occupied`} accent="text-green-600" />
        <StatCard icon={IndianRupee} label="Revenue" value={formatINR(r.totalCollected)} sub={`${collectionRate}% collected`} accent="text-green-600" />
        <StatCard icon={AlertTriangle} label="Open Issues" value={openIssues} sub={c.resolved > 0 ? `${c.resolved} resolved` : "No issues"} accent={openIssues > 0 ? "text-warning" : "text-green-600"} />
      </div>

      {/* Occupancy + Revenue detail row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 flex items-center gap-5">
          <OccupancyRing percent={occupancy} size={100} strokeWidth={9} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wide mb-2">Occupancy Details</h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-base-content/50">Total beds</span>
              <span className="font-semibold text-right">{v.totalBeds || 0}</span>
              <span className="text-base-content/50">Occupied</span>
              <span className="font-semibold text-right text-green-600">{v.occupiedBeds || 0}</span>
              <span className="text-base-content/50">Available</span>
              <span className="font-semibold text-right text-primary">{v.availableBeds || 0}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-base-200 bg-base-100 p-5">
          <h3 className="text-sm font-bold text-base-content/70 uppercase tracking-wide mb-3">Revenue Collection</h3>
          <div className="text-2xl font-extrabold">{formatINR(r.totalCollected)}</div>
          <div className="text-sm text-base-content/50 mt-1">of {formatINR(r.totalBilled)} billed this month</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-base-200 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${collectionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-green-600">{collectionRate}%</span>
          </div>
          {r.pending > 0 && <div className="text-xs text-warning mt-2">⚠ {formatINR(r.pending)} pending</div>}
        </div>
      </div>

      {/* Move activity */}
      {/* Move Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {dash.moveActivity && (
          <>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-green-700 dark:text-green-400">{dash.moveActivity.moveIns}</div>
                <div className="text-xs text-green-600/70">Move-ins (30d)</div>
              </div>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{dash.moveActivity.moveOuts}</div>
                <div className="text-xs text-red-500/70">Move-outs (30d)</div>
              </div>
            </div>
          </>
        )}
        <div className="rounded-xl border border-base-200 bg-base-100 p-4">
          <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wide mb-3">Quick Actions</h3>
          <div className="flex flex-col gap-1.5">
            <Link to={`/property/${pgId}`} className="btn btn-sm btn-ghost justify-start gap-2 text-xs font-medium">
              <Eye size={14} className="text-primary" /> View Listing
            </Link>
            <Link to={`/property/${pgId}`} className="btn btn-sm btn-ghost justify-start gap-2 text-xs font-medium">
              <Settings size={14} className="text-base-content/50" /> Edit PG Details
            </Link>
          </div>
        </div>
      </div>

      {/* Pending deposits */}
      {dash.pendingDeposits?.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <IndianRupee size={14} className="text-warning" /> Pending Deposit Refunds
          </h3>
          {dash.pendingDeposits.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{d.tenant?.fullName || "Tenant"}</span>
              <div className="text-right">
                <div className="font-medium">{formatINR(d.depositAmount)}</div>
                <div className="text-xs text-base-content/50">Due {formatDate(d.depositDueDate)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ratings snapshot */}
      {dash.ratings && (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Star size={14} className="text-yellow-500" /> Ratings</h3>
          <div className="flex items-center gap-4">
            <div className={`text-3xl font-bold px-4 py-2 rounded-xl ${ratingBg(dash.ratings.avgOverall)}`}>
              {(dash.ratings.avgOverall || 0).toFixed(1)}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} className={s <= Math.round(dash.ratings.avgOverall || 0) ? "fill-yellow-400 text-yellow-400" : "text-base-300"} />
                ))}
              </div>
              <div className="text-sm text-base-content/60 mt-0.5">{dash.ratings.reviewCount || 0} reviews</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RentTab({ dash, pgId }) {
  const r = dash.rentCollection || {};
  const { mutate: refundDeposit, isPending } = useRecordDepositRefund();
  const [refundForm, setRefundForm] = useState(null);

  const collectionRate = r.totalBilled ? Math.round((r.totalCollected / r.totalBilled) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={IndianRupee} label="Total Billed" value={formatINR(r.totalBilled)} />
        <StatCard icon={CheckCircle2} label="Collected" value={formatINR(r.totalCollected)} sub={`${collectionRate}% rate`} />
      </div>

      {r.pendingAmount > 0 && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-4">
          <h3 className="font-semibold text-sm text-error mb-2">Pending — {formatINR(r.pendingAmount)}</h3>
          <div className="space-y-2">
            {(r.unpaid || []).map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-base-content/40" />
                  <span>{u.tenant?.fullName || "Tenant"}</span>
                </div>
                <span className="font-medium text-error">{formatINR(u.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposit refunds */}
      {dash.pendingDeposits?.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Deposit Refunds Due</h3>
          {dash.pendingDeposits.map((d, i) => (
            <div key={i} className="rounded-xl border border-base-200 bg-base-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-sm">{d.tenant?.fullName}</span>
                  {d.tenant?.phone && (
                    <span className="text-xs text-base-content/50 ml-2 flex items-center gap-1 inline-flex">
                      <Phone size={10} /> {d.tenant.phone}
                    </span>
                  )}
                </div>
                <span className="font-bold text-sm">{formatINR(d.depositAmount)}</span>
              </div>
              {refundForm === i ? (
                <RefundForm
                  residencyId={d._id}
                  maxAmount={d.depositAmount}
                  isPending={isPending}
                  onSubmit={(body) =>
                    refundDeposit(body, {
                      onSuccess: () => { toast.success("Deposit refund recorded"); setRefundForm(null); },
                      onError: (err) => toast.error(err.response?.data?.message || "Failed"),
                    })
                  }
                  onCancel={() => setRefundForm(null)}
                />
              ) : (
                <button onClick={() => setRefundForm(i)} className="btn btn-xs btn-outline gap-1">
                  <IndianRupee size={12} /> Record Refund
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RefundForm({ residencyId, maxAmount, isPending, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(maxAmount);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-2 pt-2 border-t border-base-200 mt-2">
      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={0}
          max={maxAmount}
          className="input input-bordered input-xs flex-1"
          placeholder="Refund amount"
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="input input-bordered input-xs w-full"
        placeholder="Notes (e.g., deductions)"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ residencyId, refundAmount: amount, notes })}
          disabled={isPending || amount <= 0}
          className="btn btn-xs btn-primary flex-1"
        >
          {isPending ? "Saving..." : "Confirm Refund"}
        </button>
        <button onClick={onCancel} className="btn btn-xs btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function ComplaintsTab({ dash }) {
  const { mutate: updateIssue, isPending } = useUpdateIssue();
  const stats = dash.complaints?.stats || {};
  const issues = dash.complaints?.openIssues || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {["open", "in_progress", "resolved"].map((s) => (
          <div key={s} className="rounded-xl bg-base-200/50 p-3 text-center">
            <div className="text-lg font-bold">{stats[s] || 0}</div>
            <div className="text-xs text-base-content/60">{humanStatus(s)}</div>
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-sm">Open Issues ({issues.length})</h3>
      {issues.length === 0 ? (
        <p className="text-center text-base-content/50 py-8 text-sm">No open issues</p>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div key={issue._id} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-sm">{issue.title}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadge(issue.status)}`}>
                      {humanStatus(issue.status)}
                    </span>
                    <span className="text-xs text-base-content/50">{issue.category}</span>
                  </div>
                </div>
                <span className="text-xs text-base-content/40">{formatDate(issue.createdAt)}</span>
              </div>
              <div className="flex gap-2">
                {issue.status === "open" && (
                  <button
                    onClick={() => updateIssue({ issueId: issue._id, status: "acknowledged" }, {
                      onSuccess: () => toast.success("Issue acknowledged"),
                    })}
                    disabled={isPending}
                    className="btn btn-xs btn-outline"
                  >
                    Acknowledge
                  </button>
                )}
                {(issue.status === "open" || issue.status === "acknowledged") && (
                  <button
                    onClick={() => updateIssue({ issueId: issue._id, status: "in_progress" }, {
                      onSuccess: () => toast.success("Marked in progress"),
                    })}
                    disabled={isPending}
                    className="btn btn-xs btn-outline btn-info"
                  >
                    In Progress
                  </button>
                )}
                {issue.status !== "resolved" && issue.status !== "closed" && (
                  <button
                    onClick={() => updateIssue({ issueId: issue._id, status: "resolved" }, {
                      onSuccess: () => toast.success("Issue resolved"),
                    })}
                    disabled={isPending}
                    className="btn btn-xs btn-success btn-outline"
                  >
                    <CheckCircle2 size={12} /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingsTab({ dash }) {
  const ratings = dash.ratings;
  const food = dash.foodRatings || [];

  const categories = [
    { key: "avgFood", label: "Food" },
    { key: "avgCleanliness", label: "Cleanliness" },
    { key: "avgWifi", label: "WiFi" },
    { key: "avgWater", label: "Water" },
    { key: "avgSafety", label: "Safety" },
    { key: "avgLandlord", label: "Landlord" },
    { key: "avgValue", label: "Value" },
    { key: "avgLocation", label: "Location" },
  ];

  return (
    <div className="space-y-4">
      {ratings ? (
        <>
          <div className="rounded-xl border border-base-200 bg-base-100 p-4 text-center">
            <div className={`text-4xl font-bold inline-block px-4 py-2 rounded-xl ${ratingBg(ratings.avgOverall)}`}>
              {(ratings.avgOverall || 0).toFixed(1)}
            </div>
            <p className="text-sm text-base-content/60 mt-2">{ratings.reviewCount} total reviews</p>
          </div>

          <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Category Breakdown</h3>
            {categories.map((cat) => {
              const val = ratings[cat.key] || 0;
              return (
                <div key={cat.key} className="flex items-center gap-3">
                  <span className="text-sm w-24 text-base-content/70">{cat.label}</span>
                  <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${val >= 4 ? "bg-green-500" : val >= 3 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${(val / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{val.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-center text-base-content/50 py-8">No reviews yet</p>
      )}

      {food.length > 0 && (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UtensilsCrossed size={14} /> Food Ratings (30-day)
          </h3>
          {food.map((f) => (
            <div key={f._id} className="flex items-center justify-between text-sm">
              <span className="capitalize">{f._id}</span>
              <div className="flex items-center gap-2">
                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{(f.avgRating || 0).toFixed(1)}</span>
                <span className="text-xs text-base-content/40">({f.count} ratings)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateBillTab({ pgId }) {
  const { mutate: createBill, isPending } = useCreateBill();
  const [form, setForm] = useState({
    tenantId: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    items: [{ label: "Room Rent", amount: "" }],
    electricityUnits: "",
    electricityPerUnit: "",
    splitMethod: "equal",
    notes: "",
  });

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { label: "", amount: "" }] }));
  }

  function removeItem(i) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }

  function updateItem(i, field, value) {
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  }

  const total = form.items.reduce((s, item) => s + (Number(item.amount) || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.tenantId) return toast.error("Enter tenant ID");
    const body = {
      pgId,
      tenantId: form.tenantId,
      month: form.month,
      year: form.year,
      items: form.items.filter((it) => it.label && it.amount).map((it) => ({ label: it.label, amount: Number(it.amount) })),
      splitMethod: form.splitMethod,
    };
    if (form.electricityUnits) body.electricityUnits = Number(form.electricityUnits);
    if (form.electricityPerUnit) body.electricityPerUnit = Number(form.electricityPerUnit);
    if (form.notes) body.notes = form.notes;

    createBill(body, {
      onSuccess: () => {
        toast.success("Bill created");
        setForm((f) => ({ ...f, tenantId: "", items: [{ label: "Room Rent", amount: "" }], notes: "" }));
      },
      onError: (err) => toast.error(err.response?.data?.message || "Failed to create bill"),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="font-semibold">Create Monthly Bill</h2>

      <input
        type="text"
        placeholder="Tenant ID"
        value={form.tenantId}
        onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
        required
        className="input input-bordered input-sm w-full"
      />

      <div className="flex gap-2">
        <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))} className="select select-bordered select-sm flex-1">
          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} className="select select-bordered select-sm">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Line Items</span>
          <button type="button" onClick={addItem} className="btn btn-xs btn-ghost gap-1"><Plus size={12} /> Add</button>
        </div>
        {form.items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Label"
              value={item.label}
              onChange={(e) => updateItem(i, "label", e.target.value)}
              className="input input-bordered input-xs flex-1"
            />
            <input
              type="number"
              placeholder="Amount"
              value={item.amount}
              onChange={(e) => updateItem(i, "amount", e.target.value)}
              className="input input-bordered input-xs w-24"
            />
            {form.items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} className="btn btn-xs btn-ghost btn-circle text-error">
                <FileText size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Electricity units"
          value={form.electricityUnits}
          onChange={(e) => setForm((f) => ({ ...f, electricityUnits: e.target.value }))}
          className="input input-bordered input-xs"
        />
        <input
          type="number"
          placeholder="₹/unit"
          value={form.electricityPerUnit}
          onChange={(e) => setForm((f) => ({ ...f, electricityPerUnit: e.target.value }))}
          className="input input-bordered input-xs"
        />
      </div>

      <select
        value={form.splitMethod}
        onChange={(e) => setForm((f) => ({ ...f, splitMethod: e.target.value }))}
        className="select select-bordered select-xs w-full"
      >
        <option value="equal">Equal Split</option>
        <option value="per_meter">Per Meter</option>
        <option value="usage_based">Usage Based</option>
        <option value="fixed">Fixed</option>
      </select>

      <textarea
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={2}
        className="textarea textarea-bordered textarea-xs w-full"
      />

      <div className="text-right font-bold text-lg">{formatINR(total)}</div>

      <button type="submit" disabled={isPending} className="btn btn-primary btn-sm w-full gap-1">
        <Receipt size={14} /> {isPending ? "Creating..." : "Create Bill"}
      </button>
    </form>
  );
}

function ResidentsTab({ pgId }) {
  const [statusFilter, setStatusFilter] = useState("active");
  const { data: residentsData, isLoading } = usePgResidents(pgId, { status: statusFilter });
  const residents = residentsData?.residents || [];
  const { mutate: moveOut, isPending: movingOut } = useRegisterMoveOut();
  const { mutate: generateNotice } = useGenerateFormalNotice();
  const [expandedId, setExpandedId] = useState(null);

  const statusFilters = [
    { value: "active", label: "Active", color: "bg-green-500" },
    { value: "notice_period", label: "Notice", color: "bg-yellow-500" },
    { value: "moved_out", label: "Moved Out", color: "bg-base-300" },
  ];

  function handleMoveOut(residencyId) {
    if (!confirm("Mark this resident as moved out?")) return;
    moveOut(
      { residencyId, actualMoveOutDate: new Date().toISOString() },
      {
        onSuccess: () => toast.success("Resident moved out"),
        onError: (err) => toast.error(err.response?.data?.message || "Failed"),
      }
    );
  }

  function handleNotice(residencyId) {
    generateNotice(residencyId, {
      onSuccess: (data) => {
        toast.success("Formal notice generated");
        if (data?.noticeUrl) window.open(data.noticeUrl, "_blank");
      },
      onError: (err) => toast.error(err.response?.data?.message || "Failed to generate notice"),
    });
  }

  if (isLoading) return <div className="flex justify-center py-12"><div className="loading loading-spinner" /></div>;

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-2">
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setStatusFilter(sf.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === sf.value
                ? "bg-primary text-primary-content"
                : "bg-base-200/80 text-base-content/60 hover:bg-base-300"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sf.color}`} />
            {sf.label}
          </button>
        ))}
      </div>

      {residents.length === 0 ? (
        <div className="text-center py-12">
          <Users size={40} className="mx-auto text-base-content/15 mb-3" />
          <p className="text-sm text-base-content/50">No {statusFilter.replace("_", " ")} residents</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-base-content/50 font-medium">{residents.length} resident{residents.length !== 1 ? "s" : ""}</p>
          {residents.map((res) => {
            const isExpanded = expandedId === res._id;
            return (
              <div key={res._id} className="rounded-xl border border-base-200 bg-base-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : res._id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-base-50 transition-colors"
                >
                  {res.tenant?.profilePic ? (
                    <img src={res.tenant.profilePic} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users size={16} className="text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{res.tenant?.fullName || "Tenant"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-base-content/50">{res.roomType}</span>
                      <span className="text-xs font-medium">₹{res.monthlyRent?.toLocaleString("en-IN")}/mo</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadge(res.status)}`}>
                      {humanStatus(res.status)}
                    </span>
                    <ChevronDown size={14} className={`mt-1 mx-auto text-base-content/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-base-200">
                    <div className="grid grid-cols-2 gap-y-2 text-sm pt-3">
                      {res.moveInDate && (
                        <>
                          <span className="text-base-content/50 flex items-center gap-1"><DoorOpen size={12} /> Move-in</span>
                          <span className="text-right font-medium">{formatDate(res.moveInDate)}</span>
                        </>
                      )}
                      {res.depositAmount != null && (
                        <>
                          <span className="text-base-content/50">Deposit</span>
                          <span className="text-right font-medium">{formatINR(res.depositAmount)}</span>
                        </>
                      )}
                      {res.lockInEndDate && (
                        <>
                          <span className="text-base-content/50">Lock-in ends</span>
                          <span className="text-right font-medium">{formatDate(res.lockInEndDate)}</span>
                        </>
                      )}
                      {res.tenant?.phone && (
                        <>
                          <span className="text-base-content/50 flex items-center gap-1"><Phone size={12} /> Phone</span>
                          <span className="text-right font-medium">{res.tenant.phone}</span>
                        </>
                      )}
                      {res.tenant?.email && (
                        <>
                          <span className="text-base-content/50 flex items-center gap-1"><Mail size={12} /> Email</span>
                          <span className="text-right font-medium text-xs">{res.tenant.email}</span>
                        </>
                      )}
                    </div>

                    {res.status === "active" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleMoveOut(res._id)}
                          disabled={movingOut}
                          className="btn btn-xs btn-outline gap-1"
                        >
                          <LogOut size={12} /> Move Out
                        </button>
                        <button
                          onClick={() => handleNotice(res._id)}
                          className="btn btn-xs btn-outline btn-warning gap-1"
                        >
                          <ShieldAlert size={12} /> Notice
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingRequestsTab({ pgId }) {
  const { data: pendingRequests = [], isLoading: loadingPending } = useBookingRequests(pgId);
  const { data: allRequests = [], isLoading: loadingAll } = useAllBookingRequests(pgId);
  const { mutate: approve, isPending: approving } = useApproveBooking();
  const { mutate: reject, isPending: rejecting } = useRejectBooking();
  const [actionModal, setActionModal] = useState(null);
  const [note, setNote] = useState("");
  const [assignedRoom, setAssignedRoom] = useState("");
  const [assignedBed, setAssignedBed] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  function openApproveModal(req) {
    setNote("");
    setAssignedRoom("");
    setAssignedBed("");
    setMoveInDate(req.preferredMoveInDate ? new Date(req.preferredMoveInDate).toISOString().split("T")[0] : "");
    setActionModal({ type: "approve", req });
  }

  function openRejectModal(req) {
    setRejectReason("");
    setActionModal({ type: "reject", req });
  }

  function confirmApprove() {
    const req = actionModal.req;
    approve(
      {
        residencyId: req._id,
        note,
        assignedRoom,
        assignedBed,
        ...(moveInDate ? { moveInDate: new Date(moveInDate).toISOString() } : {}),
      },
      {
        onSuccess: () => { toast.success("Booking approved — tenant is now a resident"); setActionModal(null); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to approve"),
      }
    );
  }

  function confirmReject() {
    const req = actionModal.req;
    reject(
      { residencyId: req._id, note: rejectReason },
      {
        onSuccess: () => { toast.success("Booking request declined"); setActionModal(null); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to reject"),
      }
    );
  }

  const isLoading = loadingPending || loadingAll;
  if (isLoading) return <div className="flex justify-center py-12"><div className="loading loading-spinner" /></div>;

  const pastRequests = allRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      {/* Pending requests */}
      <h3 className="text-sm font-semibold text-base-content/70">
        Pending Requests ({pendingRequests.length})
      </h3>
      {pendingRequests.length === 0 ? (
        <div className="text-center py-8">
          <UserRoundPlus size={36} className="mx-auto text-base-content/15 mb-2" />
          <p className="text-sm text-base-content/50">No pending booking requests</p>
          <p className="text-xs text-base-content/40 mt-1">When someone requests to join your PG, it will appear here</p>
        </div>
      ) : (
        pendingRequests.map((req) => (
          <RequestCard
            key={req._id}
            req={req}
            onApprove={() => openApproveModal(req)}
            onReject={() => openRejectModal(req)}
            busy={approving || rejecting}
          />
        ))
      )}

      {/* Request history toggle */}
      {pastRequests.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn btn-sm btn-ghost gap-1 text-base-content/60"
          >
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Request History ({pastRequests.length})
          </button>
          {showHistory && (
            <div className="space-y-2 mt-2">
              {pastRequests.map((req) => (
                <div key={req._id} className="rounded-xl border border-base-200 bg-base-100 p-3 flex items-center gap-3">
                  {req.tenant?.profilePic ? (
                    <img src={req.tenant.profilePic} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
                      <Users size={14} className="text-base-content/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{req.tenant?.fullName || "Unknown"}</p>
                    <p className="text-xs text-base-content/50">{req.roomType} · ₹{req.monthlyRent?.toLocaleString("en-IN")}/mo</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    req.status === "active" ? "bg-success/15 text-success" :
                    req.status === "approved" ? "bg-primary/15 text-primary" :
                    req.status === "rejected" ? "bg-error/15 text-error" :
                    "bg-base-200 text-base-content/60"
                  }`}>
                    {req.status === "active" ? "Active" : req.status === "approved" ? "Approved" : req.status === "rejected" ? "Declined" : req.status}
                  </span>
                  <span className="text-[10px] text-base-content/40">{formatDate(req.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve confirmation modal */}
      {actionModal?.type === "approve" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setActionModal(null)}>
          <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-success flex items-center gap-2">
                <CheckCircle2 size={20} /> Approve Booking
              </h3>
              <button onClick={() => setActionModal(null)} className="btn btn-sm btn-ghost btn-circle"><X size={16} /></button>
            </div>

            <div className="rounded-lg bg-base-200/50 p-3">
              <p className="text-sm font-semibold">{actionModal.req.tenant?.fullName}</p>
              <p className="text-xs text-base-content/60 mt-0.5">
                {actionModal.req.roomType} · ₹{actionModal.req.monthlyRent?.toLocaleString("en-IN")}/mo · Deposit ₹{actionModal.req.depositAmount?.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-base-content/70">Move-in Date</span>
                <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="input input-bordered input-sm w-full mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-base-content/70">Room Number</span>
                  <input type="text" value={assignedRoom} onChange={(e) => setAssignedRoom(e.target.value)} placeholder="e.g. 204" className="input input-bordered input-sm w-full mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-base-content/70">Bed Number</span>
                  <input type="text" value={assignedBed} onChange={(e) => setAssignedBed(e.target.value)} placeholder="e.g. B2" className="input input-bordered input-sm w-full mt-1" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-base-content/70">Note to Tenant (optional)</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Welcome message or instructions..." className="textarea textarea-bordered textarea-sm w-full mt-1" />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setActionModal(null)} className="btn btn-sm btn-ghost flex-1">Cancel</button>
              <button onClick={confirmApprove} disabled={approving} className="btn btn-sm btn-success flex-1 gap-1">
                {approving ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle2 size={14} />}
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation modal */}
      {actionModal?.type === "reject" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setActionModal(null)}>
          <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-error flex items-center gap-2">
                <ShieldAlert size={20} /> Decline Booking
              </h3>
              <button onClick={() => setActionModal(null)} className="btn btn-sm btn-ghost btn-circle"><X size={16} /></button>
            </div>

            <div className="rounded-lg bg-base-200/50 p-3">
              <p className="text-sm font-semibold">{actionModal.req.tenant?.fullName}</p>
              <p className="text-xs text-base-content/60 mt-0.5">
                {actionModal.req.roomType} · ₹{actionModal.req.monthlyRent?.toLocaleString("en-IN")}/mo
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-base-content/70">Reason for declining (optional but recommended)</span>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} rows={3} placeholder="e.g. No beds available for this room type, try again next month..." className="textarea textarea-bordered textarea-sm w-full mt-1" />
            </label>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setActionModal(null)} className="btn btn-sm btn-ghost flex-1">Cancel</button>
              <button onClick={confirmReject} disabled={rejecting} className="btn btn-sm btn-error flex-1 gap-1">
                {rejecting ? <span className="loading loading-spinner loading-xs" /> : <X size={14} />}
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, onApprove, onReject, busy }) {
  const whatsappUrl = req.tenant?.phone
    ? `https://wa.me/${req.tenant.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${req.tenant.fullName}, regarding your PG booking request...`)}`
    : null;

  return (
    <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        {req.tenant?.profilePic ? (
          <img src={req.tenant.profilePic} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users size={18} className="text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{req.tenant?.fullName || "Unknown"}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs bg-base-200 rounded-full px-2 py-0.5">{req.roomType}</span>
            <span className="text-xs text-base-content/50">
              ₹{req.monthlyRent?.toLocaleString("en-IN")}/mo
            </span>
          </div>
          {req.preferredMoveInDate && (
            <p className="text-xs text-base-content/50 mt-1">
              <Clock size={11} className="inline mr-1" />
              Wants to move in: {formatDate(req.preferredMoveInDate)}
            </p>
          )}
          {req.tenantMessage && (
            <div className="mt-2 rounded-lg bg-base-200/50 p-2.5">
              <p className="text-xs text-base-content/70 italic">&ldquo;{req.tenantMessage}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-base-content/40">
        {req.tenant?.phone && (
          <span className="flex items-center gap-1"><Phone size={11} /> {req.tenant.phone}</span>
        )}
        {req.tenant?.email && (
          <span className="flex items-center gap-1"><Mail size={11} /> {req.tenant.email}</span>
        )}
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:underline">WhatsApp</a>
        )}
        {req.tenant?.phone && (
          <a href={`tel:${req.tenant.phone}`} className="text-primary font-medium hover:underline">Call</a>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onApprove} disabled={busy} className="btn btn-sm btn-success flex-1 gap-1">
          <CheckCircle2 size={14} /> Approve
        </button>
        <button onClick={onReject} disabled={busy} className="btn btn-sm btn-outline btn-error flex-1 gap-1">
          <X size={14} /> Decline
        </button>
      </div>
    </div>
  );
}

function AnalyticsTab({ dash }) {
  const r = dash.rentCollection || {};
  const v = dash.vacancy || {};
  const c = dash.complaints?.stats || {};
  const ratings = dash.ratings || {};

  const collectionRate = r.totalBilled ? Math.round((r.totalCollected / r.totalBilled) * 100) : 0;
  const occupancy = v.totalBeds ? Math.round(((v.totalBeds - (v.availableBeds || 0)) / v.totalBeds) * 100) : 0;

  const totalIssues = (c.open || 0) + (c.acknowledged || 0) + (c.in_progress || 0) + (c.resolved || 0) + (c.closed || 0);
  const resolvedPct = totalIssues > 0 ? Math.round(((c.resolved || 0) + (c.closed || 0)) / totalIssues * 100) : 0;
  const avgResTime = dash.complaints?.avgResolutionHours || null;

  const sharingRevenue = (r.byRoomType || []).length > 0 ? r.byRoomType : null;

  const ratingCats = [
    { key: "food", label: "Food" }, { key: "cleanliness", label: "Cleanliness" },
    { key: "wifi", label: "WiFi" }, { key: "safety", label: "Safety" },
    { key: "water", label: "Water" }, { key: "landlord", label: "Landlord" },
    { key: "value_for_money", label: "Value" }, { key: "location", label: "Location" },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold text-base-content/50 uppercase tracking-wide">Performance Analytics</h3>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-base-200 bg-base-100 p-4">
          <div className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <IndianRupee size={12} /> Revenue
          </div>
          <div className="text-2xl font-bold">{formatINR(r.totalCollected)}</div>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${collectionRate}%` }} />
            </div>
            <span className="text-xs font-semibold">{collectionRate}%</span>
          </div>
          <p className="text-xs text-base-content/40 mt-1">{formatINR(r.pendingAmount || 0)} pending</p>
        </div>

        <div className="rounded-xl border border-base-200 bg-base-100 p-4">
          <div className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Bed size={12} /> Occupancy
          </div>
          <div className="text-2xl font-bold">{occupancy}%</div>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full ${occupancy >= 80 ? "bg-green-500" : occupancy >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${occupancy}%` }} />
            </div>
          </div>
          <p className="text-xs text-base-content/40 mt-1">{v.availableBeds || 0} of {v.totalBeds || 0} beds free</p>
        </div>
      </div>

      {/* Issue Resolution Metrics */}
      <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
        <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide flex items-center gap-1.5">
          <AlertTriangle size={12} /> Issue Resolution
        </h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold">{totalIssues}</div>
            <div className="text-xs text-base-content/50">Total</div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-600">{resolvedPct}%</div>
            <div className="text-xs text-base-content/50">Resolved</div>
          </div>
          <div>
            <div className="text-xl font-bold">{avgResTime ? `${avgResTime}h` : "—"}</div>
            <div className="text-xs text-base-content/50">Avg Time</div>
          </div>
        </div>
        {totalIssues > 0 && (
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-base-200">
            {c.resolved > 0 && <div className="bg-green-500 h-full" style={{ width: `${((c.resolved || 0) / totalIssues) * 100}%` }} />}
            {c.closed > 0 && <div className="bg-green-300 h-full" style={{ width: `${((c.closed || 0) / totalIssues) * 100}%` }} />}
            {c.in_progress > 0 && <div className="bg-yellow-400 h-full" style={{ width: `${((c.in_progress || 0) / totalIssues) * 100}%` }} />}
            {c.acknowledged > 0 && <div className="bg-blue-400 h-full" style={{ width: `${((c.acknowledged || 0) / totalIssues) * 100}%` }} />}
            {c.open > 0 && <div className="bg-red-400 h-full" style={{ width: `${((c.open || 0) / totalIssues) * 100}%` }} />}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-base-content/50">
          {c.resolved > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Resolved {c.resolved}</span>}
          {c.in_progress > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> In Progress {c.in_progress}</span>}
          {c.open > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Open {c.open}</span>}
        </div>
      </div>

      {/* Bed-wise Revenue */}
      {sharingRevenue && (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide flex items-center gap-1.5">
            <Bed size={12} /> Revenue by Room Type
          </h4>
          {sharingRevenue.map((item) => {
            const maxRev = Math.max(...sharingRevenue.map((s) => s.collected || 0), 1);
            return (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{item.type} Sharing</span>
                  <span className="font-semibold">{formatINR(item.collected)}</span>
                </div>
                <div className="h-2 bg-base-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${((item.collected || 0) / maxRev) * 100}%` }} />
                </div>
                <div className="text-xs text-base-content/40">{item.residents || 0} residents · {formatINR(item.billed)} billed</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Satisfaction Breakdown */}
      {ratings.avgOverall > 0 && (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide flex items-center gap-1.5">
            <Star size={12} className="text-yellow-500" /> Satisfaction Breakdown
          </h4>
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-3xl font-bold px-3 py-1.5 rounded-xl ${ratingBg(ratings.avgOverall)}`}>
              {(ratings.avgOverall || 0).toFixed(1)}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} className={s <= Math.round(ratings.avgOverall || 0) ? "fill-yellow-400 text-yellow-400" : "text-base-300"} />
                ))}
              </div>
              <div className="text-sm text-base-content/60">{ratings.reviewCount || 0} reviews</div>
            </div>
          </div>
          <div className="space-y-2">
            {ratingCats.map((cat) => {
              const val = ratings.breakdown?.[cat.key] || ratings[cat.key] || 0;
              return (
                <div key={cat.key} className="flex items-center gap-2">
                  <span className="text-xs w-20 text-base-content/60">{cat.label}</span>
                  <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${val >= 4 ? "bg-green-500" : val >= 3 ? "bg-yellow-500" : val > 0 ? "bg-red-500" : "bg-base-300"}`}
                      style={{ width: `${(val / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-6 text-right">{val > 0 ? val.toFixed(1) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Move Activity */}
      {dash.moveActivity && (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-2">
          <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wide flex items-center gap-1.5">
            <DoorOpen size={12} /> Move Activity (30 days)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <TrendingUp size={16} className="mx-auto text-green-600 mb-1" />
              <div className="text-xl font-bold text-green-700 dark:text-green-400">{dash.moveActivity.moveIns}</div>
              <div className="text-xs text-green-600/70">Move-ins</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <TrendingDown size={16} className="mx-auto text-red-500 mb-1" />
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{dash.moveActivity.moveOuts}</div>
              <div className="text-xs text-red-500/70">Move-outs</div>
            </div>
          </div>
          {(dash.moveActivity.moveIns - dash.moveActivity.moveOuts) !== 0 && (
            <p className="text-xs text-center text-base-content/50">
              Net: {dash.moveActivity.moveIns - dash.moveActivity.moveOuts > 0 ? "+" : ""}
              {dash.moveActivity.moveIns - dash.moveActivity.moveOuts} residents
            </p>
          )}
        </div>
      )}
    </div>
  );
}
