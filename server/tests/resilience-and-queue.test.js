import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import app from "../src/app.js";
import { getNotificationQueue, enqueueNotification, closeNotificationQueue } from "../src/queues/notification.queue.js";
import Comment from "../src/models/Comment.model.js";

let server;
let baseUrl;

beforeAll(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState === 0 && uri) {
    await mongoose.connect(uri);
  }

  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await closeNotificationQueue();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe("Backend Resilience & BullMQ Architecture", () => {
  it("GET /api/readyz returns 200 ready when DB is connected", async () => {
    const res = await fetch(`${baseUrl}/api/readyz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.database).toBe("connected");
  });

  it("GET /api/health returns 200 liveness status", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("BullMQ notification queue is instantiated and can enqueue jobs", async () => {
    const queue = getNotificationQueue();
    expect(queue).toBeTruthy();
    expect(queue.name).toBe("insell_notifications");

    const result = await enqueueNotification("EMAIL", {
      email: "test-queue@example.com",
      subject: "Test BullMQ",
      htmlContent: "<p>Hello from BullMQ</p>",
    });
    expect(result).toBeTruthy();
  });

  it("Comment model schema compiles cleanly without duplicate index warnings", () => {
    expect(Comment.modelName).toBe("Comment");
    expect(Comment.schema.path("sentiment")).toBeTruthy();
    expect(Comment.schema.path("keywords")).toBeTruthy();
    expect(Comment.schema.path("category")).toBeTruthy();
  });
});
