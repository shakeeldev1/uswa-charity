import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // True when the account was created automatically at donation time,
    // rather than through a manual signup form.
    isGuest: { type: Boolean, default: false },

    setPasswordToken: { type: String, select: false },
    setPasswordExpires: { type: Date, select: false },

    // Account lockout after repeated failed logins (brute-force protection).
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },

    // Hashed refresh tokens (one per active session/device). The raw token
    // only ever lives in an httpOnly cookie on the client.
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
        },
      ],
      default: [],
      select: false,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

userSchema.methods.registerFailedLogin = async function registerFailedLogin() {
  this.loginAttempts = (this.loginAttempts || 0) + 1;
  if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    this.loginAttempts = 0;
  }
  await this.save();
};

userSchema.methods.registerSuccessfulLogin = async function registerSuccessfulLogin() {
  if (this.loginAttempts || this.lockUntil) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
  }
};

// Drops expired sessions and adds the new one in a single save.
userSchema.methods.addRefreshToken = async function addRefreshToken(tokenHash, expiresAt) {
  this.refreshTokens = (this.refreshTokens || []).filter((t) => t.expiresAt > new Date());
  this.refreshTokens.push({ tokenHash, expiresAt });
  await this.save();
};

// Removes one session's refresh token (used on rotation and logout).
userSchema.methods.removeRefreshToken = async function removeRefreshToken(tokenHash) {
  this.refreshTokens = (this.refreshTokens || []).filter((t) => t.tokenHash !== tokenHash);
  await this.save();
};

export const User = mongoose.model("User", userSchema);
