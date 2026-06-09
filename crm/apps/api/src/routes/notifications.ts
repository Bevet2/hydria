import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parsePagination } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { processTaskNotifications } from "../services/notifications.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    await processTaskNotifications();
    const { limit, skip } = parsePagination(req.query);
    const unreadOnly = String(req.query.unread || "") === "true";
    const where = {
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      ...(unreadOnly ? { readAt: null } : {})
    };
    const [notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          task: {
            select: { id: true, title: true, status: true, dueAt: true }
          }
        }
      }),
      prisma.notification.count({
        where: {
          organizationId: req.user!.organizationId,
          userId: req.user!.id,
          readAt: null
        }
      })
    ]);
    res.json({ notifications, unreadCount });
  })
);

router.patch(
  "/:id/read",
  asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId: req.user!.organizationId, userId: req.user!.id }
    });
    if (!notification) throw new HttpError("Notification not found", 404);
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt || new Date() }
    });
    res.json({ notification: updated });
  })
);

router.post(
  "/read-all",
  asyncRoute(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        readAt: null
      },
      data: { readAt: new Date() }
    });
    res.json({ updated: result.count });
  })
);

export default router;
