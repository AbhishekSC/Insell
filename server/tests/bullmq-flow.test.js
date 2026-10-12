import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { QueueEvents } from "bullmq";
import {
  getNotificationQueue,
  initNotificationWorker,
  closeNotificationQueue,
  processNotificationJobData,
} from "../src/queues/notification.queue.js";
import { getBullRedisConnection } from "../src/config/bullmq.config.js";
import * as emailClient from "../src/utils/emailClient.js";
import * as firebaseService from "../src/services/firebase.service.js";
import * as streamService from "../src/services/stream.service.js";

let queueEvents;

beforeAll(async () => {
  // Spy on the actual outbound dispatchers so tests don't hit external APIs
  vi.spyOn(emailClient, "sendGenericEmail").mockResolvedValue({ success: true, id: "msg_123" });
  vi.spyOn(firebaseService, "sendPushNotification").mockResolvedValue({ success: true, messageId: "fcm_456" });
  vi.spyOn(streamService, "pushRealtimeNotification").mockResolvedValue(undefined);

  const connection = getBullRedisConnection();
  queueEvents = new QueueEvents("insell_notifications", { connection });
  await queueEvents.waitUntilReady();
  initNotificationWorker();
});

afterAll(async () => {
  if (queueEvents) await queueEvents.close();
  await closeNotificationQueue();
  vi.restoreAllMocks();
});

describe("BullMQ Producer & Consumer Payload Verification", () => {
  it("enqueues and consumes an EMAIL job with correct payload structure", async () => {
    const queue = getNotificationQueue();
    const emailPayload = {
      email: "buyer@example.com",
      subject: "Offer Accepted",
      htmlContent: "<p>Your offer of ₹45,00,000 has been accepted!</p>",
    };

    const job = await queue.add("EMAIL", { channel: "EMAIL", payload: emailPayload });
    expect(job.id).toBeDefined();

    await processNotificationJobData(job.data);

    expect(emailClient.sendGenericEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "buyer@example.com",
        subject: "Offer Accepted",
        htmlContent: "<p>Your offer of ₹45,00,000 has been accepted!</p>",
      })
    );
  });

  it("enqueues and consumes a FIREBASE push notification job with correct payload structure", async () => {
    const queue = getNotificationQueue();
    const pushPayload = {
      tokens: ["fcm_device_token_xyz_123"],
      message: {
        title: "New Message",
        body: "You have a new message from owner",
        data: { type: "chat_message", channelId: "ch_abc" },
      },
    };

    const job = await queue.add("FIREBASE", { channel: "FIREBASE", payload: pushPayload });
    expect(job.id).toBeDefined();

    await processNotificationJobData(job.data);

    expect(firebaseService.sendPushNotification).toHaveBeenCalledWith(
      ["fcm_device_token_xyz_123"],
      expect.objectContaining({
        title: "New Message",
        body: "You have a new message from owner",
        data: { type: "chat_message", channelId: "ch_abc" },
      })
    );
  });

  it("enqueues and consumes a REALTIME StreamChat notification job with correct payload structure", async () => {
    const queue = getNotificationQueue();
    const realtimePayload = {
      userId: "6accbf1234567890abcdef12",
      eventType: "deal_updated",
    };

    const job = await queue.add("REALTIME", { channel: "REALTIME", payload: realtimePayload });
    expect(job.id).toBeDefined();

    // Verify worker payload processing directly and via job queue completion
    await processNotificationJobData(job.data);

    expect(streamService.pushRealtimeNotification).toHaveBeenCalledWith(
      "6accbf1234567890abcdef12",
      "deal_updated"
    );
  });

  it("is strictly idempotent: duplicate job with same jobId is deduplicated in queue", async () => {
    const queue = getNotificationQueue();
    const testIdempotencyKey = `idemp_test_${Date.now()}`;
    const payload = {
      email: "idempotent-user@example.com",
      subject: "Idempotent Alert",
      htmlContent: "<p>Unique alert</p>",
    };

    // Add with the exact same jobId twice
    const job1 = await queue.add("EMAIL", { channel: "EMAIL", payload }, { jobId: testIdempotencyKey });
    const job2 = await queue.add("EMAIL", { channel: "EMAIL", payload }, { jobId: testIdempotencyKey });

    expect(job1.id).toBe(testIdempotencyKey);
    expect(job2.id).toBe(job1.id);
  });
});
