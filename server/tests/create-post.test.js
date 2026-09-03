// Characterization tests for createPropertyPost / updatePropertyPost — these
// pin down the CURRENT behaviour of the Create Post flow before the
// simplification work (dynamic per-type forms + postMeta validation) begins.
// Nothing in the refactor is allowed to break these unless we consciously
// decide to change that behaviour and update the assertion here.
//
// Runs against the same real MongoDB the app uses (see offer-lifecycle.test.js
// for why). Every fixture is disposable and torn down afterward.
import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { createPropertyPost, updatePropertyPost } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function makeUser(suffix, roles) {
  const primary = roles?.[0] || "Seller";
  return User.create({
    fullName: `CreatePost Test ${suffix}`,
    email: `create-post-test-${suffix}-${Date.now()}@example.test`,
    password: "TestPass1!",
    isVerified: true,
    primaryRole: primary,
    activeRole: primary,
    userRoles: roles || [primary],
  });
}

let seller, tenant, builder, broker;
const createdPostIds = [];

async function create(user, body) {
  const res = fakeRes();
  await createPropertyPost({ user, body }, res);
  if (res.body?.data?.post?._id) createdPostIds.push(res.body.data.post._id);
  return res;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  seller = await makeUser("seller", ["Seller"]);
  tenant = await makeUser("tenant", ["Tenant"]);
  builder = await makeUser("builder", ["Builder"]);
  broker = await makeUser("broker", ["Broker"]);
});

afterEach(async () => {
  if (createdPostIds.length) {
    await PropertyPost.deleteMany({ _id: { $in: createdPostIds.splice(0) } });
  }
});

afterAll(async () => {
  const ids = [seller._id, tenant._id, builder._id, broker._id];
  await PropertyPost.deleteMany({ author: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});

describe("createPropertyPost — current behaviour", () => {
  it("creates a PROPERTY_SALE post for a Seller with top-level residential fields", async () => {
    const res = await create(seller, {
      postType: "PROPERTY_SALE",
      listingType: "Sell",
      propertyType: "Apartment",
      title: "3BHK in Vijay Nagar",
      city: "Indore",
      price: 8500000,
      bedrooms: 3,
      bathrooms: 2,
      areaSqft: 1450,
      status: "PUBLISHED",
    });
    expect(res.statusCode).toBe(201);
    const post = res.body.data.post;
    expect(post.postType).toBe("PROPERTY_SALE");
    expect(post.bedrooms).toBe(3);
    expect(post.bathrooms).toBe(2);
    expect(post.areaSqft).toBe(1450);
    expect(post.price).toBe(8500000);
    expect(post.status).toBe("PUBLISHED");
    expect(post.publishedAt).toBeTruthy();
    expect(Array.isArray(post.priceHistory)).toBe(true);
    expect(post.priceHistory[0].price).toBe(8500000);
  });

  it("honours the requested post type regardless of role (no role gating)", async () => {
    // Post creation is not gated by role anymore — a "Tenant" can still
    // create a PROPERTY_SALE listing if they ask for one.
    const res = await create(tenant, {
      postType: "PROPERTY_SALE",
      title: "Tenant lists a flat for sale",
      city: "Indore",
      status: "PUBLISHED",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.postType).toBe("PROPERTY_SALE");
  });

  it("falls back to a default post type when none is supplied", async () => {
    const res = await create(tenant, {
      title: "No type given",
      city: "Indore",
      status: "PUBLISHED",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.postType).toBeTruthy();
  });

  it("lets a Seller create an AGRICULTURAL_LISTING without downgrading the type", async () => {
    const res = await create(seller, {
      postType: "AGRICULTURAL_LISTING",
      listingType: "Sell",
      title: "Seller lists farm land",
      city: "Indore",
      price: 3000000,
      status: "PUBLISHED",
      postMeta: { land: { landArea: 3, landAreaUnit: "Acre" } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.postType).toBe("AGRICULTURAL_LISTING");
  });

  it("creates a REQUIREMENT_RENT post for a Tenant with no media and no price", async () => {
    const res = await create(tenant, {
      postType: "REQUIREMENT_RENT",
      title: "Looking for 2BHK near Bhawarkua",
      city: "Indore",
      status: "PUBLISHED",
      postMeta: { requirement: { budgetMin: 8000, budgetMax: 15000 } },
    });
    expect(res.statusCode).toBe(201);
    const post = res.body.data.post;
    expect(post.postType).toBe("REQUIREMENT_RENT");
    expect(post.mediaUrls).toEqual([]);
    expect(post.postMeta.requirement.budgetMax).toBe(15000);
  });

  it("stores arbitrary postMeta as-is (Mixed, no validation today)", async () => {
    const res = await create(builder, {
      postType: "BUILDER_PROJECT",
      title: "Skyline Residences",
      city: "Indore",
      status: "PUBLISHED",
      postMeta: { project: { projectName: "Skyline", reraNumber: "RERA123" }, junkField: "anything goes", bedrooms: "not-a-number" },
    });
    expect(res.statusCode).toBe(201);
    const post = res.body.data.post;
    expect(post.postMeta.project.projectName).toBe("Skyline");
    // Documents the current lack of sanitisation — this assertion is expected
    // to change once postMeta validation lands.
    expect(post.postMeta.junkField).toBe("anything goes");
  });

  it("auto-generates a title from location when none is given", async () => {
    const res = await create(seller, {
      postType: "PROPERTY_SALE",
      city: "Indore",
      locality: "Rau",
      status: "PUBLISHED",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.title).toBe("Post for Rau, Indore");
  });

  it("saves a DRAFT without publishedAt semantics changing status", async () => {
    const res = await create(seller, {
      postType: "PROPERTY_SALE",
      title: "Draft listing",
      city: "Indore",
      status: "DRAFT",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.status).toBe("DRAFT");
  });

  it("persists agricultural-land specifics under postMeta.land", async () => {
    const res = await create(broker, {
      postType: "AGRICULTURAL_LISTING",
      listingType: "Sell",
      title: "5 acre farm land",
      city: "Indore",
      price: 20000000,
      status: "PUBLISHED",
      postMeta: {
        land: { landArea: 5, landAreaUnit: "Acre", soilType: "Black Soil", waterAvailability: "Borewell", roadAccess: true },
      },
    });
    expect(res.statusCode).toBe(201);
    const post = res.body.data.post;
    expect(post.postType).toBe("AGRICULTURAL_LISTING");
    expect(post.postMeta.land.landArea).toBe(5);
    expect(post.postMeta.land.soilType).toBe("Black Soil");
    expect(post.postMeta.land.roadAccess).toBe(true);
  });

  it("persists commercial specifics under postMeta.commercial", async () => {
    const res = await create(broker, {
      postType: "COMMERCIAL_LISTING",
      listingType: "Sell",
      title: "Office space MG Road",
      city: "Indore",
      price: 12000000,
      status: "PUBLISHED",
      postMeta: { commercial: { commercialType: "Office", carpetArea: 1500, floorNumber: 3, washrooms: 2 } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.postMeta.commercial.commercialType).toBe("Office");
    expect(res.body.data.post.postMeta.commercial.carpetArea).toBe(1500);
  });

  it("Broker can create PROPERTY_RENT and it keeps the requested type", async () => {
    const res = await create(broker, {
      postType: "PROPERTY_RENT",
      listingType: "Rent",
      title: "2BHK for rent",
      city: "Indore",
      price: 18000,
      status: "PUBLISHED",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.post.postType).toBe("PROPERTY_RENT");
    expect(res.body.data.post.listingType).toBe("Rent");
  });
});

describe("typed postMeta schema", () => {
  it("casts string numbers/booleans in known meta branches", async () => {
    const res = await create(broker, {
      postType: "AGRICULTURAL_LISTING",
      title: "Cast test",
      city: "Indore",
      status: "PUBLISHED",
      postMeta: { land: { landArea: "12", roadAccess: "true", electricityAvailable: "false" } },
    });
    expect(res.statusCode).toBe(201);
    const fresh = await PropertyPost.findById(res.body.data.post._id).lean();
    expect(fresh.postMeta.land.landArea).toBe(12);
    expect(fresh.postMeta.land.roadAccess).toBe(true);
    expect(fresh.postMeta.land.electricityAvailable).toBe(false);
  });

  it("keeps unknown meta keys instead of dropping them (strict:false)", async () => {
    const res = await create(broker, {
      postType: "COMMERCIAL_LISTING",
      title: "Unknown key test",
      city: "Indore",
      status: "PUBLISHED",
      postMeta: { commercial: { commercialType: "Shop" }, facing: "East", roi: 8, amenities: ["Lift", "Parking"] },
    });
    expect(res.statusCode).toBe(201);
    const fresh = await PropertyPost.findById(res.body.data.post._id).lean();
    expect(fresh.postMeta.facing).toBe("East");
    expect(fresh.postMeta.roi).toBe(8);
    expect(fresh.postMeta.amenities).toEqual(["Lift", "Parking"]);
  });

  it("round-trips a legacy-shaped postMeta on re-save without data loss", async () => {
    // Simulate a doc written before the typed schema: flat keys, no branches.
    const raw = await PropertyPost.collection.insertOne({
      author: seller._id,
      postType: "PROPERTY_SALE",
      title: "Legacy doc",
      status: "PUBLISHED",
      price: 100,
      postMeta: { furnishing: "Semi Furnished", ageOfProperty: "5 years", possessionStatus: "Ready" },
    });
    createdPostIds.push(raw.insertedId);

    const res = fakeRes();
    await updatePropertyPost(
      { user: seller, params: { id: raw.insertedId }, body: { caption: "touched", postMeta: { furnishing: "Semi Furnished", ageOfProperty: "5 years", possessionStatus: "Ready" } } },
      res
    );
    expect(res.statusCode).toBe(200);
    const fresh = await PropertyPost.findById(raw.insertedId).lean();
    expect(fresh.postMeta.furnishing).toBe("Semi Furnished");
    expect(fresh.postMeta.possessionStatus).toBe("Ready");
  });
});

describe("updatePropertyPost — current behaviour", () => {
  it("updates an existing draft in place without creating a duplicate", async () => {
    const createRes = await create(seller, {
      postType: "PROPERTY_SALE",
      title: "Original title",
      city: "Indore",
      price: 5000000,
      status: "DRAFT",
    });
    const id = createRes.body.data.post._id;

    const res = fakeRes();
    await updatePropertyPost(
      { user: seller, params: { id }, body: { title: "Updated title", price: 5500000, status: "PUBLISHED" } },
      res
    );
    expect(res.statusCode).toBe(200);

    const count = await PropertyPost.countDocuments({ author: seller._id, title: { $in: ["Original title", "Updated title"] } });
    expect(count).toBe(1);

    const fresh = await PropertyPost.findById(id).lean();
    expect(fresh.title).toBe("Updated title");
    expect(fresh.status).toBe("PUBLISHED");
  });

  it("rejects editing someone else's post", async () => {
    const createRes = await create(seller, {
      postType: "PROPERTY_SALE",
      title: "Seller's post",
      city: "Indore",
      status: "PUBLISHED",
    });
    const id = createRes.body.data.post._id;

    const res = fakeRes();
    await updatePropertyPost({ user: broker, params: { id }, body: { title: "hijacked" } }, res);
    expect(res.statusCode).toBe(403);
  });
});
