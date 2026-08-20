import jwt from "jsonwebtoken";
import crypto from "crypto";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS) || 30;

export const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });

// Refresh tokens are opaque random strings, not JWTs — only their SHA-256
// hash is stored server-side, so a leaked DB dump can't be replayed.
export const generateRefreshToken = () => {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  return { raw, tokenHash, expiresAt };
};

export const hashRefreshToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const setRefreshTokenCookie = (res, rawToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
};

export const getRefreshTokenFromRequest = (req) => req.cookies?.[REFRESH_TOKEN_COOKIE];
