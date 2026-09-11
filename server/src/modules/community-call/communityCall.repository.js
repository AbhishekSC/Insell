import ScheduledCall from "../../models/ScheduledCall.model.js";
import StudyCircle from "../../models/StudyCircle.model.js";

export async function findCircle(circleId) {
  return StudyCircle.findById(circleId).select("name creator members moderators").lean();
}

export async function create({ circleId, scheduledBy, title, scheduledAt }) {
  return ScheduledCall.create({ circle: circleId, scheduledBy, title, scheduledAt });
}

export async function findById(id) {
  return ScheduledCall.findById(id);
}

// Upcoming = not cancelled, start time still ahead of now. Soonest first.
export async function listUpcomingForCircle(circleId) {
  return ScheduledCall.find({
    circle: circleId,
    status: { $in: ["SCHEDULED", "REMINDED"] },
    scheduledAt: { $gte: new Date() },
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
