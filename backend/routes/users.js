import { Router } from "express";
import {
  createUser,
  listConversationsByUser,
  listUsers
} from "../services/memory/historyService.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    users: listUsers()
  });
});

router.post("/", (req, res) => {
  const user = createUser(req.body?.username);
  res.status(201).json({
    success: true,
    user
  });
});

router.get("/:userId/conversations", (req, res) => {
  res.json({
    success: true,
    conversations: listConversationsByUser(req.params.userId)
  });
});

export default router;

