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
    const [deals, leads, tasks, users, stages] = await prisma.$transaction([
      prisma.deal.findMany({
        where: { organizationId },
        include: {
          stage: true,
          owner: { select: { id: true, firstName: true, lastName: true } }
        }
      }),
      prisma.lead.findMany({ where: { organizationId } }),
      prisma.task.findMany({ where: { organizationId } }),
      prisma.user.findMany({
        where: { organizationId },
        select: { id: true, firstName: true, lastName: true }
      }),
      prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: "asc" }
      })
    ]);

    const ownerForecast = users.map((user) => {
      const owned = deals.filter((deal) => deal.ownerId === user.id && deal.status !== "LOST");
      return {
        ownerId: user.id,
        owner: `${user.firstName} ${user.lastName}`,
        pipeline: owned.reduce((sum, deal) => sum + Number(deal.value), 0),
        weighted: owned.reduce((sum, deal) => sum + Number(deal.value) * (deal.probability / 100), 0),
        commit: owned
          .filter((deal) => deal.forecastCategory === "COMMIT" || deal.status === "WON")
          .reduce((sum, deal) => sum + Number(deal.value), 0),
        deals: owned.length
      };
    });

    const funnel = stages
      .map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stageId === stage.id);
        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, deal) => sum + Number(deal.value), 0)
        };
      })
      .sort((a, b) => a.position - b.position);

    const sources = Object.entries(
      leads.reduce<Record<string, number>>((result, lead) => {
        const key = lead.source || "Unknown";
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {})
    )
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const now = new Date();
    const overdue = tasks.filter(
      (task) => task.dueAt && task.dueAt < now && !["DONE", "CANCELED"].includes(task.status)
    ).length;
    const won = deals.filter((deal) => deal.status === "WON");
    const lost = deals.filter((deal) => deal.status === "LOST");
    const convertedLeads = leads.filter((lead) => lead.status === "CONVERTED").length;

    res.json({
      summary: {
        pipelineValue: deals
          .filter((deal) => deal.status === "OPEN")
          .reduce((sum, deal) => sum + Number(deal.value), 0),
        weightedValue: deals
          .filter((deal) => deal.status === "OPEN")
          .reduce((sum, deal) => sum + Number(deal.value) * (deal.probability / 100), 0),
        wonValue: won.reduce((sum, deal) => sum + Number(deal.value), 0),
        winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
        leadConversionRate: leads.length ? Math.round((convertedLeads / leads.length) * 100) : 0,
        overdueTasks: overdue
      },
      ownerForecast,
      funnel,
      sources
    });
  })
);

export default router;
