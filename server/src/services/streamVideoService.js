import { StreamClient } from "@stream-io/node-sdk";
import { logger } from "../utils/logger.js";

// Server-side counterpart to the chat client in stream.service.js — same
// singleton pattern, same env vars, but for querying Stream Video call
// state (occupancy) rather than chat. Only used by the scheduled-call
// auto-end sweep today.
let _videoClient = null;
function getStreamVideoClient() {
  if (!_videoClient) {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("STREAM_API_KEY or STREAM_API_SECRET is not defined in environment variables.");
    }
    _videoClient = new StreamClient(apiKey, apiSecret);
  }
  return _videoClient;
}

// How many people are currently connected to a video call room, queried
// server-side — no browser session or per-user token needed. Used to
// decide whether a duration-limited scheduled call can be safely
// auto-ended (never force-ends a call anyone is still actually in).
//
// Returns 0 (rather than throwing) if the call was never actually started
// in Stream at all — a scheduled call nobody ever joined is exactly as
// "empty" as one that was joined and then everyone left.
export async function getLiveParticipantCount(callId, callType = "default") {
  try {
    const client = getStreamVideoClient();
    const call = client.video.call(callType, callId);
    const response = await call.queryCallParticipants({});
    return response?.total_participants || 0;
  } catch (err) {
    logger.warn(`[STREAM VIDEO] queryCallParticipants failed for ${callType}:${callId}: ${err.message}`);
    return 0;
  }
}
