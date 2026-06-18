import { Router } from "express";
import {
  branchConversation,
  clearConversationMessages,
  createChatProject,
  createConversation,
  ensureConversationForUser,
  getConversationTree,
  getConversationMessages,
  getSharedConversation,
  listChatProjects,
  shareConversation,
  updateChatProject,
  updateConversation
} from "../services/memory/historyService.js";

const router = Router();

router.post("/", (req, res) => {
  const conversation = createConversation({
    userId: req.body?.userId,
    title: req.body?.title,
    projectId: req.body?.projectId,
    folder: req.body?.folder
  });

  res.status(201).json({
    success: true,
    conversation
  });
});

router.get("/tree/:userId", (req, res) => {
  res.json({
    success: true,
    tree: getConversationTree(req.params.userId)
  });
});

router.get("/projects/:userId", (req, res) => {
  res.json({
    success: true,
    projects: listChatProjects(req.params.userId, {
      archived: req.query.archived === "1" || req.query.archived === "true"
    })
  });
});

router.post("/projects", (req, res) => {
  const project = createChatProject({
    userId: req.body?.userId,
    name: req.body?.name,
    description: req.body?.description
  });
  res.status(201).json({ success: true, project });
});

router.patch("/projects/:projectId", (req, res) => {
  const project = updateChatProject(req.params.projectId, req.body?.userId, {
    name: req.body?.name,
    description: req.body?.description,
    archived: req.body?.archived
  });
  res.json({ success: true, project });
});

router.get("/shared/:shareToken", (req, res) => {
  const shared = getSharedConversation(req.params.shareToken);
  if (!shared) {
    res.status(404).json({ success: false, error: "Shared conversation not found" });
    return;
  }
  res.json({ success: true, ...shared });
});

router.patch("/:conversationId", (req, res) => {
  ensureConversationForUser(req.params.conversationId, req.body?.userId);
  const conversation = updateConversation(req.params.conversationId, {
    title: req.body?.title,
    archived: req.body?.archived,
    folder: req.body?.folder,
    projectId: req.body?.projectId
  });
  res.json({ success: true, conversation });
});

router.post("/:conversationId/share", (req, res) => {
  ensureConversationForUser(req.params.conversationId, req.body?.userId);
  const conversation = shareConversation(req.params.conversationId);
  res.json({
    success: true,
    conversation,
    shareUrl: `/share/chat/${conversation.share_token}`
  });
});

router.post("/:conversationId/branch", (req, res) => {
  const conversation = branchConversation({
    conversationId: req.params.conversationId,
    userId: req.body?.userId,
    messageId: req.body?.messageId,
    title: req.body?.title
  });
  res.status(201).json({ success: true, conversation });
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
