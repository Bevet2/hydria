import { Router } from "express";
import { getAllUserMemory } from "../services/memory/memoryService.js";

const router = Router();

router.get("/:userId", (req, res) => {
  res.json({
    success: true,
    memory: getAllUserMemory(req.params.userId)
  });
});

export default router;

