import crypto from "crypto";
import { User } from "../models/User.js";
import { sendSetPasswordEmail } from "./emailService.js";
import { primaryClientUrl } from "../config/clientOrigins.js";

const SET_PASSWORD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Returns the existing account for this email, or creates a guest account
// and emails a set-password link so the donor can access it later.
export const findOrCreateDonorAccount = async ({ name, email, phone }) => {
  const normalizedEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (user) return user;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user = await User.create({
    name,
    email: normalizedEmail,
    phone,
    password: crypto.randomBytes(16).toString("hex"), // random, unusable until reset
    isGuest: true,
    setPasswordToken: hashedToken,
    setPasswordExpires: Date.now() + SET_PASSWORD_EXPIRY_MS,
  });

  const setPasswordUrl = `${primaryClientUrl}/set-password/${rawToken}`;
  await sendSetPasswordEmail({ to: normalizedEmail, name, setPasswordUrl }).catch((err) =>
    console.error("Failed to send set-password email:", err.message)
  );

  return user;
};
