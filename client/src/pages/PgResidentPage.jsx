import { useState } from "react";
import {
  Building2, UtensilsCrossed, Receipt, AlertTriangle, Star, ArrowRight,
  Clock, CheckCircle2, IndianRupee, FileText, Send, ChevronDown, ChevronUp,
  Wifi, Droplets, Zap, Wrench, ShieldCheck, Volume2, Trash2, ThumbsUp,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import { useMyResidencies, useGenerateFormalNotice } from "../hooks/usePgResidency";
import { useMyBills, useMarkBillPaid } from "../hooks/usePgBills";
import { useMyIssues, useCreateIssue } from "../hooks/useIssueReports";
import { useRateMeal, useDailyMealRatings } from "../hooks/useMealRatings";
import { useCreatePgReview } from "../hooks/usePgReviews";
import {
  formatINR, formatDate, statusBadge, humanStatus,
  REVIEW_CATEGORIES, ISSUE_CATEGORIES, MEAL_TYPES,
} from "../lib/pgHelpers";

function StatCard(props) {
  const { icon: IconComp, label, value, sub, accent } = props;
  return (
    <div className="rounded-xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-base-content/50 mb-1.5 uppercase tracking-wide">
        <IconComp size={14} className={accent || ""} />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-base-content">{value}</div>
      {sub && <div className="text-xs text-base-content/50 mt-1">{sub}</div>}
    </div>
  );
}

function StarInput({ value, onChange, size = 20 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="transition-transform hover:scale-110">
          <Star size={size} className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-base-content/20"} />
        </button>
      ))}
    </div>
  );
}

export default function PgResidentPage() {
  const { data: residencyData, isLoading: loadingRes } = useMyResidencies();
  const { data: billsData } = useMyBills();
  const { data: issuesData } = useMyIssues();

  const residencies = residencyData?.residencies || [];
  const activeResidency = residencies.find((r) => r.status === "active" || r.status === "notice_period");
  const pgId = activeResidency?.pg?._id || activeResidency?.pg;

  const { data: dailyMeals } = useDailyMealRatings(pgId);

  const [tab, setTab] = useState("overview");

  if (loadingRes) {
    return (
      <AppShell hideMobileHeader showBackButton hideHero title="My PG">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="loading loading-spinner loading-lg" />
        </div>
      </AppShell>
    );
  }

  if (!activeResidency) {
    return (
      <AppShell hideMobileHeader showBackButton hideHero title="My PG">
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Building2 size={48} className="mx-auto text-base-content/20 mb-4" />
          <h2 className="text-xl font-bold mb-2">No Active Residency</h2>
          <p className="text-sm text-base-content/60">You don't have an active PG residency yet. Once you move into a PG, your dashboard will appear here.</p>
        </div>
      </AppShell>
    );
  }

  const pgName = activeResidency.pg?.title || "My PG";
  const allBills = billsData?.bills || [];
  const bills = allBills.filter((b) => !b.paid);
  const issues = issuesData?.issues || [];
  const openIssues = issues.filter((i) => i.status !== "resolved" && i.status !== "closed");

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "bills", label: "Bills", icon: Receipt },
    { id: "meals", label: "Meals", icon: UtensilsCrossed },
    { id: "issues", label: "Issues", icon: AlertTriangle },
    { id: "review", label: "Review", icon: Star },
  ];

  return (
    <AppShell hideMobileHeader showBackButton hideHero title={pgName}>
      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{pgName}</h1>
              <p className="text-sm text-base-content/50">
                {activeResidency.pg?.locality}, {activeResidency.pg?.city} · Since {formatDate(activeResidency.moveInDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
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

        {tab === "overview" && (
          <OverviewTab
            residency={activeResidency}
            bills={bills}
            openIssues={openIssues}
            setTab={setTab}
          />
        )}
        {tab === "bills" && <BillsTab bills={allBills} />}
        {tab === "meals" && <MealsTab pgId={pgId} dailyMeals={dailyMeals} />}
        {tab === "issues" && <IssuesTab pgId={pgId} issues={issues} />}
        {tab === "review" && <ReviewTab pgId={pgId} />}
      </div>
    </AppShell>
  );
}

function WelcomeCard({ residency }) {
  const moveIn = new Date(residency.moveInDate);
  const daysSince = Math.floor((Date.now() - moveIn.getTime()) / 86400000);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || daysSince > 7) return null;

  const pg = residency.pg || {};
  const pgMeta = pg.postMeta?.pgHostel || {};
  const wifiSpeed = pgMeta.wifiSpeed || "";
  const rules = pgMeta.houseRules || [];

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 space-y-4 relative">
      <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 btn btn-ghost btn-xs btn-circle">
        <ThumbsUp size={14} />
      </button>
      <div>
        <h3 className="text-lg font-bold">Welcome to {pg.title || "your PG"}! 🎉</h3>
        <p className="text-sm text-base-content/60 mt-1">You moved in {daysSince === 0 ? "today" : `${daysSince} day${daysSince > 1 ? "s" : ""} ago`}. Here's everything you need to settle in.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-base-100 border border-base-200">
          <p className="text-xs text-base-content/50 mb-1">Room Type</p>
          <p className="font-semibold">{residency.roomType || "—"}</p>
        </div>
        <div className="p-3 rounded-lg bg-base-100 border border-base-200">
          <p className="text-xs text-base-content/50 mb-1">Monthly Rent</p>
          <p className="font-semibold">{formatINR(residency.monthlyRent)}</p>
        </div>
        <div className="p-3 rounded-lg bg-base-100 border border-base-200">
          <p className="text-xs text-base-content/50 mb-1">Deposit</p>
          <p className="font-semibold">{formatINR(residency.depositAmount)}</p>
        </div>
        {wifiSpeed && (
          <div className="p-3 rounded-lg bg-base-100 border border-base-200">
            <p className="text-xs text-base-content/50 mb-1 flex items-center gap-1"><Wifi size={10} /> WiFi</p>
            <p className="font-semibold">{wifiSpeed}</p>
          </div>
        )}
      </div>
      {rules.length > 0 && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
            <ShieldCheck size={12} /> House Rules
          </p>
          <ul className="space-y-1">
            {rules.slice(0, 4).map((r, i) => (
              <li key={i} className="text-xs text-base-content/70 flex items-start gap-2">
                <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">{i + 1}.</span> {r}
              </li>
            ))}
            {rules.length > 4 && <li className="text-xs text-base-content/40">+{rules.length - 4} more</li>}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="badge badge-outline badge-sm">Move-in: {formatDate(residency.moveInDate)}</span>
        {pgMeta.foodIncluded && <span className="badge badge-success badge-outline badge-sm">Food Included</span>}
        {pgMeta.lockInPeriodMonths > 0 && <span className="badge badge-outline badge-sm">{pgMeta.lockInPeriodMonths}mo lock-in</span>}
      </div>
    </div>
  );
}

function OverviewTab({ residency, bills, openIssues, setTab }) {
  const { mutate: genNotice, isPending: genPending } = useGenerateFormalNotice();
  const [notice, setNotice] = useState(null);

  const unpaidTotal = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const isMovedOut = residency.status === "moved_out";
  const depositPending = isMovedOut && !residency.depositRefunded;

  return (
    <div className="space-y-4">
      <WelcomeCard residency={residency} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={IndianRupee} label="Monthly Rent" value={formatINR(residency.monthlyRent)} />
        <StatCard icon={IndianRupee} label="Deposit Paid" value={formatINR(residency.depositAmount)} />
        <StatCard
          icon={Receipt}
          label="Unpaid Bills"
          value={bills.length}
          sub={unpaidTotal > 0 ? formatINR(unpaidTotal) : "All clear"}
        />
        <StatCard icon={AlertTriangle} label="Open Issues" value={openIssues.length} />
      </div>

      {bills.length > 0 && (
        <button onClick={() => setTab("bills")} className="w-full flex items-center justify-between p-4 rounded-xl border border-warning/30 bg-warning/5">
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-warning" />
            <div className="text-left">
              <div className="font-medium text-sm">{bills.length} unpaid bill{bills.length > 1 ? "s" : ""}</div>
              <div className="text-xs text-base-content/60">{formatINR(unpaidTotal)} due</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-base-content/40" />
        </button>
      )}

      {depositPending && (
        <div className="p-4 rounded-xl border border-error/30 bg-error/5 space-y-3">
          <div className="flex items-center gap-2 text-error font-medium text-sm">
            <IndianRupee size={16} />
            Deposit refund pending — {formatINR(residency.depositAmount)}
          </div>
          {residency.depositDueDate && (
            <p className="text-xs text-base-content/60">Due by {formatDate(residency.depositDueDate)}</p>
          )}
          <button
            onClick={() => genNotice(residency._id, {
              onSuccess: (data) => { setNotice(data?.notice); toast.success("Formal notice generated"); },
              onError: (err) => toast.error(err.response?.data?.message || "Failed to generate notice"),
            })}
            disabled={genPending}
            className="btn btn-sm btn-error btn-outline gap-1"
          >
            <FileText size={14} />
            {genPending ? "Generating..." : "Generate Formal Notice"}
          </button>
          {notice && (
            <div className="mt-3 p-3 rounded-lg bg-base-200 text-xs whitespace-pre-wrap">
              <p className="font-bold mb-1">FORMAL NOTICE — Deposit Non-Refund</p>
              <p>To: {notice.to}</p>
              <p>Date: {notice.date}</p>
              <p className="mt-2">{notice.message}</p>
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-xl bg-base-200/50 space-y-2">
        <h3 className="font-semibold text-sm">Residency Details</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-base-content/60">Status</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${statusBadge(residency.status)}`}>
            {humanStatus(residency.status)}
          </span>
          <span className="text-base-content/60">Room Type</span>
          <span>{residency.roomType || "—"}</span>
          <span className="text-base-content/60">Move-in</span>
          <span>{formatDate(residency.moveInDate)}</span>
          {residency.moveOutDate && (
            <>
              <span className="text-base-content/60">Move-out</span>
              <span>{formatDate(residency.moveOutDate)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BillsTab({ bills }) {
  const { mutate: markPaid, isPending } = useMarkBillPaid();
  const [expanded, setExpanded] = useState(null);

  if (!bills.length) {
    return <p className="text-center text-base-content/50 py-12">No bills yet</p>;
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => {
        const isOpen = expanded === bill._id;
        return (
          <div key={bill._id} className="rounded-xl border border-base-200 bg-base-100 overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : bill._id)} className="w-full flex items-center justify-between p-4">
              <div className="text-left">
                <div className="font-medium text-sm">
                  {["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][bill.month]} {bill.year}
                </div>
                <div className="text-lg font-bold">{formatINR(bill.totalAmount)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${bill.paid ? statusBadge("paid") : statusBadge("unpaid")}`}>
                  {bill.paid ? "Paid" : "Unpaid"}
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-base-200 pt-3 space-y-2">
                {(bill.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-base-content/70">{item.label}</span>
                    <span className="font-medium">{formatINR(item.amount)}</span>
                  </div>
                ))}
                {bill.electricityUnits > 0 && (
                  <div className="text-xs text-base-content/50 pt-1">
                    <Zap size={12} className="inline mr-1" />
                    {bill.electricityUnits} units × ₹{bill.electricityPerUnit}/unit
                    {bill.splitMethod && ` · ${humanStatus(bill.splitMethod)} split`}
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-base-200 font-bold text-sm">
                  <span>Total</span>
                  <span>{formatINR(bill.totalAmount)}</span>
                </div>
                {!bill.paid && (
                  <button
                    onClick={() => markPaid(bill._id, {
                      onSuccess: () => toast.success("Bill marked as paid"),
                      onError: (err) => toast.error(err.response?.data?.message || "Failed"),
                    })}
                    disabled={isPending}
                    className="btn btn-sm btn-primary w-full mt-2"
                  >
                    <CheckCircle2 size={14} />
                    Mark as Paid
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MealsTab({ pgId, dailyMeals }) {
  const { mutate: rateMeal, isPending } = useRateMeal();
  const [ratings, setRatings] = useState({});

  const today = new Date().toISOString().split("T")[0];
  const existing = dailyMeals?.ratings || [];

  function handleRate(mealType) {
    const rating = ratings[mealType];
    if (!rating || !pgId) return;
    rateMeal(
      { pgId, mealType, rating, date: today },
      {
        onSuccess: () => { toast.success(`${mealType} rated!`); setRatings((p) => ({ ...p, [mealType]: 0 })); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to rate"),
      }
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Rate Today's Meals</h2>
      <div className="space-y-3">
        {MEAL_TYPES.map((meal) => {
          const done = existing.find((e) => e.mealType === meal);
          return (
            <div key={meal} className="rounded-xl border border-base-200 bg-base-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm capitalize">{meal}</span>
                {done && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Rated {done.rating}/5
                  </span>
                )}
              </div>
              {!done && (
                <div className="flex items-center gap-3">
                  <StarInput value={ratings[meal] || 0} onChange={(v) => setRatings((p) => ({ ...p, [meal]: v }))} />
                  <button
                    onClick={() => handleRate(meal)}
                    disabled={!ratings[meal] || isPending}
                    className="btn btn-xs btn-primary"
                  >
                    Rate
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssuesTab({ pgId, issues }) {
  const { mutate: createIssue, isPending } = useCreateIssue();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", category: "other", description: "", priority: "medium" });

  function handleSubmit(e) {
    e.preventDefault();
    if (!pgId) return;
    createIssue(
      { ...form, pgId },
      {
        onSuccess: () => { toast.success("Issue reported"); setShow(false); setForm({ title: "", category: "other", description: "", priority: "medium" }); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed"),
      }
    );
  }

  const iconMap = { wifi: Wifi, water: Droplets, electricity: Zap, maintenance: Wrench, safety: ShieldCheck, noise: Volume2 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Issues</h2>
        <button onClick={() => setShow(!show)} className="btn btn-sm btn-primary gap-1">
          <AlertTriangle size={14} /> Report Issue
        </button>
      </div>

      {show && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-3">
          <input
            type="text"
            placeholder="Issue title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            className="input input-bordered input-sm w-full"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="select select-bordered select-sm"
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="select select-bordered select-sm"
            >
              {["low", "medium", "high", "urgent"].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Describe the issue..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="textarea textarea-bordered textarea-sm w-full"
          />
          <button type="submit" disabled={isPending || !form.title} className="btn btn-sm btn-primary w-full gap-1">
            <Send size={14} /> {isPending ? "Submitting..." : "Submit Issue"}
          </button>
        </form>
      )}

      {issues.length === 0 ? (
        <p className="text-center text-base-content/50 py-8">No issues reported</p>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => {
            const Ic = iconMap[issue.category] || AlertTriangle;
            return (
              <div key={issue._id} className="rounded-xl border border-base-200 bg-base-100 p-4">
                <div className="flex items-start gap-3">
                  <Ic size={18} className="text-base-content/40 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{issue.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadge(issue.status)}`}>
                        {humanStatus(issue.status)}
                      </span>
                    </div>
                    {issue.ownerResponse && (
                      <p className="text-xs text-base-content/60 mt-1 italic">Owner: {issue.ownerResponse}</p>
                    )}
                    <p className="text-xs text-base-content/40 mt-1">{formatDate(issue.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewTab({ pgId }) {
  const { mutate: createReview, isPending } = useCreatePgReview(pgId);
  const [ratings, setRatings] = useState({});
  const [text, setText] = useState("");

  const filled = REVIEW_CATEGORIES.filter((c) => ratings[c.key] > 0).length;

  function handleSubmit(e) {
    e.preventDefault();
    if (filled < 3) return toast.error("Please rate at least 3 categories");
    createReview(
      { categoryRatings: ratings, reviewText: text },
      {
        onSuccess: () => { toast.success("Review submitted!"); setRatings({}); setText(""); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to submit review"),
      }
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Rate Your PG</h2>
      <form onSubmit={handleSubmit} className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-4">
        <div className="space-y-3">
          {REVIEW_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between">
              <span className="text-sm font-medium w-24">{cat.label}</span>
              <StarInput value={ratings[cat.key] || 0} onChange={(v) => setRatings((p) => ({ ...p, [cat.key]: v }))} size={18} />
            </div>
          ))}
        </div>
        <textarea
          placeholder="Write your review (optional)..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="textarea textarea-bordered textarea-sm w-full"
        />
        <button type="submit" disabled={isPending || filled < 3} className="btn btn-primary btn-sm w-full gap-1">
          <Star size={14} /> {isPending ? "Submitting..." : "Submit Review"}
        </button>
        <p className="text-xs text-base-content/50 text-center">{filled}/8 categories rated (min 3)</p>
      </form>
    </div>
  );
}
