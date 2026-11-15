import IssueReport from "../../models/IssueReport.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";

export async function create(data) {
  return IssueReport.create(data);
}

export async function findById(issueId) {
  return IssueReport.findById(issueId)
    .populate("reporter", "fullName profilePic")
    .lean();
}

export async function findByPg(pgId, { page = 1, limit = 20, status } = {}) {
  const filter = { pg: pgId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [issues, total] = await Promise.all([
    IssueReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reporter", "fullName profilePic")
      .lean(),
    IssueReport.countDocuments(filter),
  ]);
  return { issues, total };
}

export async function findByReporter(reporterId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [issues, total] = await Promise.all([
    IssueReport.find({ reporter: reporterId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("pg", "title city locality")
      .lean(),
    IssueReport.countDocuments({ reporter: reporterId }),
  ]);
  return { issues, total };
}

export async function updateStatus(issueId, updates) {
  return IssueReport.findByIdAndUpdate(issueId, updates, { new: true })
    .populate("reporter", "fullName profilePic")
    .lean();
}

export async function findPgPost(pgId) {
  return PropertyPost.findById(pgId).select("postType author title").lean();
}

export async function getOpenCountByPg(pgId) {
  return IssueReport.countDocuments({ pg: pgId, status: { $in: ["open", "acknowledged", "in_progress"] } });
}

export async function getAvgResolutionTimeHours(pgId) {
  const result = await IssueReport.aggregate([
    { $match: { pg: pgId, resolvedAt: { $exists: true } } },
    {
      $project: {
        resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] },
      },
    },
    { $group: { _id: null, avgMs: { $avg: "$resolutionMs" } } },
  ]);
  if (!result.length) return null;
  return Math.round(result[0].avgMs / (1000 * 60 * 60) * 10) / 10;
}
