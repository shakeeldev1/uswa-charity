import { Router } from "express";
import {
  createOrder,
  captureOrder,
  notifyBankTransfer,
  createManualDonation,
  listDonations,
  getMyDonations,
  updateDonation,
  deleteDonation,
} from "../controllers/donationController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

// Public: guest or logged-in donor checkout via PayPal
router.post("/paypal/create-order", createOrder);
router.post("/paypal/capture-order", captureOrder);

// Public: guest or logged-in donor notifies us of a direct bank transfer
router.post("/bank-transfer", notifyBankTransfer);

// Logged-in donor
router.get("/mine", protect, getMyDonations);

// Admin
router.get("/", protect, adminOnly, listDonations);
router.post("/manual", protect, adminOnly, createManualDonation);
router.patch("/:id", protect, adminOnly, updateDonation);
router.delete("/:id", protect, adminOnly, deleteDonation);

export default router;
