import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Denormalized so donation records stay stable even if the user edits their profile later.
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },

    type: {
      type: String,
      enum: ["One-time", "Campaign", "In-kind"],
      default: "One-time",
    },
    campaign: { type: String, default: "General Fund" },

    isMonetary: { type: Boolean, default: true },
    amount: { type: Number, min: 0 }, // present when isMonetary is true
    currency: { type: String, default: "USD" },
    itemDescription: { type: String }, // present when isMonetary is false (in-kind)

    paymentMethod: {
      type: String,
      enum: ["paypal", "bank_transfer", "manual"],
      default: "manual",
    },
    paypalOrderId: { type: String },
    paypalCaptureId: { type: String },

    // Donor-supplied note (e.g. their own transfer reference) for bank_transfer donations.
    transferReference: { type: String },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Failed", "Refunded"],
      default: "Pending",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ campaign: 1 });

export const Donation = mongoose.model("Donation", donationSchema);
