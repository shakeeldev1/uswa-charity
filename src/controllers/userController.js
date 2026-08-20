import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/User.js";
import { sendSetPasswordEmail } from "../services/emailService.js";

const SET_PASSWORD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Admin: create a staff/admin account directly. The new user gets a
// set-password email rather than a password chosen by the admin.
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, role } = req.body;
  if (!name || !email) {
    throw new ApiError(400, "Name and email are required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.create({
    name,
    email: normalizedEmail,
    phone,
    role: role === "admin" ? "admin" : "user",
    password: crypto.randomBytes(16).toString("hex"),
    setPasswordToken: hashedToken,
    setPasswordExpires: Date.now() + SET_PASSWORD_EXPIRY_MS,
  });

  const setPasswordUrl = `${process.env.CLIENT_URL}/set-password/${rawToken}`;
  await sendSetPasswordEmail({ to: normalizedEmail, name, setPasswordUrl }).catch((err) =>
    console.error("Failed to send set-password email:", err.message)
  );

  res.status(201).json({ success: true, user });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;

  const query = {};
  if (role) query.role = role;
  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [{ name: regex }, { email: regex }];
  }

  const pageNum = Math.max(Number(page), 1);
  const limitNum = Math.max(Number(limit), 1);

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    User.countDocuments(query),
  ]);

  res.json({
    success: true,
    users,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  res.json({ success: true, user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, role, active } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;

  await user.save();
  res.json({ success: true, user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  res.json({ success: true, message: "User deleted" });
});
