import { Router } from "express";
import { getAnalytics } from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/analytics", protect, adminOnly, getAnalytics);

export default router;
