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
    conversations: listConversationsByUser(req.params.userId, {
      search: req.query.search || "",
      archived: req.query.archived === "1" || req.query.archived === "true",
      folder: req.query.folder || "",
      projectId: req.query.projectId || ""
    })
  });
});

export default router;
