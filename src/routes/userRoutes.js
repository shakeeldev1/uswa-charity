import { Router } from "express";
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.use(protect, adminOnly);
router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
