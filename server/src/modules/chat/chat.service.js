import { generateStreamToken } from "../../services/stream.service.js";
import * as chatRepository from "./chat.repository.js";

export async function createStreamToken(userId) {
  return generateStreamToken(userId.toString());
}

export async function getPrioritizedConversations(currentUserId, { limit, page }) {
  const skip = (page - 1) * limit;

  const currentUser = await chatRepository.findUserFriends(currentUserId);
  const friendIds = currentUser?.friends || [];

  const verifiedRoles = ["Broker", "Seller", "Landlord"];

  let friendAndVerified = [];
  let friendOnly = [];
  let verifiedNonFriend = [];

  if (friendIds.length) {
    const [facetResult] = await chatRepository.aggregateFriendsByRole(friendIds, currentUserId, verifiedRoles);
    friendAndVerified = facetResult?.friendAndVerified || [];
    friendOnly = facetResult?.friendOnly || [];
  }

  const seenIds = [
    ...friendAndVerified.map((u) => u._id),
    ...friendOnly.map((u) => u._id),
    currentUserId,
  ];

  verifiedNonFriend = await chatRepository.findVerifiedNonFriendUsers(seenIds, verifiedRoles, limit) || [];

  const tag = (users, score, level, isFriend, isVerified) =>
    users.map((u) => ({ ...u, priorityScore: score, priorityLevel: level, isFriend, isVerified }));

  const sorted = [
    ...tag(friendAndVerified, 100, "high", true, true),
    ...tag(friendOnly, 70, "medium", true, false),
    ...tag(verifiedNonFriend, 50, "medium", false, true),
  ];

  const paged = sorted.slice(skip, skip + limit);

  return {
    conversations: paged,
    total: sorted.length,
    page,
    limit,
  };
}
