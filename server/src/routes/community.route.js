import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { uploadCommunityResource } from "../middlewares/upload.middleware.js";
import {
  createCheckIn,
  createCommunityMessage,
  createCommunityResource,
  createSessionRecap,
  createStudyCircle,
  destroyCommunity,
  getCommunityCircleDetail,
  getCommunityData,
  inviteMembersToCommunity,
  leaveCommunity,
  markCommunityNotificationRead,
  removeMemberFromCommunity,
  requestAddMemberToCommunity,
  requestJoinCommunity,
  respondMemberAddRequest,
  respondToCommunityInvite,
  respondJoinCommunityRequest,
  transferCommunityOwnership,
  toggleReaction,
  upsertPresence,
} from "../controllers/community.controller.js";

const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.get("/", getCommunityData);
router.get("/circles/:id", getCommunityCircleDetail);
router.put("/presence", upsertPresence);
router.post("/check-ins", createCheckIn);
router.post("/circles", createStudyCircle);
router.post("/circles/:id/leave", leaveCommunity);
router.post("/circles/:id/messages", createCommunityMessage);
router.post("/circles/:id/resources", uploadCommunityResource.single("file"), createCommunityResource);
router.post("/circles/:id/invite", inviteMembersToCommunity);
router.post("/circles/:id/member-add-request", requestAddMemberToCommunity);
router.post("/circles/:id/member-add-requests/:targetUserId/respond", respondMemberAddRequest);
router.post("/circles/:id/join-request", requestJoinCommunity);
router.post("/circles/:id/join-requests/:userId/respond", respondJoinCommunityRequest);
router.post("/circles/:id/transfer-ownership", transferCommunityOwnership);
router.delete("/circles/:id", destroyCommunity);
router.delete("/circles/:id/members/:memberId", removeMemberFromCommunity);
router.post("/notifications/:notificationId/read", markCommunityNotificationRead);
router.post("/invites/:notificationId/respond", respondToCommunityInvite);
router.post("/recaps", createSessionRecap);
router.post("/reactions", toggleReaction);

export default router;
