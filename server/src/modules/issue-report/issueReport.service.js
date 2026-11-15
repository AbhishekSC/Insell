import * as repo from "./issueReport.repository.js";
import { logger } from "../../utils/logger.js";

export async function createIssue(reporterId, data) {
  const pg = await repo.findPgPost(data.pgId);
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "Issues can only be reported for PG/Hostel listings" } };
  }
  if (String(pg.author) === String(reporterId)) {
    return { error: { status: 400, message: "You cannot report issues on your own PG" } };
  }

  const issue = await repo.create({
    reporter: reporterId,
    pg: data.pgId,
    category: data.category,
    title: data.title,
    description: data.description || "",
    photos: data.photos,
    priority: data.priority || "medium",
  });

  logger.info(`[ISSUE REPORT] User ${reporterId} reported "${data.category}" issue on PG ${data.pgId}`);
  return { issue };
}

export async function getIssuesByPg(pgId, userId, opts) {
  const pg = await repo.findPgPost(pgId);
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };

  return repo.findByPg(pgId, opts);
}

export async function getMyIssues(reporterId, opts) {
  return repo.findByReporter(reporterId, opts);
}

export async function getIssueById(issueId) {
  const issue = await repo.findById(issueId);
  if (!issue) return { error: { status: 404, message: "Issue not found" } };
  return { issue };
}

export async function updateIssueStatus(issueId, userId, data) {
  const issue = await repo.findById(issueId);
  if (!issue) return { error: { status: 404, message: "Issue not found" } };

  const pg = await repo.findPgPost(issue.pg);
  const isOwner = pg && String(pg.author) === String(userId);
  const isReporter = String(issue.reporter._id || issue.reporter) === String(userId);

  if (!isOwner && !isReporter) {
    return { error: { status: 403, message: "Only the PG owner or reporter can update this issue" } };
  }

  const updates = {};
  if (data.status) {
    updates.status = data.status;
    if (data.status === "acknowledged") updates.acknowledgedAt = new Date();
    if (data.status === "resolved") updates.resolvedAt = new Date();
    if (data.status === "closed") updates.closedAt = new Date();
  }
  if (data.ownerResponse && isOwner) {
    updates.ownerResponse = data.ownerResponse;
  }

  const updated = await repo.updateStatus(issueId, updates);

  if (updates.resolvedAt) {
    try {
      const avgHours = await repo.getAvgResolutionTimeHours(issue.pg);
      if (avgHours != null) {
        const PropertyPost = (await import("../../models/PropertyPost.model.js")).default;
        await PropertyPost.findByIdAndUpdate(issue.pg, {
          "postMeta.pgHostel.issueResponseTimeHours": avgHours,
        });
      }
    } catch (err) {
      logger.warn(`[ISSUE REPORT] Failed to update avg resolution time: ${err.message}`);
    }
  }

  return { issue: updated };
}

export async function getPgIssueStats(pgId) {
  const [openCount, avgResolutionHours] = await Promise.all([
    repo.getOpenCountByPg(pgId),
    repo.getAvgResolutionTimeHours(pgId),
  ]);
  return { openCount, avgResolutionHours };
}
