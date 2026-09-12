import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import User from "../src/models/User.model.js";
import StudyCircle from "../src/models/StudyCircle.model.js";
import ScheduledCall from "../src/models/ScheduledCall.model.js";

// The auto-end sweep calls out to Stream's server API to check live
// occupancy — mocked here so these tests run without real Stream
// credentials or an actual video room, and so the "still occupied" /
// "empty" cases are both cheaply reproducible.
vi.mock("../src/services/streamVideoService.js", () => ({
  getLiveParticipantCount: vi.fn(),
}));

const { getLiveParticipantCount } = await import("../src/services/streamVideoService.js");
const { scheduleCall, listUpcoming, sweepStaleCalls } = await import(
  "../src/modules/community-call/communityCall.service.js"
);

const mk = (s) =>
  User.create({ fullName: `Dur ${s}`, email: `dur-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let member, circle;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  member = await mk("member");
});

afterAll(async () => {
  await ScheduledCall.deleteMany({ scheduledBy: member._id });
  await StudyCircle.deleteMany({ creator: member._id });
  await User.deleteMany({ _id: member._id });
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Clean up ALL of this test file's scheduled calls first, before swapping
  // circles out — otherwise a call left over from the previous test (which
  // pointed at the old, about-to-be-deleted circle id) never gets removed,
  // and sweepStaleCalls() — which queries globally, not per-circle — picks
  // it up in a later test.
  await ScheduledCall.deleteMany({ scheduledBy: member._id });
  if (circle) await StudyCircle.deleteOne({ _id: circle._id });
  circle = await StudyCircle.create({
    name: "Duration Test Circle",
    topic: "Testing call duration",
    creator: member._id,
    members: [member._id],
  });
  getLiveParticipantCount.mockReset();
});

const inMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

describe("scheduleCall — durationMinutes", () => {
  it("defaults to no limit when omitted", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), {
      title: "x",
      scheduledAt: inMinutes(60),
    });
    const doc = await ScheduledCall.findById(call.id);
    expect(doc.durationMinutes).toBeNull();
  });

  it("accepts a valid duration and returns it on the DTO, not just in the database", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), {
      title: "x",
      scheduledAt: inMinutes(60),
      durationMinutes: 30,
    });
    // The bug this guards against: durationMinutes was stored correctly but
    // toScheduledCallDTO() never included it, so the client had no way to
    // ever display the duration the organizer picked.
    expect(call.durationMinutes).toBe(30);
    const doc = await ScheduledCall.findById(call.id);
    expect(doc.durationMinutes).toBe(30);
  });

  it("also returns durationMinutes through listUpcoming", async () => {
    await scheduleCall(String(member._id), String(circle._id), {
      title: "x",
      scheduledAt: inMinutes(60),
      durationMinutes: 45,
    });
    const upcoming = await listUpcoming(String(member._id), String(circle._id));
    expect(upcoming.find((c) => c.title === "x")?.durationMinutes).toBe(45);
  });

  it("rejects a duration below the minimum", async () => {
    await expect(
      scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60), durationMinutes: 1 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a duration above the maximum", async () => {
    await expect(
      scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60), durationMinutes: 500 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("sweepStaleCalls", () => {
  it("ends a STARTED call whose duration elapsed and the room is empty", async () => {
    const call = await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Empty now",
      scheduledAt: inMinutes(-40), // started 40 min ago
      durationMinutes: 30, // duration elapsed 10 min ago
      status: "STARTED",
    });
    getLiveParticipantCount.mockResolvedValue(0);

    const { endedCount } = await sweepStaleCalls();
    expect(endedCount).toBeGreaterThanOrEqual(1);
    const updated = await ScheduledCall.findById(call._id);
    expect(updated.status).toBe("ENDED");
    expect(updated.endedAt).toBeTruthy();
  });

  it("leaves a STARTED call alone if people are still in the room", async () => {
    const call = await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Still going",
      scheduledAt: inMinutes(-40),
      durationMinutes: 30,
      status: "STARTED",
    });
    getLiveParticipantCount.mockResolvedValue(3);

    await sweepStaleCalls();
    const updated = await ScheduledCall.findById(call._id);
    expect(updated.status).toBe("STARTED");
    expect(updated.endedAt).toBeNull();
  });

  it("never touches a STARTED call with no duration set at all", async () => {
    await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "No limit",
      scheduledAt: inMinutes(-1000), // started ages ago
      durationMinutes: null,
      status: "STARTED",
    });

    await sweepStaleCalls();
    // Never even asked Stream about it — durationMinutes: null is excluded
    // by the query itself, not by the occupancy check.
    expect(getLiveParticipantCount).not.toHaveBeenCalled();
  });

  it("ignores a STARTED call whose duration hasn't elapsed yet", async () => {
    const call = await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Just started",
      scheduledAt: inMinutes(-5),
      durationMinutes: 30, // 25 minutes still left
      status: "STARTED",
    });

    await sweepStaleCalls();
    const updated = await ScheduledCall.findById(call._id);
    expect(updated.status).toBe("STARTED");
    expect(getLiveParticipantCount).not.toHaveBeenCalled();
  });

  it("doesn't crash the whole sweep if the Stream check throws for one call", async () => {
    await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Broken lookup",
      scheduledAt: inMinutes(-40),
      durationMinutes: 30,
      status: "STARTED",
    });
    getLiveParticipantCount.mockRejectedValue(new Error("stream unreachable"));

    await expect(sweepStaleCalls()).resolves.toMatchObject({ endedCount: 0 });
  });
});

describe("listUpcoming — includes live (STARTED) calls", () => {
  it("shows a STARTED call even though its scheduledAt is in the past", async () => {
    await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Ongoing",
      scheduledAt: inMinutes(-10),
      status: "STARTED",
    });
    const upcoming = await listUpcoming(String(member._id), String(circle._id));
    expect(upcoming.some((c) => c.title === "Ongoing")).toBe(true);
  });

  it("does not show an ENDED or CANCELLED call", async () => {
    await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Done",
      scheduledAt: inMinutes(-60),
      status: "ENDED",
      endedAt: new Date(),
    });
    const upcoming = await listUpcoming(String(member._id), String(circle._id));
    expect(upcoming.some((c) => c.title === "Done")).toBe(false);
  });
});
