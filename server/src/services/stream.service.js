import { StreamChat } from "stream-chat";
import "dotenv/config";
import { logger } from "../utils/logger.js";

// **Initialize StreamChat client with API key and secret
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_SECRET_KEY;

if (!apiKey || !apiSecret) {
  logger.error(
    "STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables."
  );
  throw new Error(
    "STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables."
  );
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const UpdateStreamUser = async (user) => {
  try {
    await streamClient.upsertUsers([user]);
    return user;
  } catch (error) {
    logger.error("Error upserting Stream user:", error);
    throw new Error("Failed to upserting Stream user");
  }
};

// TODO: Implement the function to generate a Stream token for a user
export const generateStreamToken = async (userId) => {
  try {
    const userIdStr = userId.toString();
    if (!userIdStr) {
      throw new Error("Invalid user ID");
    }
    const token = await streamClient.createToken(userIdStr);
    return token;
  } catch (error) {
    logger.error("Error generating Stream token:", error);
    throw new Error("Failed to generate Stream token");
  }
};
