import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

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
