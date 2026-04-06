const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../db/client");

const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ErrorCode } = require("../utils/errorCodes");

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, displayName, role } = req.body;

    if (!email || !password) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "email and password are required", {
        fields: ["email", "password"],
      });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const passNorm = String(password);
    const nameNorm = displayName == null ? null : String(displayName);

    if (!EMAIL_RE.test(emailNorm)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email", { field: "email" });
    }

    if (passNorm.length < 8) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Password must be at least 8 characters", {
        field: "password",
        min: 8,
      });
    }

    if (nameNorm !== null && !USERNAME_RE.test(nameNorm)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid display name", {
        field: "displayName",
      });
    }

    // Safe rule: register only USER/OWNER. ADMIN created manually.
    const safeRole = role === "OWNER" ? "OWNER" : "USER";

    const passwordHash = await bcrypt.hash(passNorm, 10);

    try {
      const user = await prisma.user.create({
        data: {
          email: emailNorm,
          passwordHash,
          displayName: nameNorm,
          role: safeRole,
        },
        select: { id: true, email: true, role: true, displayName: true },
      });

      const token = signToken(user);
      res.status(201).json({ user, token });
    } catch (e) {
      if (e && e.code === "P2002") {
        const target = e.meta?.target || [];

        if (Array.isArray(target) && target.includes("email")) {
          throw new AppError(409, ErrorCode.CONFLICT, "Email already taken", { field: "email" });
        }

        if (Array.isArray(target) && target.includes("displayName")) {
          throw new AppError(409, ErrorCode.CONFLICT, "Display name already taken", {
            field: "displayName",
          });
        }

        throw new AppError(409, ErrorCode.CONFLICT, "Unique constraint failed", {
          target,
        });
      }

      throw e;
    }
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "email and password are required", {
        fields: ["email", "password"],
      });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Invalid credentials");
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Invalid credentials");
    }

    const token = signToken(user);

    res.json({
      user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
      token,
    });
  }),
);

module.exports = router;
