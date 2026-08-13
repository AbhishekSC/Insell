// import { StreamChat } from "stream-chat";
// import "dotenv/config";
// import { logger } from "../utils/logger.js";

// // **Initialize StreamChat client with API key and secret
// const apiKey = process.env.STREAM_API_KEY;
// const apiSecret = process.env.STREAM_SECRET_KEY;

// if (!apiKey || !apiSecret) {
//   logger.error(
//     "STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables."
//   );
//   throw new Error(
//     "STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables."
//   );
// }

// const streamClient = StreamChat.getInstance(apiKey, apiSecret);

// export const UpdateStreamUser = async (user) => {
//   try {
//     await streamClient.upsertUsers([user]);
//     return user;
//   } catch (error) {
//     logger.error("Error upserting Stream user:", error);
//     throw new Error("Failed to upserting Stream user");
//   }
// };

// // TODO: Implement the function to generate a Stream token for a user
// export const generateStreamToken = async (userId) => {
//   try {
//     const userIdStr = userId.toString();
//     if (!userIdStr) {
//       throw new Error("Invalid user ID");
//     }
//     const token = await streamClient.createToken(userIdStr);
//     return token;
//   } catch (error) {
//     logger.error("Error generating Stream token:", error);
//     throw new Error("Failed to generate Stream token");
//   }
// };




import "dotenv/config";
import { StreamChat } from "stream-chat";
import { logger } from "../utils/logger.js";

let _streamClient = null;

function getStreamClient() {
  if (!_streamClient) {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables.");
    }
    _streamClient = StreamChat.getInstance(apiKey, apiSecret);
  }
  return _streamClient;
}

/**
 * Upsert a user into Stream with retries and proper error handling.
 * @param {Object} user - { id, name, image, ... }
 * @returns {Promise<Object>}
 */
export const UpdateStreamUser = async (user) => {
  if (!user?.id) {
    throw new Error("Invalid user object: missing 'id'");
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      await getStreamClient().upsertUsers([user]);
      logger.info("Stream user upserted successfully", { userId: user.id });
      return user;
    } catch (error) {
      logger.error(`Attempt ${attempt} failed to upsert Stream user`, {
        userId: user.id,
        error,
      });

      // Wait exponentially before retrying
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));

      if (attempt >= maxRetries) {
        throw new Error(`Failed to upsert Stream user after ${attempt} attempts`);
      }
    }
  }
};

/**
 * Generate a Stream token for a user.
 * @param {string|number} userId
 * @returns {Promise<string>} token
 */
export const generateStreamToken = async (userId) => {
  if (!userId) {
    throw new Error("Invalid user ID");
  }

  try {
    const token = await getStreamClient().createToken(userId.toString());
    return token;
  } catch (error) {
    logger.error("Failed to generate Stream token", { userId, error });
    throw new Error("Failed to generate Stream token");
  }
};

/**
 * Ensure Stream community channel exists and members are synced with DB.
 * @param {string} circleId
 * @param {string} name
 * @param {Array<string>} memberIds
 */
export const syncCommunityChannelMembers = async (circleId, name, memberIds = []) => {
  if (!circleId) {
    throw new Error("circleId is required");
  }

  const uniqueMemberIds = [...new Set((memberIds || []).map((id) => String(id)).filter(Boolean))];
  const channelId = `community-${String(circleId)}`;
  const channel = getStreamClient().channel("messaging", channelId, {
    name: String(name || "Community"),
    members: uniqueMemberIds,
  });

  try {
    await channel.create();
  } catch (_error) {
    // Channel might already exist.
  }

  const state = await channel.query({
    state: true,
    watch: false,
    presence: false,
  });

  const currentMemberIds = Object.keys(state?.members || {}).map((id) => String(id));
  const currentSet = new Set(currentMemberIds);
  const targetSet = new Set(uniqueMemberIds);

  const toAdd = uniqueMemberIds.filter((id) => !currentSet.has(id));
  const toRemove = currentMemberIds.filter((id) => !targetSet.has(id));

  if (toAdd.length > 0) {
    await channel.addMembers(toAdd);
  }

  if (toRemove.length > 0) {
    await channel.removeMembers(toRemove);
  }

  await channel.updatePartial({
    set: {
      name: String(name || "Community"),
    },
  });

  return {
    channelId,
    members: uniqueMemberIds,
  };
};

/**
 * Push a real-time signal into a community's Stream channel so any member
 * currently watching it (e.g. actively chatting) is notified immediately,
 * rather than waiting for the next notifications poll.
 * @param {string} circleId
 * @param {string} actorId - the admin who destroyed the community
 * @param {string} name
 */
export const notifyCommunityDestroyed = async (circleId, actorId, name) => {
  if (!circleId) {
    return;
  }

  const channelId = `community-${String(circleId)}`;
  const channel = getStreamClient().channel("messaging", channelId);

  await channel.sendMessage({
    text: `${name || "This community"} has been deleted by the admin.`,
    user_id: String(actorId),
    custom_type: "community_destroyed",
  });
};
