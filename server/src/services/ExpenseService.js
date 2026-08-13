import ExpenseWorkspace from "../models/ExpenseWorkspace.model.js";
import ExpenseSettlement from "../models/ExpenseSettlement.model.js";
import Notification from "../models/Notification.model.js";
import SharedExpense from "../models/SharedExpense.model.js";
import User from "../models/User.model.js";
import {
  createExpenseSettlementReminderNotifications,
  createExpenseSettlementRequestNotification,
  createExpenseSettlementResultNotifications,
  createExpenseWorkspaceInviteNotification,
  createExpenseWorkspaceInviteNotificationsBatch,
  EXPENSE_INBOX_NOTIFICATION_TYPES,
  markExpenseWorkspaceInviteNotificationsRead,
} from "../services/expenseNotification.service.js";
import { logger } from "../utils/logger.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";

function toIdSet(ids = []) {
  return new Set((ids || []).map((id) => String(id)));
}

function parseJsonInput(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculateSuggestedTransfers(balanceMap) {
  const creditors = [];
  const debtors = [];

  for (const [userId, balance] of Object.entries(balanceMap)) {
    const amount = round2(balance);
    if (amount > 0.01) creditors.push({ userId, amount });
    if (amount < -0.01) debtors.push({ userId, amount: Math.abs(amount) });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const settleAmount = round2(Math.min(debtors[i].amount, creditors[j].amount));
    if (settleAmount > 0) {
      transfers.push({ fromUser: debtors[i].userId, toUser: creditors[j].userId, amount: settleAmount });
    }
    debtors[i].amount = round2(debtors[i].amount - settleAmount);
    creditors[j].amount = round2(creditors[j].amount - settleAmount);
    if (debtors[i].amount <= 0.01) i += 1;
    if (creditors[j].amount <= 0.01) j += 1;
  }
  return transfers;
}

async function getWorkspaceWithAccess(workspaceId, currentUserId) {
  const workspace = await ExpenseWorkspace.findById(workspaceId)
    .populate("admin", "fullName profilePic")
    .populate("members", "fullName profilePic")
    .populate("pendingInvites", "fullName profilePic")
    .lean();

  if (!workspace) {
    return { error: { code: 404, message: "Workspace not found" } };
  }

  const isAdmin = String(workspace.admin?._id || workspace.admin) === String(currentUserId);
  const isMember = (workspace.members || []).some((member) => String(member?._id || member) === String(currentUserId));
  if (!isAdmin && !isMember) {
    return { error: { code: 403, message: "You are not part of this workspace" } };
  }

  return { workspace, isAdmin, isMember };
}

async function computeWorkspaceBalances(workspaceId) {
  const [expenses, settlements] = await Promise.all([
    SharedExpense.find({ workspace: workspaceId }).select("amount paidBy splitBetween splits splitType participants").lean(),
    ExpenseSettlement.find({
      workspace: workspaceId,
      $or: [{ status: "confirmed" }, { status: { $exists: false } }],
    })
      .select("fromUser toUser amount")
      .lean(),
  ]);

  const balances = {};
  for (const expense of expenses) {
    const payerId = String(expense.paidBy);
    balances[payerId] = round2((balances[payerId] || 0) + Number(expense.amount || 0));

    if ((expense.splits || []).length > 0) {
      for (const split of expense.splits) {
        const splitUserId = String(split.user);
        balances[splitUserId] = round2((balances[splitUserId] || 0) - Number(split.amount || 0));
      }
      continue;
    }

    const participantIds = (expense.participants || []).map((id) => String(id));
    const count = participantIds.length || Math.max(1, Number(expense.splitBetween || 1));
    const eachShare = Number(expense.amount || 0) / count;
    if (participantIds.length > 0) {
      for (const participantId of participantIds) {
        balances[participantId] = round2((balances[participantId] || 0) - eachShare);
      }
    }
  }

  for (const settlement of settlements) {
    const fromUserId = String(settlement.fromUser);
    const toUserId = String(settlement.toUser);
    const amount = Number(settlement.amount || 0);
    balances[fromUserId] = round2((balances[fromUserId] || 0) + amount);
    balances[toUserId] = round2((balances[toUserId] || 0) - amount);
  }

  return {
    balances,
    suggestedTransfers: calculateSuggestedTransfers(balances),
  };
}

export async function getExpenseWorkspaces(req, res) {
  try {
    const currentUserId = req.user?._id;
    const [workspaces, inviteNotifications] = await Promise.all([
      ExpenseWorkspace.find({
        $or: [{ admin: currentUserId }, { members: currentUserId }],
      })
        .populate("admin", "fullName profilePic")
        .populate("members", "fullName profilePic")
        .populate("pendingInvites", "fullName profilePic")
        .sort({ createdAt: -1 })
        .lean(),
      Notification.find({
        recipient: currentUserId,
        type: { $in: EXPENSE_INBOX_NOTIFICATION_TYPES },
        read: false,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("actor", "fullName profilePic")
        .populate("session", "name")
        .lean(),
    ]);

    return sendSuccessResponse(res, 200, "Expense workspaces fetched successfully", {
      workspaces,
      inviteNotifications,
    });
  } catch (error) {
    logger.error("Error fetching expense workspaces:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createExpenseWorkspace(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { name, memberIds = [], budgetLimit = 0, budgetAlertThresholds = [50, 80, 100], reminderEnabled = true } = req.body || {};

    if (!name || !String(name).trim()) {
      return sendErrorResponse(res, 400, "Workspace name is required");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    if (!currentUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const friendIds = toIdSet(currentUser.friends || []);
    const normalizedMemberIds = [...new Set((memberIds || []).map((id) => String(id)))]
      .filter((id) => friendIds.has(id));

    const workspace = await ExpenseWorkspace.create({
      name: String(name).trim(),
      admin: currentUserId,
      members: [String(currentUserId)],
      pendingInvites: normalizedMemberIds,
      budgetLimit: Math.max(0, Number(budgetLimit || 0)),
      budgetAlertThresholds: (Array.isArray(budgetAlertThresholds) ? budgetAlertThresholds : [50, 80, 100])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0 && value <= 300)
        .sort((a, b) => a - b),
      reminderEnabled: Boolean(reminderEnabled),
    });

    if (normalizedMemberIds.length > 0) {
      await createExpenseWorkspaceInviteNotificationsBatch({
        recipientIds: normalizedMemberIds,
        actorId: currentUserId,
        workspaceId: workspace._id,
        workspaceName: String(name).trim(),
        actorName: currentUser?.fullName,
      });
    }

    const populatedWorkspace = await ExpenseWorkspace.findById(workspace._id)
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .populate("pendingInvites", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Expense workspace created successfully", { workspace: populatedWorkspace });
  } catch (error) {
    logger.error("Error creating expense workspace:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getExpenseWorkspaceDetail(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }
    const { workspace, isAdmin } = access;

    const expenses = await SharedExpense.find({ workspace: id })
      .populate("paidBy", "fullName profilePic")
      .populate("createdBy", "fullName profilePic")
      .populate("updatedBy", "fullName profilePic")
      .populate("updateHistory.updatedBy", "fullName profilePic")
      .populate("splits.user", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const budgetUsagePercent = workspace.budgetLimit > 0 ? round2((totalSpent / workspace.budgetLimit) * 100) : 0;

    return sendSuccessResponse(res, 200, "Expense workspace detail fetched successfully", {
      workspace,
      expenses,
      stats: {
        totalSpent: round2(totalSpent),
        budgetUsagePercent,
      },
      permissions: {
        isAdmin,
        canInvite: isAdmin,
        canManageMembers: isAdmin,
        canArchive: isAdmin,
        canAddExpense: !workspace.archivedAt,
      },
    });
  } catch (error) {
    logger.error("Error fetching expense workspace detail:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function inviteExpenseWorkspaceMember(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { memberId } = req.body || {};

    if (!memberId) {
      return sendErrorResponse(res, 400, "Member id is required");
    }

    const workspace = await ExpenseWorkspace.findById(id);
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }

    if (String(workspace.admin) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can invite members");
    }

    if (workspace.archivedAt) {
      return sendErrorResponse(res, 400, "Archived workspace cannot be updated");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    const friendIds = toIdSet(currentUser?.friends || []);
    if (!friendIds.has(String(memberId))) {
      return sendErrorResponse(res, 400, "You can only invite your friends");
    }

    const invitee = await User.findById(memberId).select("_id").lean();
    if (!invitee) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (String(memberId) === String(currentUserId)) {
      return sendErrorResponse(res, 400, "Admin is already part of this workspace");
    }

    const memberExists = toIdSet(workspace.members || []).has(String(memberId));
    const invitePending = toIdSet(workspace.pendingInvites || []).has(String(memberId));
    if (memberExists || invitePending) {
      return sendErrorResponse(res, 400, "User is already a member or invited");
    }

    workspace.pendingInvites = [...(workspace.pendingInvites || []), memberId];
    await workspace.save();

    await createExpenseWorkspaceInviteNotification({
      recipientId: memberId,
      actorId: currentUserId,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      actorName: currentUser?.fullName,
    });

    return sendSuccessResponse(res, 200, "Workspace invite sent successfully", { workspaceId: workspace._id });
  } catch (error) {
    logger.error("Error inviting workspace member:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function respondExpenseWorkspaceInvite(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { notificationId } = req.params;
    const { action } = req.body || {};

    if (!["accept", "reject"].includes(String(action))) {
      return sendErrorResponse(res, 400, "Valid action is required");
    }

    const notification = await Notification.findById(notificationId);
    if (!notification || notification.type !== "expense_workspace_invite") {
      return sendErrorResponse(res, 404, "Invite notification not found");
    }

    if (String(notification.recipient) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "You are not allowed to respond to this invite");
    }

    const workspace = await ExpenseWorkspace.findById(notification.session);
    if (!workspace) {
      notification.read = true;
      await notification.save();
      return sendErrorResponse(res, 404, "Workspace not found");
    }

    if (workspace.archivedAt) {
      notification.read = true;
      await notification.save();
      return sendErrorResponse(res, 400, "Workspace is archived");
    }

    workspace.pendingInvites = (workspace.pendingInvites || []).filter((id) => String(id) !== String(currentUserId));
    if (action === "accept") {
      workspace.members = [...new Set([...(workspace.members || []).map((id) => String(id)), String(currentUserId)])];
    }

    await workspace.save();
    notification.read = true;
    await notification.save();

    return sendSuccessResponse(res, 200, `Workspace invite ${action}ed successfully`, {
      action,
      workspaceId: workspace._id,
    });
  } catch (error) {
    logger.error("Error responding to workspace invite:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createSharedExpense(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const body = req.body || {};
    const title = body.title;
    const amount = body.amount;
    const paidBy = body.paidBy;
    const splitBetween = body.splitBetween;
    const category = String(body.category || "other").toLowerCase();
    const splitType = String(body.splitType || "equal").toLowerCase();
    const participantsInput = parseJsonInput(body.participants, []);
    const splitsInput = parseJsonInput(body.splits, []);

    if (!title || !String(title).trim()) {
      return sendErrorResponse(res, 400, "Expense title is required");
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return sendErrorResponse(res, 400, "A valid amount is required");
    }

    const workspace = await ExpenseWorkspace.findById(id).select("admin members archivedAt budgetLimit budgetAlertThresholds").lean();
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }

    if (workspace.archivedAt) {
      return sendErrorResponse(res, 400, "Workspace is archived");
    }

    const isAdmin = String(workspace.admin) === String(currentUserId);
    const isMember = (workspace.members || []).some((memberId) => String(memberId) === String(currentUserId));
    if (!isAdmin && !isMember) {
      return sendErrorResponse(res, 403, "Only workspace members can add expenses");
    }

    const memberSet = toIdSet(workspace.members || []);
    const resolvedPaidBy = paidBy && memberSet.has(String(paidBy)) ? String(paidBy) : String(currentUserId);

    let participants = Array.isArray(participantsInput) ? participantsInput.map((idVal) => String(idVal)) : [];
    participants = [...new Set(participants)].filter((idVal) => memberSet.has(idVal));
    if (participants.length === 0) {
      participants = [...memberSet];
    }

    const splitCount = Math.max(1, Number(splitBetween || participants.length || memberSet.size || 1));
    const allowedCategories = new Set(["food", "stay", "transport", "activities", "shopping", "other"]);
    const resolvedCategory = allowedCategories.has(category) ? category : "other";

    let splits = [];
    if (splitType === "custom" || splitType === "percentage") {
      const incomingSplits = Array.isArray(splitsInput) ? splitsInput : [];
      const normalized = incomingSplits
        .map((row) => ({
          user: String(row.user || row.userId || ""),
          value: Number(row.value ?? row.amount ?? row.percentage ?? 0),
        }))
        .filter((row) => memberSet.has(row.user) && Number.isFinite(row.value) && row.value >= 0);

      const dedupMap = new Map();
      for (const row of normalized) dedupMap.set(row.user, row.value);

      const deduped = [...dedupMap.entries()].map(([user, value]) => ({ user, value }));
      if (deduped.length > 0) {
        if (splitType === "percentage") {
          const percentageSum = deduped.reduce((sum, row) => sum + row.value, 0);
          if (Math.abs(percentageSum - 100) > 0.5) {
            return sendErrorResponse(res, 400, "Percentage split must total 100");
          }
          splits = deduped.map((row) => ({
            user: row.user,
            percentage: round2(row.value),
            amount: round2((normalizedAmount * row.value) / 100),
          }));
        } else {
          const amountSum = deduped.reduce((sum, row) => sum + row.value, 0);
          if (Math.abs(amountSum - normalizedAmount) > 2) {
            return sendErrorResponse(res, 400, "Custom split amounts must match total");
          }
          splits = deduped.map((row) => ({ user: row.user, amount: round2(row.value) }));
        }
      }
    }

    if (splits.length === 0) {
      const eachShare = round2(normalizedAmount / participants.length);
      splits = participants.map((userId) => ({ user: userId, amount: eachShare }));
    }

    const warningFlags = [];
    if (normalizedAmount >= 50000) {
      warningFlags.push("high_amount");
    }
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentDuplicate = await SharedExpense.findOne({
      workspace: id,
      title: String(title).trim(),
      amount: normalizedAmount,
      paidBy: resolvedPaidBy,
      createdAt: { $gte: tenMinutesAgo },
    }).lean();
    if (recentDuplicate) {
      warningFlags.push("possible_duplicate");
    }

    const receiptUrl = req.file ? req.file.path : "";

    const expense = await SharedExpense.create({
      workspace: id,
      title: String(title).trim(),
      amount: normalizedAmount,
      paidBy: resolvedPaidBy,
      category: resolvedCategory,
      splitType: ["equal", "custom", "percentage"].includes(splitType) ? splitType : "equal",
      participants,
      splits,
      splitBetween: splitCount,
      receiptUrl,
      warningFlags,
      createdBy: currentUserId,
    });

    // Protect against timing races where archive happens between validation and insert.
    const lockState = await ExpenseWorkspace.findById(id).select("archivedAt").lean();
    if (lockState?.archivedAt) {
      const archivedAtMs = new Date(lockState.archivedAt).getTime();
      const expenseCreatedAtMs = new Date(expense.createdAt).getTime();

      if (Number.isFinite(archivedAtMs) && Number.isFinite(expenseCreatedAtMs) && expenseCreatedAtMs >= archivedAtMs) {
        await SharedExpense.deleteOne({ _id: expense._id });
        return sendErrorResponse(res, 400, "Workspace is archived");
      }
    }

    const populatedExpense = await SharedExpense.findById(expense._id)
      .populate("paidBy", "fullName profilePic")
      .populate("createdBy", "fullName profilePic")
      .populate("updatedBy", "fullName profilePic")
      .populate("updateHistory.updatedBy", "fullName profilePic")
      .populate("splits.user", "fullName profilePic")
      .lean();

    let budgetAlert = null;
    if (Number(workspace.budgetLimit || 0) > 0) {
      const totalSpent = await SharedExpense.aggregate([
        { $match: { workspace: expense.workspace } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const spent = Number(totalSpent?.[0]?.total || 0);
      const percent = round2((spent / workspace.budgetLimit) * 100);
      const crossedThreshold = (workspace.budgetAlertThresholds || [50, 80, 100])
        .map((value) => Number(value))
        .sort((a, b) => b - a)
        .find((value) => percent >= value);
      if (crossedThreshold) {
        budgetAlert = { threshold: crossedThreshold, usagePercent: percent };
      }
    }

    return sendSuccessResponse(res, 201, "Expense added successfully", {
      expense: populatedExpense,
      warnings: warningFlags,
      budgetAlert,
    });
  } catch (error) {
    logger.error("Error creating shared expense:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function updateSharedExpense(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, expenseId } = req.params;
    const body = req.body || {};

    const expense = await SharedExpense.findById(expenseId);
    if (!expense || String(expense.workspace) !== String(id)) {
      return sendErrorResponse(res, 404, "Expense not found");
    }

    const workspace = await ExpenseWorkspace.findById(id).select("admin members archivedAt").lean();
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }
    if (workspace.archivedAt) {
      return sendErrorResponse(res, 400, "Workspace is archived");
    }

    const isAdmin = String(workspace.admin) === String(currentUserId);
    const isMember = (workspace.members || []).some((memberId) => String(memberId) === String(currentUserId));
    if (!isAdmin && !isMember) {
      return sendErrorResponse(res, 403, "Only workspace members can edit expenses");
    }

    const memberSet = toIdSet(workspace.members || []);
    const nextTitle = body.title ? String(body.title).trim() : expense.title;
    const nextAmount = body.amount !== undefined ? Number(body.amount) : Number(expense.amount || 0);
    const nextCategory = body.category ? String(body.category).toLowerCase() : expense.category;
    const nextSplitType = body.splitType ? String(body.splitType).toLowerCase() : expense.splitType;
    const nextSplitBetween = body.splitBetween !== undefined
      ? Math.max(1, Number(body.splitBetween || 1))
      : Math.max(1, Number(expense.splitBetween || 1));
    const reason = String(body.reason || "").trim();

    if (!reason) {
      return sendErrorResponse(res, 400, "Update reason is required");
    }

    if (!nextTitle) {
      return sendErrorResponse(res, 400, "Expense title is required");
    }
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return sendErrorResponse(res, 400, "A valid amount is required");
    }

    const resolvedPaidBy = body.paidBy && memberSet.has(String(body.paidBy))
      ? String(body.paidBy)
      : String(expense.paidBy);

    const participantsInput = parseJsonInput(body.participants, expense.participants || []);
    let participants = Array.isArray(participantsInput) ? participantsInput.map((idVal) => String(idVal)) : [];
    participants = [...new Set(participants)].filter((idVal) => memberSet.has(idVal));
    if (participants.length === 0) {
      participants = [...memberSet];
    }

    let splits = [];
    const splitsInput = parseJsonInput(body.splits, []);
    if (nextSplitType === "custom" || nextSplitType === "percentage") {
      const incomingSplits = Array.isArray(splitsInput) ? splitsInput : [];
      const normalized = incomingSplits
        .map((row) => ({
          user: String(row.user || row.userId || ""),
          value: Number(row.value ?? row.amount ?? row.percentage ?? 0),
        }))
        .filter((row) => memberSet.has(row.user) && Number.isFinite(row.value) && row.value >= 0);

      const dedupMap = new Map();
      for (const row of normalized) dedupMap.set(row.user, row.value);
      const deduped = [...dedupMap.entries()].map(([user, value]) => ({ user, value }));

      if (deduped.length > 0) {
        if (nextSplitType === "percentage") {
          const percentageSum = deduped.reduce((sum, row) => sum + row.value, 0);
          if (Math.abs(percentageSum - 100) > 0.5) {
            return sendErrorResponse(res, 400, "Percentage split must total 100");
          }
          splits = deduped.map((row) => ({
            user: row.user,
            percentage: round2(row.value),
            amount: round2((nextAmount * row.value) / 100),
          }));
        } else {
          const amountSum = deduped.reduce((sum, row) => sum + row.value, 0);
          if (Math.abs(amountSum - nextAmount) > 2) {
            return sendErrorResponse(res, 400, "Custom split amounts must match total");
          }
          splits = deduped.map((row) => ({ user: row.user, amount: round2(row.value) }));
        }
      }
    }

    if (splits.length === 0) {
      const eachShare = round2(nextAmount / participants.length);
      splits = participants.map((userId) => ({ user: userId, amount: eachShare }));
    }

    const allowedCategories = new Set(["food", "stay", "transport", "activities", "shopping", "other"]);
    expense.title = nextTitle;
    expense.amount = nextAmount;
    expense.category = allowedCategories.has(nextCategory) ? nextCategory : "other";
    expense.paidBy = resolvedPaidBy;
    expense.splitType = ["equal", "custom", "percentage"].includes(nextSplitType) ? nextSplitType : "equal";
    expense.splitBetween = nextSplitBetween;
    expense.participants = participants;
    expense.splits = splits;
    if (req.file) {
      expense.receiptUrl = req.file.path;
    }
    expense.updatedBy = currentUserId;
    expense.updatedAtCustom = new Date();
    expense.updateReason = reason;
    expense.updateHistory = [
      ...(expense.updateHistory || []),
      {
        updatedBy: currentUserId,
        updatedAt: new Date(),
        reason,
      },
    ].slice(-30);

    await expense.save();

    const populatedExpense = await SharedExpense.findById(expense._id)
      .populate("paidBy", "fullName profilePic")
      .populate("createdBy", "fullName profilePic")
      .populate("updatedBy", "fullName profilePic")
      .populate("updateHistory.updatedBy", "fullName profilePic")
      .populate("splits.user", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 200, "Expense updated successfully", {
      expense: populatedExpense,
    });
  } catch (error) {
    logger.error("Error updating shared expense:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function removeExpenseWorkspaceMember(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, memberId } = req.params;

    const workspace = await ExpenseWorkspace.findById(id);
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }

    if (String(workspace.admin) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can remove members");
    }

    if (workspace.archivedAt) {
      return sendErrorResponse(res, 400, "Archived workspace cannot be updated");
    }

    if (String(memberId) === String(workspace.admin)) {
      return sendErrorResponse(res, 400, "Admin cannot be removed from workspace");
    }

    const isMember = toIdSet(workspace.members || []).has(String(memberId));
    if (!isMember) {
      return sendErrorResponse(res, 404, "Member is not part of this workspace");
    }

    workspace.members = (workspace.members || []).filter((userId) => String(userId) !== String(memberId));
    workspace.pendingInvites = (workspace.pendingInvites || []).filter((userId) => String(userId) !== String(memberId));
    await workspace.save();

    await markExpenseWorkspaceInviteNotificationsRead({
      recipientId: memberId,
      actorId: currentUserId,
      workspaceId: workspace._id,
    });

    return sendSuccessResponse(res, 200, "Member removed successfully", { workspaceId: workspace._id, memberId });
  } catch (error) {
    logger.error("Error removing workspace member:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function archiveExpenseWorkspace(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { archived = true } = req.body || {};

    const workspace = await ExpenseWorkspace.findById(id);
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }

    if (String(workspace.admin) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can archive workspace");
    }

    const shouldArchive =
      archived === true ||
      archived === "true" ||
      archived === 1 ||
      archived === "1";
    workspace.archivedAt = shouldArchive ? new Date() : null;
    workspace.archivedBy = shouldArchive ? currentUserId : null;
    await workspace.save();

    return sendSuccessResponse(
      res,
      200,
      shouldArchive ? "Workspace archived successfully" : "Workspace reopened successfully",
      {
        workspaceId: workspace._id,
        archivedAt: workspace.archivedAt,
      }
    );
  } catch (error) {
    logger.error("Error archiving workspace:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function updateWorkspaceBudget(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { budgetLimit = 0, budgetAlertThresholds = [50, 80, 100], reminderEnabled = true } = req.body || {};

    const workspace = await ExpenseWorkspace.findById(id);
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }
    if (String(workspace.admin) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can update budget settings");
    }

    workspace.budgetLimit = Math.max(0, Number(budgetLimit || 0));
    workspace.budgetAlertThresholds = (Array.isArray(budgetAlertThresholds) ? budgetAlertThresholds : [50, 80, 100])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 300)
      .sort((a, b) => a - b);
    workspace.reminderEnabled = Boolean(reminderEnabled);
    await workspace.save();

    return sendSuccessResponse(res, 200, "Budget settings updated", {
      budgetLimit: workspace.budgetLimit,
      budgetAlertThresholds: workspace.budgetAlertThresholds,
      reminderEnabled: workspace.reminderEnabled,
    });
  } catch (error) {
    logger.error("Error updating workspace budget:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getExpenseAnalytics(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }

    const [byCategory, byPayer] = await Promise.all([
      SharedExpense.aggregate([
        { $match: { workspace: access.workspace._id } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      SharedExpense.aggregate([
        { $match: { workspace: access.workspace._id } },
        { $group: { _id: "$paidBy", totalPaid: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalPaid: -1 } },
      ]),
    ]);

    return sendSuccessResponse(res, 200, "Expense analytics fetched", {
      categoryBreakdown: byCategory,
      payerBreakdown: byPayer,
    });
  } catch (error) {
    logger.error("Error fetching expense analytics:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getExpenseSettlements(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }

    const [calc, settlements] = await Promise.all([
      computeWorkspaceBalances(access.workspace._id),
      ExpenseSettlement.find({ workspace: access.workspace._id })
        .populate("fromUser", "fullName profilePic")
        .populate("toUser", "fullName profilePic")
        .populate("requestedBy", "fullName profilePic")
        .populate("confirmedBy", "fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
    ]);

    const history = settlements.filter(
      (item) => item.status === "confirmed" || !item.status
    );
    const pendingRequests = settlements.filter((item) => item.status === "requested");
    const rejectedRequests = settlements.filter((item) => item.status === "rejected");

    return sendSuccessResponse(res, 200, "Settlement data fetched", {
      balances: calc.balances,
      suggestedTransfers: calc.suggestedTransfers,
      history,
      pendingRequests,
      rejectedRequests,
    });
  } catch (error) {
    logger.error("Error fetching settlements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createExpenseSettlement(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { fromUser, toUser, amount, note = "", paymentMethod = "upi", payeeUpiId = "", paymentReference = "" } = req.body || {};

    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }
    if (access.workspace.archivedAt) {
      return sendErrorResponse(res, 400, "Workspace is archived");
    }

    const memberSet = toIdSet((access.workspace.members || []).map((member) => member._id || member));
    if (!memberSet.has(String(fromUser)) || !memberSet.has(String(toUser))) {
      return sendErrorResponse(res, 400, "Settlement users must be workspace members");
    }
    if (String(fromUser) === String(toUser)) {
      return sendErrorResponse(res, 400, "Payer and receiver cannot be the same user");
    }
    if (String(currentUserId) !== String(fromUser) && !access.isAdmin) {
      return sendErrorResponse(res, 403, "Only payer or admin can request a settlement");
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return sendErrorResponse(res, 400, "Valid settlement amount is required");
    }

    const settlement = await ExpenseSettlement.create({
      workspace: access.workspace._id,
      fromUser,
      toUser,
      amount: round2(normalizedAmount),
      status: "requested",
      note: String(note || "").trim(),
      paymentMethod: ["upi", "bank", "card", "cash", "other"].includes(String(paymentMethod)) ? String(paymentMethod) : "other",
      payeeUpiId: String(payeeUpiId || "").trim(),
      paymentReference: String(paymentReference || "").trim(),
      requestedBy: currentUserId,
      createdBy: currentUserId,
    });

    await createExpenseSettlementRequestNotification({
      recipientId: toUser,
      actorId: currentUserId,
      workspaceId: access.workspace._id,
      workspaceName: access.workspace.name,
      amount: round2(normalizedAmount),
    });

    const populated = await ExpenseSettlement.findById(settlement._id)
      .populate("fromUser", "fullName profilePic")
      .populate("toUser", "fullName profilePic")
      .populate("requestedBy", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Settlement request created", { settlement: populated });
  } catch (error) {
    logger.error("Error creating settlement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function respondExpenseSettlement(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, settlementId } = req.params;
    const { action, reason = "" } = req.body || {};

    if (!["confirm", "reject"].includes(String(action))) {
      return sendErrorResponse(res, 400, "Valid action is required");
    }

    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }

    const settlement = await ExpenseSettlement.findById(settlementId);
    if (!settlement || String(settlement.workspace) !== String(access.workspace._id)) {
      return sendErrorResponse(res, 404, "Settlement request not found");
    }

    if (String(settlement.status || "requested") !== "requested") {
      return sendErrorResponse(res, 400, "Settlement request already processed");
    }

    const canRespond = String(settlement.toUser) === String(currentUserId) || access.isAdmin;
    if (!canRespond) {
      return sendErrorResponse(res, 403, "Only receiver or admin can respond to this request");
    }

    if (String(action) === "confirm") {
      settlement.status = "confirmed";
      settlement.confirmedBy = currentUserId;
      settlement.confirmedAt = new Date();
      settlement.rejectionReason = "";
    } else {
      settlement.status = "rejected";
      settlement.confirmedBy = currentUserId;
      settlement.confirmedAt = new Date();
      settlement.rejectionReason = String(reason || "").trim();
    }

    await settlement.save();

    const resultMessage =
      String(action) === "confirm"
        ? `Settlement confirmed in ${access.workspace.name} for Rs ${round2(settlement.amount)}`
        : `Settlement rejected in ${access.workspace.name}${settlement.rejectionReason ? `: ${settlement.rejectionReason}` : ""}`;

    const recipients = [String(settlement.fromUser), String(settlement.requestedBy)]
      .filter((value, index, array) => array.indexOf(value) === index)
      .filter((value) => value && value !== String(currentUserId));

    await createExpenseSettlementResultNotifications({
      recipientIds: recipients,
      actorId: currentUserId,
      workspaceId: access.workspace._id,
      message: resultMessage,
    });

    const populated = await ExpenseSettlement.findById(settlement._id)
      .populate("fromUser", "fullName profilePic")
      .populate("toUser", "fullName profilePic")
      .populate("requestedBy", "fullName profilePic")
      .populate("confirmedBy", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 200, `Settlement request ${action}ed`, { settlement: populated });
  } catch (error) {
    logger.error("Error responding to settlement request:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function sendSettlementReminders(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const workspace = await ExpenseWorkspace.findById(id).populate("members", "fullName profilePic").lean();
    if (!workspace) {
      return sendErrorResponse(res, 404, "Workspace not found");
    }
    if (String(workspace.admin?._id || workspace.admin) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can send reminders");
    }
    if (!workspace.reminderEnabled) {
      return sendErrorResponse(res, 400, "Reminders are disabled for this workspace");
    }

    const calc = await computeWorkspaceBalances(workspace._id);
    const debtors = Object.entries(calc.balances)
      .filter(([, balance]) => Number(balance) < -1)
      .map(([userId, balance]) => ({ userId, amount: Math.abs(Number(balance)) }));

    if (debtors.length === 0) {
      return sendSuccessResponse(res, 200, "No pending debtors to remind", { remindersSent: 0 });
    }

    await createExpenseSettlementReminderNotifications({
      debtors,
      actorId: currentUserId,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
    });

    return sendSuccessResponse(res, 200, "Reminders sent successfully", { remindersSent: debtors.length });
  } catch (error) {
    logger.error("Error sending settlement reminders:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function markExpenseNotificationRead(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return sendErrorResponse(res, 404, "Notification not found");
    }

    if (String(notification.recipient) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "You are not allowed to update this notification");
    }

    notification.read = true;
    await notification.save();

    return sendSuccessResponse(res, 200, "Notification marked as read", { notificationId });
  } catch (error) {
    logger.error("Error marking expense notification as read:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function exportExpenseCsv(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const access = await getWorkspaceWithAccess(id, currentUserId);
    if (access.error) {
      return sendErrorResponse(res, access.error.code, access.error.message);
    }

    const expenses = await SharedExpense.find({ workspace: access.workspace._id })
      .populate("paidBy", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    const lines = ["title,amount,category,paid_by,split_type,created_at,receipt_url"];
    for (const expense of expenses) {
      const row = [
        `"${String(expense.title || "").replace(/"/g, '""')}"`,
        Number(expense.amount || 0),
        String(expense.category || "other"),
        `"${String(expense.paidBy?.fullName || "Unknown").replace(/"/g, '""')}"`,
        String(expense.splitType || "equal"),
        new Date(expense.createdAt).toISOString(),
        `"${String(expense.receiptUrl || "").replace(/"/g, '""')}"`,
      ];
      lines.push(row.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="expense-export-${access.workspace._id}.csv"`);
    return res.status(200).send(`${lines.join("\n")}\n`);
  } catch (error) {
    logger.error("Error exporting expense csv:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}
