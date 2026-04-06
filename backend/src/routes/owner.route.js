const router = require("express").Router();
const prisma = require("../db/client");
const { authenticateToken, requireRole } = require("../middleware/auth");

const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

router.use(authenticateToken, requireRole("OWNER"));

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

const WATER_TYPES = new Set(["LAKE", "RIVER", "POND", "SEA", "OTHER"]);

function normalizePhotoInputs(photos, max = 6) {
  if (!Array.isArray(photos)) return [];

  const cleaned = photos
    .map((p) => ({
      url: p?.url ? String(p.url).trim() : "",
      publicId: p?.publicId ? String(p.publicId).trim() : "",
    }))
    .filter((p) => p.url && p.publicId);

  const uniqueByUrl = [];
  const seen = new Set();
  for (const p of cleaned) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    uniqueByUrl.push(p);
  }

  return uniqueByUrl.slice(0, max);
}

function normalizePhotoUrls(photoUrls, max = 6) {
  if (!Array.isArray(photoUrls)) return [];
  const cleaned = photoUrls.map((u) => String(u).trim()).filter(Boolean);
  const unique = [...new Set(cleaned)];
  return unique.slice(0, max);
}

router.get(
  "/locations",
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limitRaw = parseInt(req.query.limit || "20", 10);
    const limit = Math.min(50, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const where = { ownerId: userId };

    const [total, items] = await Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
          photos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, url: true, createdAt: true },
          },
          fish: { include: { fish: true } },
          seasons: { include: { season: true } },
        },
      }),
    ]);

    res.json({ items, total, page, limit });
  }),
);

router.get(
  "/locations/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const location = await prisma.location.findFirst({
      where: { id, ownerId: req.user.id },
      include: {
        owner: { select: { id: true, displayName: true } },
        fish: { include: { fish: true } },
        seasons: { include: { season: true } },
        photos: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, url: true, createdAt: true },
        },
      },
    });

    if (!location) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    res.json(location);
  }),
);

router.patch(
  "/locations/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const {
      title,
      description,
      region,
      waterType,
      lat,
      lng,
      fishNames,
      seasonCodes,
      contactInfo,
      photos,
      photoUrls,
    } = req.body;

    const data = {};

    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = String(description).trim();

    if (region !== undefined) {
      const regionCode = String(region).trim().toUpperCase();
      if (!REGION_CODES.has(regionCode)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid region", {
          field: "region",
        });
      }
      data.region = regionCode;
    }

    if (waterType !== undefined) {
      const waterTypeCode = String(waterType).trim().toUpperCase();
      if (!WATER_TYPES.has(waterTypeCode)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid waterType", {
          field: "waterType",
          allowed: Array.from(WATER_TYPES),
        });
      }
      data.waterType = waterTypeCode;
    }

    const hasLat = lat !== undefined;
    const hasLng = lng !== undefined;

    if (hasLat !== hasLng) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        "lat and lng must be provided together",
        { fields: ["lat", "lng"] },
      );
    }

    if (hasLat && hasLng) {
      if (String(lat).trim() === "" || String(lng).trim() === "") {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, "lat and lng are required", {
          fields: ["lat", "lng"],
        });
      }

      const latNum = Number(lat);
      const lngNum = Number(lng);

      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          "lat and lng must be valid numbers",
          { fields: ["lat", "lng"] },
        );
      }

      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, "lat/lng out of range", {
          latRange: [-90, 90],
          lngRange: [-180, 180],
        });
      }

      data.lat = String(latNum);
      data.lng = String(lngNum);
    }

    if ("contactInfo" in req.body) {
      const contact = contactInfo ? String(contactInfo).trim() : null;
      if (contact && contact.length > 255) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          "contactInfo is too long (max 255 chars)",
          { field: "contactInfo", max: 255 },
        );
      }
      data.contactInfo = contact;
    }

    const normalizedNewPhotos = Array.isArray(photos)
      ? normalizePhotoInputs(photos, 6)
      : null;
    const normalizedPhotoUrls = Array.isArray(photoUrls)
      ? normalizePhotoUrls(photoUrls, 6)
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.location.findFirst({
        where: { id, ownerId: req.user.id },
        select: { id: true, status: true },
      });

      if (!current) {
        throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
      }

      const nextData =
        current.status === "APPROVED"
          ? { ...data, status: "PENDING" }
          : data;

      const upd = await tx.location.updateMany({
        where: { id, ownerId: req.user.id },
        data: nextData,
      });

      if (upd.count !== 1) {
        throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
      }

      if (Array.isArray(fishNames)) {
        const fishList = fishNames.map((x) => String(x).trim()).filter(Boolean);

        const fishRows = fishList.length
          ? await tx.fish.findMany({
              where: { name: { in: fishList } },
              select: { id: true },
            })
          : [];

        await tx.locationFish.deleteMany({ where: { locationId: id } });

        if (fishRows.length) {
          await tx.locationFish.createMany({
            data: fishRows.map((f) => ({ locationId: id, fishId: f.id })),
            skipDuplicates: true,
          });
        }
      }

      if (Array.isArray(seasonCodes)) {
        const seasonRows = seasonCodes.length
          ? await tx.season.findMany({
              where: { code: { in: seasonCodes.map((c) => String(c)) } },
              select: { id: true },
            })
          : [];

        await tx.locationSeason.deleteMany({ where: { locationId: id } });

        if (seasonRows.length) {
          await tx.locationSeason.createMany({
            data: seasonRows.map((s) => ({ locationId: id, seasonId: s.id })),
            skipDuplicates: true,
          });
        }
      }

      if (normalizedNewPhotos) {
        const existingPhotos = await tx.photo.findMany({
          where: { locationId: id },
          select: { url: true },
        });

        const existingUrls = new Set(existingPhotos.map((p) => p.url));
        const currentCount = existingPhotos.length;

        const remainingSlots = Math.max(0, 6 - currentCount);
        if (remainingSlots > 0) {
          const toAdd = normalizedNewPhotos
            .filter((p) => !existingUrls.has(p.url))
            .slice(0, remainingSlots);

          if (toAdd.length) {
            await tx.photo.createMany({
              data: toAdd.map((p) => ({
                locationId: id,
                url: p.url,
                publicId: p.publicId,
              })),
            });
          }
        }
      }

      // We use createdAt sequencing because reads are ordered by createdAt asc, id asc.
      if (normalizedPhotoUrls) {
        const currentPhotos = await tx.photo.findMany({
          where: { locationId: id },
          select: { id: true, url: true },
        });

        if (currentPhotos.length) {
          const byUrl = new Map(currentPhotos.map((p) => [p.url, p]));
          const usedIds = new Set();
          const ordered = [];

          for (const url of normalizedPhotoUrls) {
            const photo = byUrl.get(url);
            if (!photo) continue;
            if (usedIds.has(photo.id)) continue;
            usedIds.add(photo.id);
            ordered.push(photo);
          }

          for (const photo of currentPhotos) {
            if (usedIds.has(photo.id)) continue;
            ordered.push(photo);
          }

          const baseTs = Date.now();
          await Promise.all(
            ordered.map((photo, index) =>
              tx.photo.update({
                where: { id: photo.id },
                data: { createdAt: new Date(baseTs + index) },
              }),
            ),
          );
        }
      }

      return tx.location.findFirst({
        where: { id, ownerId: req.user.id },
        include: {
          owner: { select: { id: true, displayName: true } },
          fish: { include: { fish: true } },
          seasons: { include: { season: true } },
          photos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, url: true, createdAt: true },
          },
        },
      });
    });

    res.json(result);
  }),
);

router.post(
  "/locations/:id/hide",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.location.findFirst({
      where: { id, ownerId: req.user.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    try {
      const updated = await prisma.location.update({
        where: { id },
        data: { status: "HIDDEN" },
        include: {
          owner: { select: { id: true, displayName: true } },
          fish: { include: { fish: true } },
          seasons: { include: { season: true } },
          photos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, url: true, createdAt: true },
          },
        },
      });

      res.json(updated);
    } catch (e) {
      if (e && e.code === "P2025") {
        throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
      }
      throw e;
    }
  }),
);

router.post(
  "/locations/:id/unhide",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.location.findFirst({
      where: { id, ownerId: req.user.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
    }

    try {
      const updated = await prisma.location.update({
        where: { id },
        data: { status: "PENDING" },
        include: {
          owner: { select: { id: true, displayName: true } },
          fish: { include: { fish: true } },
          seasons: { include: { season: true } },
          photos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, url: true, createdAt: true },
          },
        },
      });

      res.json(updated);
    } catch (e) {
      if (e && e.code === "P2025") {
        throw new AppError(404, ErrorCode.NOT_FOUND, "Location not found");
      }
      throw e;
    }
  }),
);

module.exports = router;
