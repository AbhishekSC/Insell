import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  zAdd: vi.fn(),
  zRem: vi.fn(),
  zScore: vi.fn(),
  zCard: vi.fn(),
  zCount: vi.fn(),
  zRangeWithScores: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  sAdd: vi.fn(),
  sMembers: vi.fn(),
  sRem: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  setEx: vi.fn(),
  incr: vi.fn(),
  incrBy: vi.fn(),
  decr: vi.fn(),
  decrBy: vi.fn(),
  del: vi.fn(),
}));

vi.mock("../src/config/redisClient.config.js", () => ({
  default: mockRedis,
}));

vi.mock("../src/models/PropertyPost.model.js", () => ({
  default: {
    findById: vi.fn(),
    bulkWrite: vi.fn(),
  },
}));

vi.mock("../src/models/Notification.model.js", () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

import {
  toggleEngagementRedis,
  incrementViewCountRedis,
  recordUserActiveRedis,
  getLiveUsersCountRedis,
  invalidatePostDetailCache,
  invalidateUserProfileCache,
  getPostEngagement,
  getLikersFromCache,
} from "../src/services/likeCache.service.js";

import {
  getUnreadNotificationCount,
  incrementUnreadNotificationCount,
  decrementUnreadNotificationCount,
  clearUnreadNotificationCount,
} from "../src/services/notificationCache.service.js";

describe("Write-Behind Caching Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("likeCache.service", () => {
    const postId = "64b8f0f1a1b2c3d4e5f6a7b8";
    const userId = "64b8f0f1a1b2c3d4e5f6a799";

    it("toggleEngagementRedis: adds like when not yet liked and marks dirty:likes", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zScore.mockResolvedValue(null); // not currently liked
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.zRem.mockResolvedValue(0);
      mockRedis.sAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zCard.mockResolvedValue(5);

      const result = await toggleEngagementRedis(postId, userId, "like");

      expect(result.active).toBe(true);
      expect(result.count).toBe(5);
      expect(mockRedis.zAdd).toHaveBeenCalledWith(`post:${postId}:liked_by`, [
        expect.objectContaining({ value: String(userId) }),
      ]);
      expect(mockRedis.sAdd).toHaveBeenCalledWith("dirty:likes", String(postId));
    });

    it("toggleEngagementRedis: removes like when already liked", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zScore.mockResolvedValue(1700000000000); // already liked
      mockRedis.zRem.mockResolvedValue(1);
      mockRedis.sAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zCard.mockResolvedValue(4);

      const result = await toggleEngagementRedis(postId, userId, "like");

      expect(result.active).toBe(false);
      expect(result.count).toBe(4);
      expect(mockRedis.zRem).toHaveBeenCalledWith(`post:${postId}:liked_by`, String(userId));
      expect(mockRedis.sAdd).toHaveBeenCalledWith("dirty:likes", String(postId));
    });

    it("incrementViewCountRedis: seeds atomically with NX and increments", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.sAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const newViews = await incrementViewCountRedis(postId, 10);

      expect(newViews).toBe(11);
      expect(mockRedis.set).toHaveBeenCalledWith(`post:${postId}:views`, "10", {
        EX: expect.any(Number),
        NX: true,
      });
      expect(mockRedis.incr).toHaveBeenCalledWith(`post:${postId}:views`);
      expect(mockRedis.sAdd).toHaveBeenCalledWith("dirty:views", String(postId));
    });

    it("toggleEngagementRedis: prevents concurrent double-toggle with lockKey", async () => {
      // First call acquires lock
      mockRedis.set.mockResolvedValueOnce("OK");
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zScore.mockResolvedValue(null);
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.sAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zCard.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      const res1 = await toggleEngagementRedis(postId, userId, "like");
      expect(res1.active).toBe(true);

      // Concurrent second call fails to acquire lock
      mockRedis.set.mockResolvedValueOnce(null);
      mockRedis.zScore.mockResolvedValue(1700000000000);
      mockRedis.zCard.mockResolvedValue(1);

      const res2 = await toggleEngagementRedis(postId, userId, "like");
      expect(res2.active).toBe(true);
      expect(res2.count).toBe(1);
    });

    it("getLikersFromCache: returns reverse-chronological likers from Redis ZSet", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zRem.mockResolvedValue(0);
      mockRedis.zCard.mockResolvedValue(2);
      mockRedis.zRangeWithScores.mockResolvedValue([
        { value: "user2", score: 2000 },
        { value: "user1", score: 1000 },
      ]);

      const likers = await getLikersFromCache(postId, 0, 10);
      expect(likers.total).toBe(2);
      expect(likers.items).toHaveLength(2);
      expect(likers.items[0].userId).toBe("user2");
      expect(likers.items[1].userId).toBe("user1");
    });

    it("recordUserActiveRedis: deduplicates active recording with 60s throttle", async () => {
      // First call succeeds with NX: true
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.sAdd.mockResolvedValue(1);

      await recordUserActiveRedis(userId);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `user:${userId}:act_dedupe`,
        "1",
        { EX: 60, NX: true }
      );
      expect(mockRedis.zAdd).toHaveBeenCalledWith("users:last_active", [
        expect.objectContaining({ value: String(userId) }),
      ]);
      expect(mockRedis.sAdd).toHaveBeenCalledWith("dirty:users_active", String(userId));

      // Second call within 60s returns null (throttled)
      vi.clearAllMocks();
      mockRedis.set.mockResolvedValue(null);

      await recordUserActiveRedis(userId);
      expect(mockRedis.zAdd).not.toHaveBeenCalled();
      expect(mockRedis.sAdd).not.toHaveBeenCalled();
    });

    it("getLiveUsersCountRedis: counts active users in window via zCount", async () => {
      mockRedis.zCount.mockResolvedValue(42);

      const count = await getLiveUsersCountRedis(5);
      expect(count).toBe(42);
      expect(mockRedis.zCount).toHaveBeenCalledWith("users:last_active", expect.any(Number), "+inf");
    });

    it("invalidatePostDetailCache and invalidateUserProfileCache delete proper keys", async () => {
      await invalidatePostDetailCache(postId);
      expect(mockRedis.del).toHaveBeenCalledWith(`post:${postId}:detail`);

      await invalidateUserProfileCache(userId);
      expect(mockRedis.del).toHaveBeenCalledWith(`user:${userId}:profile`);
    });
  });

  describe("notificationCache.service", () => {
    const userId = "64b8f0f1a1b2c3d4e5f6a799";

    it("incrementUnreadNotificationCount: seeds from Mongo on cold start and increments", async () => {
      mockRedis.exists.mockResolvedValue(0); // cold start
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await incrementUnreadNotificationCount(userId);

      expect(mockRedis.incr).toHaveBeenCalledWith(`user:${userId}:unread_notifs`);
      expect(mockRedis.expire).toHaveBeenCalledWith(`user:${userId}:unread_notifs`, expect.any(Number));
    });

    it("decrementUnreadNotificationCount: decrements counter and floors at 0", async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.decr.mockResolvedValue(-1); // dropped below zero
      mockRedis.set.mockResolvedValue("OK");

      await decrementUnreadNotificationCount(userId);

      expect(mockRedis.decr).toHaveBeenCalledWith(`user:${userId}:unread_notifs`);
      expect(mockRedis.set).toHaveBeenCalledWith(`user:${userId}:unread_notifs`, "0", {
        EX: expect.any(Number),
      });
    });

    it("clearUnreadNotificationCount: sets counter to 0 with TTL", async () => {
      mockRedis.set.mockResolvedValue("OK");

      await clearUnreadNotificationCount(userId);

      expect(mockRedis.set).toHaveBeenCalledWith(`user:${userId}:unread_notifs`, "0", {
        EX: expect.any(Number),
      });
    });
  });

  describe("HotFeedCacheService", () => {
    it("getHotPostsByCity: serves from pre-warmed master key when limit <= 20", async () => {
      const { getHotPostsByCity } = await import("../src/services/HotFeedCacheService.js");
      const prewarmed = Array.from({ length: 20 }, (_, i) => ({ _id: `post_${i}`, title: `Post ${i}` }));
      
      mockRedis.get.mockImplementation((key) => {
        if (key.endsWith(":20")) {
          return Promise.resolve(JSON.stringify(prewarmed));
        }
        return Promise.resolve(null);
      });

      const results = await getHotPostsByCity("Mumbai", 12);
      expect(results).toHaveLength(12);
      expect(results[0]._id).toBe("post_0");
      expect(results[11]._id).toBe("post_11");
    });
  });

  describe("engagementSync.queue", () => {
    it("flushEngagementToMongo: drains dirty sets and invokes PropertyPost.bulkWrite", async () => {
      const { flushEngagementToMongo } = await import("../src/queues/engagementSync.queue.js");
      const PropertyPost = (await import("../src/models/PropertyPost.model.js")).default;

      mockRedis.sMembers.mockImplementation((key) => {
        if (key === "dirty:likes") return Promise.resolve(["post1"]);
        if (key === "dirty:saves") return Promise.resolve([]);
        if (key === "dirty:views") return Promise.resolve(["post1"]);
        if (key === "dirty:users_active") return Promise.resolve([]);
        return Promise.resolve([]);
      });

      mockRedis.zRangeWithScores.mockResolvedValue([
        { value: "userA", score: 1700000000000 },
      ]);
      mockRedis.get.mockImplementation((key) => {
        if (key === "post:post1:views") return Promise.resolve("42");
        return Promise.resolve(null);
      });
      mockRedis.sRem.mockResolvedValue(1);
      PropertyPost.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      await flushEngagementToMongo();

      expect(PropertyPost.bulkWrite).toHaveBeenCalled();
    });
  });
});
