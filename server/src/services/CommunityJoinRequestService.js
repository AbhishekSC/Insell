import AppError from "../exceptions/AppError.js";
import StudyCircle from "../models/StudyCircle.model.js";
import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import { syncCommunityChannelMembers } from "./stream.service.js";
import { logger } from "../utils/logger.js";

export default class CommunityJoinRequestService {
  async requestJoinCommunity({ circleId, currentUserId }) {
    const circle = await StudyCircle.findById(circleId);
    if (!circle) {
      throw new AppError("Community not found", 404);
    }

    if (String(circle.creator) === String(currentUserId)) {
      throw new AppError("Admin is already part of the community", 400);
    }

    const memberSet = new Set((circle.members || []).map((entry) => String(entry)));
    if (memberSet.has(String(currentUserId))) {
      throw new AppError("You are already a community member", 400);
    }

    const pendingInviteSet = new Set((circle.pendingInvites || []).map((entry) => String(entry)));
    if (pendingInviteSet.has(String(currentUserId))) {
      throw new AppError("You already have an invite to this community", 400);
    }

    const pendingJoinSet = new Set((circle.pendingJoinRequests || []).map((entry) => String(entry)));
    if (pendingJoinSet.has(String(currentUserId))) {
      throw new AppError("Join request is already pending", 400);
    }

    circle.pendingJoinRequests = [...(circle.pendingJoinRequests || []), currentUserId];
    await circle.save();

    const requester = await User.findById(currentUserId).select("fullName").lean();
    await Notification.create({
      recipient: circle.creator,
      actor: currentUserId,
      type: "circle_join_request",
      message: `${requester?.fullName || "A user"} requested to join ${circle.name}`,
      circle: circle._id,
    });

    return { circleId: circle._id };
  }

  async cancelJoinRequest({ circleId, currentUserId }) {
    const circle = await StudyCircle.findById(circleId);
    if (!circle) {
      throw new AppError("Community not found", 404);
    }

    const pendingJoinSet = new Set((circle.pendingJoinRequests || []).map((entry) => String(entry)));
    if (!pendingJoinSet.has(String(currentUserId))) {
      throw new AppError("You don't have a pending join request for this community", 404);
    }

    circle.pendingJoinRequests = (circle.pendingJoinRequests || []).filter(
      (entry) => String(entry) !== String(currentUserId)
    );
    await circle.save();

    return { circleId: circle._id };
  }

  async respondJoinCommunityRequest({ circleId, targetUserId, currentUserId, action }) {
    if (!["accept", "reject"].includes(String(action))) {
      throw new AppError("Valid action is required", 400);
    }

    const circle = await StudyCircle.findById(circleId);
    if (!circle) {
      throw new AppError("Community not found", 404);
    }

    const isCreator = String(circle.creator) === String(currentUserId);
    const isModerator = (circle.moderators || []).some((entry) => String(entry) === String(currentUserId));
    if (!isCreator && !isModerator) {
      throw new AppError("Only admin or moderator can review join requests", 403);
    }

    const pendingJoinSet = new Set((circle.pendingJoinRequests || []).map((entry) => String(entry)));
    if (!pendingJoinSet.has(String(targetUserId))) {
      throw new AppError("Join request not found", 404);
    }

    circle.pendingJoinRequests = (circle.pendingJoinRequests || []).filter((entry) => String(entry) !== String(targetUserId));

    if (String(action) === "accept") {
      circle.members = [...new Set([...(circle.members || []).map((entry) => String(entry)), String(targetUserId)])];
    }

    await circle.save();

    try {
      await syncCommunityChannelMembers(
        circle._id,
        circle.name,
        (circle.members || []).map((entry) => String(entry))
      );
    } catch (error) {
      logger.error("Failed to sync Stream members after join request response:", { message: error.message, stack: error.stack });
    }

    await Notification.create({
      recipient: targetUserId,
      actor: currentUserId,
      type: "circle_join_request_result",
      message:
        String(action) === "accept"
          ? `Your request to join ${circle.name} was accepted`
          : `Your request to join ${circle.name} was declined`,
      circle: circle._id,
    });

    return {
      circleId: circle._id,
      userId: targetUserId,
      action,
    };
  }
}
