import ScheduledCall from "../../models/ScheduledCall.model.js";
import StudyCircle from "../../models/StudyCircle.model.js";
import User from "../../models/User.model.js";

export async function findCircle(circleId) {
  return StudyCircle.findById(circleId).select("name creator members moderators").lean();
}

// Kept separate from findCircle() — that one is used for membership checks
// that compare `members` as raw ObjectIds; this is only for display (the
// reminder email's "who's invited" line), so it's fine for it to shape
// `members` differently.
export async function findMemberNames(memberIds) {
  return User.find({ _id: { $in: memberIds } }).select("fullName").lean();
}

export async function create({ circleId, scheduledBy, title, scheduledAt, durationMinutes }) {
  return ScheduledCall.create({ circle: circleId, scheduledBy, title, scheduledAt, durationMinutes });
}

export async function findById(id) {
  return ScheduledCall.findById(id);
}

// Upcoming = still relevant to show right now: a future call not yet
// started, OR a call that's currently live (STARTED) — the banner should
// keep showing for the whole time people might actually be in the room,
// not just up until its scheduled start time.
export async function listUpcomingForCircle(circleId) {
  return ScheduledCall.find({
    circle: circleId,
    $or: [
      { status: { $in: ["SCHEDULED", "REMINDED"] }, scheduledAt: { $gte: new Date() } },
      { status: "STARTED" },
    ],
  })
    .populate("scheduledBy", "fullName profilePic")
    .sort({ scheduledAt: 1 })
    .lean();
}

export async function cancel(id, userId) {
  return ScheduledCall.findByIdAndUpdate(
    id,
    { $set: { status: "CANCELLED", cancelledBy: userId, cancelledAt: new Date() } },
    { new: true }
  );
}

export async function markReminded(id) {
  return ScheduledCall.findByIdAndUpdate(id, { $set: { status: "REMINDED", reminderSentAt: new Date() } }, { new: true });
}

export async function markStarted(id) {
  return ScheduledCall.findOneAndUpdate(
    { _id: id, status: { $ne: "CANCELLED" } },
    { $set: { status: "STARTED" } },
    { new: true }
  );
}

// Due within the next `withinMs` and never reminded yet — the cron sweep's
// entire query. Deliberately not a tight "9-10 minutes" window: the cron
// runs every ~5 minutes, and a tight window can be skipped entirely by
// timing drift. "Due soon, not yet reminded" is simpler and never misses.
export async function findDueForReminder(withinMs) {
  return ScheduledCall.find({
    status: "SCHEDULED",
    reminderSentAt: null,
    scheduledAt: { $gt: new Date(), $lte: new Date(Date.now() + withinMs) },
  })
    .populate("scheduledBy", "fullName")
    .populate({ path: "circle", select: "name members" })
    .lean();
}

// STARTED calls whose duration has elapsed — a call with no durationMinutes
// set never matches this at all (no limit means never auto-checked). Uses
// $expr for the per-document date arithmetic (scheduledAt + duration).
export async function findStaleStarted() {
  return ScheduledCall.find({
    status: "STARTED",
    durationMinutes: { $ne: null },
    $expr: {
      $lte: [{ $add: ["$scheduledAt", { $multiply: ["$durationMinutes", 60000] }] }, new Date()],
    },
  }).lean();
}

export async function markEnded(id) {
  return ScheduledCall.findOneAndUpdate(
    { _id: id, status: "STARTED" },
    { $set: { status: "ENDED", endedAt: new Date() } },
    { new: true }
  );
}
