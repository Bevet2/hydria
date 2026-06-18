import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) {
      res.json({ results: [] });
      return;
    }
    const organizationId = req.user!.organizationId;
    const [contacts, companies, leads, deals, products, tickets] = await prisma.$transaction([
      prisma.contact.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5
      }),
      prisma.company.findMany({
        where: { organizationId, name: { contains: query, mode: "insensitive" } },
        take: 5
      }),
      prisma.lead.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { companyName: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5
      }),
      prisma.deal.findMany({
        where: { organizationId, name: { contains: query, mode: "insensitive" } },
        take: 5
      }),
      prisma.product.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5
      }),
      prisma.ticket.findMany({
        where: {
          organizationId,
          OR: [
            { number: { contains: query, mode: "insensitive" } },
            { subject: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5
      })
    ]);
    res.json({
      results: [
        ...contacts.map((item) => ({
          id: item.id,
          type: "contact",
          label: `${item.firstName} ${item.lastName}`,
          meta: item.email || "Contact",
          path: `/contacts/${item.id}`
        })),
        ...companies.map((item) => ({
          id: item.id,
          type: "company",
          label: item.name,
          meta: item.industry || "Company",
          path: `/companies/${item.id}`
        })),
        ...leads.map((item) => ({
          id: item.id,
          type: "lead",
          label: `${item.firstName} ${item.lastName}`,
          meta: item.companyName || item.status,
          path: `/leads/${item.id}`
        })),
        ...deals.map((item) => ({
          id: item.id,
          type: "deal",
          label: item.name,
          meta: `${item.currency} ${Number(item.value).toLocaleString()}`,
          path: `/deals/${item.id}`
        })),
        ...products.map((item) => ({
          id: item.id,
          type: "product",
          label: item.name,
          meta: item.sku,
          path: "/products"
        })),
        ...tickets.map((item) => ({
          id: item.id,
          type: "ticket",
          label: item.subject,
          meta: `${item.number} | ${item.status.toLowerCase().replaceAll("_", " ")}`,
          path: "/tickets"
        }))
      ]
    });
  })
);

export default router;
