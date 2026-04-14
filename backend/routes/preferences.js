import { Router } from "express";
import {
  getUserPreferences,
  updateUserPreferences
} from "../services/memory/profileService.js";

const router = Router();

router.get("/:userId", (req, res) => {
  res.json({
    success: true,
    preferences: getUserPreferences(req.params.userId)
  });
});

router.post("/:userId", (req, res) => {
  res.json({
    success: true,
    preferences: updateUserPreferences(req.params.userId, req.body || {})
  });
});

export default router;

