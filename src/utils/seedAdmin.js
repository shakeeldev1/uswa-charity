// One-off script to create the first admin account.
// Usage: node src/utils/seedAdmin.js "Admin Name" admin@uswa.org "StrongPassword123"
import "dotenv/config";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error("Usage: node src/utils/seedAdmin.js <name> <email> <password>");
  process.exit(1);
}

await connectDB();

const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) {
  existing.role = "admin";
  await existing.save();
  console.log(`Existing user ${email} promoted to admin.`);
} else {
  await User.create({ name, email, password, role: "admin" });
  console.log(`Admin account created for ${email}.`);
}

await mongoose.disconnect();
process.exit(0);
