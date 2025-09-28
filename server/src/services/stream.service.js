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

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_SECRET_KEY;

if (!apiKey || !apiSecret) {
  logger.error(
    "STREAM_API_KEY or STREAM_SECRET is not defined in environment variables."
  );
  throw new Error(
    "STREAM_API_KEY or STREAM_SECRET is not defined in environment variables."
  );
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

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
      await streamClient.upsertUsers([user]);
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
    const token = await streamClient.createToken(userId.toString());
    return token;
  } catch (error) {
    logger.error("Failed to generate Stream token", { userId, error });
    throw new Error("Failed to generate Stream token");
  }
};
