import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { uploadExpenseReceipt } from "../middlewares/upload.middleware.js";
import {
  archiveExpenseWorkspace,
  createExpenseSettlement,
  createExpenseWorkspace,
  createSharedExpense,
  exportExpenseCsv,
  getExpenseAnalytics,
  getExpenseSettlements,
  getExpenseWorkspaceDetail,
  getExpenseWorkspaces,
  inviteExpenseWorkspaceMember,
  markExpenseNotificationRead,
  removeExpenseWorkspaceMember,
  respondExpenseSettlement,
  respondExpenseWorkspaceInvite,
  sendSettlementReminders,
  updateSharedExpense,
  updateWorkspaceBudget,
} from "../controllers/expense.controller.js";

const router = new express.Router();

router.use(verifyUser);

router.get("/workspaces", getExpenseWorkspaces);
router.post("/workspaces", createExpenseWorkspace);
router.get("/workspaces/:id", getExpenseWorkspaceDetail);
router.post("/workspaces/:id/invite", inviteExpenseWorkspaceMember);
router.delete("/workspaces/:id/members/:memberId", removeExpenseWorkspaceMember);
router.patch("/workspaces/:id/archive", archiveExpenseWorkspace);
router.patch("/workspaces/:id/budget", updateWorkspaceBudget);
router.get("/workspaces/:id/analytics", getExpenseAnalytics);
router.get("/workspaces/:id/settlements", getExpenseSettlements);
router.post("/workspaces/:id/settlements", createExpenseSettlement);
router.patch("/workspaces/:id/settlements/:settlementId/respond", respondExpenseSettlement);
router.post("/workspaces/:id/reminders/send", sendSettlementReminders);
router.get("/workspaces/:id/export.csv", exportExpenseCsv);
router.post("/workspaces/:id/expenses", uploadExpenseReceipt.single("receipt"), createSharedExpense);
router.patch("/workspaces/:id/expenses/:expenseId", uploadExpenseReceipt.single("receipt"), updateSharedExpense);
router.post("/invites/:notificationId/respond", respondExpenseWorkspaceInvite);
router.post("/notifications/:notificationId/read", markExpenseNotificationRead);

export default router;
