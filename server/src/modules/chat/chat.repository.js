import User from "../../models/User.model.js";

export const findUserFriends = (userId) => {
  return User.findById(userId).select("friends").lean();
};

export const aggregateFriendsByRole = (friendIds, currentUserId, verifiedRoles) => {
  return User.aggregate([
    {
      $match: {
        _id: { $in: friendIds, $ne: currentUserId },
      },
    },
    { $project: { fullName: 1, profilePic: 1, activeRole: 1, primaryRole: 1, city: 1 } },
    {
      $facet: {
        friendAndVerified: [
          { $match: { $or: [{ activeRole: { $in: verifiedRoles } }, { primaryRole: { $in: verifiedRoles } }] } },
        ],
        friendOnly: [
          { $match: { activeRole: { $nin: verifiedRoles }, primaryRole: { $nin: verifiedRoles } } },
        ],
      },
    },
  ]);
};

export const findVerifiedNonFriendUsers = (excludeIds, verifiedRoles, limit) => {
  return User.find({
    _id: { $nin: excludeIds },
    $or: [{ activeRole: { $in: verifiedRoles } }, { primaryRole: { $in: verifiedRoles } }],
  })
    .select("fullName profilePic activeRole primaryRole city")
    .limit(limit)
    .lean();
};
