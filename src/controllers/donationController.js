import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { Donation } from "../models/Donation.js";
import { createPaypalOrder, capturePaypalOrder } from "../services/paypalService.js";
import { findOrCreateDonorAccount } from "../services/userService.js";
import { sendDonationReceiptEmail, sendBankTransferNotificationEmail } from "../services/emailService.js";

// Step 1: donor submits the donation form (name/email/amount/campaign) and we
// open a PayPal order. No account or DB record is created yet.
export const createOrder = asyncHandler(async (req, res) => {
  const { amount, campaign } = req.body;
  if (!amount || Number(amount) <= 0) {
    throw new ApiError(400, "A valid donation amount is required");
  }

  const order = await createPaypalOrder({ amount, currency: "USD", campaign });
  res.status(201).json({ success: true, orderId: order.id });
});

// Step 2: browser confirms the PayPal payment; we capture the funds, then
// create the donation record and (if needed) auto-create the donor's account.
export const captureOrder = asyncHandler(async (req, res) => {
  const { orderId, name, email, phone, campaign } = req.body;
  if (!orderId || !name || !email) {
    throw new ApiError(400, "orderId, name, and email are required");
  }

  const capture = await capturePaypalOrder(orderId);
  if (capture.status !== "COMPLETED") {
    throw new ApiError(402, "PayPal payment was not completed");
  }

  const purchaseUnit = capture.purchase_units?.[0];
  const captureRecord = purchaseUnit?.payments?.captures?.[0];
  const amount = Number(captureRecord?.amount?.value || 0);
  const currency = captureRecord?.amount?.currency_code || "USD";

  const user = await findOrCreateDonorAccount({ name, email, phone });

  const donation = await Donation.create({
    donor: user._id,
    name,
    email,
    type: campaign ? "Campaign" : "One-time",
    campaign: campaign || "General Fund",
    isMonetary: true,
    amount,
    currency,
    paymentMethod: "paypal",
    paypalOrderId: orderId,
    paypalCaptureId: captureRecord?.id,
    status: "Confirmed",
  });

  sendDonationReceiptEmail({ to: email, name, amount, currency, campaign: donation.campaign }).catch(
    (err) => console.error("Failed to send donation receipt email:", err.message)
  );

  res.status(201).json({ success: true, donation });
});

// Public: donor tells us they've made (or are about to make) a direct bank
// transfer. No payment is verified here — this just logs a Pending donation
// so admins know to expect the funds and can confirm receipt manually.
export const notifyBankTransfer = asyncHandler(async (req, res) => {
  const { name, email, phone, amount, campaign, transferReference } = req.body;
  if (!name || !email) {
    throw new ApiError(400, "Name and email are required");
  }
  if (!amount || Number(amount) <= 0) {
    throw new ApiError(400, "A valid donation amount is required");
  }

  const user = await findOrCreateDonorAccount({ name, email, phone });

  const donation = await Donation.create({
    donor: user._id,
    name,
    email,
    type: campaign ? "Campaign" : "One-time",
    campaign: campaign || "General Fund",
    isMonetary: true,
    amount,
    currency: "ZAR",
    paymentMethod: "bank_transfer",
    transferReference: transferReference || undefined,
    status: "Pending",
  });

  sendBankTransferNotificationEmail({
    to: email,
    name,
    amount,
    currency: "ZAR",
    campaign: donation.campaign,
  }).catch((err) => console.error("Failed to send bank transfer notification email:", err.message));

  res.status(201).json({ success: true, donation });
});

// Admin: manually log a donation that didn't go through PayPal (cash, in-kind, etc).
export const createManualDonation = asyncHandler(async (req, res) => {
  const { name, email, phone, type, amount, itemDescription, campaign, status } = req.body;
  if (!name || !email) {
    throw new ApiError(400, "Name and email are required");
  }

  const isMonetary = type !== "In-kind";
  if (isMonetary && (!amount || Number(amount) <= 0)) {
    throw new ApiError(400, "A valid amount is required for monetary donations");
  }
  if (!isMonetary && !itemDescription) {
    throw new ApiError(400, "An item description is required for in-kind donations");
  }

  const user = await findOrCreateDonorAccount({ name, email, phone });

  const donation = await Donation.create({
    donor: user._id,
    name,
    email,
    type: type || "One-time",
    campaign: campaign || "General Fund",
    isMonetary,
    amount: isMonetary ? amount : undefined,
    itemDescription: !isMonetary ? itemDescription : undefined,
    currency: "USD",
    paymentMethod: "manual",
    status: status || "Pending",
  });

  res.status(201).json({ success: true, donation });
});

// Admin: full donation list with search/filter/pagination for the dashboard table.
export const listDonations = asyncHandler(async (req, res) => {
  const { search, status, type, campaign, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
  if (campaign) query.campaign = campaign;
  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [{ name: regex }, { email: regex }, { campaign: regex }];
  }

  const pageNum = Math.max(Number(page), 1);
  const limitNum = Math.max(Number(limit), 1);

  const [donations, total] = await Promise.all([
    Donation.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Donation.countDocuments(query),
  ]);

  res.json({
    success: true,
    donations,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
  });
});

// Logged-in donor: their own donation history.
export const getMyDonations = asyncHandler(async (req, res) => {
  const donations = await Donation.find({ donor: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, donations });
});

export const updateDonation = asyncHandler(async (req, res) => {
  const { status, active, campaign, amount, itemDescription } = req.body;

  const donation = await Donation.findById(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");

  if (status !== undefined) donation.status = status;
  if (active !== undefined) donation.active = active;
  if (campaign !== undefined) donation.campaign = campaign;
  if (amount !== undefined) donation.amount = amount;
  if (itemDescription !== undefined) donation.itemDescription = itemDescription;

  await donation.save();
  res.json({ success: true, donation });
});

export const deleteDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findByIdAndDelete(req.params.id);
  if (!donation) throw new ApiError(404, "Donation not found");
  res.json({ success: true, message: "Donation deleted" });
});
