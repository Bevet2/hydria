import { Router } from "express";
import {
  clearConversationMessages,
  createConversation,
  getConversationMessages
} from "../services/memory/historyService.js";

const router = Router();

router.post("/", (req, res) => {
  const conversation = createConversation({
    userId: req.body?.userId,
    title: req.body?.title
  });

  res.status(201).json({
    success: true,
    conversation
  });
});

router.get("/:conversationId/messages", (req, res) => {
  res.json({
    success: true,
    messages: getConversationMessages(req.params.conversationId)
  });
});

router.delete("/:conversationId/messages", (req, res) => {
  const conversation = clearConversationMessages(req.params.conversationId);
  res.json({
    success: true,
    conversation
  });
});

export default router;

