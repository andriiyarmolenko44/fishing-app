const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/client");
const { registerAndLogin } = require("./helpers/auth");

describe("GET /locations", () => {
  it("should return locations list", async () => {
    const res = await request(app).get("/locations");

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();

    const items = res.body.items || res.body.data || res.body;
    expect(Array.isArray(items)).toBe(true);
  });

  it("should filter locations by fish", async () => {
    await prisma.fish.createMany({
      data: [{ name: "Pike" }, { name: "Carp" }],
      skipDuplicates: true,
    });

    await prisma.season.createMany({
      data: [
        { code: "SUMMER", name: "Summer" },
        { code: "WINTER", name: "Winter" },
      ],
      skipDuplicates: true,
    });

    const { token } = await registerAndLogin("OWNER");

    const payload1 = {
      title: "Pike Spot",
      description: "Best place for pike",
      region: "KYIV",
      waterType: "RIVER",
      lat: 50.4501,
      lng: 30.5234,
      fishNames: ["Pike"],
      seasonCodes: ["SUMMER"],
      photos: [
        {
          url: "https://example.com/pike.jpg",
          publicId: "pike-photo-1",
        },
      ],
    };

    const payload2 = {
      title: "Carp Spot",
      description: "Best place for carp",
      region: "KYIV",
      waterType: "LAKE",
      lat: 50.4601,
      lng: 30.5334,
      fishNames: ["Carp"],
      seasonCodes: ["WINTER"],
      photos: [
        {
          url: "https://example.com/carp.jpg",
          publicId: "carp-photo-1",
        },
      ],
    };

    const createRes1 = await request(app)
      .post("/locations")
      .set("Authorization", `Bearer ${token}`)
      .send(payload1);

    const createRes2 = await request(app)
      .post("/locations")
      .set("Authorization", `Bearer ${token}`)
      .send(payload2);

    expect(createRes1.status).toBe(201);
    expect(createRes2.status).toBe(201);

    await prisma.location.update({
      where: { id: createRes1.body.id },
      data: { status: "APPROVED" },
    });

    await prisma.location.update({
      where: { id: createRes2.body.id },
      data: { status: "APPROVED" },
    });

    const res = await request(app).get("/locations").query({ fish: "Pike" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    const titles = res.body.items.map((item) => item.title);

    expect(titles).toContain("Pike Spot");
    expect(titles).not.toContain("Carp Spot");
  });

  it("should return 404 when owner tries to edit another owner's location", async () => {
    const { token: owner1Token } = await registerAndLogin("OWNER");

    const createPayload = {
      title: "Owner1 Spot",
      description: "Created by owner1",
      region: "KYIV",
      waterType: "RIVER",
      lat: 50.4501,
      lng: 30.5234,
      photos: [
        {
          url: "https://example.com/owner1.jpg",
          publicId: "owner1-photo-1",
        },
      ],
    };

    const createRes = await request(app)
      .post("/locations")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send(createPayload);

    expect(createRes.status).toBe(201);

    const locationId = createRes.body.id;

    const { token: owner2Token } = await registerAndLogin("OWNER");

    const patchRes = await request(app)
      .patch(`/owner/locations/${locationId}`)
      .set("Authorization", `Bearer ${owner2Token}`)
      .send({
        title: "Hacked title",
        waterType: "LAKE",
      });

    expect(patchRes.status).toBe(404);
    expect(patchRes.body).toBeTruthy();
  });
});

describe("POST /locations", () => {
  it("should return 401 without token", async () => {
    const res = await request(app).post("/locations").send({
      title: "Test location",
      description: "Nice fishing place",
    });

    expect(res.status).toBe(401);
    expect(res.body).toBeTruthy();
  });

  it("should create location for authorized owner", async () => {
    const { token } = await registerAndLogin("OWNER");

    const payload = {
      title: "River spot",
      description: "Nice fishing place",
      region: "KYIV",
      waterType: "RIVER",
      lat: 50.4501,
      lng: 30.5234,
      photos: [
        {
          url: "https://picsum.photos/200/300",
          publicId: "test-photo-1",
        },
      ],
    };

    const res = await request(app)
      .post("/locations")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect([200, 201]).toContain(res.status);

    const created = res.body.location || res.body.data || res.body;

    expect(created).toBeTruthy();
    expect(created.title).toBe(payload.title);

    const locationInDb = await prisma.location.findFirst({
      where: { title: payload.title },
    });

    expect(locationInDb).toBeTruthy();
    expect(locationInDb.title).toBe(payload.title);
  });

  it("should return 400 for invalid location payload", async () => {
    const { token } = await registerAndLogin("OWNER");

    const res = await request(app)
      .post("/locations")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toBeTruthy();
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
  });
});
