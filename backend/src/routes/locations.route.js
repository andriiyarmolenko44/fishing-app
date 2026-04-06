const router = require("express").Router();
const prisma = require("../db/client");
const { authenticateToken, requireRole } = require("../middleware/auth");

const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

const REGION_CODES = new Set([
  "VINNYTSIA",
  "VOLYN",
  "DNIPROPETROVSK",
  "DONETSK",
  "ZHYTOMYR",
  "ZAKARPATTIA",
  "ZAPORIZHZHIA",
  "IVANO_FRANKIVSK",
  "KYIV",
  "KIROVOHRAD",
  "LUHANSK",
  "LVIV",
  "MYKOLAIV",
  "ODESA",
  "POLTAVA",
  "RIVNE",
  "SUMY",
  "TERNOPIL",
  "KHARKIV",
  "KHERSON",
  "KHMELNYTSKYI",
  "CHERKASY",
  "CHERNIVTSI",
  "CHERNIHIV",
  "CRIMEA",
]);

function normalizePhotoUrls(photoUrls, max = 6) {
  if (!Array.isArray(photoUrls)) return [];
  const cleaned = photoUrls.map((u) => String(u).trim()).filter(Boolean);
  const unique = [...new Set(cleaned)];
  return unique.slice(0, max);
}

function normalizePhotos(photos, max = 6) {
  if (!Array.isArray(photos)) return [];

  const cleaned = photos
    .map((p) => ({
      url: p?.url ? String(p.url).trim() : "",
      publicId: p?.publicId ? String(p.publicId).trim() : "",
    }))
    .filter((p) => p.url && p.publicId);

  const out = [];
  const seen = new Set();
  for (const p of cleaned) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    out.push(p);
  }

  return out.slice(0, max);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      region,
      waterType,
      fish,
      season,
      seasons,
      page = "1",
      limit = "10",

      sort = "createdAt",
      order = "desc",
    } = req.query;

    const regionCode = region ? String(region).trim().toUpperCase() : null;

    if (regionCode && !REGION_CODES.has(regionCode)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid region", { field: "region" });
    }

    const fishList = fish
      ? String(fish)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const seasonsList = seasons
      ? String(seasons)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : season
        ? [String(season).trim().toUpperCase()]
        : [];

    const take = Math.min(parseInt(limit, 10) || 10, 50);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    const where = {
      status: "APPROVED",
      ...(regionCode ? { region: regionCode } : {}),
      ...(waterType ? { waterType: String(waterType) } : {}),
      ...(fishList.length
        ? { fish: { some: { fish: { name: { in: fishList } } } } }
        : {}),
      ...(seasonsList.length
        ? { seasons: { some: { season: { code: { in: seasonsList } } } } }
        : {}),
    };

    const sortKey = String(sort).toLowerCase();
    const sortOrder = String(order).toLowerCase() === "asc" ? "asc" : "desc";

    const total = await prisma.location.count({ where });

    if (sortKey === "rating") {
      const allIdsRows = await prisma.location.findMany({
        where,
        select: { id: true },
      });
      const allIds = allIdsRows.map((x) => x.id);

      if (!allIds.length) {
        return res.json({ items: [], total: 0, page: pageNum, limit: take });
      }

      const ratedAgg = await prisma.review.groupBy({
        by: ["locationId"],
        where: { locationId: { in: allIds } },
        _avg: { rating: true },
        orderBy: { _avg: { rating: sortOrder } },
      });

      const ratedIdsOrdered = ratedAgg.map((x) => x.locationId);

      const unratedRows = await prisma.location.findMany({
        where: { ...where, id: { notIn: ratedIdsOrdered } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      const orderedIds = [...ratedIdsOrdered, ...unratedRows.map((x) => x.id)];
      const pageIds = orderedIds.slice(skip, skip + take);

      const itemsRaw = await prisma.location.findMany({
        where: { id: { in: pageIds } },
        include: {
          owner: { select: { id: true, displayName: true } },
          fish: { include: { fish: true } },
          seasons: { include: { season: true } },
          photos: {
            take: 1,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          _count: { select: { reviews: true, photos: true } },
        },
      });

      const byId = new Map(itemsRaw.map((x) => [x.id, x]));
      const itemsOrdered = pageIds.map((id) => byId.get(id)).filter(Boolean);

      const ratingMap = new Map(
        ratedAgg.map((r) => [
          r.locationId,
          r._avg.rating ? Number(r._avg.rating.toFixed(2)) : null,
        ]),
      );

      const itemsWithRating = itemsOrdered.map((loc) => {
        const reviewsCount = loc._count?.reviews ?? 0;
        const photosCount = loc._count?.photos ?? 0;
        const avgRating = ratingMap.get(loc.id) ?? null;
        const { _count, ...rest } = loc;
        return { ...rest, reviewsCount, avgRating, photosCount };
      });

      return res.json({
        items: itemsWithRating,
        total,
        page: pageNum,
        limit: take,
      });
    }

    const orderField = sortKey === "updatedat" ? "updatedAt" : "createdAt";

    const items = await prisma.location.findMany({
      where,
      include: {
        owner: { select: { id: true, displayName: true } },
        fish: { include: { fish: true } },
        seasons: { include: { season: true } },
        photos: {
          take: 1,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        _count: { select: { reviews: true, photos: true } },
      },
      orderBy: { [orderField]: sortOrder },
      skip,
      take,
    });

    const locationIds = items.map((x) => x.id);

    const ratingAgg = locationIds.length
      ? await prisma.review.groupBy({
          by: ["locationId"],
          where: { locationId: { in: locationIds } },
          _avg: { rating: true },
        })
      : [];

    const ratingMap = new Map(
      ratingAgg.map((r) => [
        r.locationId,
        r._avg.rating ? Number(r._avg.rating.toFixed(2)) : null,
      ]),
    );

    const itemsWithRating = items.map((loc) => {
      const reviewsCount = loc._count?.reviews ?? 0;
      const photosCount = loc._count?.photos ?? 0;
      const avgRating = ratingMap.get(loc.id) ?? null;
      const { _count, ...rest } = loc;
      return { ...rest, reviewsCount, avgRating, photosCount };
    });

    res.json({
      items: itemsWithRating,
      total,
      page: pageNum,
      limit: take,
    });
  }),
);

router.post(
  "/",
  authenticateToken,
  requireRole("OWNER"),
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;

    const {
      title,
      description,
      region,
      waterType,
      lat,
      lng,
      fishNames = [],
      seasonCodes = [],
      contactInfo,

      photos = null,

      photoUrls = [],
    } = req.body;

    if (!title || !description || !region || !waterType) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        "Missing required fields: title, description, region, waterType, lat, lng",
        { fields: ["title", "description", "region", "waterType", "lat", "lng"] },
      );
    }

    if (String(lat).trim() === "" || String(lng).trim() === "") {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "lat and lng are required", {
        fields: ["lat", "lng"],
      });
    }

    const regionCode = String(region).trim().toUpperCase();
    if (!REGION_CODES.has(regionCode)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid region", { field: "region" });
    }

    const contact = contactInfo ? String(contactInfo).trim() : null;
    if (contact && contact.length > 255) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "contactInfo is too long (max 255 chars)", {
        field: "contactInfo",
        max: 255,
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "lat and lng must be valid numbers", {
        fields: ["lat", "lng"],
      });
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "lat/lng out of range", {
        latRange: [-90, 90],
        lngRange: [-180, 180],
      });
    }

    const normalizedPhotos = Array.isArray(photos) ? normalizePhotos(photos, 6) : [];

    if (!normalizedPhotos.length) {
      const urls = normalizePhotoUrls(photoUrls, 6);
      if (urls.length) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          "Photos must include publicId now. Send `photos: [{ url, publicId }]` instead of `photoUrls`.",
          { field: "photos" },
        );
      }
    }

    if (normalizedPhotos.length < 1) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "At least 1 photo is required", {
        field: "photos",
        min: 1,
      });
    }

    const fishList = (Array.isArray(fishNames) ? fishNames : [])
      .map((x) => String(x).trim())
      .filter(Boolean);

    const fishRows = fishList.length
      ? await prisma.fish.findMany({
          where: { name: { in: fishList } },
          select: { id: true },
        })
      : [];

    const seasonRows =
      Array.isArray(seasonCodes) && seasonCodes.length
        ? await prisma.season.findMany({
            where: { code: { in: seasonCodes.map((c) => String(c)) } },
            select: { id: true },
          })
        : [];

    const location = await prisma.location.create({
      data: {
        ownerId,
        title: String(title).trim(),
        description: String(description).trim(),
        region: regionCode,
        waterType: String(waterType),
        lat: String(latNum),
        lng: String(lngNum),
        status: "PENDING",
        contactInfo: contact,
        fish: { create: fishRows.map((f) => ({ fishId: f.id })) },
        seasons: { create: seasonRows.map((s) => ({ seasonId: s.id })) },
        photos: {
          create: normalizedPhotos.map((p) => ({
            url: p.url,
            publicId: p.publicId,
          })),
        },
      },
      include: {
        owner: { select: { id: true, displayName: true } },
        fish: { include: { fish: true } },
        seasons: { include: { season: true } },
        photos: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    res.status(201).json(location);
  }),
);

router.get(
  "/fish",
  asyncHandler(async (req, res) => {
    const items = await prisma.fish.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    res.json({ items });
  }),
);

router.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const reviews = await prisma.review.findMany({
      where: { locationId: id },
      include: {
        user: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ items: reviews, total: reviews.length });
  }),
);

router.post(
  "/:id/reviews",
  authenticateToken,
  requireRole("USER", "OWNER"),
  asyncHandler(async (req, res) => {
    const { id: locationId } = req.params;
    const { rating, comment } = req.body;

    const r = Number(rating);

    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "rating must be an integer from 1 to 5", {
        field: "rating",
        min: 1,
        max: 5,
      });
    }

    if (!comment || String(comment).trim().length < 3) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "comment is required (min 3 chars)", {
        field: "comment",
        minLen: 3,
      });
    }

    const loc = await prisma.location.findUnique({
      where: { id: locationId },
      select: { status: true },
    });

    if (!loc) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    if (loc.status !== "APPROVED") {
      throw new AppError(403, ErrorCode.FORBIDDEN, "You can review only APPROVED locations");
    }

    try {
      const created = await prisma.review.create({
        data: {
          locationId,
          userId: req.user.id,
          rating: r,
          comment: String(comment).trim(),
        },
        include: {
          user: { select: { id: true, displayName: true } },
        },
      });

      res.status(201).json(created);
    } catch (e) {
      if (e && e.code === "P2002") {
        throw new AppError(409, ErrorCode.CONFLICT, "You already reviewed this location");
      }
      throw e;
    }
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const location = await prisma.location.findFirst({
      where: { id, status: "APPROVED" },
      include: {
        owner: { select: { id: true, displayName: true } },
        fish: { include: { fish: true } },
        seasons: { include: { season: true } },
        photos: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!location) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    const agg = await prisma.review.aggregate({
      where: { locationId: id },
      _avg: { rating: true },
    });

    const avgRating = agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : null;

    const { _count, ...rest } = location;

    res.json({
      ...rest,
      reviewsCount: _count.reviews,
      avgRating,
    });
  }),
);

router.get(
  "/:id/contact",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const loc = await prisma.location.findFirst({
      where: { id, status: "APPROVED" },
      select: { id: true, contactInfo: true },
    });

    if (!loc) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    res.json({ contactInfo: loc.contactInfo });
  }),
);

module.exports = router;
