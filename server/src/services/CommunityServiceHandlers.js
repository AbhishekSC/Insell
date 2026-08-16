import CheckIn from "../models/CheckIn.model.js";
import CommunityMessage from "../models/CommunityMessage.model.js";
import CommunityResource from "../models/CommunityResource.model.js";
import FeedReaction from "../models/FeedReaction.model.js";
import Notification from "../models/Notification.model.js";
import Presence from "../models/Presence.model.js";
import SessionRecap from "../models/SessionRecap.model.js";
import StudyCircle from "../models/StudyCircle.model.js";
import User from "../models/User.model.js";
import CommunityJoinRequestService from "../services/CommunityJoinRequestService.js";
import { notifyCommunityDestroyed, syncCommunityChannelMembers } from "../services/stream.service.js";
import { logger } from "../utils/logger.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";

const communityJoinRequestService = new CommunityJoinRequestService();

function getFriendIdList(user) {
  return (user?.friends || []).map((item) => String(item));
}

function buildReactionKey(targetType, targetId, emoji) {
  return `${targetType}:${String(targetId)}:${emoji}`;
}

async function deleteCommunityById(circleId) {
  await Promise.all([
    CommunityMessage.deleteMany({ circle: circleId }),
    CommunityResource.deleteMany({ circle: circleId }),
    Notification.deleteMany({ circle: circleId }),
    StudyCircle.deleteOne({ _id: circleId }),
  ]);
}

export async function getCommunityData(req, res) {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    if (!currentUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const friendIds = getFriendIdList(currentUser);
    const visibleUserIds = [String(currentUserId), ...friendIds];
    const now = new Date();

    const [myPresence, friendsPresence, checkIns, studyCircles, recaps, notifications] = await Promise.all([
      Presence.findOne({ user: currentUserId }).lean(),
      Presence.find({ user: { $in: friendIds } })
        .populate("user", "fullName profilePic")
        .sort({ updatedAt: -1 })
        .lean(),
      CheckIn.find({ author: { $in: visibleUserIds }, expiresAt: { $gt: now } })
        .populate("author", "fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(24)
        .lean(),
      StudyCircle.find({ $or: [{ creator: currentUserId }, { members: currentUserId }] })
        .populate("creator", "fullName profilePic")
        .populate("members", "fullName profilePic")
        .populate("moderators", "fullName profilePic")
        .populate("pendingInvites", "fullName profilePic")
        .populate("pendingJoinRequests", "fullName profilePic")
        .populate("memberAddRequests.targetUser", "fullName profilePic")
        .populate("memberAddRequests.requestedBy", "fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      SessionRecap.find({ author: { $in: visibleUserIds } })
        .populate("author", "fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Notification.find({
        recipient: currentUserId,
        type: {
          $in: [
            "circle_invite",
            "circle_deleted",
            "circle_join_request_result",
            "circle_member_add_request_result",
          ],
        },
        read: false,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("actor", "fullName profilePic")
        .populate("circle", "name topic")
        .lean(),
    ]);

    const joinedCircleIdSet = new Set(studyCircles.map((circle) => String(circle._id)));
    const suggestedCirclesRaw = await StudyCircle.find({
      _id: { $nin: [...joinedCircleIdSet] },
      creator: { $ne: currentUserId },
      members: { $nin: [currentUserId] },
      pendingInvites: { $nin: [currentUserId] },
      pendingJoinRequests: { $nin: [currentUserId] },
    })
      .populate("creator", "fullName profilePic")
      .populate("members", "_id")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const suggestedCircles = suggestedCirclesRaw.map((circle) => ({
      ...circle,
      memberCount: Array.isArray(circle.members) ? circle.members.length : 0,
    }));

    const messageCounts = await CommunityMessage.aggregate([
      { $match: { circle: { $in: studyCircles.map((circle) => circle._id) } } },
      { $group: { _id: "$circle", count: { $sum: 1 } } },
    ]);
    const messageCountByCircleId = new Map(messageCounts.map((row) => [String(row._id), row.count]));
    const studyCirclesWithMessageCount = studyCircles.map((circle) => ({
      ...circle,
      messageCount: messageCountByCircleId.get(String(circle._id)) || 0,
    }));

    const checkInIds = checkIns.map((item) => item._id);
    const recapIds = recaps.map((item) => item._id);

    const reactions = await FeedReaction.find({
      $or: [
        { targetType: "checkin", targetId: { $in: checkInIds } },
        { targetType: "recap", targetId: { $in: recapIds } },
      ],
    })
      .select("user targetType targetId emoji")
      .lean();

    const reactionSummary = {};
    const myReactionKeys = [];

    for (const reaction of reactions) {
      const key = buildReactionKey(reaction.targetType, reaction.targetId, reaction.emoji);
      reactionSummary[key] = Number(reactionSummary[key] || 0) + 1;
      if (String(reaction.user) === String(currentUserId)) {
        myReactionKeys.push(key);
      }
    }

    return sendSuccessResponse(res, 200, "Community data fetched successfully", {
      myPresence,
      friendsPresence,
      checkIns,
      studyCircles: studyCirclesWithMessageCount,
      recaps,
      notifications,
      suggestedCircles,
      reactionSummary,
      myReactionKeys,
    });
  } catch (error) {
    logger.error("Error fetching community data:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function upsertPresence(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { status, note } = req.body || {};

    const presence = await Presence.findOneAndUpdate(
      { user: currentUserId },
      {
        user: currentUserId,
        status: ["ready", "busy", "offline"].includes(status) ? status : "ready",
        note: String(note || "").trim().slice(0, 180),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return sendSuccessResponse(res, 200, "Presence updated successfully", { presence });
  } catch (error) {
    logger.error("Error updating presence:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createCheckIn(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { prompt, content, type } = req.body || {};

    if (!prompt || !String(prompt).trim() || !content || !String(content).trim()) {
      return sendErrorResponse(res, 400, "Prompt and content are required");
    }

    const checkIn = await CheckIn.create({
      author: currentUserId,
      prompt: String(prompt).trim(),
      content: String(content).trim(),
      type: type === "text" ? "text" : "voice",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const populatedCheckIn = await CheckIn.findById(checkIn._id)
      .populate("author", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Check-in posted successfully", { checkIn: populatedCheckIn });
  } catch (error) {
    logger.error("Error creating check-in:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createStudyCircle(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { name, topic, memberIds = [], category } = req.body || {};

    if (!name || !String(name).trim() || !topic || !String(topic).trim()) {
      return sendErrorResponse(res, 400, "Circle name and topic are required");
    }

    const allowedCategories = ["Real Estate", "Construction", "Investment", "Lifestyle", "General"];
    const normalizedCategory = allowedCategories.includes(category) ? category : "General";

    const currentUser = await User.findById(currentUserId).select("friends").lean();
    if (!currentUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const friendIds = new Set(getFriendIdList(currentUser));
    const normalizedMemberIds = [...new Set((memberIds || []).map((id) => String(id)))].filter((id) => friendIds.has(id));
    const members = [String(currentUserId)];

    const circle = await StudyCircle.create({
      name: String(name).trim(),
      topic: String(topic).trim(),
      category: normalizedCategory,
      creator: currentUserId,
      members,
      moderators: [],
      pendingInvites: normalizedMemberIds,
      pendingJoinRequests: [],
    });

    if (normalizedMemberIds.length > 0) {
      const creator = await User.findById(currentUserId).select("fullName").lean();
      await Notification.insertMany(
        normalizedMemberIds.map((memberId) => ({
          recipient: memberId,
          actor: currentUserId,
          type: "circle_invite",
          message: `${creator?.fullName || "A friend"} added you to ${String(name).trim()}`,
          circle: circle._id,
        }))
      );
    }

    const populatedCircle = await StudyCircle.findById(circle._id)
      .populate("creator", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .populate("moderators", "fullName profilePic")
      .lean();

    try {
      await syncCommunityChannelMembers(circle._id, circle.name, members);
    } catch (error) {
      logger.error("Failed to initialize Stream community channel:", { message: error.message, stack: error.stack });
    }

    return sendSuccessResponse(res, 201, "Study circle created successfully", { circle: populatedCircle });
  } catch (error) {
    logger.error("Error creating study circle:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getCommunityCircleDetail(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const circle = await StudyCircle.findById(id)
      .populate("creator", "fullName profilePic")
      .populate("members", "fullName profilePic email homeBase travelStyle travelInterests favoriteDestinations nativeLanguage learningLanguage location")
      .populate("moderators", "fullName profilePic")
      .populate("pendingInvites", "fullName profilePic")
      .populate("memberAddRequests.targetUser", "fullName profilePic")
      .populate("memberAddRequests.requestedBy", "fullName profilePic")
      .lean();

    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator?._id || circle.creator) === String(currentUserId);
    const isModerator = (circle.moderators || []).some((member) => String(member?._id || member) === String(currentUserId));
    const isMember = (circle.members || []).some((member) => String(member?._id || member) === String(currentUserId));

    if (!isCreator && !isMember) {
      return sendErrorResponse(res, 403, "You are not a member of this community");
    }

    try {
      await syncCommunityChannelMembers(
        circle._id,
        circle.name,
        (circle.members || []).map((member) => String(member?._id || member))
      );
    } catch (error) {
      logger.error("Failed to sync community Stream channel:", { message: error.message, stack: error.stack });
    }

    const resources = await CommunityResource.find({ circle: id })
      .populate("author", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return sendSuccessResponse(res, 200, "Community detail fetched successfully", {
      circle,
      resources,
      permissions: {
        isCreator,
        isModerator,
        canInvite: isCreator,
        canProposeMembers: isMember && !isCreator,
        canTransferOwnership: isCreator,
        canDestroy: isCreator,
        canReviewJoinRequests: isCreator || isModerator,
      },
    });
  } catch (error) {
    logger.error("Error fetching community detail:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function destroyCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    if (String(circle.creator) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can destroy the community");
    }

    const memberIdsToNotify = (circle.members || [])
      .map((memberId) => String(memberId))
      .filter((memberId) => memberId !== String(currentUserId));

    if (memberIdsToNotify.length > 0) {
      // No `circle` ref here on purpose: the circle is about to be deleted, and
      // deleteCommunityById() below wipes any notification tied to it.
      await Notification.insertMany(
        memberIdsToNotify.map((memberId) => ({
          recipient: memberId,
          actor: currentUserId,
          type: "circle_deleted",
          message: `${circle.name} was deleted by the admin`,
        }))
      );
    }

    try {
      await notifyCommunityDestroyed(circle._id, currentUserId, circle.name);
    } catch (error) {
      logger.error("Failed to push real-time destroy notice to Stream channel:", { message: error.message, stack: error.stack });
    }

    await deleteCommunityById(circle._id);

    return sendSuccessResponse(res, 200, "Community destroyed", {
      circleId: circle._id,
      deleted: true,
    });
  } catch (error) {
    logger.error("Error destroying community:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function respondToCommunityInvite(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { notificationId } = req.params;
    const { action } = req.body || {};

    if (!["accept", "reject"].includes(String(action))) {
      return sendErrorResponse(res, 400, "Valid action is required");
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return sendErrorResponse(res, 404, "Invite notification not found");
    }

    if (String(notification.recipient) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "You are not allowed to respond to this invite");
    }

    if (notification.type !== "circle_invite" || !notification.circle) {
      return sendErrorResponse(res, 400, "This notification is not a community invite");
    }

    const circle = await StudyCircle.findById(notification.circle);
    if (!circle) {
      notification.read = true;
      await notification.save();
      return sendErrorResponse(res, 404, "Community not found");
    }

    circle.pendingInvites = (circle.pendingInvites || []).filter((id) => String(id) !== String(currentUserId));

    if (action === "accept") {
      circle.members = [...new Set([...(circle.members || []).map((id) => String(id)), String(currentUserId)])];
    }

    await circle.save();

    try {
      await syncCommunityChannelMembers(
        circle._id,
        circle.name,
        (circle.members || []).map((memberId) => String(memberId))
      );
    } catch (error) {
      logger.error("Failed to sync Stream members after invite response:", { message: error.message, stack: error.stack });
    }

    notification.read = true;
    await notification.save();

    return sendSuccessResponse(res, 200, `Community invite ${action}ed successfully`, {
      action,
      circleId: circle._id,
    });
  } catch (error) {
    logger.error("Error responding to community invite:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function markCommunityNotificationRead(req, res) {
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
    logger.error("Error marking community notification as read:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createCommunityMessage(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || !String(text).trim()) {
      return sendErrorResponse(res, 400, "Message text is required");
    }

    const circle = await StudyCircle.findById(id).select("creator members").lean();
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isMember = (circle.members || []).some((member) => String(member) === String(currentUserId));

    if (!isCreator && !isMember) {
      return sendErrorResponse(res, 403, "Only community members can send messages");
    }

    const message = await CommunityMessage.create({
      circle: id,
      author: currentUserId,
      text: String(text).trim(),
    });

    const populatedMessage = await CommunityMessage.findById(message._id)
      .populate("author", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Community message sent successfully", { message: populatedMessage });
  } catch (error) {
    logger.error("Error creating community message:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function updateCommunityPhoto(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    if (!req.file) {
      return sendErrorResponse(res, 400, "A photo file is required");
    }

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isModerator = (circle.moderators || []).some((m) => String(m) === String(currentUserId));
    if (!isCreator && !isModerator) {
      return sendErrorResponse(res, 403, "Only the community admin or a moderator can update the photo");
    }

    circle.photo = req.file.path;
    await circle.save();

    return sendSuccessResponse(res, 200, "Community photo updated successfully", { photo: circle.photo });
  } catch (error) {
    logger.error("Error updating community photo:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function leaveCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    if (String(circle.creator) === String(currentUserId)) {
      return sendErrorResponse(res, 400, "Admin cannot leave the community. Transfer or remove members instead.");
    }

    circle.members = (circle.members || []).filter((memberId) => String(memberId) !== String(currentUserId));
    circle.pendingInvites = (circle.pendingInvites || []).filter((memberId) => String(memberId) !== String(currentUserId));
    circle.pendingJoinRequests = (circle.pendingJoinRequests || []).filter((memberId) => String(memberId) !== String(currentUserId));
    circle.memberAddRequests = (circle.memberAddRequests || []).filter(
      (entry) => String(entry.targetUser) !== String(currentUserId) && String(entry.requestedBy) !== String(currentUserId)
    );
    await circle.save();

    try {
      await syncCommunityChannelMembers(
        circle._id,
        circle.name,
        (circle.members || []).map((memberId) => String(memberId))
      );
    } catch (error) {
      logger.error("Failed to sync Stream members after leaving community:", { message: error.message, stack: error.stack });
    }

    return sendSuccessResponse(res, 200, "You left the community successfully", { circleId: circle._id });
  } catch (error) {
    logger.error("Error leaving community:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function removeMemberFromCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, memberId } = req.params;

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    if (String(circle.creator) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can remove members");
    }

    if (String(memberId) === String(circle.creator)) {
      return sendErrorResponse(res, 400, "Admin cannot remove themselves");
    }

    circle.members = (circle.members || []).filter((entry) => String(entry) !== String(memberId));
    circle.pendingInvites = (circle.pendingInvites || []).filter((entry) => String(entry) !== String(memberId));
    circle.pendingJoinRequests = (circle.pendingJoinRequests || []).filter((entry) => String(entry) !== String(memberId));
    circle.memberAddRequests = (circle.memberAddRequests || []).filter(
      (entry) => String(entry.targetUser) !== String(memberId) && String(entry.requestedBy) !== String(memberId)
    );
    await circle.save();

    try {
      await syncCommunityChannelMembers(
        circle._id,
        circle.name,
        (circle.members || []).map((entry) => String(entry))
      );
    } catch (error) {
      logger.error("Failed to sync Stream members after removing member:", { message: error.message, stack: error.stack });
    }

    return sendSuccessResponse(res, 200, "Member removed successfully", { memberId, circleId: circle._id });
  } catch (error) {
    logger.error("Error removing member from community:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function transferCommunityOwnership(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { newOwnerId } = req.body || {};

    if (!newOwnerId) {
      return sendErrorResponse(res, 400, "New owner is required");
    }

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    if (String(circle.creator) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only current admin can transfer ownership");
    }

    const isMember = (circle.members || []).some((memberId) => String(memberId) === String(newOwnerId));
    if (!isMember) {
      return sendErrorResponse(res, 400, "New owner must already be a community member");
    }

    circle.creator = newOwnerId;
    await circle.save();

    return sendSuccessResponse(res, 200, "Community ownership transferred successfully", { circleId: circle._id, newOwnerId });
  } catch (error) {
    logger.error("Error transferring community ownership:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createCommunityResource(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { title, type, url, description } = req.body || {};

    if (!title || !String(title).trim()) {
      return sendErrorResponse(res, 400, "Resource title is required");
    }

    const circle = await StudyCircle.findById(id).select("creator members").lean();
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isMember = (circle.members || []).some((memberId) => String(memberId) === String(currentUserId));

    if (!isCreator && !isMember) {
      return sendErrorResponse(res, 403, "Only community members can add resources");
    }

    const uploadedFileUrl = req.file ? req.file.path : "";

    const resource = await CommunityResource.create({
      circle: id,
      author: currentUserId,
      title: String(title).trim(),
      type: req.file ? "file" : ["link", "note", "file"].includes(String(type)) ? String(type) : "link",
      url: uploadedFileUrl || String(url || "").trim(),
      description: String(description || "").trim(),
    });

    const populatedResource = await CommunityResource.findById(resource._id)
      .populate("author", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Community resource added successfully", { resource: populatedResource });
  } catch (error) {
    logger.error("Error creating community resource:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function inviteMembersToCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { memberIds = [] } = req.body || {};

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    if (String(circle.creator) !== String(currentUserId)) {
      return sendErrorResponse(res, 403, "Only admin can invite members");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    const friendIds = new Set(getFriendIdList(currentUser));
    const existingMemberIds = new Set((circle.members || []).map((item) => String(item)));
    const existingPendingIds = new Set((circle.pendingInvites || []).map((item) => String(item)));

    const normalizedMemberIds = [...new Set((memberIds || []).map((memberId) => String(memberId)))]
      .filter((memberId) => friendIds.has(memberId))
      .filter((memberId) => !existingMemberIds.has(memberId) && !existingPendingIds.has(memberId));

    if (normalizedMemberIds.length === 0) {
      return sendErrorResponse(res, 400, "No new valid members to invite");
    }

    circle.pendingInvites = [...(circle.pendingInvites || []).map((item) => String(item)), ...normalizedMemberIds];
    circle.pendingJoinRequests = (circle.pendingJoinRequests || []).filter(
      (item) => !normalizedMemberIds.includes(String(item))
    );
    await circle.save();

    await Notification.insertMany(
      normalizedMemberIds.map((memberId) => ({
        recipient: memberId,
        actor: currentUserId,
        type: "circle_invite",
        message: `${currentUser?.fullName || "A friend"} invited you to ${circle.name}`,
        circle: circle._id,
      }))
    );

    return sendSuccessResponse(res, 200, "Community invites sent successfully", { invitedCount: normalizedMemberIds.length });
  } catch (error) {
    logger.error("Error inviting members to community:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function requestAddMemberToCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { memberIds = [] } = req.body || {};

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isMember = (circle.members || []).some((memberId) => String(memberId) === String(currentUserId));
    if (!isMember) {
      return sendErrorResponse(res, 403, "Only community members can propose new members");
    }

    if (isCreator) {
      return sendErrorResponse(res, 400, "Admin can invite members directly");
    }

    const currentUser = await User.findById(currentUserId).select("friends fullName").lean();
    const friendIds = new Set(getFriendIdList(currentUser));
    const existingMemberIds = new Set((circle.members || []).map((item) => String(item)));
    const existingPendingIds = new Set((circle.pendingInvites || []).map((item) => String(item)));
    const existingRequestIds = new Set(
      (circle.memberAddRequests || []).map((entry) => String(entry.targetUser))
    );

    const normalizedMemberIds = [...new Set((memberIds || []).map((memberId) => String(memberId)))]
      .filter((memberId) => friendIds.has(memberId))
      .filter(
        (memberId) =>
          !existingMemberIds.has(memberId) && !existingPendingIds.has(memberId) && !existingRequestIds.has(memberId)
      );

    if (normalizedMemberIds.length === 0) {
      return sendErrorResponse(res, 400, "No new valid members to propose");
    }

    circle.memberAddRequests = [
      ...(circle.memberAddRequests || []),
      ...normalizedMemberIds.map((memberId) => ({
        targetUser: memberId,
        requestedBy: currentUserId,
        requestedAt: new Date(),
      })),
    ];
    await circle.save();

    const reviewerIds = [String(circle.creator), ...(circle.moderators || []).map((entry) => String(entry))];

    await Notification.insertMany(
      reviewerIds.map((reviewerId) => ({
        recipient: reviewerId,
        actor: currentUserId,
        type: "circle_member_add_request",
        message: `${currentUser?.fullName || "A member"} wants to add ${normalizedMemberIds.length} member(s) to ${circle.name}`,
        circle: circle._id,
      }))
    );

    return sendSuccessResponse(res, 200, "Request sent to admin for approval", {
      requestedCount: normalizedMemberIds.length,
    });
  } catch (error) {
    logger.error("Error requesting to add community member:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function respondMemberAddRequest(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, targetUserId } = req.params;
    const { action } = req.body || {};

    if (!["accept", "reject"].includes(String(action))) {
      return sendErrorResponse(res, 400, "Valid action is required");
    }

    const circle = await StudyCircle.findById(id);
    if (!circle) {
      return sendErrorResponse(res, 404, "Community not found");
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isModerator = (circle.moderators || []).some((entry) => String(entry) === String(currentUserId));
    if (!isCreator && !isModerator) {
      return sendErrorResponse(res, 403, "Only admin or moderator can review member requests");
    }

    const request = (circle.memberAddRequests || []).find(
      (entry) => String(entry.targetUser) === String(targetUserId)
    );
    if (!request) {
      return sendErrorResponse(res, 404, "Member add request not found");
    }

    circle.memberAddRequests = (circle.memberAddRequests || []).filter(
      (entry) => String(entry.targetUser) !== String(targetUserId)
    );

    if (action === "accept") {
      const existingMemberIds = new Set((circle.members || []).map((item) => String(item)));
      const existingPendingIds = new Set((circle.pendingInvites || []).map((item) => String(item)));

      if (!existingMemberIds.has(String(targetUserId)) && !existingPendingIds.has(String(targetUserId))) {
        circle.pendingInvites = [...(circle.pendingInvites || []).map((item) => String(item)), String(targetUserId)];

        const requester = await User.findById(request.requestedBy).select("fullName").lean();
        await Notification.create({
          recipient: targetUserId,
          actor: currentUserId,
          type: "circle_invite",
          message: `${requester?.fullName || "A friend"} invited you to ${circle.name}`,
          circle: circle._id,
        });
      }
    }

    await circle.save();

    await Notification.create({
      recipient: request.requestedBy,
      actor: currentUserId,
      type: "circle_member_add_request_result",
      message:
        action === "accept"
          ? `Your request to add a member to ${circle.name} was approved`
          : `Your request to add a member to ${circle.name} was declined`,
      circle: circle._id,
    });

    return sendSuccessResponse(res, 200, "Member add request processed", {
      circleId: circle._id,
      targetUserId,
      action,
    });
  } catch (error) {
    logger.error("Error responding to member add request:", { message: error.message, stack: error.stack });
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createSessionRecap(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { title, duration, confidence, newWords, nextStep } = req.body || {};

    if (!title || !String(title).trim() || !nextStep || !String(nextStep).trim()) {
      return sendErrorResponse(res, 400, "Title and next step are required");
    }

    const recap = await SessionRecap.create({
      author: currentUserId,
      title: String(title).trim(),
      duration: Number(duration || 0),
      confidence: Number(confidence || 0),
      newWords: Number(newWords || 0),
      nextStep: String(nextStep).trim(),
    });

    const populatedRecap = await SessionRecap.findById(recap._id)
      .populate("author", "fullName profilePic")
      .lean();

    return sendSuccessResponse(res, 201, "Session recap created successfully", { recap: populatedRecap });
  } catch (error) {
    logger.error("Error creating session recap:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function toggleReaction(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { targetType, targetId, emoji } = req.body || {};

    if (!currentUserId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!["checkin", "recap"].includes(String(targetType)) || !targetId || !emoji) {
      return sendErrorResponse(res, 400, "Valid reaction target and emoji are required");
    }

    const existingReaction = await FeedReaction.findOne({
      user: currentUserId,
      targetType: String(targetType),
      targetId,
      emoji: String(emoji),
    });

    if (existingReaction) {
      await existingReaction.deleteOne();
      return sendSuccessResponse(res, 200, "Reaction removed successfully", { reacted: false });
    }

    await FeedReaction.create({
      user: currentUserId,
      targetType: String(targetType),
      targetId,
      emoji: String(emoji),
    });

    return sendSuccessResponse(res, 201, "Reaction added successfully", { reacted: true });
  } catch (error) {
    logger.error("Error toggling reaction:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function requestJoinCommunity(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    const data = await communityJoinRequestService.requestJoinCommunity({
      circleId: id,
      currentUserId,
    });

    return sendSuccessResponse(res, 200, "Join request sent to community admin", {
      circleId: data.circleId,
    });
  } catch (error) {
    logger.error("Error requesting to join community:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal Server Error", error?.details || {});
  }
}

export async function respondJoinCommunityRequest(req, res) {
  try {
    const currentUserId = req.user?._id;
    const { id, userId } = req.params;
    const { action } = req.body || {};

    const data = await communityJoinRequestService.respondJoinCommunityRequest({
      circleId: id,
      targetUserId: userId,
      currentUserId,
      action,
    });

    return sendSuccessResponse(res, 200, `Join request ${action}ed successfully`, {
      circleId: data.circleId,
      userId: data.userId,
      action: data.action,
    });
  } catch (error) {
    logger.error("Error responding to community join request:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal Server Error", error?.details || {});
  }
}
