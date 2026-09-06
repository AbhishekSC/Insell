import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import Offer from "../src/models/Offer.model.js";
import Deal from "../src/models/Deal.model.js";
import Notification from "../src/models/Notification.model.js";
import { createOffer, respondToOffer } from "../src/controllers/offer.controller.js";
import { getDealForPost, updateDeal, getMyDeals, nudgeStalledDeals, adminResolveDealReports, adminForceCancelDeal } from "../src/controllers/deal.controller.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const mk = (s) => User.create({ fullName: `Deal ${s}`, email: `deal-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let owner, buyer, stranger, post;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await mk("owner");
  buyer = await mk("buyer");
  stranger = await mk("stranger");
});
afterAll(async () => {
  const ids = [owner._id, buyer._id, stranger._id];
  await Deal.deleteMany({ owner: { $in: ids } });
  await Offer.deleteMany({ owner: { $in: ids } });
  await Notification.deleteMany({ recipient: { $in: ids } });
  await PropertyPost.deleteMany({ author: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await Deal.deleteMany({ owner: owner._id });
  await Offer.deleteMany({ owner: owner._id });
  await Notification.deleteMany({ recipient: { $in: [owner._id, buyer._id] } });
  if (post) await PropertyPost.deleteOne({ _id: post._id });
  post = await PropertyPost.create({ author: owner._id, title: "Deal test flat", price: 5000000, status: "PUBLISHED", listingType: "Sell" });
});

async function acceptedDeal() {
  await createOffer({ params: { postId: post._id }, body: { price: 4700000 }, user: buyer }, fakeRes());
  const offer = await Offer.findOne({ post: post._id, buyer: buyer._id });
  await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());
  return Deal.findOne({ post: post._id });
}
const patch = async (dealId, user, body) => {
  const res = fakeRes();
  await updateDeal({ params: { id: String(dealId) }, body, user: { _id: user._id, fullName: user.fullName } }, res);
  return res;
};
// propose + confirm a stage in one go
async function step(dealId, proposer, confirmer, message) {
  await patch(dealId, proposer, { action: "propose", message });
  return patch(dealId, confirmer, { action: "confirm" });
}

describe("deal lifecycle", () => {
  it("an accepted offer opens a Deal (BUY, agreed done)", async () => {
    const d = await acceptedDeal();
    expect(d.status).toBe("ACTIVE");
    expect(d.mode).toBe("BUY");
    expect(d.completedStages).toEqual(["agreed"]);
    expect(d.agreedPrice).toBe(4700000);
  });

  it("propose sets a pending stage; only the OTHER party can confirm", async () => {
    const d = await acceptedDeal();
    await patch(d._id, owner, { action: "propose", message: "docs shared" });
    let fresh = await Deal.findById(d._id);
    expect(fresh.pendingStage.key).toBe("documents");
    expect(fresh.completedStages).not.toContain("documents");

    // proposer can't confirm their own
    const selfConfirm = await patch(d._id, owner, { action: "confirm" });
    expect(selfConfirm.statusCode).toBe(409);

    const ok = await patch(d._id, buyer, { action: "confirm" });
    expect(ok.statusCode).toBe(200);
    fresh = await Deal.findById(d._id);
    expect(fresh.completedStages).toContain("documents");
    expect(fresh.pendingStage).toBeNull();
    expect(await Notification.findOne({ recipient: owner._id, type: "deal_updated" })).toBeTruthy();
  });

  it("dispute clears the pending stage without completing it", async () => {
    const d = await acceptedDeal();
    await patch(d._id, buyer, { action: "propose" });
    const res = await patch(d._id, owner, { action: "dispute", message: "haven't received the NOC" });
    expect(res.statusCode).toBe(200);
    const fresh = await Deal.findById(d._id);
    expect(fresh.pendingStage).toBeNull();
    expect(fresh.completedStages).not.toContain("documents");
  });

  it("stepping through every stage completes the deal and marks the post sold-ish", async () => {
    const d = await acceptedDeal();
    // BUY: agreed(done) + 5 more = documents, agreement, payment, registration, completed
    for (let i = 0; i < 5; i++) await step(d._id, buyer, owner);
    const done = await Deal.findById(d._id);
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBeTruthy();
    expect(await Notification.findOne({ recipient: buyer._id, type: "deal_completed" })).toBeTruthy();
  });

  it("cancel puts the listing back on the market", async () => {
    const d = await acceptedDeal();
    expect((await PropertyPost.findById(post._id)).offerStatus).toBe("ACCEPTED");
    const res = await patch(d._id, buyer, { action: "cancel", reason: "loan rejected" });
    expect(res.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).status).toBe("CANCELLED");
    expect((await PropertyPost.findById(post._id)).offerStatus).toBe("OPEN");
    expect((await Offer.findOne({ post: post._id })).status).toBe("declined");
  });

  it("PATCH is idempotent under the same requestId", async () => {
    const d = await acceptedDeal();
    const rid = "deal-req-1";
    await updateDeal({ params: { id: String(d._id) }, body: { action: "propose", requestId: rid }, user: { _id: owner._id, fullName: owner.fullName } }, fakeRes());
    await updateDeal({ params: { id: String(d._id) }, body: { action: "propose", requestId: rid }, user: { _id: owner._id, fullName: owner.fullName } }, fakeRes());
    const fresh = await Deal.findById(d._id);
    expect(fresh.history.filter((h) => h.action === "propose").length).toBe(1);
  });

  it("captures the payment amount and blocks undo / unilateral cancel afterwards", async () => {
    const d = await acceptedDeal();
    await step(d._id, buyer, owner); // documents
    await step(d._id, buyer, owner); // agreement
    // payment stage — propose needs an amount
    await patch(d._id, buyer, { action: "propose", amount: 250000 });
    await patch(d._id, owner, { action: "confirm" });
    const paid = await Deal.findById(d._id);
    expect(paid.paymentAmount).toBe(250000);
    expect(paid.completedStages).toContain("payment");

    // undo is blocked once payment is confirmed
    const undo = await patch(d._id, buyer, { action: "revert" });
    expect(undo.statusCode).toBe(409);

    // cancel is now a request, not unilateral
    const req = await patch(d._id, buyer, { action: "cancel_request", reason: "changed my mind" });
    expect(req.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).status).toBe("ACTIVE"); // not cancelled yet
    expect((await Deal.findById(d._id)).pendingCancel).toBeTruthy();

    // requester can't self-confirm
    expect((await patch(d._id, buyer, { action: "cancel_confirm" })).statusCode).toBe(409);
    // the other party agrees
    const agree = await patch(d._id, owner, { action: "cancel_confirm" });
    expect(agree.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).status).toBe("CANCELLED");
  });

  it("two disputes flip 'disputed', a later confirm clears it", async () => {
    const d = await acceptedDeal();
    await patch(d._id, buyer, { action: "propose" });
    await patch(d._id, owner, { action: "dispute", message: "no" });
    await patch(d._id, buyer, { action: "propose" });
    await patch(d._id, owner, { action: "dispute", message: "still no" });
    expect((await Deal.findById(d._id)).disputed).toBe(true);

    await step(d._id, buyer, owner); // documents finally confirmed
    expect((await Deal.findById(d._id)).disputed).toBe(false);
  });

  it("the cancel requester can withdraw; stage moves are blocked while it's open", async () => {
    const d = await acceptedDeal();
    for (const _ of [0, 1]) await step(d._id, buyer, owner); // documents, agreement
    await patch(d._id, buyer, { action: "propose", amount: 100000 }); // payment
    await patch(d._id, owner, { action: "confirm" });

    await patch(d._id, owner, { action: "cancel_request", reason: "second thoughts" });
    // stage move blocked while cancellation pending
    const blocked = await patch(d._id, buyer, { action: "propose" });
    expect(blocked.statusCode).toBe(409);
    // requester withdraws
    const w = await patch(d._id, owner, { action: "cancel_withdraw" });
    expect(w.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).pendingCancel).toBeNull();
    // now stage moves work again
    expect((await patch(d._id, buyer, { action: "propose" })).statusCode).toBe(200);
  });

  it("report is recorded and allowed on a completed deal", async () => {
    const d = await acceptedDeal();
    const res = await patch(d._id, buyer, { action: "report", reason: "the owner is asking for cash off-platform" });
    expect(res.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).reports.length).toBe(1);
  });

  it("admin can resolve reports and force-cancel a deal", async () => {
    const d = await acceptedDeal();
    await patch(d._id, buyer, { action: "report", reason: "fraud" });

    const r1 = fakeRes();
    await adminResolveDealReports({ params: { id: String(d._id) }, user: { _id: stranger._id } }, r1);
    expect(r1.statusCode).toBe(200);
    expect((await Deal.findById(d._id)).reports.every((x) => x.resolved)).toBe(true);

    const r2 = fakeRes();
    await adminForceCancelDeal({ params: { id: String(d._id) }, body: { reason: "verified fraud" }, user: { _id: stranger._id } }, r2);
    expect(r2.statusCode).toBe(200);
    const after = await Deal.findById(d._id);
    expect(after.status).toBe("CANCELLED");
    expect(after.cancelledReason).toContain("[Admin]");
    expect((await PropertyPost.findById(post._id)).offerStatus).toBe("OPEN");
    // both parties notified
    expect(await Notification.countDocuments({ recipient: { $in: [buyer._id, owner._id] }, type: "deal_cancelled" })).toBeGreaterThanOrEqual(2);
  });

  it("force-cancel requires a reason and only touches ACTIVE deals", async () => {
    const d = await acceptedDeal();
    const noReason = fakeRes();
    await adminForceCancelDeal({ params: { id: String(d._id) }, body: {}, user: { _id: stranger._id } }, noReason);
    expect(noReason.statusCode).toBe(400);
  });

  it("a stranger can't touch the deal", async () => {
    const d = await acceptedDeal();
    const res = await patch(d._id, stranger, { action: "propose" });
    expect(res.statusCode).toBe(403);
  });

  it("getDealForPost: parties see it, strangers don't", async () => {
    await acceptedDeal();
    const forStranger = fakeRes();
    await getDealForPost({ params: { postId: String(post._id) }, user: stranger }, forStranger);
    expect(forStranger.body.data.deal).toBeNull();
    const forBuyer = fakeRes();
    await getDealForPost({ params: { postId: String(post._id) }, user: buyer }, forBuyer);
    expect(forBuyer.body.data.deal).toBeTruthy();
  });

  it("getMyDeals lists it for the buyer", async () => {
    await acceptedDeal();
    const res = fakeRes();
    await getMyDeals({ user: buyer }, res);
    expect(res.body.data.deals.some((x) => String(x.post?._id || x.post) === String(post._id))).toBe(true);
  });
});

describe("stalled-deal sweep", () => {
  it("rejects without the cron secret", async () => {
    const res = fakeRes();
    await nudgeStalledDeals({ get: () => "wrong" }, res);
    expect(res.statusCode).toBe(401);
  });

  it("nudges a deal that hasn't moved in a week", async () => {
    process.env.CRON_SECRET = "test-secret";
    const d = await acceptedDeal();
    await Deal.updateOne(
      { _id: d._id },
      { $set: { updatedAt: new Date(Date.now() - 10 * 86400000) }, $unset: { lastNudgedAt: 1 } },
      { timestamps: false }
    );

    const res = fakeRes();
    await nudgeStalledDeals({ get: (h) => (h === "x-cron-secret" ? "test-secret" : "") }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.nudged).toBeGreaterThanOrEqual(1);
    expect((await Deal.findById(d._id)).lastNudgedAt).toBeTruthy();
    expect(await Notification.findOne({ recipient: buyer._id, type: "deal_updated" })).toBeTruthy();
  });
});
