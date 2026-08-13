const NOTIFICATION_TYPES = {
  WORKSPACE_INVITE: "expense_workspace_invite",
  SETTLEMENT_REQUEST: "expense_settlement_request",
  SETTLEMENT_RESULT: "expense_settlement_result",
  SETTLEMENT_REMINDER: "expense_settlement_reminder",
};

function normalizeId(value) {
  return value === undefined || value === null ? "" : String(value);
}

export const EXPENSE_INBOX_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPES.WORKSPACE_INVITE,
  NOTIFICATION_TYPES.SETTLEMENT_REQUEST,
  NOTIFICATION_TYPES.SETTLEMENT_RESULT,
  NOTIFICATION_TYPES.SETTLEMENT_REMINDER,
]);

export function toWorkspaceInviteNotificationDTO({ recipientId, actorId, workspaceId, workspaceName, actorName }) {
  return {
    recipient: normalizeId(recipientId),
    actor: normalizeId(actorId),
    type: NOTIFICATION_TYPES.WORKSPACE_INVITE,
    message: `${actorName || "A friend"} invited you to join expense workspace: ${workspaceName}`,
    session: normalizeId(workspaceId),
  };
}

export function toSettlementRequestNotificationDTO({ recipientId, actorId, workspaceId, workspaceName, amount }) {
  return {
    recipient: normalizeId(recipientId),
    actor: normalizeId(actorId),
    type: NOTIFICATION_TYPES.SETTLEMENT_REQUEST,
    message: `Settlement request: ${amount} pending confirmation in ${workspaceName}`,
    session: normalizeId(workspaceId),
  };
}

export function toSettlementResultNotificationDTO({ recipientId, actorId, workspaceId, message }) {
  return {
    recipient: normalizeId(recipientId),
    actor: normalizeId(actorId),
    type: NOTIFICATION_TYPES.SETTLEMENT_RESULT,
    message: String(message || ""),
    session: normalizeId(workspaceId),
  };
}

export function toSettlementReminderNotificationDTO({ recipientId, actorId, workspaceId, workspaceName, amount }) {
  return {
    recipient: normalizeId(recipientId),
    actor: normalizeId(actorId),
    type: NOTIFICATION_TYPES.SETTLEMENT_REMINDER,
    message: `Reminder: you have pending settlement of around Rs ${Math.round(Number(amount || 0))} in ${workspaceName}`,
    session: normalizeId(workspaceId),
  };
}

export function buildUnreadWorkspaceInviteQuery({ recipientId, actorId, workspaceId }) {
  return {
    recipient: normalizeId(recipientId),
    actor: normalizeId(actorId),
    type: NOTIFICATION_TYPES.WORKSPACE_INVITE,
    session: normalizeId(workspaceId),
    read: false,
  };
}
