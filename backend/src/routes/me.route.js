const router = require("express").Router();
const prisma = require("../db/client");
const { authenticateToken } = require("../middleware/auth");
const bcrypt = require("bcrypt");

const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
    }

    res.json({ user });
  }),
);

router.patch(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const newDisplayName = req.body?.displayName;

    if (typeof newDisplayName !== "string") {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid displayName", {
        field: "displayName",
      });
    }

    const trimmed = newDisplayName.trim();

    if (trimmed.length < 2) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "displayName is too short", {
        field: "displayName",
        minLen: 2,
      });
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { displayName: trimmed },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          createdAt: true,
        },
      });

      res.json({ user });
    } catch (e) {
      if (e && e.code === "P2002") {
        throw new AppError(409, ErrorCode.CONFLICT, "Display name already taken", {
          field: "displayName",
        });
      }
      if (e && e.code === "P2025") {
        throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
      }
      throw e;
    }
  }),
);

router.patch(
  "/password",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "currentPassword and newPassword are required", {
        fields: ["currentPassword", "newPassword"],
      });
    }

    if (newPassword.length < 8) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Password must be at least 8 characters", {
        field: "newPassword",
        min: 8,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!ok) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Wrong password");
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash },
    });

    res.json({ ok: true });
  }),
);

module.exports = router;
