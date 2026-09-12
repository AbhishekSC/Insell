import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import OwnerVerificationRequest from "../src/models/OwnerVerificationRequest.model.js";
import { submitRequest, review } from "../src/modules/owner-verification/ownerVerification.service.js";

const mk = (s) =>
  User.create({ fullName: `OV ${s}`, email: `ov-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let user, admin;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  user = await mk("user");
  admin = await mk("admin");
});

afterAll(async () => {
  await OwnerVerificationRequest.deleteMany({ user: user._id });
  await User.deleteMany({ _id: { $in: [user._id, admin._id] } });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await OwnerVerificationRequest.deleteMany({ user: user._id });
});

describe("submitRequest — docNumber validation", () => {
  it("requires a PAN number when docType is PAN", async () => {
    await expect(
      submitRequest(String(user._id), { docType: "PAN", docUrl: "https://x/doc.jpg" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a malformed PAN number", async () => {
    await expect(
      submitRequest(String(user._id), { docType: "PAN", docUrl: "https://x/doc.jpg", docNumber: "12345" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a valid PAN and normalizes it to uppercase, no spaces", async () => {
    await submitRequest(String(user._id), { docType: "PAN", docUrl: "https://x/doc.jpg", docNumber: "abcde 1234f" });
    const doc = await OwnerVerificationRequest.findOne({ user: user._id });
    expect(doc.docNumber).toBe("ABCDE1234F");
  });

  it("requires an Aadhaar number when docType is AADHAAR", async () => {
    await expect(
      submitRequest(String(user._id), { docType: "AADHAAR", docUrl: "https://x/doc.jpg" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a malformed Aadhaar number", async () => {
    await expect(
      submitRequest(String(user._id), { docType: "AADHAAR", docUrl: "https://x/doc.jpg", docNumber: "123" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a valid 12-digit Aadhaar number, stripping spaces", async () => {
    await submitRequest(String(user._id), { docType: "AADHAAR", docUrl: "https://x/doc.jpg", docNumber: "1234 5678 9012" });
    const doc = await OwnerVerificationRequest.findOne({ user: user._id });
    expect(doc.docNumber).toBe("123456789012");
  });

  it("doesn't require a docNumber for other document types", async () => {
    const result = await submitRequest(String(user._id), {
      docType: "SALE_DEED",
      docUrl: "https://x/doc.jpg",
    });
    expect(result.status).toBe("PENDING");
    const doc = await OwnerVerificationRequest.findOne({ user: user._id });
    expect(doc.docNumber).toBe("");
  });

  it("still enforces the existing required fields (docType, docUrl)", async () => {
    await expect(
      submitRequest(String(user._id), { docType: "NOT_A_TYPE", docUrl: "https://x/doc.jpg" })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      submitRequest(String(user._id), { docType: "OTHER", docUrl: "" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("review() still works with a docNumber on file", () => {
  it("approves a PAN request and sets isOwnerVerified", async () => {
    await submitRequest(String(user._id), { docType: "PAN", docUrl: "https://x/doc.jpg", docNumber: "ABCDE1234F" });
    const doc = await OwnerVerificationRequest.findOne({ user: user._id });
    const result = await review(String(doc._id), { approve: true, reviewerId: String(admin._id) });
    expect(result.status).toBe("APPROVED");
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isOwnerVerified).toBe(true);
  });
});
