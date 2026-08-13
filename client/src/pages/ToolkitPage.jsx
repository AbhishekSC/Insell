import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, BellRing, Calculator, Crown, Download, IndianRupee, MessageSquare, ShieldCheck, Users, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { defaultChallenges, useLocalStorageState } from "../lib/dashboardMvp";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function buildUpiLink({ upiId, payeeName, amount, note }) {
  if (!upiId) return "";
  const params = new URLSearchParams({
    pa: String(upiId).trim(),
    pn: String(payeeName || "Trip Partner").trim(),
    am: String(Number(amount || 0).toFixed(2)),
    cu: "INR",
    tn: String(note || "Trip settlement").trim(),
  });
  return `upi://pay?${params.toString()}`;
}

export default function ToolkitPage() {
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users");
      return response.data?.data?.users || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const [tripNotes, setTripNotes] = useLocalStorageState("syncspace_trip_notes", []);
  const [safetySettings, setSafetySettings] = useLocalStorageState("syncspace_safety", {
    verifiedOnly: false,
    hideLocation: false,
    strictMode: true,
  });
  const [blockedUserIds, setBlockedUserIds] = useLocalStorageState("syncspace_blocked", []);
  const [, setChallengeProgress] = useLocalStorageState("syncspace_challenges", defaultChallenges());

  const [vocabForm, setVocabForm] = useState({
    term: "",
    meaning: "",
    example: "",
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    memberIds: [],
  });
  const [inviteMemberId, setInviteMemberId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    paidBy: "me",
    splitBetween: 2,
    category: "other",
    splitType: "equal",
    receipt: null,
  });
  const [customSplitValues, setCustomSplitValues] = useState({});
  const [budgetSettings, setBudgetSettings] = useState({
    budgetLimit: 0,
    budgetAlertThresholds: "50,80,100",
    reminderEnabled: true,
  });
  const [settlementForm, setSettlementForm] = useState({
    fromUser: "",
    toUser: "",
    amount: "",
    note: "",
    paymentMethod: "upi",
    payeeUpiId: "",
    paymentReference: "",
  });
  const [editingExpense, setEditingExpense] = useState(null);
  const [historyExpense, setHistoryExpense] = useState(null);
  const [historyOnlyWithReason, setHistoryOnlyWithReason] = useState(false);
  const [historyOnlyByMe, setHistoryOnlyByMe] = useState(false);
  const [editExpenseForm, setEditExpenseForm] = useState({
    title: "",
    amount: "",
    paidBy: "",
    splitBetween: 2,
    category: "other",
    splitType: "equal",
    reason: "",
    receipt: null,
  });
  const [editSplitValues, setEditSplitValues] = useState({});
  const [offlineExpenseDrafts, setOfflineExpenseDrafts] = useLocalStorageState("syncspace_offline_expense_drafts", []);
  const [budgetForm, setBudgetForm] = useState({
    days: 5,
    travelers: 2,
    dailySpendPerPerson: 70,
    stayPerNight: 80,
    transportTotal: 180,
    activitiesTotal: 120,
  });
  const [activeTool, setActiveTool] = useState("expenses");
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [showBudgetToolsModal, setShowBudgetToolsModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  const { data: workspaceData } = useQuery({
    queryKey: ["expenseWorkspaces"],
    queryFn: async () => {
      const response = await axiosInstance.get("/expenses/workspaces");
      return response.data?.data || {};
    },
    enabled: Boolean(authUser?._id),
    refetchInterval: 20000,
  });

  const workspaces = workspaceData?.workspaces || [];
  const expenseInviteNotifications = workspaceData?.inviteNotifications || [];

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(String(workspaces[0]._id));
    }
  }, [selectedWorkspaceId, workspaces]);

  const { data: workspaceDetailData } = useQuery({
    queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/expenses/workspaces/${selectedWorkspaceId}`);
      return response.data?.data || {};
    },
    enabled: Boolean(selectedWorkspaceId),
    refetchInterval: selectedWorkspaceId ? 8000 : false,
  });

  const selectedWorkspace = workspaceDetailData?.workspace || null;
  const selectedWorkspaceExpenses = workspaceDetailData?.expenses || [];
  const workspaceStats = workspaceDetailData?.stats || {};
  const workspacePermissions = workspaceDetailData?.permissions || { isAdmin: false, canInvite: false };
  const canArchiveWorkspace = Boolean(workspacePermissions?.canArchive);

  useEffect(() => {
    if (!selectedWorkspace) return;
    setBudgetSettings({
      budgetLimit: Number(selectedWorkspace.budgetLimit || 0),
      budgetAlertThresholds: Array.isArray(selectedWorkspace.budgetAlertThresholds)
        ? selectedWorkspace.budgetAlertThresholds.join(",")
        : "50,80,100",
      reminderEnabled: selectedWorkspace.reminderEnabled !== false,
    });
  }, [selectedWorkspace]);

  const { data: settlementData } = useQuery({
    queryKey: ["expenseWorkspaceSettlements", selectedWorkspaceId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/expenses/workspaces/${selectedWorkspaceId}/settlements`);
      return response.data?.data || {};
    },
    enabled: Boolean(selectedWorkspaceId),
    refetchInterval: selectedWorkspaceId ? 8000 : false,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["expenseWorkspaceAnalytics", selectedWorkspaceId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/expenses/workspaces/${selectedWorkspaceId}/analytics`);
      return response.data?.data || {};
    },
    enabled: Boolean(selectedWorkspaceId),
    refetchInterval: selectedWorkspaceId ? 15000 : false,
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post("/expenses/workspaces", payload);
      return response.data?.data?.workspace;
    },
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      if (workspace?._id) {
        setSelectedWorkspaceId(String(workspace._id));
      }
      setWorkspaceForm({ name: "", memberIds: [] });
      toast.success("Shared expense group created.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create group");
    },
  });

  const respondExpenseInviteMutation = useMutation({
    mutationFn: async ({ notificationId, action }) => {
      const response = await axiosInstance.post(`/expenses/invites/${notificationId}/respond`, { action });
      return response.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      toast.success(variables.action === "accept" ? "Joined expense group." : "Invite declined.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond");
    },
  });

  const markExpenseNotificationReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await axiosInstance.post(`/expenses/notifications/${notificationId}/read`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark notification as read");
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/expenses/workspaces/${selectedWorkspaceId}/expenses`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceSettlements", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceAnalytics", selectedWorkspaceId] });
      setExpenseForm({ title: "", amount: "", paidBy: "me", splitBetween: 2, category: "other", splitType: "equal", receipt: null });
      setCustomSplitValues({});
      toast.success("Expense added.");
      if (data?.warnings?.includes("possible_duplicate")) {
        toast("Possible duplicate expense detected.", { icon: "⚠️" });
      }
      if (data?.warnings?.includes("high_amount")) {
        toast("High amount detected. Please verify.", { icon: "⚠️" });
      }
      if (data?.budgetAlert?.threshold) {
        toast(`Budget alert: ${data.budgetAlert.threshold}% crossed`, { icon: "💸" });
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to add expense");
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const response = await axiosInstance.post(`/expenses/workspaces/${selectedWorkspaceId}/invite`, { memberId });
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      setInviteMemberId("");
      toast.success("Invite sent.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to invite member");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const response = await axiosInstance.delete(`/expenses/workspaces/${selectedWorkspaceId}/members/${memberId}`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      toast.success("Member removed.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to remove member");
    },
  });

  const archiveWorkspaceMutation = useMutation({
    mutationFn: async (archived) => {
      const response = await axiosInstance.patch(`/expenses/workspaces/${selectedWorkspaceId}/archive`, { archived });
      return response.data?.data;
    },
    onSuccess: (_, archived) => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaces"] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      toast.success(archived ? "Group archived." : "Group reopened.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update group");
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.patch(`/expenses/workspaces/${selectedWorkspaceId}/budget`, payload);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      toast.success("Budget settings updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update budget settings");
    },
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(`/expenses/workspaces/${selectedWorkspaceId}/reminders/send`);
      return response.data?.data;
    },
    onSuccess: (data) => {
      toast.success(`Reminders sent: ${data?.remindersSent || 0}`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send reminders");
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/expenses/workspaces/${selectedWorkspaceId}/settlements`, payload);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceSettlements", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      setSettlementForm({ fromUser: "", toUser: "", amount: "", note: "", paymentMethod: "upi", payeeUpiId: "", paymentReference: "" });
      toast.success("Settlement request sent.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send settlement request");
    },
  });

  const respondSettlementMutation = useMutation({
    mutationFn: async ({ settlementId, action }) => {
      const response = await axiosInstance.patch(
        `/expenses/workspaces/${selectedWorkspaceId}/settlements/${settlementId}/respond`,
        { action }
      );
      return response.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceSettlements", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      toast.success(variables.action === "confirm" ? "Settlement confirmed." : "Settlement rejected.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond to settlement request");
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ expenseId, payload }) => {
      const response = await axiosInstance.patch(`/expenses/workspaces/${selectedWorkspaceId}/expenses/${expenseId}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data?.expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceDetail", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceSettlements", selectedWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["expenseWorkspaceAnalytics", selectedWorkspaceId] });
      setEditingExpense(null);
      setEditExpenseForm({ title: "", amount: "", paidBy: "", splitBetween: 2, category: "other", splitType: "equal", reason: "", receipt: null });
      setEditSplitValues({});
      toast.success("Expense updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update expense");
    },
  });

  const budgetEstimate = useMemo(() => {
    const days = Math.max(1, Number(budgetForm.days || 1));
    const travelers = Math.max(1, Number(budgetForm.travelers || 1));
    const dailySpend = Math.max(0, Number(budgetForm.dailySpendPerPerson || 0));
    const stayPerNight = Math.max(0, Number(budgetForm.stayPerNight || 0));
    const transportTotal = Math.max(0, Number(budgetForm.transportTotal || 0));
    const activitiesTotal = Math.max(0, Number(budgetForm.activitiesTotal || 0));

    const foodAndLocal = days * dailySpend * travelers;
    const accommodation = days * stayPerNight;
    const total = foodAndLocal + accommodation + transportTotal + activitiesTotal;
    const perPerson = total / travelers;

    return {
      total,
      perPerson,
      foodAndLocal,
      accommodation,
      transportTotal,
      activitiesTotal,
    };
  }, [budgetForm]);

  function applyBudgetPreset(type) {
    if (type === "weekend") {
      setBudgetForm({
        days: 2,
        travelers: 2,
        dailySpendPerPerson: 60,
        stayPerNight: 75,
        transportTotal: 90,
        activitiesTotal: 60,
      });
      return;
    }

    if (type === "week") {
      setBudgetForm({
        days: 7,
        travelers: 2,
        dailySpendPerPerson: 80,
        stayPerNight: 95,
        transportTotal: 220,
        activitiesTotal: 180,
      });
      return;
    }

    setBudgetForm({
      days: 5,
      travelers: 2,
      dailySpendPerPerson: 70,
      stayPerNight: 80,
      transportTotal: 180,
      activitiesTotal: 120,
    });
  }

  function addTripNote(event) {
    event.preventDefault();
    if (!vocabForm.term.trim() || !vocabForm.meaning.trim()) {
      return;
    }

    setTripNotes((prev) => [
      {
        id: crypto.randomUUID(),
        ...vocabForm,
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ...prev,
    ]);

    setVocabForm({ term: "", meaning: "", example: "" });
    setChallengeProgress((prev) => ({ ...prev, plans: prev.plans + 1 }));
  }

  function addSplitExpense(event) {
    event.preventDefault();
    if (!expenseForm.title.trim() || Number(expenseForm.amount) <= 0) {
      return;
    }

    if (!selectedWorkspaceId) {
      toast.error("Select a group first.");
      return;
    }

    const selectedMembers = (selectedWorkspace?.members || []).map((member) => String(member._id || member));
    if (selectedMembers.length === 0) {
      toast.error("No members in this group.");
      return;
    }

    const formData = new FormData();
    const paidBy = expenseForm.paidBy === "me" ? String(authUser?._id || "") : expenseForm.paidBy;
    formData.append("title", expenseForm.title.trim());
    formData.append("amount", String(Number(expenseForm.amount || 0)));
    formData.append("paidBy", paidBy);
    formData.append("splitBetween", String(Math.max(1, Number(expenseForm.splitBetween || 1))));
    formData.append("category", String(expenseForm.category || "other"));
    formData.append("splitType", String(expenseForm.splitType || "equal"));
    formData.append("participants", JSON.stringify(selectedMembers));

    if (expenseForm.splitType === "custom" || expenseForm.splitType === "percentage") {
      const splitsPayload = selectedMembers.map((memberId) => ({ userId: memberId, value: Number(customSplitValues[memberId] || 0) }));
      formData.append("splits", JSON.stringify(splitsPayload));
    }

    if (expenseForm.receipt) {
      formData.append("receipt", expenseForm.receipt);
    }

    addExpenseMutation.mutate(formData);
  }

  function saveOfflineDraft() {
    if (!expenseForm.title.trim() || Number(expenseForm.amount) <= 0) {
      toast.error("Enter title and amount before saving draft.");
      return;
    }
    setOfflineExpenseDrafts((prev) => [
      {
        id: crypto.randomUUID(),
        ...expenseForm,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    toast.success("Draft saved locally.");
  }

  function loadOfflineDraft(draft) {
    setExpenseForm((prev) => ({
      ...prev,
      title: draft.title || "",
      amount: draft.amount || "",
      paidBy: draft.paidBy || "me",
      splitBetween: Number(draft.splitBetween || 2),
      category: draft.category || "other",
      splitType: draft.splitType || "equal",
      receipt: null,
    }));
    toast.success("Draft loaded.");
  }

  function saveBudgetSettings(event) {
    event.preventDefault();
    if (!selectedWorkspaceId) return;
    const thresholds = String(budgetSettings.budgetAlertThresholds || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    updateBudgetMutation.mutate({
      budgetLimit: Math.max(0, Number(budgetSettings.budgetLimit || 0)),
      budgetAlertThresholds: thresholds,
      reminderEnabled: Boolean(budgetSettings.reminderEnabled),
    });
  }

  function submitSettlement(event) {
    event.preventDefault();
    if (!settlementForm.fromUser || !settlementForm.toUser || Number(settlementForm.amount) <= 0) {
      toast.error("Fill settlement details.");
      return;
    }
    if (String(settlementForm.fromUser) === String(settlementForm.toUser)) {
      toast.error("Payer and receiver cannot be the same person.");
      return;
    }
    settleMutation.mutate({
      fromUser: settlementForm.fromUser,
      toUser: settlementForm.toUser,
      amount: Number(settlementForm.amount || 0),
      note: settlementForm.note,
      paymentMethod: settlementForm.paymentMethod,
      payeeUpiId: settlementForm.payeeUpiId,
      paymentReference: settlementForm.paymentReference,
    });
  }

  function openEditExpense(expense) {
    const splitType = expense.splitType || "equal";
    const splitMap = {};
    (expense.splits || []).forEach((split) => {
      const key = String(split?.user?._id || split?.user || "");
      if (!key) return;
      splitMap[key] = splitType === "percentage" ? String(split.percentage ?? "") : String(split.amount ?? "");
    });

    setEditingExpense(expense);
    setEditExpenseForm({
      title: expense.title || "",
      amount: String(expense.amount || ""),
      paidBy: String(expense?.paidBy?._id || expense?.paidBy || ""),
      splitBetween: Number(expense.splitBetween || 2),
      category: expense.category || "other",
      splitType,
      reason: "",
      receipt: null,
    });
    setEditSplitValues(splitMap);
  }

  function openExpenseHistory(expense) {
    setHistoryExpense(expense);
    setHistoryOnlyWithReason(false);
    setHistoryOnlyByMe(false);
  }

  function submitEditExpense(event) {
    event.preventDefault();
    if (!editingExpense?._id) return;
    if (!editExpenseForm.title.trim() || Number(editExpenseForm.amount) <= 0) {
      toast.error("Enter valid title and amount.");
      return;
    }
    if (!String(editExpenseForm.reason || "").trim()) {
      toast.error("Update note is mandatory.");
      return;
    }

    const payload = new FormData();
    const members = (selectedWorkspace?.members || []).map((member) => String(member?._id || member));
    const splitType = String(editExpenseForm.splitType || "equal");

    payload.append("title", editExpenseForm.title.trim());
    payload.append("amount", String(Number(editExpenseForm.amount || 0)));
    payload.append("paidBy", String(editExpenseForm.paidBy || ""));
    payload.append("splitBetween", String(Math.max(1, Number(editExpenseForm.splitBetween || 1))));
    payload.append("category", String(editExpenseForm.category || "other"));
    payload.append("splitType", splitType);
    payload.append("reason", String(editExpenseForm.reason || ""));

    if (splitType === "equal") {
      const count = Math.max(1, Number(editExpenseForm.splitBetween || 1));
      payload.append("participants", JSON.stringify(members.slice(0, count)));
    } else {
      const splits = members
        .map((memberId) => ({ userId: memberId, value: Number(editSplitValues[memberId] || 0) }))
        .filter((row) => row.value > 0);

      if (splits.length === 0) {
        toast.error("Enter split values for selected split type.");
        return;
      }

      if (splitType === "percentage") {
        const totalPercentage = splits.reduce((sum, row) => sum + row.value, 0);
        if (Math.abs(totalPercentage - 100) > 0.5) {
          toast.error("Percentage split must total 100.");
          return;
        }
      }

      payload.append("participants", JSON.stringify(members));
      payload.append("splits", JSON.stringify(splits));
    }

    if (editExpenseForm.receipt) {
      payload.append("receipt", editExpenseForm.receipt);
    }

    updateExpenseMutation.mutate({
      expenseId: editingExpense._id,
      payload,
    });
  }

  async function downloadCsvExport() {
    if (!selectedWorkspaceId) {
      toast.error("Select a group first.");
      return;
    }
    try {
      const response = await axiosInstance.get(`/expenses/workspaces/${selectedWorkspaceId}/export.csv`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `expenses-${selectedWorkspaceId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to export CSV");
    }
  }

  function displayNameFromId(id) {
    const workspaceMember = (selectedWorkspace?.members || []).find(
      (member) => String(member?._id || member) === String(id)
    );
    if (workspaceMember?.fullName) {
      return workspaceMember.fullName;
    }

    return (
      friends.find((item) => String(item._id) === String(id))?.fullName ||
      users.find((item) => String(item._id) === String(id))?.fullName ||
      "Partner"
    );
  }

  function toggleWorkspaceMember(id) {
    setWorkspaceForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((item) => item !== id)
        : [...prev.memberIds, id],
    }));
  }

  function submitWorkspace(event) {
    event.preventDefault();
    if (!workspaceForm.name.trim()) {
      toast.error("Please enter a group name.");
      return;
    }
    createWorkspaceMutation.mutate(workspaceForm);
  }

  function submitInvite(event) {
    event.preventDefault();
    if (!inviteMemberId) {
      toast.error("Choose a friend to invite.");
      return;
    }
    if (!selectedWorkspaceId) {
      toast.error("Select a group first.");
      return;
    }
    inviteMemberMutation.mutate(inviteMemberId);
  }

  const isWorkspaceArchived = Boolean(selectedWorkspace?.archivedAt);
  const workspaceMemberIds = new Set((selectedWorkspace?.members || []).map((member) => String(member._id || member)));
  const pendingInviteIds = new Set((selectedWorkspace?.pendingInvites || []).map((member) => String(member._id || member)));
  const inviteEligibleFriends = friends.filter(
    (friend) => !workspaceMemberIds.has(String(friend._id)) && !pendingInviteIds.has(String(friend._id))
  );

  const expenseTotals = useMemo(() => {
    const total = selectedWorkspaceExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const youPaid = selectedWorkspaceExpenses
      .filter((expense) => expense.paidBy === "me")
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const myId = String(authUser?._id || "");
    const youPaidResolved = selectedWorkspaceExpenses
      .filter((expense) => String(expense?.paidBy?._id || expense?.paidBy) === myId)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const yourShare = selectedWorkspaceExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0) / Math.max(1, Number(expense.splitBetween || 1)),
      0
    );
    return {
      total,
      youPaid: youPaidResolved || youPaid,
      yourShare,
      net: (youPaidResolved || youPaid) - yourShare,
    };
  }, [authUser?._id, selectedWorkspaceExpenses]);

  const workspaceHeadlineStats = useMemo(() => {
    const members = (selectedWorkspace?.members || []).length;
    const pending = (selectedWorkspace?.pendingInvites || []).length;
    const transactionCount = selectedWorkspaceExpenses.length;
    const avgExpense = transactionCount > 0 ? expenseTotals.total / transactionCount : 0;

    return {
      members,
      pending,
      transactionCount,
      avgExpense,
    };
  }, [expenseTotals.total, selectedWorkspace, selectedWorkspaceExpenses.length]);

  const memberBalanceSnapshot = useMemo(() => {
    const myId = String(authUser?._id || "");
    const balances = settlementData?.balances || {};
    const net = Number(balances[myId] || 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartTime = monthStart.getTime();

    let monthlyNet = 0;
    for (const expense of selectedWorkspaceExpenses || []) {
      const createdAt = new Date(expense.createdAt || Date.now()).getTime();
      if (createdAt < monthStartTime) continue;

      const amount = Number(expense.amount || 0);
      const payerId = String(expense?.paidBy?._id || expense?.paidBy || "");
      if (payerId === myId) {
        monthlyNet += amount;
      }

      const splitRows = Array.isArray(expense.splits) ? expense.splits : [];
      if (splitRows.length > 0) {
        const mySplit = splitRows.find((row) => String(row?.user?._id || row?.user || "") === myId);
        if (mySplit) {
          monthlyNet -= Number(mySplit.amount || 0);
        }
      } else {
        const participants = Array.isArray(expense.participants) ? expense.participants.map((id) => String(id)) : [];
        if (participants.length > 0) {
          if (participants.includes(myId)) {
            monthlyNet -= amount / Math.max(1, participants.length);
          }
        } else {
          monthlyNet -= amount / Math.max(1, Number(expense.splitBetween || 1));
        }
      }
    }

    for (const settlement of settlementData?.history || []) {
      const dateValue = settlement.confirmedAt || settlement.createdAt;
      const createdAt = new Date(dateValue || Date.now()).getTime();
      if (createdAt < monthStartTime) continue;

      const amount = Number(settlement.amount || 0);
      const fromUserId = String(settlement?.fromUser?._id || settlement?.fromUser || "");
      const toUserId = String(settlement?.toUser?._id || settlement?.toUser || "");
      if (fromUserId === myId) monthlyNet += amount;
      if (toUserId === myId) monthlyNet -= amount;
    }

    const normalizedMonthlyNet = Math.round(monthlyNet * 100) / 100;

    return {
      net,
      owe: net < 0 ? Math.abs(net) : 0,
      receive: net > 0 ? net : 0,
      monthlyNet: normalizedMonthlyNet,
    };
  }, [authUser?._id, selectedWorkspaceExpenses, settlementData?.balances, settlementData?.history]);

  const summaryCards = [
    { label: "Notes", value: tripNotes.length },
    { label: "Expenses", value: selectedWorkspaceExpenses.length },
    { label: "Safety", value: blockedUserIds.length },
  ];

  const filteredHistoryEntries = useMemo(() => {
    const entries = (historyExpense?.updateHistory || []).slice().reverse();
    const myId = String(authUser?._id || "");
    return entries.filter((entry) => {
      if (historyOnlyWithReason && !String(entry.reason || "").trim()) return false;
      if (historyOnlyByMe && String(entry.updatedBy?._id || entry.updatedBy || "") !== myId) return false;
      return true;
    });
  }, [authUser?._id, historyExpense?.updateHistory, historyOnlyByMe, historyOnlyWithReason]);

  return (
    <AppShell title="Travel Toolkit" subtitle="Clean tools for faster planning, safer connections, and better trip decisions.">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${activeTool === "expenses" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTool("expenses")}
        >
          Expenses
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTool === "budget" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTool("budget")}
        >
          Budget
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTool === "notes" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTool("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTool === "safety" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTool("safety")}
        >
          Safety
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="space-y-5 xl:col-span-8">
          <section className="shell-panel">
            <div className="p-5 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-3">
                {summaryCards.map((item) => (
                  <article key={item.label} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-xs text-base-content/60">{item.label}</p>
                    <p className="mt-1 text-xl font-black leading-none">{item.value}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {activeTool === "expenses" ? (
          <section className="shell-panel overflow-hidden">
            <div className="bg-gradient-to-r from-accent/15 via-primary/10 to-secondary/10 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                    <Wallet className="size-3.5 text-accent" /> Expense dashboard
                  </p>
                  <p className="mt-1 text-lg font-black leading-tight">
                    {selectedWorkspace?.name || "Select a group to start tracking"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isWorkspaceArchived ? <span className="badge badge-warning badge-sm">Archived</span> : <span className="badge badge-success badge-sm">Active</span>}
                  {workspacePermissions.isAdmin ? <span className="badge badge-primary badge-sm">Admin</span> : <span className="badge badge-outline badge-sm">Member</span>}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Total spend</p>
                  <p className="mt-1 text-base font-black">{formatCurrency(expenseTotals.total)}</p>
                </article>
                <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="inline-flex items-center gap-1 text-xs text-base-content/60">
                    <Users className="size-3.5" /> People in group
                  </p>
                  <p className="mt-1 text-base font-black">{workspaceHeadlineStats.members}</p>
                </article>
                <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Avg expense</p>
                  <p className="mt-1 text-base font-black">{formatCurrency(workspaceHeadlineStats.avgExpense)}</p>
                </article>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <article className="rounded-xl border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs text-base-content/70">You owe</p>
                  <p className="mt-1 text-base font-black text-warning">{formatCurrency(memberBalanceSnapshot.owe)}</p>
                </article>
                <article className="rounded-xl border border-success/30 bg-success/10 p-3">
                  <p className="text-xs text-base-content/70">You should receive</p>
                  <p className="mt-1 text-base font-black text-success">{formatCurrency(memberBalanceSnapshot.receive)}</p>
                </article>
                <article className="rounded-xl border border-info/30 bg-info/10 p-3">
                  <p className="text-xs text-base-content/70">Net trend this month</p>
                  <p className={`mt-1 text-base font-black ${memberBalanceSnapshot.monthlyNet >= 0 ? "text-success" : "text-warning"}`}>
                    {memberBalanceSnapshot.monthlyNet >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(memberBalanceSnapshot.monthlyNet))}
                  </p>
                </article>
              </div>

              {Number(selectedWorkspace?.budgetLimit || 0) > 0 ? (
                <div className="mt-3 rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <div className="flex items-center justify-between text-xs text-base-content/70">
                    <span>Budget usage</span>
                    <span>{Math.min(999, Number(workspaceStats?.budgetUsagePercent || 0)).toFixed(1)}%</span>
                  </div>
                  <progress
                    className="progress progress-primary mt-2 w-full"
                    value={Math.min(100, Number(workspaceStats?.budgetUsagePercent || 0))}
                    max="100"
                  />
                </div>
              ) : null}
            </div>

            <div className="p-5 sm:p-6">
              {!selectedWorkspace ? (
                <div className="rounded-2xl border border-dashed border-base-300 bg-base-100/70 p-6 text-center">
                  <p className="text-sm font-semibold">No expense group selected</p>
                  <p className="mt-1 text-xs text-base-content/65">Create a group from the right panel or pick an existing group to see transactions.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {(selectedWorkspace.members || []).slice(0, 10).map((member) => (
                      <span key={member._id} className="badge badge-outline gap-1.5 py-3">
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {(member.fullName || "M").slice(0, 1).toUpperCase()}
                        </span>
                        {member.fullName || "Member"}
                      </span>
                    ))}
                    {workspaceHeadlineStats.pending > 0 ? <span className="badge badge-ghost">{workspaceHeadlineStats.pending} pending</span> : null}
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-xl border border-base-300/70 bg-base-100/80">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Paid by</th>
                          <th>Split</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkspaceExpenses.slice(0, 10).map((expense) => (
                          <tr key={expense._id || expense.id}>
                            <td>
                              <p className="font-semibold">{expense.title || "Expense"}</p>
                              <p className="text-[11px] text-base-content/60">{new Date(expense.createdAt || Date.now()).toLocaleDateString("en-IN")}</p>
                              {expense.updatedBy ? (
                                <p className="text-[11px] text-base-content/60">
                                  Updated by {expense.updatedBy?.fullName || "Member"}
                                </p>
                              ) : null}
                              {expense.receiptUrl ? (
                                <a
                                  href={expense.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-[11px] font-medium text-primary hover:underline"
                                >
                                  View receipt
                                </a>
                              ) : null}
                            </td>
                            <td>{expense.paidBy?.fullName || displayNameFromId(expense.paidBy)}</td>
                            <td>{expense.splitBetween} people</td>
                            <td className="text-right font-semibold">{formatCurrency(expense.amount)}</td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => openExpenseHistory(expense)}
                                >
                                  History
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => openEditExpense(expense)}
                                  disabled={isWorkspaceArchived}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {workspaceHeadlineStats.transactionCount === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-base-300 bg-base-100/70 p-4 text-xs text-base-content/65">
                      No transactions yet. Add your first expense from the right panel.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <section className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/65">Suggested settlements</p>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {(settlementData?.suggestedTransfers || []).slice(0, 6).map((item, index) => {
                          const fromName = displayNameFromId(item.fromUser);
                          const toName = displayNameFromId(item.toUser);
                          return (
                            <div key={`${item.fromUser}-${item.toUser}-${index}`} className="rounded-lg border border-base-300/60 bg-base-100/90 p-2">
                              {fromName} pays {toName} <span className="font-semibold">{formatCurrency(item.amount)}</span>
                            </div>
                          );
                        })}
                        {(settlementData?.suggestedTransfers || []).length === 0 ? (
                          <p className="text-base-content/60">No pending settlements.</p>
                        ) : null}
                      </div>
                    </section>

                    <section className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                        <BarChart3 className="size-3.5" /> Category insights
                      </p>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {(analyticsData?.categoryBreakdown || []).slice(0, 6).map((item) => (
                          <div key={item._id || "other"} className="flex items-center justify-between rounded-lg border border-base-300/60 bg-base-100/90 px-2 py-1.5">
                            <span className="capitalize">{item._id || "other"}</span>
                            <span className="font-semibold">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                        {(analyticsData?.categoryBreakdown || []).length === 0 ? (
                          <p className="text-base-content/60">No analytics yet.</p>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          </section>
          ) : null}

          {activeTool === "budget" ? (
          <section className="shell-panel">
            <div className="p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Calculator className="size-3.5 text-primary" /> Quick trip budget
              </p>
              <p className="mt-1 text-sm text-base-content/70">
                Use this for a rough estimate before final bookings.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-xs btn-outline" onClick={() => applyBudgetPreset("weekend")}>
                  Weekend example
                </button>
                <button type="button" className="btn btn-xs btn-outline" onClick={() => applyBudgetPreset("week")}>
                  1-week example
                </button>
                <button type="button" className="btn btn-xs btn-ghost" onClick={() => applyBudgetPreset("reset")}>
                  Reset
                </button>
              </div>

              <form className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
                <label className="form-control">
                  <span className="label-text text-xs">Trip days</span>
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered input-sm"
                    value={budgetForm.days}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, days: Number(event.target.value || 1) }))}
                    placeholder="Days"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Travelers</span>
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered input-sm"
                    value={budgetForm.travelers}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, travelers: Number(event.target.value || 1) }))}
                    placeholder="Travelers"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Daily spend per person</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm"
                    value={budgetForm.dailySpendPerPerson}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, dailySpendPerPerson: Number(event.target.value || 0) }))
                    }
                    placeholder="Food, local rides, misc"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Stay per night (total)</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm"
                    value={budgetForm.stayPerNight}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, stayPerNight: Number(event.target.value || 0) }))}
                    placeholder="Hotel or stay cost"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Transport total</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm"
                    value={budgetForm.transportTotal}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, transportTotal: Number(event.target.value || 0) }))
                    }
                    placeholder="Flights, trains, buses"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Activities total</span>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm"
                    value={budgetForm.activitiesTotal}
                    onChange={(event) =>
                      setBudgetForm((prev) => ({ ...prev, activitiesTotal: Number(event.target.value || 0) }))
                    }
                    placeholder="Tickets, tours, events"
                  />
                </label>
              </form>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Total budget</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(budgetEstimate.total)}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Per traveler</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(budgetEstimate.perPerson)}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Food and local</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(budgetEstimate.foodAndLocal)}</p>
                </div>
                <div className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-xs text-base-content/60">Stay</p>
                  <p className="mt-1 text-lg font-black">{formatCurrency(budgetEstimate.accommodation)}</p>
                </div>
              </div>
            </div>
          </section>
          ) : null}

          {activeTool === "notes" ? (
          <section className="shell-panel">
          <div className="p-6">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
              <MessageSquare className="size-3.5 text-secondary" /> Trip note capture
            </p>
            <form className="mt-2" onSubmit={addTripNote}>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="input input-bordered"
                  value={vocabForm.term}
                  onChange={(event) => setVocabForm((prev) => ({ ...prev, term: event.target.value }))}
                  placeholder="Place, activity, or route"
                />
                <input
                  className="input input-bordered"
                  value={vocabForm.meaning}
                  onChange={(event) => setVocabForm((prev) => ({ ...prev, meaning: event.target.value }))}
                  placeholder="Why it matters"
                />
              </div>
              <input
                className="input input-bordered mt-2 w-full"
                value={vocabForm.example}
                onChange={(event) => setVocabForm((prev) => ({ ...prev, example: event.target.value }))}
                placeholder="Extra planning details"
              />
              <button type="submit" className="btn btn-secondary btn-sm mt-2">
                Save note
              </button>
            </form>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tripNotes.slice(0, 8).map((item) => (
                <article key={item.id} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                  <p className="text-sm font-bold">{item.term}</p>
                  <p className="text-xs text-base-content/65">{item.meaning}</p>
                  <p className="mt-1 text-xs text-base-content/70">{item.example || "No example yet"}</p>
                </article>
              ))}
            </div>
          </div>
          </section>
          ) : null}

          {activeTool === "safety" ? (
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <ShieldCheck className="size-3.5 text-success" /> Safety and trust
              </p>
              <label className="label cursor-pointer justify-between py-1.5">
                <span className="label-text text-xs">Verified profiles only</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={safetySettings.verifiedOnly}
                  onChange={() => setSafetySettings((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                />
              </label>
              <label className="label cursor-pointer justify-between py-1.5">
                <span className="label-text text-xs">Hide exact location</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={safetySettings.hideLocation}
                  onChange={() => setSafetySettings((prev) => ({ ...prev, hideLocation: !prev.hideLocation }))}
                />
              </label>
              <label className="label cursor-pointer justify-between py-1.5">
                <span className="label-text text-xs">Strict moderation mode</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={safetySettings.strictMode}
                  onChange={() => setSafetySettings((prev) => ({ ...prev, strictMode: !prev.strictMode }))}
                />
              </label>

              <div className="mt-2 flex flex-wrap gap-2">
                {users.slice(0, 6).map((user) => {
                  const blocked = blockedUserIds.includes(String(user._id));

                  return (
                    <button
                      key={user._id}
                      type="button"
                      className={`btn btn-xs ${blocked ? "btn-error" : "btn-outline"}`}
                      onClick={() =>
                        setBlockedUserIds((prev) =>
                          blocked ? prev.filter((id) => id !== String(user._id)) : [...prev, String(user._id)]
                        )
                      }
                    >
                      {blocked ? `Unblock ${user.fullName}` : `Block ${user.fullName}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
          ) : null}
        </section>

        <aside className="space-y-5 xl:col-span-4">
          {activeTool === "expenses" ? (
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <IndianRupee className="size-3.5 text-accent" /> Group expense splitter
              </p>
              <p className="mt-1 text-xs text-base-content/70">Track shared trip spend with one active group at a time.</p>

              <select
                className="select select-bordered select-sm mt-3 w-full"
                value={selectedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              >
                <option value="">Select shared group</option>
                {workspaces.map((workspace) => (
                  <option key={workspace._id} value={workspace._id}>
                    {workspace.name}
                  </option>
                ))}
              </select>

              {expenseInviteNotifications.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {expenseInviteNotifications.slice(0, 3).map((invite) => (
                    <div key={invite._id} className="rounded-lg border border-base-300/70 bg-base-100/85 p-2.5">
                      <p className="text-xs font-semibold">
                        {invite.type === "expense_workspace_invite"
                          ? `${invite.actor?.fullName || "Friend"} invited you`
                          : `${invite.actor?.fullName || "Member"} sent an update`}
                      </p>
                      <p className="text-[11px] text-base-content/65">{invite.message}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-base-content/55">
                        {invite.type === "expense_workspace_invite"
                          ? "Workspace invite"
                          : invite.type === "expense_settlement_request"
                            ? "Settlement request"
                            : invite.type === "expense_settlement_result"
                              ? "Settlement update"
                              : "Settlement reminder"}
                      </p>
                      {invite.type === "expense_workspace_invite" ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => respondExpenseInviteMutation.mutate({ notificationId: invite._id, action: "accept" })}
                            disabled={respondExpenseInviteMutation.isPending}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => respondExpenseInviteMutation.mutate({ notificationId: invite._id, action: "reject" })}
                            disabled={respondExpenseInviteMutation.isPending}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => {
                              const workspaceId = String(invite?.session?._id || invite?.session || "");
                              if (workspaceId) {
                                setSelectedWorkspaceId(workspaceId);
                              }
                              setShowSettlementModal(true);
                            }}
                          >
                            Open settlement
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => markExpenseNotificationReadMutation.mutate(invite._id)}
                            disabled={markExpenseNotificationReadMutation.isPending}
                          >
                            Mark read
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedWorkspace ? (
                <div className="mt-2 rounded-lg border border-base-300/70 bg-base-100/80 p-2.5 text-[11px] text-base-content/70">
                  <p>
                    Members: {(selectedWorkspace.members || []).length} · Pending: {(selectedWorkspace.pendingInvites || []).length}
                  </p>
                  {!canArchiveWorkspace ? <p>Only group admin can archive or reopen.</p> : null}
                  {isWorkspaceArchived ? <p className="text-warning">This group is archived. Expense entry is disabled.</p> : null}
                </div>
              ) : null}

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowManageGroupModal(true)}>
                  Manage group
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowBudgetToolsModal(true)}
                  disabled={!selectedWorkspaceId}
                >
                  Budget and export
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowSettlementModal(true)}
                  disabled={!selectedWorkspaceId}
                >
                  Record settlement
                </button>
              </div>

              <form className="mt-2 space-y-2" onSubmit={addSplitExpense}>
                <input
                  className="input input-bordered input-sm w-full"
                  value={expenseForm.title}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Expense title (hotel, cab, food)"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered input-sm"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="Amount in rupees"
                  />
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered input-sm"
                    value={expenseForm.splitBetween}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, splitBetween: Number(event.target.value || 1) }))}
                    placeholder="Split between people"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="select select-bordered select-sm"
                    value={expenseForm.category}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))}
                  >
                    <option value="other">Category: Other</option>
                    <option value="food">Food</option>
                    <option value="stay">Stay</option>
                    <option value="transport">Transport</option>
                    <option value="activities">Activities</option>
                    <option value="shopping">Shopping</option>
                  </select>
                  <select
                    className="select select-bordered select-sm"
                    value={expenseForm.splitType}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, splitType: event.target.value }))}
                  >
                    <option value="equal">Equal split</option>
                    <option value="custom">Custom amount split</option>
                    <option value="percentage">Percentage split</option>
                  </select>
                </div>
                <select
                  className="select select-bordered select-sm w-full"
                  value={expenseForm.paidBy}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, paidBy: event.target.value }))}
                >
                  <option value="me">Paid by me</option>
                  {(selectedWorkspace?.members || []).map((friend) => (
                    <option key={String(friend._id || friend)} value={String(friend._id || friend)}>
                      Paid by {friend.fullName || "Member"}
                    </option>
                  ))}
                </select>

                {expenseForm.splitType !== "equal" ? (
                  <div className="rounded-lg border border-base-300/70 bg-base-100/70 p-2">
                    <p className="text-[11px] font-semibold text-base-content/65">Set {expenseForm.splitType === "percentage" ? "percentage" : "amount"} per member</p>
                    <div className="mt-1.5 space-y-1.5">
                      {(selectedWorkspace?.members || []).map((member) => (
                        <label key={String(member._id || member)} className="flex items-center justify-between gap-2 text-xs">
                          <span>{member.fullName || "Member"}</span>
                          <input
                            type="number"
                            min="0"
                            className="input input-bordered input-xs w-28"
                            value={customSplitValues[String(member._id || member)] || ""}
                            onChange={(event) =>
                              setCustomSplitValues((prev) => ({
                                ...prev,
                                [String(member._id || member)]: event.target.value,
                              }))
                            }
                            placeholder={expenseForm.splitType === "percentage" ? "%" : "Amount"}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="form-control">
                  <span className="label-text text-[11px]">Attach receipt (optional)</span>
                  <input
                    type="file"
                    className="file-input file-input-bordered file-input-sm w-full"
                    accept="image/*,application/pdf"
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, receipt: event.target.files?.[0] || null }))}
                  />
                </label>

                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={saveOfflineDraft}>
                    Save draft
                  </button>
                  <button
                    type="submit"
                    className="btn btn-accent btn-sm flex-1"
                    disabled={addExpenseMutation.isPending || !selectedWorkspaceId || isWorkspaceArchived}
                  >
                    Add expense
                  </button>
                </div>
              </form>

              {offlineExpenseDrafts.length > 0 ? (
                <div className="mt-2 rounded-lg border border-base-300/70 bg-base-100/80 p-2">
                  <p className="text-[11px] font-semibold text-base-content/65">Offline drafts</p>
                  <div className="mt-1 max-h-32 space-y-1 overflow-y-auto pr-1">
                    {offlineExpenseDrafts.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        className="btn btn-ghost btn-xs w-full justify-between"
                        onClick={() => loadOfflineDraft(draft)}
                      >
                        <span>{draft.title}</span>
                        <span>{formatCurrency(draft.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}


              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-base-300/70 bg-base-100/85 p-2.5">
                  <p className="text-[11px] text-base-content/60">Total tracked</p>
                  <p className="text-sm font-bold">{formatCurrency(expenseTotals.total)}</p>
                </div>
                <div className="rounded-lg border border-base-300/70 bg-base-100/85 p-2.5">
                  <p className="text-[11px] text-base-content/60">My net</p>
                  <p className={`text-sm font-bold ${expenseTotals.net >= 0 ? "text-success" : "text-warning"}`}>
                    {expenseTotals.net >= 0 ? `Receive ${formatCurrency(expenseTotals.net)}` : `Pay ${formatCurrency(Math.abs(expenseTotals.net))}`}
                  </p>
                </div>
              </div>

              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {selectedWorkspaceExpenses.map((expense) => (
                  <div key={expense._id || expense.id} className="rounded-lg border border-base-300/70 bg-base-100/85 p-2 text-xs text-base-content/75">
                    <p className="font-semibold text-base-content">{expense.title || "Expense"}</p>
                    <p>
                      {formatCurrency(expense.amount)} · paid by {expense.paidBy?.fullName || displayNameFromId(expense.paidBy)} · split {expense.splitBetween} ways
                    </p>
                    {expense.updatedBy ? (
                      <p className="text-[11px] text-base-content/60">
                        Updated by {expense.updatedBy?.fullName || "Member"}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs mt-1 h-6 min-h-0 px-2"
                      onClick={() => openExpenseHistory(expense)}
                    >
                      View history
                    </button>
                    {expense.receiptUrl ? (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-[11px] font-medium text-primary hover:underline"
                      >
                        View receipt
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
          ) : null}

          <section className="shell-panel">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/8 to-accent/10">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                <Crown className="size-3.5 text-warning" /> Premium upgrades
              </p>
              <ul className="mt-2 space-y-1 text-sm text-base-content/75">
                <li>AI trip planner with route and timing hints</li>
                <li>Advanced traveler filters and compatibility insights</li>
                <li>Deep trip planning and confidence analytics</li>
              </ul>
              <button type="button" className="btn btn-primary btn-sm mt-3">
                Join waitlist
              </button>
            </div>
          </section>
        </aside>
      </div>

      <dialog className={`modal ${showManageGroupModal ? "modal-open" : ""}`}>
        <div className="modal-box max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Manage Group</h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowManageGroupModal(false)}>
              Close
            </button>
          </div>

          <form className="mt-3" onSubmit={submitWorkspace}>
            <input
              className="input input-bordered input-sm w-full"
              value={workspaceForm.name}
              onChange={(event) => setWorkspaceForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="New group name"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {friends.slice(0, 8).map((friend) => {
                const selected = workspaceForm.memberIds.includes(friend._id);
                return (
                  <button
                    key={friend._id}
                    type="button"
                    className={`btn btn-xs ${selected ? "btn-primary" : "btn-outline"}`}
                    onClick={() => toggleWorkspaceMember(friend._id)}
                  >
                    {friend.fullName}
                  </button>
                );
              })}
            </div>
            <button type="submit" className="btn btn-sm btn-accent mt-2 w-full" disabled={createWorkspaceMutation.isPending}>
              {createWorkspaceMutation.isPending ? "Creating..." : "Create shared group"}
            </button>
          </form>

          {workspacePermissions.canInvite && selectedWorkspace ? (
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submitInvite}>
              <select
                className="select select-bordered select-sm flex-1"
                value={inviteMemberId}
                onChange={(event) => setInviteMemberId(event.target.value)}
                disabled={isWorkspaceArchived || inviteEligibleFriends.length === 0}
              >
                <option value="">Invite friend</option>
                {inviteEligibleFriends.map((friend) => (
                  <option key={friend._id} value={friend._id}>
                    {friend.fullName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-sm btn-outline"
                disabled={inviteMemberMutation.isPending || isWorkspaceArchived || !inviteMemberId}
              >
                Invite
              </button>
            </form>
          ) : null}

          {workspacePermissions.canManageMembers && selectedWorkspace ? (
            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {(selectedWorkspace.members || [])
                .filter((member) => String(member._id) !== String(selectedWorkspace.admin?._id || selectedWorkspace.admin))
                .map((member) => (
                  <div key={member._id} className="flex items-center justify-between rounded-lg border border-base-300/70 bg-base-100/80 p-2">
                    <span className="text-xs">{member.fullName || "Member"}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeMemberMutation.mutate(member._id)}
                      disabled={removeMemberMutation.isPending || isWorkspaceArchived}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          ) : null}

          {workspacePermissions.canArchive && selectedWorkspace ? (
            <button
              type="button"
              className={`btn btn-sm mt-3 w-full ${isWorkspaceArchived ? "btn-success" : "btn-warning"}`}
              onClick={() => archiveWorkspaceMutation.mutate(!isWorkspaceArchived)}
              disabled={archiveWorkspaceMutation.isPending || !canArchiveWorkspace}
            >
              {isWorkspaceArchived ? "Reopen group" : "Archive group"}
            </button>
          ) : null}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowManageGroupModal(false)}>
            close
          </button>
        </form>
      </dialog>

      <dialog className={`modal ${showBudgetToolsModal ? "modal-open" : ""}`}>
        <div className="modal-box max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Budget, Reminders, Export</h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowBudgetToolsModal(false)}>
              Close
            </button>
          </div>
          <p className="mt-2 text-[11px] text-base-content/65">Set a limit, send due reminders, and download your trip report.</p>

          <form className="mt-2 space-y-2" onSubmit={saveBudgetSettings}>
            <label className="form-control">
              <span className="label-text text-[11px]">Group budget limit (INR)</span>
              <input
                type="number"
                min="0"
                className="input input-bordered input-sm w-full"
                value={budgetSettings.budgetLimit}
                onChange={(event) => setBudgetSettings((prev) => ({ ...prev, budgetLimit: event.target.value }))}
                placeholder="Example: 25000"
              />
            </label>
            <label className="form-control">
              <span className="label-text text-[11px]">Alert levels (%)</span>
              <input
                className="input input-bordered input-sm w-full"
                value={budgetSettings.budgetAlertThresholds}
                onChange={(event) => setBudgetSettings((prev) => ({ ...prev, budgetAlertThresholds: event.target.value }))}
                placeholder="Example: 50,80,100"
              />
            </label>
            <label className="label cursor-pointer justify-between py-1">
              <span className="label-text text-xs">Auto reminders enabled</span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={Boolean(budgetSettings.reminderEnabled)}
                onChange={() => setBudgetSettings((prev) => ({ ...prev, reminderEnabled: !prev.reminderEnabled }))}
              />
            </label>
            <button type="submit" className="btn btn-sm btn-outline w-full" disabled={!workspacePermissions.isAdmin || updateBudgetMutation.isPending}>
              Save budget
            </button>
          </form>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => sendRemindersMutation.mutate()}
              disabled={!workspacePermissions.isAdmin || sendRemindersMutation.isPending}
            >
              <BellRing className="size-3.5" /> Send reminder
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={downloadCsvExport}>
              <Download className="size-3.5" /> Download CSV
            </button>
          </div>
          <p className="mt-1 text-[11px] text-base-content/60">Only admin can save budget and send reminders.</p>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowBudgetToolsModal(false)}>
            close
          </button>
        </form>
      </dialog>

      <dialog className={`modal ${showSettlementModal ? "modal-open" : ""}`}>
        <div className="modal-box max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Record Settlement</h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowSettlementModal(false)}>
              Close
            </button>
          </div>
          <p className="mt-2 text-[11px] text-base-content/65">
            Request a settlement after payment outside the app. Balances update only after receiver confirms.
          </p>

          {(settlementData?.suggestedTransfers || []).length > 0 ? (
            <div className="mt-2 space-y-1.5 rounded-lg border border-base-300/70 bg-base-100/70 p-2">
              <p className="text-[11px] font-semibold text-base-content/65">Quick pick from suggested settlements</p>
              {(settlementData?.suggestedTransfers || []).slice(0, 3).map((item, index) => {
                const fromName = displayNameFromId(item.fromUser);
                const toName = displayNameFromId(item.toUser);
                return (
                  <button
                    key={`${item.fromUser}-${item.toUser}-${index}`}
                    type="button"
                    className="btn btn-ghost btn-xs h-auto min-h-0 w-full justify-between px-2 py-1.5 text-[11px]"
                    onClick={() =>
                      setSettlementForm((prev) => ({
                        ...prev,
                        fromUser: String(item.fromUser),
                        toUser: String(item.toUser),
                        amount: String(Math.max(1, Math.round(Number(item.amount || 0)))),
                      }))
                    }
                  >
                    <span className="truncate text-left">{fromName} pays {toName}</span>
                    <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <form className="mt-2 space-y-2" onSubmit={submitSettlement}>
            <select
              className="select select-bordered select-sm w-full"
              value={settlementForm.fromUser}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, fromUser: event.target.value }))}
            >
              <option value="">From: who paid now</option>
              {(selectedWorkspace?.members || []).map((member) => (
                <option key={`from-${String(member._id || member)}`} value={String(member._id || member)}>
                  {member.fullName || "Member"}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered select-sm w-full"
              value={settlementForm.toUser}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, toUser: event.target.value }))}
            >
              <option value="">To: who received now</option>
              {(selectedWorkspace?.members || []).map((member) => (
                <option key={`to-${String(member._id || member)}`} value={String(member._id || member)}>
                  {member.fullName || "Member"}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              className="input input-bordered input-sm w-full"
              value={settlementForm.amount}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="Settlement amount"
            />
            <input
              className="input input-bordered input-sm w-full"
              value={settlementForm.note}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Note (optional)"
            />
            <select
              className="select select-bordered select-sm w-full"
              value={settlementForm.paymentMethod}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
            >
              <option value="upi">Payment method: UPI</option>
              <option value="bank">Payment method: Bank transfer</option>
              <option value="cash">Payment method: Cash</option>
              <option value="card">Payment method: Card</option>
              <option value="other">Payment method: Other</option>
            </select>
            {settlementForm.paymentMethod === "upi" ? (
              <input
                className="input input-bordered input-sm w-full"
                value={settlementForm.payeeUpiId}
                onChange={(event) => setSettlementForm((prev) => ({ ...prev, payeeUpiId: event.target.value }))}
                placeholder="Receiver UPI ID (example@upi)"
              />
            ) : null}
            <input
              className="input input-bordered input-sm w-full"
              value={settlementForm.paymentReference}
              onChange={(event) => setSettlementForm((prev) => ({ ...prev, paymentReference: event.target.value }))}
              placeholder="Transaction reference (optional)"
            />
            {settlementForm.paymentMethod === "upi" && settlementForm.payeeUpiId ? (
              <a
                href={buildUpiLink({
                  upiId: settlementForm.payeeUpiId,
                  payeeName: displayNameFromId(settlementForm.toUser),
                  amount: settlementForm.amount,
                  note: settlementForm.note || "Trip settlement",
                })}
                className="btn btn-sm btn-ghost w-full"
              >
                Open UPI app
              </a>
            ) : null}
            <button type="submit" className="btn btn-sm btn-outline w-full" disabled={settleMutation.isPending || isWorkspaceArchived}>
              Request settlement
            </button>
          </form>

          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/60">Pending confirmations</p>
            {(settlementData?.pendingRequests || []).slice(0, 4).map((entry) => {
              const canRespond = String(entry?.toUser?._id || entry?.toUser || "") === String(authUser?._id || "");
              return (
                <div key={entry._id} className="rounded-lg border border-base-300/70 bg-base-100/85 p-2 text-[11px] text-base-content/75">
                  <p>
                    <span className="font-semibold">{entry.fromUser?.fullName || "Member"}</span> requested to pay{" "}
                    <span className="font-semibold">{entry.toUser?.fullName || "Member"}</span>{" "}
                    <span className="font-semibold">{formatCurrency(entry.amount)}</span>
                  </p>
                  {entry.note ? <p className="mt-0.5 text-base-content/60">Note: {entry.note}</p> : null}
                  {entry.paymentReference ? <p className="mt-0.5 text-base-content/60">Ref: {entry.paymentReference}</p> : null}
                  {entry.paymentMethod === "upi" && entry.payeeUpiId ? (
                    <a
                      href={buildUpiLink({
                        upiId: entry.payeeUpiId,
                        payeeName: entry.toUser?.fullName,
                        amount: entry.amount,
                        note: entry.note || "Trip settlement",
                      })}
                      className="mt-1 inline-flex text-[10px] font-medium text-primary hover:underline"
                    >
                      Pay via UPI
                    </a>
                  ) : null}
                  {canRespond ? (
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={() => respondSettlementMutation.mutate({ settlementId: entry._id, action: "confirm" })}
                        disabled={respondSettlementMutation.isPending}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => respondSettlementMutation.mutate({ settlementId: entry._id, action: "reject" })}
                        disabled={respondSettlementMutation.isPending}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-base-content/60">Waiting for receiver confirmation.</p>
                  )}
                </div>
              );
            })}
            {(settlementData?.pendingRequests || []).length === 0 ? (
              <p className="text-[11px] text-base-content/60">No pending settlement requests.</p>
            ) : null}
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/60">Recent settlements</p>
            {(settlementData?.history || []).slice(0, 4).map((entry) => (
              <div key={entry._id} className="rounded-lg border border-base-300/70 bg-base-100/85 p-2 text-[11px] text-base-content/75">
                <p>
                  <span className="font-semibold">{entry.fromUser?.fullName || "Member"}</span> paid{" "}
                  <span className="font-semibold">{entry.toUser?.fullName || "Member"}</span>{" "}
                  <span className="font-semibold">{formatCurrency(entry.amount)}</span>
                </p>
                {entry.note ? <p className="mt-0.5 text-base-content/60">Note: {entry.note}</p> : null}
              </div>
            ))}
            {(settlementData?.history || []).length === 0 ? (
              <p className="text-[11px] text-base-content/60">No settlements recorded yet.</p>
            ) : null}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowSettlementModal(false)}>
            close
          </button>
        </form>
      </dialog>

      {editingExpense ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit Expense</h3>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingExpense(null)}>
                Close
              </button>
            </div>

            <form className="mt-3 space-y-2" onSubmit={submitEditExpense}>
              <input
                className="input input-bordered input-sm w-full"
                value={editExpenseForm.title}
                onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Expense title"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  min="1"
                  className="input input-bordered input-sm"
                  value={editExpenseForm.amount}
                  onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="Amount"
                />
                <input
                  type="number"
                  min="1"
                  className="input input-bordered input-sm"
                  value={editExpenseForm.splitBetween}
                  onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, splitBetween: Number(event.target.value || 1) }))}
                  placeholder="Split between"
                />
              </div>
              <select
                className="select select-bordered select-sm w-full"
                value={editExpenseForm.paidBy}
                onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, paidBy: event.target.value }))}
              >
                {(selectedWorkspace?.members || []).map((member) => (
                  <option key={`edit-paid-${String(member._id || member)}`} value={String(member._id || member)}>
                    Paid by {member.fullName || "Member"}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm w-full"
                value={editExpenseForm.category}
                onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                <option value="other">Category: Other</option>
                <option value="food">Food</option>
                <option value="stay">Stay</option>
                <option value="transport">Transport</option>
                <option value="activities">Activities</option>
                <option value="shopping">Shopping</option>
              </select>
              <select
                className="select select-bordered select-sm w-full"
                value={editExpenseForm.splitType}
                onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, splitType: event.target.value }))}
              >
                <option value="equal">Equal split</option>
                <option value="custom">Custom amount split</option>
                <option value="percentage">Percentage split</option>
              </select>

              {editExpenseForm.splitType !== "equal" ? (
                <div className="rounded-lg border border-base-300/70 bg-base-100/70 p-2">
                  <p className="text-[11px] font-semibold text-base-content/65">
                    Set {editExpenseForm.splitType === "percentage" ? "percentage" : "amount"} per member
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    {(selectedWorkspace?.members || []).map((member) => {
                      const memberId = String(member?._id || member);
                      return (
                        <label key={`edit-split-${memberId}`} className="flex items-center justify-between gap-2 text-xs">
                          <span>{member.fullName || "Member"}</span>
                          <input
                            type="number"
                            min="0"
                            className="input input-bordered input-xs w-28"
                            value={editSplitValues[memberId] || ""}
                            onChange={(event) =>
                              setEditSplitValues((prev) => ({
                                ...prev,
                                [memberId]: event.target.value,
                              }))
                            }
                            placeholder={editExpenseForm.splitType === "percentage" ? "%" : "Amount"}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                value={editExpenseForm.reason}
                onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="Why update? (required)"
                rows={2}
                required
              />
              <label className="form-control">
                <span className="label-text text-[11px]">Replace receipt (optional)</span>
                <input
                  type="file"
                  className="file-input file-input-bordered file-input-sm w-full"
                  accept="image/*,application/pdf"
                  onChange={(event) =>
                    setEditExpenseForm((prev) => ({
                      ...prev,
                      receipt: event.target.files?.[0] || null,
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-sm w-full"
                disabled={updateExpenseMutation.isPending || !String(editExpenseForm.reason || "").trim()}
              >
                Save update
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {historyExpense ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Expense History</h3>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setHistoryExpense(null);
                  setHistoryOnlyWithReason(false);
                  setHistoryOnlyByMe(false);
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-base-300/70 bg-base-100/80 p-2 text-xs">
              <p className="font-semibold text-base-content">{historyExpense.title || "Expense"}</p>
              <p className="text-base-content/70">Current: {formatCurrency(historyExpense.amount)}</p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <label className="label cursor-pointer gap-2 rounded-lg border border-base-300/70 bg-base-100/80 px-2 py-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={historyOnlyWithReason}
                  onChange={() => setHistoryOnlyWithReason((prev) => !prev)}
                />
                <span className="text-xs">Only with reason</span>
              </label>
              <label className="label cursor-pointer gap-2 rounded-lg border border-base-300/70 bg-base-100/80 px-2 py-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={historyOnlyByMe}
                  onChange={() => setHistoryOnlyByMe((prev) => !prev)}
                />
                <span className="text-xs">Only by me</span>
              </label>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredHistoryEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-base-300/70 bg-base-100/70 p-3 text-xs text-base-content/65">
                  No updates match selected filters.
                </div>
              ) : (
                filteredHistoryEntries.map((entry, index) => (
                    <div key={`${entry.updatedAt || index}-${entry.updatedBy?._id || index}`} className="rounded-lg border border-base-300/70 bg-base-100/90 p-3 text-xs">
                      <p className="font-semibold text-base-content">{entry.updatedBy?.fullName || "Member"}</p>
                      <p className="text-base-content/70">{new Date(entry.updatedAt || Date.now()).toLocaleString("en-IN")}</p>
                      {entry.reason ? <p className="mt-1 text-base-content/80">Reason: {entry.reason}</p> : <p className="mt-1 text-base-content/60">No reason provided</p>}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
