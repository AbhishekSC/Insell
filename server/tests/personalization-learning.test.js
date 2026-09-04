import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import RecoEvent from "../src/models/RecoEvent.model.js";
import { getPreferencePrompt, answerPreferencePrompt } from "../src/services/UserServiceHandlers.js";
import PersonalizationService from "../src/services/PersonalizationService.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const tag = `plearn-${Date.now()}`;
let user;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
});
afterAll(async () => {
  await RecoEvent.deleteMany({ user: user?._id });
  await PropertyPost.deleteMany({ title: new RegExp(`^${tag}`) });
  await User.deleteMany({ email: new RegExp(`^${tag}`) });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await User.deleteMany({ email: new RegExp(`^${tag}`) });
  user = await User.create({
    fullName: "PL User", email: `${tag}-${Math.random()}@t.test`, password: "TestPass1!", isVerified: true,
    city: "Mumbai",
  });
});

const prompt = async () => {
  const res = fakeRes();
  await getPreferencePrompt({ user: { _id: user._id } }, res);
  return res.body.data.prompt;
};
const answer = async (body) => {
  const res = fakeRes();
  await answerPreferencePrompt({ user: { _id: user._id }, body }, res);
  return res;
};

describe("progressive onboarding", () => {
  it("asks 'intent' first for a blank profile", async () => {
    expect((await prompt())?.key).toBe("intent");
  });

  it("moves to the next question after one is answered, and applies the value", async () => {
    await answer({ key: "intent", value: "Rent" });
    const fresh = await User.findById(user._id).lean();
    expect(fresh.listingIntent).toBe("Rent");
    // lastPromptAt cooldown would hide the next prompt — clear it for the test
    await User.updateOne({ _id: user._id }, { $set: { "preferenceHints.lastPromptAt": null } });
    expect((await prompt())?.key).toBe("budget");
  });

  it("stores a budget range", async () => {
    await answer({ key: "budget", value: { min: 15000, max: 40000 } });
    const fresh = await User.findById(user._id).lean();
    expect(fresh.budgetMin).toBe(15000);
    expect(fresh.budgetMax).toBe(40000);
  });

  it("stops asking a question after 3 skips", async () => {
    for (let i = 0; i < 3; i++) {
      await answer({ key: "intent", skip: true });
      await User.updateOne({ _id: user._id }, { $set: { "preferenceHints.lastPromptAt": null } });
    }
    expect((await prompt())?.key).toBe("budget"); // intent is now exhausted
  });

  it("honours the cooldown between prompts", async () => {
    await answer({ key: "intent", skip: true }); // sets lastPromptAt = now
    expect(await prompt()).toBeNull();
  });

  it("marks the user onboarded after 3 answered", async () => {
    await answer({ key: "intent", value: "Buy" });
    await answer({ key: "budget", value: { min: 5000000, max: 12000000 } });
    await answer({ key: "types", value: ["Apartment"] });
    const fresh = await User.findById(user._id).lean();
    expect(fresh.isOnboarded).toBe(true);
    expect(await prompt()).toBeNull();
  });
});

describe("reco feedback", () => {
  it("records a batch of events and logs the dismiss", async () => {
    const other = await User.create({ fullName: "PL Author", email: `${tag}-author@t.test`, password: "TestPass1!", isVerified: true });
    const p = await PropertyPost.create({
      author: other._id, title: `${tag} P0`, price: 8000000, status: "PUBLISHED", visibility: "PUBLIC",
      propertyType: "Apartment", postType: "PROPERTY_SALE", city: "Mumbai", mediaUrls: ["x.jpg"],
    });

    const result = await PersonalizationService.recordRecoEvents(user._id, [
      { post: String(p._id), event: "impression", position: 0, scores: { personalization: 70, final: 55 } },
      { post: String(p._id), event: "dismiss", reason: "wrong_type" },
      { post: String(p._id), event: "bogus_event" }, // dropped
    ]);
    expect(result.inserted).toBe(2);

    const logged = await RecoEvent.find({ user: user._id }).lean();
    expect(logged.map((e) => e.event).sort()).toEqual(["dismiss", "impression"]);
    expect(logged.find((e) => e.event === "dismiss").reason).toBe("wrong_type");

    // Suppression is Mongo-backed (works without Redis) — the dismissed post
    // must now come back in the suppressed set.
    const suppressed = await PersonalizationService.getSuppressedPostIds(user._id);
    expect(suppressed.has(String(p._id))).toBe(true);

    await RecoEvent.deleteMany({ user: user._id });
    await PropertyPost.deleteOne({ _id: p._id });
    await User.deleteOne({ _id: other._id });
  });

  it("ignores an empty event list", async () => {
    const r = await PersonalizationService.recordRecoEvents(user._id, []);
    expect(r.inserted).toBe(0);
  });

  it("dismiss reasons become negative preferences that demote matching candidates", async () => {
    const other = await User.create({ fullName: "PL Author2", email: `${tag}-a2@t.test`, password: "TestPass1!", isVerified: true });
    const villa = await PropertyPost.create({
      author: other._id, title: `${tag} villa`, price: 40000000, status: "PUBLISHED", visibility: "PUBLIC",
      propertyType: "Villa", postType: "PROPERTY_SALE", city: "Pune", locality: "Baner", mediaUrls: ["x.jpg"],
    });
    const plot = await PropertyPost.create({
      author: other._id, title: `${tag} plot`, price: 9000000, status: "PUBLISHED", visibility: "PUBLIC",
      propertyType: "Plot", postType: "PROPERTY_SALE", city: "Mumbai", mediaUrls: ["x.jpg"],
    });

    await PersonalizationService.recordRecoEvents(user._id, [
      { post: String(villa._id), event: "dismiss", reason: "wrong_type" },
      { post: String(plot._id), event: "dismiss", reason: "too_expensive" },
    ]);

    const neg = await PersonalizationService.getNegativePreferences(user._id);
    expect(neg.rejectedTypes).toContain("villa");
    expect(neg.priceCeiling).toBe(Math.round(9000000 * 0.95));

    // a fresh Villa candidate is heavily demoted
    const villaLike = { propertyType: "Villa", city: "Pune", price: 35000000 };
    const flatLike = { propertyType: "Apartment", city: "Pune", price: 8000000 };
    expect(PersonalizationService.negativePreferencePenalty(villaLike, neg)).toBeLessThan(0.5);
    expect(PersonalizationService.negativePreferencePenalty(flatLike, neg)).toBe(1);

    await RecoEvent.deleteMany({ user: user._id });
    await PropertyPost.deleteMany({ _id: { $in: [villa._id, plot._id] } });
    await User.deleteOne({ _id: other._id });
  });
});
