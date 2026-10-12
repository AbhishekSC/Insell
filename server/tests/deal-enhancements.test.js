import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import app from "../src/app.js";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import Deal from "../src/models/Deal.model.js";
import Offer from "../src/models/Offer.model.js";
import jwt from "jsonwebtoken";
import { connectToRedis, closeRedisConnection } from "../src/config/redisClient.config.js";

const makeToken = (user) => {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
  return jwt.sign({ id: user._id, fullName: user.fullName }, secret, { expiresIn: "1h" });
};

let server;
let baseUrl;
let buyerUser, ownerUser, strangerUser;
let buyerToken, ownerToken;
let testPost, testOffer, testDeal;

beforeAll(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState === 0 && uri) {
    await mongoose.connect(uri);
  }
  await connectToRedis();

  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const ts = Date.now().toString().slice(-6);
  buyerUser = await User.create({
    fullName: `Buyer ${ts}`,
    email: `buyer-${ts}@example.com`,
    password: "Password123!",
    isVerified: true,
  });

  ownerUser = await User.create({
    fullName: `Owner ${ts}`,
    email: `owner-${ts}@example.com`,
    password: "Password123!",
    isVerified: true,
  });

  strangerUser = await User.create({
    fullName: `Stranger ${ts}`,
    email: `stranger-${ts}@example.com`,
    password: "Password123!",
    isVerified: true,
  });

  buyerToken = makeToken(buyerUser);
  ownerToken = makeToken(ownerUser);

  testPost = await PropertyPost.create({
    author: ownerUser._id,
    title: "Luxury Sea Facing Apartment",
    description: "3 BHK premium flat with sea view",
    price: 9500000,
    listingType: "Sell",
    postType: "PROPERTY_SALE",
    city: "Mumbai",
    locality: "Bandra West",
    status: "PUBLISHED",
  });

  testOffer = await Offer.create({
    post: testPost._id,
    buyer: buyerUser._id,
    owner: ownerUser._id,
    listedPrice: 9500000,
    currentPrice: 9200000,
    lastActionBy: buyerUser._id,
    status: "accepted",
  });

  testDeal = await Deal.create({
    post: testPost._id,
    offer: testOffer._id,
    buyer: buyerUser._id,
    owner: ownerUser._id,
    agreedPrice: 9200000,
    mode: "BUY",
    status: "ACTIVE",
    currentStage: "documents",
    completedStages: ["agreed"],
    attachments: [
      {
        url: "https://res.cloudinary.com/demo/image/upload/sample_deed.pdf",
        name: "Registered Sale Deed",
        category: "PROPERTY_TITLE",
        stage: "documents",
        uploadedBy: ownerUser._id,
      },
    ],
  });
});

afterAll(async () => {
  if (testDeal) await Deal.deleteOne({ _id: testDeal._id });
  if (testOffer) await Offer.deleteOne({ _id: testOffer._id });
  if (testPost) await PropertyPost.deleteOne({ _id: testPost._id });
  if (buyerUser) await User.deleteOne({ _id: buyerUser._id });
  if (ownerUser) await User.deleteOne({ _id: ownerUser._id });
  if (strangerUser) await User.deleteOne({ _id: strangerUser._id });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeRedisConnection();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe("Real Estate Deal Enhancements & Security Verification", () => {
  it("allows counterparty (buyer) to verify owner's document attachment", async () => {
    const attId = testDeal.attachments[0]._id;

    const res = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments/${attId}/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.data.deal.attachments[0].verifiedBy).toBe(String(buyerUser._id));
    expect(body.data.deal.attachments[0].verifiedAt).toBeTruthy();
  });

  it("blocks uploader from verifying their own document", async () => {
    const attId = testDeal.attachments[0]._id;

    const res = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments/${attId}/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`, // Owner uploaded it
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  it("proposes payment stage with banking details (UTR, mode, bank name)", async () => {
    // Fast forward stages to payment
    await Deal.updateOne(
      { _id: testDeal._id },
      { $set: { completedStages: ["agreed", "documents", "agreement"], currentStage: "payment", pendingStage: null } }
    );

    const res = await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "propose",
        amount: 1000000,
        paymentMode: "RTGS",
        transactionRef: "HDFC00012345678",
        bankName: "HDFC Bank",
        receiptUrl: "https://res.cloudinary.com/demo/image/upload/receipt.jpg",
        message: "Token payment transferred via RTGS",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deal.pendingStage.key).toBe("payment");
    expect(body.data.deal.pendingStage.amount).toBe(1000000);
    expect(body.data.deal.pendingStage.paymentMode).toBe("RTGS");
    expect(body.data.deal.pendingStage.transactionRef).toBe("HDFC00012345678");
  });

  it("owner confirms payment and saves complete paymentDetails on deal", async () => {
    const res = await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "confirm",
        message: "Payment received in bank account",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const updatedDeal = body.data.deal;
    expect(updatedDeal.paymentAmount).toBe(1000000);
    expect(updatedDeal.paymentDetails.paymentMode).toBe("RTGS");
    expect(updatedDeal.paymentDetails.transactionRef).toBe("HDFC00012345678");
    expect(updatedDeal.paymentDetails.bankName).toBe("HDFC Bank");
  });

  it("generates an official transaction closing statement with summary and checklist", async () => {
    const res = await fetch(`${baseUrl}/api/deals/${testDeal._id}/summary`, {
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");

    const summary = body.data.summary;
    expect(summary.statementNumber).toContain("NMS-DEAL-");
    expect(summary.verificationToken).toBeDefined();
    expect(summary.verificationToken.length).toBe(64); // SHA-256 hex string
    expect(summary.breakdown.agreedPrice).toBe(9200000);
    expect(summary.breakdown.tokenAdvancePaid).toBe(1000000);
    expect(summary.breakdown.balancePayable).toBe(8200000);
    expect(summary.property.title).toBe("Luxury Sea Facing Apartment");
    expect(summary.parties.buyer.name).toBe(buyerUser.fullName);
    expect(summary.parties.owner.name).toBe(ownerUser.fullName);
    expect(summary.payment.paidAmount).toBe(1000000);
    expect(summary.payment.transactionRef).toBe("HDFC00012345678");
    expect(summary.documents.verified).toBeGreaterThanOrEqual(1);
    expect(summary.milestones.length).toBeGreaterThan(0);
  });

  it("SECURITY GUARD: blocks non-uploader and uploader from deleting a verified document", async () => {
    const attId = testDeal.attachments[0]._id;

    // 1. Non-uploader (buyer) cannot delete owner's document (403)
    const resStranger = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments/${attId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    expect(resStranger.status).toBe(403);

    // 2. Uploader (owner) cannot delete once verified by counterparty (400)
    const resUploader = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments/${attId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resUploader.status).toBe(400);
    const body = await resUploader.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("already been verified");
  });

  it("SECURITY GUARD: blocks owner from deleting property listing while ACTIVE deal is in progress", async () => {
    const res = await fetch(`${baseUrl}/api/posts/${testPost._id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("Cannot delete listing while an active deal is in progress");
  });

  it("PUBLIC VERIFICATION PORTAL: unauthenticated third-party can verify statement by SHA-256 token", async () => {
    // 1. Fetch summary as buyer to ensure token is generated and persisted
    const sumRes = await fetch(`${baseUrl}/api/deals/${testDeal._id}/summary`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const sumBody = await sumRes.json();
    const token = sumBody.data.summary.verificationToken;
    expect(token).toBeTruthy();

    // 2. Fetch public endpoint WITHOUT any Authorization header
    const pubRes = await fetch(`${baseUrl}/api/deals/verify-statement/${token}`);
    expect(pubRes.status).toBe(200);

    const pubBody = await pubRes.json();
    expect(pubBody.status).toBe("success");
    expect(pubBody.data.verified).toBe(true);
    expect(pubBody.data.tamperCheckStatus).toBe("VERIFIED_AUTHENTIC");
    expect(pubBody.data.statementNumber).toContain("NMS-DEAL-");
    expect(pubBody.data.parties.buyer.name).toBe(buyerUser.fullName);
    expect(pubBody.data.parties.owner.name).toBe(ownerUser.fullName);
    expect(pubBody.data.deal.agreedPrice).toBe(9200000);
  });

  it("48-HOUR DISPUTE RESOLUTION & AMENDMENTS: triggers 48h deadline and allows mutual price amendment", async () => {
    // Propose a stage (registration)
    await Deal.updateOne(
      { _id: testDeal._id },
      { $set: { completedStages: ["agreed", "documents", "agreement", "payment"], currentStage: "registration", pendingStage: null } }
    );

    // Buyer proposes registration
    await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${buyerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "propose", message: "Registration papers submitted" }),
    });

    // Owner disputes it -> initiates 48-hour resolution window
    const disputeRes = await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dispute", message: "Sub-registrar office appointment is pending" }),
    });
    expect(disputeRes.status).toBe(200);

    const dealAfterDispute = await Deal.findById(testDeal._id).lean();
    expect(dealAfterDispute.disputed).toBe(true);
    expect(dealAfterDispute.disputeDeadline).toBeTruthy();
    const hoursLeft = (new Date(dealAfterDispute.disputeDeadline).getTime() - Date.now()) / (3600 * 1000);
    expect(hoursLeft).toBeGreaterThan(47);
    expect(hoursLeft).toBeLessThanOrEqual(48);

    // Buyer proposes a mutual amendment (Price adjustment of ₹50,000 to cover legal fees)
    const amendRes = await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${buyerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "propose_amendment",
        amendmentType: "PRICE_ADJUSTMENT",
        adjustmentAmount: 50000,
        note: "Deduct ₹50,000 for sub-registrar expedited fee",
      }),
    });
    expect(amendRes.status).toBe(200);

    const dealWithPendingAmend = await Deal.findById(testDeal._id).lean();
    expect(dealWithPendingAmend.pendingAmendment).toBeTruthy();
    expect(dealWithPendingAmend.pendingAmendment.amendmentType).toBe("PRICE_ADJUSTMENT");
    expect(dealWithPendingAmend.pendingAmendment.adjustmentAmount).toBe(50000);

    // Owner accepts the amendment -> atomically deducts price and clears dispute
    const acceptRes = await fetch(`${baseUrl}/api/deals/${testDeal._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept_amendment" }),
    });
    expect(acceptRes.status).toBe(200);

    const dealAfterAccept = await Deal.findById(testDeal._id).lean();
    expect(dealAfterAccept.disputed).toBe(false);
    expect(dealAfterAccept.disputeDeadline).toBeNull();
    expect(dealAfterAccept.pendingAmendment).toBeNull();
    expect(dealAfterAccept.agreedPrice).toBe(9150000); // 9,200,000 - 50,000
  });

  it("GEO-FENCED PHYSICAL SITE INSPECTION: stamps geoVerified when uploaded within 150m of property", async () => {
    // Set coordinates on test property
    await PropertyPost.updateOne(
      { _id: testPost._id },
      { $set: { latitude: 19.0596, longitude: 72.8295 } }
    );

    const validPngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );

    // 1. Upload site inspection document ~25 meters away
    const formOnSite = new FormData();
    formOnSite.append("file", new Blob([validPngBuffer], { type: "image/png" }), "site_photo.png");
    formOnSite.append("name", "Boundary Wall & Key Inspection");
    formOnSite.append("category", "SITE_INSPECTION");
    formOnSite.append("lat", "19.0598"); // ~25 meters from property
    formOnSite.append("lng", "72.8295");

    const resOnSite = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: formOnSite,
    });
    expect(resOnSite.status).toBe(200);
    const bodyOnSite = await resOnSite.json();
    const attOnSite = bodyOnSite.data.deal.attachments.find((a) => a.name === "Boundary Wall & Key Inspection");
    expect(attOnSite).toBeDefined();
    expect(attOnSite.category).toBe("SITE_INSPECTION");
    expect(attOnSite.geoVerified).toBe(true);
    expect(attOnSite.inspectionDistanceMeters).toBeLessThanOrEqual(150);

    // 2. Upload site inspection document far away (>150m, e.g. ~5km away)
    const formFar = new FormData();
    formFar.append("file", new Blob([validPngBuffer], { type: "image/png" }), "far_photo.png");
    formFar.append("name", "Remote Inspection Check");
    formFar.append("category", "SITE_INSPECTION");
    formFar.append("lat", "19.1000"); // ~4.5 km away
    formFar.append("lng", "72.8300");

    const resFar = await fetch(`${baseUrl}/api/deals/${testDeal._id}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: formFar,
    });
    expect(resFar.status).toBe(200);
    const bodyFar = await resFar.json();
    const attFar = bodyFar.data.deal.attachments.find((a) => a.name === "Remote Inspection Check");
    expect(attFar).toBeDefined();
    expect(attFar.category).toBe("SITE_INSPECTION");
    expect(attFar.geoVerified).toBe(false);
    expect(attFar.inspectionDistanceMeters).toBeGreaterThan(150);
  });
});

