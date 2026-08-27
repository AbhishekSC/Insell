// Integration tests for the Offer/Review state machine — run against a real
// MongoDB Atlas connection (same one the app itself uses; transactions
// require an actual replica set, which mongodb-memory-server can't cheaply
// provide, so these run against real infrastructure like every other
// verification pass in this project's history). Each test creates its own
// disposable fixtures (users, a post) and tears them down afterward — it
// never touches real user data.
import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import Offer from "../src/models/Offer.model.js";
import Review from "../src/models/Review.model.js";
import Notification from "../src/models/Notification.model.js";
import { createOffer, respondToOffer, getMyOfferForPost, getPostOffers } from "../src/controllers/offer.controller.js";
import { createReview } from "../src/controllers/review.controller.js";

function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function makeUser(suffix) {
  return User.create({
    fullName: `Test User ${suffix}`,
    email: `offer-test-${suffix}-${Date.now()}@example.test`,
    password: "TestPass1!",
    isVerified: true,
  });
}

let owner, buyerB, buyerC, buyerD, post;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await makeUser("owner");
  buyerB = await makeUser("buyerB");
  buyerC = await makeUser("buyerC");
  buyerD = await makeUser("buyerD");
});

afterAll(async () => {
  const userIds = [owner._id, buyerB._id, buyerC._id, buyerD._id];
  await Offer.deleteMany({ owner: { $in: userIds } });
  await Review.deleteMany({ reviewee: { $in: userIds } });
  await PropertyPost.deleteMany({ author: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Offer.deleteMany({ owner: owner._id });
  // Scoped to the disposable test fixtures only — this was previously
  // Review.deleteMany({}) with no filter at all, which wiped every review
  // in the entire database (including real ones) on every single test run.
  await Review.deleteMany({ reviewee: { $in: [owner._id, buyerB._id, buyerC._id, buyerD._id] } });
  await Notification.deleteMany({ recipient: { $in: [owner._id, buyerB._id, buyerC._id, buyerD._id] } });
  if (post) await PropertyPost.deleteOne({ _id: post._id });
  post = await PropertyPost.create({
    author: owner._id,
    title: "Offer lifecycle test post",
    price: 100000,
    status: "PUBLISHED",
  });
});

describe("createOffer", () => {
  it("succeeds for a real buyer on someone else's post", async () => {
    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.offer.status).toBe("pending");
  });

  it("rejects an offer on your own post", async () => {
    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: owner }, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects a second active offer from the same buyer on the same post", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 95000 }, user: buyerB }, res);
    expect(res.statusCode).toBe(409);
  });

  it("rejects a new offer on a post that already has an accepted offer", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());

    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 95000 }, user: buyerC }, res);
    expect(res.statusCode).toBe(409);
  });

  it("is idempotent under the same requestId — a retried submit returns the original offer, not a duplicate", async () => {
    const requestId = "test-request-id-1";
    await createOffer({ params: { postId: post._id }, body: { price: 90000, requestId }, user: buyerB }, fakeRes());
    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 90000, requestId }, user: buyerB }, res);
    expect(res.statusCode).toBe(200);
    const count = await Offer.countDocuments({ post: post._id, buyer: buyerB._id });
    expect(count).toBe(1);
  });
});

describe("counter", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("buyer -> owner counter works, flips lastActionBy", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000 }, user: owner }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.offer.status).toBe("countered");
    expect(String(res.body.data.offer.lastActionBy)).toBe(String(owner._id));
  });

  it("repeated back-and-forth counters keep working", async () => {
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000 }, user: owner }, fakeRes());
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 92000 }, user: buyerB }, fakeRes());
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 93000 }, user: owner }, res);
    expect(res.body.data.offer.currentPrice).toBe(93000);
    expect(res.body.data.offer.history).toHaveLength(4); // offer, counter, counter, counter
  });

  it("rejects a counter on a terminal (already declined) offer", async () => {
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: owner }, fakeRes());
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 80000 }, user: buyerB }, res);
    expect(res.statusCode).toBe(409);
  });
});

describe("accept", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("the correct counterparty can accept", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.offer.status).toBe("accepted");
  });

  it("the actor who made the last proposal cannot accept their own offer", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: buyerB }, res);
    expect(res.statusCode).toBe(409);
  });

  it("accepting an already-accepted offer fails", async () => {
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, res);
    expect(res.statusCode).toBe(409);
  });

  it("two concurrent accept requests on the same offer — exactly one wins", async () => {
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes()),
    ]);
    const statuses = [r1.statusCode, r2.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    const final = await Offer.findById(offer._id);
    expect(final.history.filter((h) => h.action === "accept")).toHaveLength(1);
  });

  it("accepting one offer auto-declines every other active offer on the same post", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 92000 }, user: buyerC }, fakeRes());
    await createOffer({ params: { postId: post._id }, body: { price: 95000 }, user: buyerD }, fakeRes());

    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());

    const offerC = await Offer.findOne({ post: post._id, buyer: buyerC._id });
    const offerD = await Offer.findOne({ post: post._id, buyer: buyerD._id });
    expect(offerC.status).toBe("declined");
    expect(offerD.status).toBe("declined");

    const postAfter = await PropertyPost.findById(post._id);
    expect(postAfter.offerStatus).toBe("ACCEPTED");
  });

  it("is idempotent under the same requestId — a retried accept doesn't push a second history entry", async () => {
    const requestId = "test-request-id-accept";
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes());
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, res);
    expect(res.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.history.filter((h) => h.action === "accept")).toHaveLength(1);
  });
});

describe("decline / withdraw", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("buyer declining their own offer produces status=withdrawn", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: buyerB }, res);
    expect(res.body.data.offer.status).toBe("withdrawn");
  });

  it("owner declining produces status=declined, never withdrawn", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: owner }, res);
    expect(res.body.data.offer.status).toBe("declined");
  });

  it("a non-participant cannot act on the offer at all", async () => {
    const res = fakeRes();
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: buyerC }, res);
    expect(res.statusCode).toBe(403);
  });
});

describe("review", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());
  });

  it("buyer can review owner, reviewee is derived server-side as the owner", async () => {
    const res = fakeRes();
    await createReview({ params: { offerId: offer._id }, body: { rating: 5, comment: "Great" }, user: buyerB }, res);
    expect(res.statusCode).toBe(201);
    expect(String(res.body.data.review.reviewee)).toBe(String(owner._id));
  });

  it("owner can review buyer too — bidirectional", async () => {
    const res = fakeRes();
    await createReview({ params: { offerId: offer._id }, body: { rating: 4, comment: "Smooth" }, user: owner }, res);
    expect(res.statusCode).toBe(201);
    expect(String(res.body.data.review.reviewee)).toBe(String(buyerB._id));
  });

  it("a second review on the same offer by the same reviewer is rejected", async () => {
    await createReview({ params: { offerId: offer._id }, body: { rating: 5, comment: "Great" }, user: buyerB }, fakeRes());
    const res = fakeRes();
    await createReview({ params: { offerId: offer._id }, body: { rating: 1, comment: "changed my mind" }, user: buyerB }, res);
    expect(res.statusCode).toBe(409);
  });

  it("a non-participant cannot review this offer", async () => {
    const res = fakeRes();
    await createReview({ params: { offerId: offer._id }, body: { rating: 5, comment: "?" }, user: buyerC }, res);
    expect(res.statusCode).toBe(403);
  });

  it("cannot review an offer that was never accepted", async () => {
    // Separate post: `post` already has an accepted offer from the outer
    // beforeEach, and a post can only ever have one accepted offer — so a
    // still-pending offer to test against needs its own post.
    const otherPost = await PropertyPost.create({ author: owner._id, title: "second post", price: 50000, status: "PUBLISHED" });
    await createOffer({ params: { postId: otherPost._id }, body: { price: 45000 }, user: buyerC }, fakeRes());
    const pendingOffer = await Offer.findOne({ post: otherPost._id, buyer: buyerC._id });
    const res = fakeRes();
    await createReview({ params: { offerId: pendingOffer._id }, body: { rating: 5, comment: "?" }, user: buyerC }, res);
    expect(res.statusCode).toBe(400);
    await PropertyPost.deleteOne({ _id: otherPost._id });
  });
});

describe("getMyOfferForPost / getPostOffers reviewedByMe flag", () => {
  it("reflects real review state, not stale client assumptions", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());

    let res = fakeRes();
    await getMyOfferForPost({ params: { postId: post._id }, user: buyerB }, res);
    expect(res.body.data.offer.reviewedByMe).toBe(false);

    await createReview({ params: { offerId: offer._id }, body: { rating: 5, comment: "Great" }, user: buyerB }, fakeRes());

    res = fakeRes();
    await getMyOfferForPost({ params: { postId: post._id }, user: buyerB }, res);
    expect(res.body.data.offer.reviewedByMe).toBe(true);

    res = fakeRes();
    await getPostOffers({ params: { postId: post._id }, user: owner }, res);
    expect(res.body.data.offers[0].reviewedByMe).toBe(false); // owner hasn't reviewed yet
  });
});

describe("idempotency under true concurrency (not just sequential retries)", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("two concurrent accepts with the SAME requestId: exactly one history entry, no error surfaces to either caller", async () => {
    const requestId = "concurrent-same-id-accept";
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes()),
    ]);
    // Neither caller should see a raw error — one gets the real accept,
    // the other gets the idempotent-replay 200 for the same requestId.
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.status).toBe("accepted");
    expect(final.history.filter((h) => h.requestId === requestId)).toHaveLength(1);
  });

  it("two concurrent counters with the SAME requestId: exactly one history entry", async () => {
    const requestId = "concurrent-same-id-counter";
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000, requestId }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000, requestId }, user: owner }, fakeRes()),
    ]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.history.filter((h) => h.requestId === requestId)).toHaveLength(1);
    expect(final.history.filter((h) => h.action === "counter")).toHaveLength(1);
  });

  it("reusing a requestId with a different payload returns the ORIGINAL result, ignoring the new payload", async () => {
    const requestId = "replay-different-payload";
    const first = await respondToOffer(
      { params: { offerId: offer._id }, body: { action: "counter", price: 95000, requestId }, user: owner },
      fakeRes()
    );
    expect(first.body.data.offer.currentPrice).toBe(95000);

    // Same requestId, a completely different price this time — must be
    // ignored; idempotency means "same request", not "latest payload wins".
    const replay = await respondToOffer(
      { params: { offerId: offer._id }, body: { action: "counter", price: 50000, requestId }, user: owner },
      fakeRes()
    );
    expect(replay.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.currentPrice).toBe(95000); // NOT 50000
    expect(final.history.filter((h) => h.requestId === requestId)).toHaveLength(1);
  });
});

describe("action-vs-action races on the same offer", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("accept vs counter, fired at once: exactly one wins, offer ends in a valid terminal-or-countered state", async () => {
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000 }, user: owner }, fakeRes()),
    ]);
    const statuses = [r1.statusCode, r2.statusCode];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const final = await Offer.findById(offer._id);
    expect(["accepted", "countered"]).toContain(final.status);
  });

  it("accept vs decline, fired at once: exactly one wins", async () => {
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: owner }, fakeRes()),
    ]);
    const statuses = [r1.statusCode, r2.statusCode];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const final = await Offer.findById(offer._id);
    expect(["accepted", "declined"]).toContain(final.status);
  });

  it("counter vs counter (different requestIds — two legitimate, distinct moves): both apply, MongoDB serializes them, neither is lost or corrupted", async () => {
    // Unlike accept/decline, landing on "countered" doesn't leave
    // ACTIVE_STATUSES — a second, genuinely different counter arriving
    // right after the first is a real next move in the negotiation, not a
    // duplicate to reject. What must never happen is data loss/corruption;
    // MongoDB's per-document write ordering guarantees exactly that even
    // when both requests are fired at literally the same instant.
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000 }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 96000 }, user: owner }, fakeRes()),
    ]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.history.filter((h) => h.action === "counter")).toHaveLength(2);
    expect(final.status).toBe("countered");
    expect([95000, 96000]).toContain(final.currentPrice);
  });

  it("counter vs counter with the SAME requestId (a genuine duplicate submit): only the first applies", async () => {
    const requestId = "dup-counter-race";
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000, requestId }, user: owner }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "counter", price: 95000, requestId }, user: owner }, fakeRes()),
    ]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const final = await Offer.findById(offer._id);
    expect(final.history.filter((h) => h.requestId === requestId)).toHaveLength(1);
    expect(final.history.filter((h) => h.action === "counter")).toHaveLength(1);
  });

  it("buyer withdraw vs owner accept, fired at once: exactly one wins, never both", async () => {
    const [r1, r2] = await Promise.all([
      respondToOffer({ params: { offerId: offer._id }, body: { action: "decline" }, user: buyerB }, fakeRes()),
      respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes()),
    ]);
    const statuses = [r1.statusCode, r2.statusCode];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const final = await Offer.findById(offer._id);
    expect(["accepted", "withdrawn"]).toContain(final.status);
  });
});

describe("authorization matrix", () => {
  let offer;
  beforeEach(async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
  });

  it("a random unrelated user cannot accept/counter/decline someone else's offer", async () => {
    for (const action of ["accept", "counter", "decline"]) {
      const res = fakeRes();
      await respondToOffer({ params: { offerId: offer._id }, body: { action, price: 91000 }, user: buyerD }, res);
      expect(res.statusCode).toBe(403);
    }
  });

  it("knowing an offerId alone is not enough — a non-party accept attempt never mutates the offer", async () => {
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: buyerC }, fakeRes());
    const untouched = await Offer.findById(offer._id);
    expect(untouched.status).toBe("pending");
  });

  it("the buyer cannot view another owner's post offers list", async () => {
    const res = fakeRes();
    await getPostOffers({ params: { postId: post._id }, user: buyerB }, res);
    expect(res.statusCode).toBe(403);
  });

  it("makeOffer on someone else's post as that post's actual owner is rejected", async () => {
    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 50000 }, user: owner }, res);
    expect(res.statusCode).toBe(400);
  });
});

describe("republish behavior (documented, not changed)", () => {
  // Decision: once offerStatus flips to ACCEPTED, it stays ACCEPTED forever
  // — including if the post is later unpublished and republished. A sold/
  // rented listing being "reopened" for fresh offers by republishing the
  // same post isn't a case this app models; that would need a deliberate
  // new post or an explicit admin/owner "reopen for offers" action, which
  // is a real product decision, not something to infer silently here.
  it("offerStatus stays ACCEPTED across an unpublish + republish cycle", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept" }, user: owner }, fakeRes());

    await PropertyPost.updateOne({ _id: post._id }, { $set: { status: "ARCHIVED" } });
    await PropertyPost.updateOne({ _id: post._id }, { $set: { status: "PUBLISHED" } });

    const republished = await PropertyPost.findById(post._id);
    expect(republished.offerStatus).toBe("ACCEPTED");

    const res = fakeRes();
    await createOffer({ params: { postId: post._id }, body: { price: 95000 }, user: buyerC }, res);
    expect(res.statusCode).toBe(409);
  });
});

describe("retry does not duplicate side effects (notifications, friendship)", () => {
  it("a sequential retry of the same accept (double-click, timeout-then-resubmit) sends exactly one offer_accepted notification", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });

    const requestId = "retry-notification-test";
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes());
    // A genuine retry, sent after the first one has already fully
    // completed — the realistic "network timeout, user clicks again" case.
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes());

    const acceptedNotifs = await Notification.find({ type: "offer_accepted", recipient: buyerB._id });
    expect(acceptedNotifs).toHaveLength(1);
  });

  it("friend connection stays a single entry each way regardless of retries ($addToSet is naturally idempotent)", async () => {
    await createOffer({ params: { postId: post._id }, body: { price: 90000 }, user: buyerB }, fakeRes());
    const offer = await Offer.findOne({ post: post._id, buyer: buyerB._id });

    const requestId = "retry-friendship-test";
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes());
    await respondToOffer({ params: { offerId: offer._id }, body: { action: "accept", requestId }, user: owner }, fakeRes());

    const freshOwner = await User.findById(owner._id).select("friends").lean();
    const matches = freshOwner.friends.filter((f) => String(f) === String(buyerB._id));
    expect(matches).toHaveLength(1);
  });
});
