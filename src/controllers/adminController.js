import { asyncHandler } from "../utils/asyncHandler.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";

// Aggregated figures for the admin dashboard overview: totals, breakdowns,
// and a monthly trend of confirmed donations.
export const getAnalytics = asyncHandler(async (req, res) => {
  const [totals, byStatus, byCampaign, byType, monthlyTrend, userCount, recentDonations] =
    await Promise.all([
      Donation.aggregate([
        { $match: { status: "Confirmed", isMonetary: true } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Donation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Donation.aggregate([
        { $match: { status: "Confirmed", isMonetary: true } },
        { $group: { _id: "$campaign", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
      ]),
      Donation.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      Donation.aggregate([
        { $match: { status: "Confirmed", isMonetary: true } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
      User.countDocuments({ role: "user" }),
      Donation.find().sort({ createdAt: -1 }).limit(10),
    ]);

  res.json({
    success: true,
    analytics: {
      totalConfirmedAmount: totals[0]?.totalAmount || 0,
      totalConfirmedCount: totals[0]?.count || 0,
      totalDonors: userCount,
      byStatus,
      byCampaign,
      byType,
      monthlyTrend,
      recentDonations,
    },
  });
});
