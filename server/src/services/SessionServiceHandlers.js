import Session from "../models/Session.model.js";
import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import { sendEmail } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";

function toObjectIdSet(ids = []) {
  return new Set(ids.map((id) => id.toString()));
}

export async function createSession(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { title, mode, scheduledFor, inviteeIds = [] } = req.body || {};

    if (!currentUserId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!title || !String(title).trim()) {
      return sendErrorResponse(res, 400, "Trip session title is required");
    }

    const when = new Date(scheduledFor);
    if (!scheduledFor || Number.isNaN(when.getTime())) {
      return sendErrorResponse(res, 400, "A valid scheduled time is required");
    }

    if (when.getTime() <= Date.now()) {
      return sendErrorResponse(res, 400, "Trip session time must be in the future");
    }

    const normalizedInviteeIds = [...new Set((inviteeIds || []).map((id) => String(id)))].filter(Boolean);

    if (normalizedInviteeIds.length === 0) {
      return sendErrorResponse(res, 400, "At least one invitee is required");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    if (!currentUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const friendSet = toObjectIdSet(currentUser.friends || []);
    const invalidInvitee = normalizedInviteeIds.find((id) => !friendSet.has(id));
    if (invalidInvitee) {
      return sendErrorResponse(res, 400, "Invitees must be in your friends list");
    }

    const session = await Session.create({
      title: String(title).trim(),
      mode: String(mode || "intro").trim(),
      scheduledFor: when,
      createdBy: currentUserId,
      invitees: normalizedInviteeIds,
    });

    const inviteMessage = `${currentUser.fullName || "Your friend"} invited you to a trip session: ${session.title}`;

    if (normalizedInviteeIds.length > 0) {
      const notifications = normalizedInviteeIds.map((inviteeId) => ({
        recipient: inviteeId,
        actor: currentUserId,
        type: "session_invite",
        message: inviteMessage,
        session: session._id,
      }));

      await Notification.insertMany(notifications);
    }

    if (String(process.env.ENABLE_SESSION_EMAIL_INVITES || "").toLowerCase() === "true") {
      const invitees = await User.find({ _id: { $in: normalizedInviteeIds } })
        .select("email fullName")
        .lean();

      await Promise.allSettled(
        invitees.map((invitee) =>
          sendEmail(
            invitee.email,
            invitee.fullName || "Traveler"
          )
        )
      );
    }

    const populatedSession = await Session.findById(session._id)
      .populate("createdBy", "fullName profilePic email")
      .populate("invitees", "fullName profilePic email homeBase travelStyle travelInterests favoriteDestinations nativeLanguage learningLanguage location")
      .lean();

    return sendSuccessResponse(res, 201, "Trip session created successfully", { session: populatedSession });
  } catch (error) {
    logger.error("Error creating session:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getMySessions(req, res) {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const sessions = await Session.find({
      $or: [{ createdBy: currentUserId }, { invitees: currentUserId }],
      status: "scheduled",
    })
      .sort({ scheduledFor: 1 })
      .populate("createdBy", "fullName profilePic")
      .populate("invitees", "fullName profilePic homeBase travelStyle travelInterests favoriteDestinations nativeLanguage learningLanguage location")
      .lean();

    const now = Date.now();
    const tenMinutesFromNow = now + 10 * 60 * 1000;
    const inviteeUpcomingSessions = sessions.filter((session) => {
      const isInvitee = (session.invitees || []).some(
        (invitee) => String(invitee?._id || invitee) === String(currentUserId)
      );
      const scheduledMs = new Date(session.scheduledFor).getTime();
      return isInvitee && scheduledMs > now && scheduledMs <= tenMinutesFromNow;
    });

    if (inviteeUpcomingSessions.length > 0) {
      const existingReminderNotifications = await Notification.find({
        recipient: currentUserId,
        type: "session_reminder",
        session: { $in: inviteeUpcomingSessions.map((item) => item._id) },
      })
        .select("session")
        .lean();

      const alreadyNotifiedSessionIds = new Set(
        existingReminderNotifications.map((item) => String(item.session))
      );

      const reminderNotifications = inviteeUpcomingSessions
        .filter((session) => !alreadyNotifiedSessionIds.has(String(session._id)))
        .map((session) => ({
          recipient: currentUserId,
          actor: session.createdBy?._id || session.createdBy,
          type: "session_reminder",
          message: `Reminder: ${session.title} trip session starts soon`,
          session: session._id,
        }));

      if (reminderNotifications.length > 0) {
        await Notification.insertMany(reminderNotifications);
      }
    }

    const myId = String(currentUserId);
    const outgoingSessions = sessions.filter((session) => String(session.createdBy?._id || session.createdBy) === myId);
    const incomingSessions = sessions.filter((session) => String(session.createdBy?._id || session.createdBy) !== myId);

    const inviteNotifications = await Notification.find({
      recipient: currentUserId,
      type: { $in: ["session_invite", "session_reminder"] },
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("actor", "fullName profilePic")
      .populate("session", "title mode scheduledFor")
      .lean();

    return sendSuccessResponse(res, 200, "Trip sessions fetched successfully", {
      outgoingSessions,
      incomingSessions,
      unreadInviteNotifications: inviteNotifications,
    });
  } catch (error) {
    logger.error("Error fetching sessions:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function rescheduleSession(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { scheduledFor } = req.body || {};

    const when = new Date(scheduledFor);
    if (!scheduledFor || Number.isNaN(when.getTime())) {
      return sendErrorResponse(res, 400, "A valid scheduled time is required");
    }

    if (when.getTime() <= Date.now()) {
      return sendErrorResponse(res, 400, "Trip session time must be in the future");
    }

    const session = await Session.findById(id);
    if (!session) {
      return sendErrorResponse(res, 404, "Session not found");
    }

    if (String(session.createdBy) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only the trip session creator can reschedule");
    }

    session.scheduledFor = when;
    await session.save();

    return sendSuccessResponse(res, 200, "Trip session rescheduled successfully", { session });
  } catch (error) {
    logger.error("Error rescheduling session:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}
