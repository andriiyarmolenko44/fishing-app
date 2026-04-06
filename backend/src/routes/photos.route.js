const router = require("express").Router();
const prisma = require("../db/client");
const { authenticateToken } = require("../middleware/auth");
const cloudinary = require("../utils/cloudinary");

const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

router.post(
  "/cleanup",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const publicIds = Array.isArray(req.body?.publicIds) ? req.body.publicIds : [];

    const cleaned = publicIds
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (!cleaned.length) {
      return res.json({ deleted: 0 });
    }

    if (cleaned.length > 20) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Too many publicIds (max 20)", {
        field: "publicIds",
        max: 20,
      });
    }

    const prefix = `drafts/${req.user.id}/`;

    // allow only own draft folder
    const allowed = cleaned.filter((id) => id.startsWith(prefix));

    if (!allowed.length) {
      return res.json({ deleted: 0 });
    }

    const result = await cloudinary.api.delete_resources(allowed, {
      resource_type: "image",
      type: "upload",
    });

    const deletedCount = result?.deleted
      ? Object.values(result.deleted).filter((v) => v === "deleted").length
      : 0;

    res.json({ deleted: deletedCount });
  }),
);

router.delete(
  "/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const photoId = String(req.params.id || "").trim();

    if (!photoId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid photo id", { field: "id" });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        publicId: true,
        locationId: true,
        location: { select: { ownerId: true } },
      },
    });

    if (!photo) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Photo not found");
    }

    const isAdmin = req.user.role === "ADMIN";
    const isOwner = photo.location?.ownerId === req.user.id;

    if (!isAdmin && !isOwner) {
      throw new AppError(403, ErrorCode.FORBIDDEN, "Forbidden");
    }

    if (photo.publicId) {
      await cloudinary.uploader.destroy(photo.publicId);
    }

    try {
      await prisma.photo.delete({ where: { id: photoId } });
    } catch (e) {
      if (e && e.code === "P2025") {
        throw new AppError(404, ErrorCode.NOT_FOUND, "Photo not found");
      }
      throw e;
    }

    res.status(204).send();
  }),
);

module.exports = router;
