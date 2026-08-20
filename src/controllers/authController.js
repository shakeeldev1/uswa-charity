import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} from "../utils/tokens.js";

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isGuest: user.isGuest,
});

// Issues a new access/refresh token pair for a session: sets the refresh
// token as an httpOnly cookie and returns the access token in the JSON body.
const issueSession = async (user, res, statusCode = 200) => {
  const { raw, tokenHash, expiresAt } = generateRefreshToken();
  await user.addRefreshToken(tokenHash, expiresAt);
  setRefreshTokenCookie(res, raw);

  res.status(statusCode).json({
    success: true,
    accessToken: generateAccessToken(user._id, user.role),
    user: sanitizeUser(user),
  });
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const user = await User.create({ name, email, password, phone });
  await issueSession(user, res, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +loginAttempts +lockUntil"
  );

  // Constant error message regardless of whether the account exists, to avoid
  // leaking which emails are registered.
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.isLocked()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(
      423,
      `Too many failed attempts. Try again in ${minutesLeft} minute(s).`
    );
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    await user.registerFailedLogin();
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.active) {
    throw new ApiError(403, "This account has been deactivated");
  }

  await user.registerSuccessfulLogin();
  await issueSession(user, res);
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: sanitizeUser(req.user) });
});

export const setPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    throw new ApiError(400, "Token and new password are required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    setPasswordToken: hashedToken,
    setPasswordExpires: { $gt: Date.now() },
  }).select("+setPasswordToken +setPasswordExpires");

  if (!user) {
    throw new ApiError(400, "This set-password link is invalid or has expired");
  }

  user.password = password;
  user.setPasswordToken = undefined;
  user.setPasswordExpires = undefined;
  await user.save();

  await issueSession(user, res);
});

// Exchanges a valid refresh token (httpOnly cookie) for a new access token,
// rotating the refresh token so a stolen cookie can't be replayed indefinitely.
export const refresh = asyncHandler(async (req, res) => {
  const rawToken = getRefreshTokenFromRequest(req);
  if (!rawToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  const tokenHash = hashRefreshToken(rawToken);
  const user = await User.findOne({
    "refreshTokens.tokenHash": tokenHash,
    "refreshTokens.expiresAt": { $gt: new Date() },
  }).select("+refreshTokens");

  if (!user || !user.active) {
    clearRefreshTokenCookie(res);
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  await user.removeRefreshToken(tokenHash);
  await issueSession(user, res);
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = getRefreshTokenFromRequest(req);
  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash }).select(
      "+refreshTokens"
    );
    if (user) await user.removeRefreshToken(tokenHash);
  }

  clearRefreshTokenCookie(res);
  res.json({ success: true, message: "Logged out" });
});
