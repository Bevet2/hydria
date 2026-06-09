import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { parseBody } from "../lib/http.js";

const router = Router();
router.use(requireAuth);

const widgetSchema = z.enum([
  "contacts",
  "companies",
  "leads",
  "openDeals",
  "wonDeals",
  "dueTasks",
  "pipeline",
  "recentActivities"
]);

router.get("/preferences", asyncRoute(async (req, res) => {
  const preference = await prisma.dashboardPreference.findUnique({ where: { userId: req.user!.id } });
  res.json({
    preference: preference || {
      widgets: ["openDeals", "wonDeals", "leads", "dueTasks", "pipeline", "recentActivities"],
      layout: []
    }
  });
}));

router.put("/preferences", asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    widgets: z.array(widgetSchema).min(1).max(8),
    layout: z.array(z.object({
      id: widgetSchema,
      position: z.coerce.number().int().min(0).max(20)
    })).max(8).default([])
  }), req.body);
  const preference = await prisma.dashboardPreference.upsert({
    where: { userId: req.user!.id },
    update: input,
    create: {
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      ...input
    }
  });
  res.json({ preference });
}));

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const organizationId = req.user!.organizationId;
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const [
      contacts,
      companies,
      leads,
      openDeals,
      wonDeals,
      dueTasks,
      stages,
      recentActivities
    ] = await prisma.$transaction([
      prisma.contact.count({ where: { organizationId } }),
      prisma.company.count({ where: { organizationId } }),
      prisma.lead.count({ where: { organizationId, status: { not: "CONVERTED" } } }),
      prisma.deal.aggregate({
        where: { organizationId, status: "OPEN" },
        _count: true,
        _sum: { value: true }
      }),
      prisma.deal.aggregate({
        where: { organizationId, status: "WON" },
        _count: true,
        _sum: { value: true }
      }),
      prisma.task.count({
        where: {
          organizationId,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueAt: { lte: weekEnd }
        }
      }),
      prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: "asc" },
        include: {
          deals: {
            where: { status: "OPEN" },
            select: { value: true }
          }
        }
      }),
      prisma.activity.findMany({
        where: { organizationId },
        orderBy: { occurredAt: "desc" },
        take: 8,
        include: {
          actor: { select: { firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          deal: { select: { id: true, name: true } }
        }
      })
    ]);

    res.json({
      metrics: {
        contacts,
        companies,
        leads,
        openDeals: openDeals._count,
        openValue: Number(openDeals._sum.value || 0),
        wonDeals: wonDeals._count,
        wonValue: Number(wonDeals._sum.value || 0),
        dueTasks
      },
      pipeline: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        count: stage.deals.length,
        value: stage.deals.reduce((total, deal) => total + Number(deal.value), 0)
      })),
      recentActivities
    });
  })
);

export default router;
