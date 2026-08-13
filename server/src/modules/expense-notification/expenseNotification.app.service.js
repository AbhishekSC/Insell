import {
  EXPENSE_INBOX_NOTIFICATION_TYPES,
  buildUnreadWorkspaceInviteQuery,
  toSettlementReminderNotificationDTO,
  toSettlementRequestNotificationDTO,
  toSettlementResultNotificationDTO,
  toWorkspaceInviteNotificationDTO,
} from "./expenseNotification.dto.js";
import { createMany, createOne, markManyRead } from "./expenseNotification.repository.js";

function toDedupedIds(ids = []) {
  return [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
}

export { EXPENSE_INBOX_NOTIFICATION_TYPES };

export async function createExpenseWorkspaceInviteNotification(input) {
  return createOne(toWorkspaceInviteNotificationDTO(input));
}

export async function createExpenseWorkspaceInviteNotificationsBatch({ recipientIds, ...rest }) {
  const dedupedRecipientIds = toDedupedIds(recipientIds);
  if (dedupedRecipientIds.length === 0) return [];

  return createMany(
    dedupedRecipientIds.map((recipientId) =>
      toWorkspaceInviteNotificationDTO({ recipientId, ...rest })
    )
  );
}

export async function markExpenseWorkspaceInviteNotificationsRead(input) {
  return markManyRead(buildUnreadWorkspaceInviteQuery(input));
}

export async function createExpenseSettlementRequestNotification(input) {
  return createOne(toSettlementRequestNotificationDTO(input));
}

export async function createExpenseSettlementResultNotifications({ recipientIds, ...rest }) {
  const dedupedRecipientIds = toDedupedIds(recipientIds);
  if (dedupedRecipientIds.length === 0) return [];

  return createMany(
    dedupedRecipientIds.map((recipientId) =>
      toSettlementResultNotificationDTO({ recipientId, ...rest })
    )
  );
}

export async function createExpenseSettlementReminderNotifications({ debtors, actorId, workspaceId, workspaceName }) {
  if (!Array.isArray(debtors) || debtors.length === 0) {
    return [];
  }

  const docs = debtors.map((debtor) =>
    toSettlementReminderNotificationDTO({
      recipientId: debtor.userId,
      actorId,
      workspaceId,
      workspaceName,
      amount: debtor.amount,
    })
  );

  return createMany(docs);
}
