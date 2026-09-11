import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import StudyCircle from "../src/models/StudyCircle.model.js";
import ScheduledCall from "../src/models/ScheduledCall.model.js";
import Notification from "../src/models/Notification.model.js";
import {
  scheduleCall,
  listUpcoming,
  cancelCall,
  sendDueReminders,
  callUrl,
  memberNamesLabel,
  buildReminderEmailHtml,
} from "../src/modules/community-call/communityCall.service.js";
import { runCallReminders } from "../src/modules/community-call/communityCall.controller.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const mk = (s) =>
  User.create({ fullName: `Call ${s}`, email: `call-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let creator, member, stranger, circle;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  creator = await mk("creator");
  member = await mk("member");
  stranger = await mk("stranger");
});

afterAll(async () => {
  const ids = [creator._id, member._id, stranger._id];
  await ScheduledCall.deleteMany({ scheduledBy: { $in: ids } });
  await Notification.deleteMany({ recipient: { $in: ids } });
  await StudyCircle.deleteMany({ creator: creator._id });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (circle) await StudyCircle.deleteOne({ _id: circle._id });
  circle = await StudyCircle.create({
    name: "Call Test Circle",
    topic: "Testing scheduled calls",
    creator: creator._id,
    members: [creator._id, member._id],
  });
  await ScheduledCall.deleteMany({ circle: circle._id });
  await Notification.deleteMany({ recipient: { $in: [creator._id, member._id, stranger._id] } });
});

const inMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

describe("scheduleCall", () => {
  it("lets any member schedule a call, not just the creator", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), {
      title: "Weekly sync",
      scheduledAt: inMinutes(60),
    });
    expect(call.title).toBe("Weekly sync");
    expect(call.status).toBe("SCHEDULED");
    expect(call.scheduledBy.id).toBe(String(member._id));
  });

  it("rejects a non-member", async () => {
    await expect(
      scheduleCall(String(stranger._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60) })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a time in the past", async () => {
    await expect(
      scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(-5) })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a time more than 30 days out", async () => {
    await expect(
      scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(31 * 24 * 60) })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("notifies the other members but not the scheduler", async () => {
    await scheduleCall(String(member._id), String(circle._id), { title: "Sync", scheduledAt: inMinutes(60) });
    expect(await Notification.findOne({ recipient: creator._id, type: "circle_call_scheduled" })).toBeTruthy();
    expect(await Notification.findOne({ recipient: member._id, type: "circle_call_scheduled" })).toBeNull();
  });

  it("sends the reminder immediately when scheduled with under 10 minutes' notice", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), { title: "Now-ish", scheduledAt: inMinutes(5) });
    expect(call.status).toBe("REMINDED");
    const doc = await ScheduledCall.findById(call.id);
    expect(doc.reminderSentAt).toBeTruthy();
    expect(await Notification.findOne({ recipient: creator._id, type: "circle_call_reminder" })).toBeTruthy();
  });
});

describe("listUpcoming", () => {
  it("returns future, non-cancelled calls soonest first", async () => {
    await scheduleCall(String(member._id), String(circle._id), { title: "Later", scheduledAt: inMinutes(120) });
    await scheduleCall(String(creator._id), String(circle._id), { title: "Sooner", scheduledAt: inMinutes(60) });
    const upcoming = await listUpcoming(String(member._id), String(circle._id));
    expect(upcoming.map((c) => c.title)).toEqual(["Sooner", "Later"]);
  });

  it("rejects a non-member", async () => {
    await expect(listUpcoming(String(stranger._id), String(circle._id))).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("cancelCall", () => {
  it("lets the organizer cancel their own call", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60) });
    const cancelled = await cancelCall(String(member._id), String(circle._id), call.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await listUpcoming(String(member._id), String(circle._id))).toHaveLength(0);
  });

  it("lets the community creator cancel someone else's call", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60) });
    const cancelled = await cancelCall(String(creator._id), String(circle._id), call.id);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("rejects a member who isn't the organizer or a moderator", async () => {
    const call = await scheduleCall(String(creator._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60) });
    await expect(cancelCall(String(member._id), String(circle._id), call.id)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects cancelling an already-cancelled call", async () => {
    const call = await scheduleCall(String(member._id), String(circle._id), { title: "x", scheduledAt: inMinutes(60) });
    await cancelCall(String(member._id), String(circle._id), call.id);
    await expect(cancelCall(String(member._id), String(circle._id), call.id)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("sendDueReminders (cron sweep)", () => {
  it("reminds a call due within 10 minutes and marks it reminded", async () => {
    const call = await ScheduledCall.create({
      circle: circle._id,
      scheduledBy: member._id,
      title: "Due soon",
      scheduledAt: inMinutes(8),
    });
    const { remindedCount } = await sendDueReminders();
    expect(remindedCount).toBeGreaterThanOrEqual(1);
    const updated = await ScheduledCall.findById(call._id);
    expect(updated.status).toBe("REMINDED");
    expect(updated.reminderSentAt).toBeTruthy();
    expect(await Notification.findOne({ recipient: creator._id, type: "circle_call_reminder" })).toBeTruthy();
  });

  it("never reminds the same call twice", async () => {
    await ScheduledCall.create({ circle: circle._id, scheduledBy: member._id, title: "Once only", scheduledAt: inMinutes(9) });
    const first = await sendDueReminders();
    const second = await sendDueReminders();
    expect(first.remindedCount).toBeGreaterThanOrEqual(1);
    expect(second.remindedCount).toBe(0);
  });

  it("ignores calls further out than the reminder window", async () => {
    await ScheduledCall.create({ circle: circle._id, scheduledBy: member._id, title: "Not yet", scheduledAt: inMinutes(45) });
    const { remindedCount } = await sendDueReminders();
    expect(remindedCount).toBe(0);
  });
});

describe("reminder email content", () => {
  it("builds a join link with the circle and call id, resolvable from outside the app", () => {
    const url = callUrl("circle123", "call456");
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain("circle=circle123");
    expect(url).toContain("callId=call456");
    expect(url).toContain("joinCall=1");
  });

  it("lists member names, truncating past 6 with an 'and N more' tail", () => {
    const names = Array.from({ length: 8 }, (_, i) => ({ _id: String(i), fullName: `Person ${i}` }));
    const label = memberNamesLabel(names, null);
    expect(label).toContain("Person 0");
    expect(label).toContain("and 2 more");
  });

  it("excludes the given user from the member list", () => {
    const names = [{ _id: "a", fullName: "Alice" }, { _id: "b", fullName: "Bob" }];
    expect(memberNamesLabel(names, "a")).toBe("Bob");
  });

  it("embeds the topic, time, members, and a working join link in the email HTML", () => {
    const html = buildReminderEmailHtml({
      title: "Weekly sync",
      circleName: "Buyers Circle",
      whenLabel: "12 Sep, 7:00 pm",
      membersLabel: "Alice, Bob",
      joinLink: "https://example.com/join",
    });
    expect(html).toContain("Weekly sync");
    expect(html).toContain("Buyers Circle");
    expect(html).toContain("12 Sep, 7:00 pm");
    expect(html).toContain("Alice, Bob");
    expect(html).toContain('href="https://example.com/join"');
  });

  it("escapes HTML in user-supplied fields to avoid injection", () => {
    const html = buildReminderEmailHtml({
      title: "<script>alert(1)</script>",
      circleName: "Circle",
      whenLabel: "now",
      membersLabel: "x",
      joinLink: "https://example.com",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("runCallReminders cron endpoint", () => {
  it("rejects without the cron secret", async () => {
    const res = fakeRes();
    await runCallReminders({ get: () => "wrong" }, res);
    expect(res.statusCode).toBe(401);
  });

  it("sweeps successfully with the correct secret", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = fakeRes();
    await runCallReminders({ get: (h) => (h === "x-cron-secret" ? "test-secret" : "") }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("remindedCount");
  });
});
