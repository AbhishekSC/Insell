import { describe, it, expect } from "vitest";
import { computeBucket, evaluateFeatureFlag } from "../src/utils/featureFlagEvaluator.js";

describe("Feature Flag Engine & Deterministic Rollout", () => {
  const flagKey = "ai_property_valuation";
  const userA = { _id: "64a7f1a1a1a1a1a1a1a1a1a1", primaryRole: "Buyer" };
  const userB = { _id: "64a7f1b2b2b2b2b2b2b2b2b2", primaryRole: "Seller" };
  const userC = { _id: "64a7f1c3c3c3c3c3c3c3c3c3", primaryRole: "Broker" };

  it("produces deterministic buckets (same user always yields identical bucket)", () => {
    const bucket1 = computeBucket(flagKey, userA._id);
    const bucket2 = computeBucket(flagKey, userA._id);
    expect(bucket1).toBe(bucket2);
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket1).toBeLessThan(100);
  });

  it("returns false for all users when rolloutPercentage is 0%", () => {
    const flag = {
      key: flagKey,
      isActive: true,
      rolloutPercentage: 0,
      enabledUserIds: [],
      disabledUserIds: [],
    };

    expect(evaluateFeatureFlag(flag, userA).enabled).toBe(false);
    expect(evaluateFeatureFlag(flag, userB).enabled).toBe(false);
    expect(evaluateFeatureFlag(flag, userC).enabled).toBe(false);
  });

  it("returns true for all users when rolloutPercentage is 100%", () => {
    const flag = {
      key: flagKey,
      isActive: true,
      rolloutPercentage: 100,
      enabledUserIds: [],
      disabledUserIds: [],
    };

    expect(evaluateFeatureFlag(flag, userA).enabled).toBe(true);
    expect(evaluateFeatureFlag(flag, userB).enabled).toBe(true);
    expect(evaluateFeatureFlag(flag, userC).enabled).toBe(true);
  });

  it("always enables explicitly whitelisted users even when rollout is 0%", () => {
    const flag = {
      key: flagKey,
      isActive: true,
      rolloutPercentage: 0,
      enabledUserIds: [userA._id], // User A is whitelisted
      disabledUserIds: [],
    };

    const resA = evaluateFeatureFlag(flag, userA);
    const resB = evaluateFeatureFlag(flag, userB);

    expect(resA.enabled).toBe(true);
    expect(resA.reason).toBe("USER_WHITELISTED");

    expect(resB.enabled).toBe(false);
    expect(resB.reason).toBe("PERCENTAGE_ZERO");
  });

  it("always disables explicitly blacklisted users even when rollout is 100%", () => {
    const flag = {
      key: flagKey,
      isActive: true,
      rolloutPercentage: 100,
      enabledUserIds: [],
      disabledUserIds: [userB._id], // User B is blacklisted
    };

    const resA = evaluateFeatureFlag(flag, userA);
    const resB = evaluateFeatureFlag(flag, userB);

    expect(resA.enabled).toBe(true);
    expect(resB.enabled).toBe(false);
    expect(resB.reason).toBe("USER_BLACKLISTED");
  });

  it("respects master killswitch (isActive: false disables for everyone)", () => {
    const flag = {
      key: flagKey,
      isActive: false, // Killswitch
      rolloutPercentage: 100,
      enabledUserIds: [userA._id],
    };

    expect(evaluateFeatureFlag(flag, userA).enabled).toBe(false);
    expect(evaluateFeatureFlag(flag, userB).enabled).toBe(false);
  });

  it("respects role targeting when enabledRoles is specified", () => {
    const flag = {
      key: flagKey,
      isActive: true,
      rolloutPercentage: 100,
      enabledRoles: ["Broker"], // Only Brokers
    };

    expect(evaluateFeatureFlag(flag, userC).enabled).toBe(true); // userC is Broker
    expect(evaluateFeatureFlag(flag, userA).enabled).toBe(false); // userA is Buyer
  });
});
