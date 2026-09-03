import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import VisitRequest from "../src/models/VisitRequest.model.js";
import Notification from "../src/models/Notification.model.js";
import {
  createVisitRequest,
  respondToVisitRequest,
  getPostVisitRequests,
  getMyVisitForPost,
} from "../src/controllers/visitRequest.controller.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const soon = (days, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

let owner, visitor, other, post;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await User.create({ fullName: "Visit Owner", email: `v-owner-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });
  visitor = await User.create({ fullName: "Visit Visitor", email: `v-visitor-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });
  other = await User.create({ fullName: "Visit Other", email: `v-other-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });
});

beforeEach(async () => {
  await VisitRequest.deleteMany({ owner: owner._id });
  await Notification.deleteMany({ recipient: { $in: [owner._id, visitor._id] } });
  if (post) await PropertyPost.deleteOne({ _id: post._id });
  post = await PropertyPost.create({ author: owner._id, title: "Visit test flat", price: 5000000, status: "PUBLISHED" });
});

afterAll(async () => {
  const ids = [owner._id, visitor._id, other._id];
  await VisitRequest.deleteMany({ owner: { $in: ids } });
  await Notification.deleteMany({ recipient: { $in: ids } });
  await PropertyPost.deleteMany({ author: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});

async function create(user, body) {
  const res = fakeRes();
  await createVisitRequest({ params: { postId: String(post._id) }, body, user }, res);
  return res;
}
async function respond(user, visitId, body) {
  const res = fakeRes();
  await respondToVisitRequest({ params: { visitId: String(visitId) }, body, user }, res);
  return res;
}

describe("createVisitRequest", () => {
  it("creates a PENDING request and notifies the owner", async () => {
    const res = await create(visitor, { slots: [soon(2), soon(3)] });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.visit.status).toBe("PENDING");
    expect(res.body.data.visit.proposedSlots).toHaveLength(2);
    const notif = await Notification.findOne({ recipient: owner._id, type: "visit_requested" });
    expect(notif).toBeTruthy();
  });

  it("rejects a visit on your own listing", async () => {
    const res = await create(owner, { slots: [soon(2)] });
    expect(res.statusCode).toBe(400);
  });

  it("rejects past-only slots", async () => {
    const res = await create(visitor, { slots: [new Date(Date.now() - 86400000).toISOString()] });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a second open request from the same visitor", async () => {
    await create(visitor, { slots: [soon(2)] });
    const res = await create(visitor, { slots: [soon(4)] });
    expect(res.statusCode).toBe(409);
  });

  it("is idempotent under the same requestId", async () => {
    const rid = "visit-req-1";
    await create(visitor, { slots: [soon(2)], requestId: rid });
    const res = await create(visitor, { slots: [soon(2)], requestId: rid });
    expect(res.statusCode).toBe(200);
    expect(await VisitRequest.countDocuments({ post: post._id, requester: visitor._id })).toBe(1);
  });
});

describe("respondToVisitRequest", () => {
  let visitId;
  beforeEach(async () => {
    const r = await create(visitor, { slots: [soon(2, 11), soon(3, 16)] });
    visitId = r.body.data.visit._id;
  });

  it("owner confirms a proposed slot", async () => {
    const visit = await VisitRequest.findById(visitId);
    const slot = visit.proposedSlots[0];
    const res = await respond(owner, visitId, { action: "confirm", slot });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.visit.status).toBe("CONFIRMED");
    expect(new Date(res.body.data.visit.confirmedSlot).getTime()).toBe(new Date(slot).getTime());
    expect(await Notification.findOne({ recipient: visitor._id, type: "visit_confirmed" })).toBeTruthy();
  });

  it("owner can't confirm a slot that wasn't proposed", async () => {
    const res = await respond(owner, visitId, { action: "confirm", slot: soon(9) });
    expect(res.statusCode).toBe(400);
  });

  it("visitor can't confirm their own pending request (not their turn)", async () => {
    const visit = await VisitRequest.findById(visitId);
    const res = await respond(visitor, visitId, { action: "confirm", slot: visit.proposedSlots[0] });
    expect(res.statusCode).toBe(409);
  });

  it("owner proposes new times, flipping the turn to the visitor", async () => {
    const res = await respond(owner, visitId, { action: "propose", slots: [soon(5, 10)] });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.visit.status).toBe("RESCHEDULE_PROPOSED");
    // now it's the visitor's turn — they confirm
    const confirm = await respond(visitor, visitId, { action: "confirm", slot: res.body.data.visit.proposedSlots[0] });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.body.data.visit.status).toBe("CONFIRMED");
  });

  it("owner declines", async () => {
    const res = await respond(owner, visitId, { action: "decline" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.visit.status).toBe("DECLINED");
  });

  it("visitor can't decline (owner-only)", async () => {
    const res = await respond(visitor, visitId, { action: "decline" });
    expect(res.statusCode).toBe(403);
  });

  it("requester cancels, even after confirmation", async () => {
    const visit = await VisitRequest.findById(visitId);
    await respond(owner, visitId, { action: "confirm", slot: visit.proposedSlots[0] });
    const res = await respond(visitor, visitId, { action: "cancel" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.visit.status).toBe("CANCELLED");
  });

  it("a stranger can't act on the request", async () => {
    const res = await respond(other, visitId, { action: "decline" });
    expect(res.statusCode).toBe(403);
  });
});

describe("listing", () => {
  it("owner sees all visits on their post; a visitor sees only their own", async () => {
    await create(visitor, { slots: [soon(2)] });
    await create(other, { slots: [soon(3)] });

    const ownerRes = fakeRes();
    await getPostVisitRequests({ params: { postId: String(post._id) }, user: owner }, ownerRes);
    expect(ownerRes.body.data.visits).toHaveLength(2);

    const visitorRes = fakeRes();
    await getPostVisitRequests({ params: { postId: String(post._id) }, user: visitor }, visitorRes);
    expect(visitorRes.body.data.visits).toHaveLength(1);

    const mineRes = fakeRes();
    await getMyVisitForPost({ params: { postId: String(post._id) }, user: visitor }, mineRes);
    expect(mineRes.body.data.visit.requester).toBeTruthy();
  });
});
