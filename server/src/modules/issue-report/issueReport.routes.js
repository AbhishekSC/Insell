import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import {
  createIssueRules,
  getIssuesByPgRules,
  updateIssueRules,
  issueIdRules,
  pgIdRules,
} from "../../validators/issueReport.validator.js";
import {
  createIssue,
  getIssuesByPg,
  getMyIssues,
  getIssueById,
  updateIssueStatus,
  getPgIssueStats,
} from "./issueReport.controller.js";

const router = Router();

router.post("/", verifyUser, requireVerified, createIssueRules, validateRequest, createIssue);
router.get("/mine", verifyUser, requireVerified, getMyIssues);
router.get("/pg/:pgId", verifyUser, requireVerified, getIssuesByPgRules, validateRequest, getIssuesByPg);
router.get("/pg/:pgId/stats", verifyUser, requireVerified, pgIdRules, validateRequest, getPgIssueStats);
router.get("/:issueId", verifyUser, requireVerified, issueIdRules, validateRequest, getIssueById);
router.patch("/:issueId", verifyUser, requireVerified, updateIssueRules, validateRequest, updateIssueStatus);

export default router;
