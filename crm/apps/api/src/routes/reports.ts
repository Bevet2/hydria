import { Prisma } from "@prisma/client";
import { Router } from "express";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, HttpError, parseBody } from "../lib/http.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function dateFilter(query: Record<string, unknown>) {
  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) {
    to.setUTCHours(23, 59, 59, 999);
  }
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function reportData(organizationId: string, query: Record<string, unknown>) {
  const ownerId = query.ownerId ? String(query.ownerId) : "";
  const campaignId = query.campaignId ? String(query.campaignId) : "";
  const range = dateFilter(query);
  const dealWhere: Prisma.DealWhereInput = {
    organizationId,
    ...(ownerId ? { ownerId } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(range ? { updatedAt: range } : {})
  };
  const leadWhere: Prisma.LeadWhereInput = {
    organizationId,
    ...(ownerId ? { ownerId } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(range ? { createdAt: range } : {})
  };
  const taskWhere: Prisma.TaskWhereInput = {
    organizationId,
    ...(ownerId ? { assignedToId: ownerId } : {}),
    ...(range ? { createdAt: range } : {})
  };

  const [deals, leads, tasks, users, stages, campaigns] = await prisma.$transaction([
    prisma.deal.findMany({
      where: dealWhere,
      include: {
        stage: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true } }
      }
    }),
    prisma.lead.findMany({ where: leadWhere }),
    prisma.task.findMany({ where: taskWhere }),
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true }
    }),
    prisma.pipelineStage.findMany({ where: { organizationId }, orderBy: { position: "asc" } }),
    prisma.campaign.findMany({ where: { organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
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

  const funnel = stages.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stageId === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      position: stage.position,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + Number(deal.value), 0)
    };
  });

  const sources = Object.entries(leads.reduce<Record<string, number>>((result, lead) => {
    const key = lead.source || "Unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {})).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  const campaignPerformance = campaigns.map((campaign) => {
    const campaignDeals = deals.filter((deal) => deal.campaignId === campaign.id);
    return {
      id: campaign.id,
      name: campaign.name,
      leads: leads.filter((lead) => lead.campaignId === campaign.id).length,
      deals: campaignDeals.length,
      revenue: campaignDeals.filter((deal) => deal.status === "WON").reduce((sum, deal) => sum + Number(deal.value), 0)
    };
  });

  const trendMap = new Map<string, { pipeline: number; won: number; created: number }>();
  for (const deal of deals) {
    const key = monthKey(deal.updatedAt);
    const current = trendMap.get(key) || { pipeline: 0, won: 0, created: 0 };
    current.created += 1;
    if (deal.status === "WON") current.won += Number(deal.value);
    else if (deal.status === "OPEN") current.pipeline += Number(deal.value);
    trendMap.set(key, current);
  }

  const now = new Date();
  const overdue = tasks.filter((task) => task.dueAt && task.dueAt < now && !["DONE", "CANCELED"].includes(task.status)).length;
  const won = deals.filter((deal) => deal.status === "WON");
  const lost = deals.filter((deal) => deal.status === "LOST");
  const convertedLeads = leads.filter((lead) => lead.status === "CONVERTED").length;

  return {
    filters: { ownerId: ownerId || null, campaignId: campaignId || null, from: query.from || null, to: query.to || null },
    summary: {
      pipelineValue: deals.filter((deal) => deal.status === "OPEN").reduce((sum, deal) => sum + Number(deal.value), 0),
      weightedValue: deals.filter((deal) => deal.status === "OPEN").reduce((sum, deal) => sum + Number(deal.value) * (deal.probability / 100), 0),
      wonValue: won.reduce((sum, deal) => sum + Number(deal.value), 0),
      winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
      leadConversionRate: leads.length ? Math.round((convertedLeads / leads.length) * 100) : 0,
      overdueTasks: overdue
    },
    ownerForecast,
    funnel,
    sources,
    campaigns: campaignPerformance,
    trend: [...trendMap.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, values]) => ({ month, ...values }))
  };
}

router.get("/export.csv", asyncRoute(async (req, res) => {
  const data = await reportData(req.user!.organizationId, req.query);
  const rows = [
    ["Metric", "Value"],
    ["Pipeline value", data.summary.pipelineValue],
    ["Weighted value", data.summary.weightedValue],
    ["Won value", data.summary.wonValue],
    ["Win rate", data.summary.winRate],
    ["Lead conversion rate", data.summary.leadConversionRate],
    ["Overdue tasks", data.summary.overdueTasks],
    [],
    ["Owner", "Deals", "Pipeline", "Weighted", "Commit"],
    ...data.ownerForecast.map((row) => [row.owner, row.deals, row.pipeline, row.weighted, row.commit])
  ];
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", 'attachment; filename="crm-report.csv"');
  res.send(stringifyCsv(rows));
}));

router.get("/saved", asyncRoute(async (req, res) => {
  const reports = await prisma.customReport.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { name: "asc" }
  });
  res.json({ reports });
}));

router.post("/saved", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const input = parseBody(z.object({
    name: z.string().min(1).max(120),
    resource: z.enum(["DEALS", "LEADS", "TASKS"]),
    metric: z.enum(["COUNT", "VALUE"]),
    groupBy: z.enum(["STATUS", "OWNER", "STAGE", "SOURCE", "CAMPAIGN"]).optional().nullable(),
    filters: z.record(z.unknown()).default({})
  }), req.body);
  const report = await prisma.customReport.create({
    data: { ...input, filters: input.filters as Prisma.InputJsonValue, organizationId: req.user!.organizationId, createdById: req.user!.id }
  });
  res.status(201).json({ report });
}));

router.delete("/saved/:id", requireRole("ADMIN", "MANAGER"), asyncRoute(async (req, res) => {
  const result = await prisma.customReport.deleteMany({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!result.count) throw new HttpError("Report not found", 404);
  res.status(204).end();
}));

router.get("/", asyncRoute(async (req, res) => {
  res.json(await reportData(req.user!.organizationId, req.query));
}));

export default router;
