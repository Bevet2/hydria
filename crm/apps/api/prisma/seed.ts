import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Northstar123!", 12);
  const organization = await prisma.organization.upsert({
    where: { slug: "northstar-demo" },
    update: { name: "Hydria CRM" },
    create: { name: "Hydria CRM", slug: "northstar-demo" }
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@northstar.local" },
    update: { passwordHash, emailVerifiedAt: new Date() },
    create: {
      organizationId: organization.id,
      email: "admin@northstar.local",
      passwordHash,
      emailVerifiedAt: new Date(),
      firstName: "Alex",
      lastName: "Morgan",
      role: "ADMIN"
    }
  });

  let stages = await prisma.pipelineStage.findMany({
    where: { organizationId: organization.id },
    orderBy: { position: "asc" }
  });
  if (!stages.length) {
    await prisma.pipelineStage.createMany({
      data: [
        { organizationId: organization.id, name: "New", position: 0, color: "#667b74" },
        { organizationId: organization.id, name: "Qualified", position: 1, color: "#397f9c" },
        { organizationId: organization.id, name: "Proposal", position: 2, color: "#a76b2d" },
        { organizationId: organization.id, name: "Won", position: 3, color: "#167d68", isWon: true },
        { organizationId: organization.id, name: "Lost", position: 4, color: "#9d4b4b", isLost: true }
      ]
    });
    stages = await prisma.pipelineStage.findMany({
      where: { organizationId: organization.id },
      orderBy: { position: "asc" }
    });
  }

  await prisma.supportQueue.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Support" } },
    update: { active: true },
    create: {
      organizationId: organization.id,
      name: "Support",
      description: "Default queue for customer support and account follow-up.",
      firstResponseMinutes: 240,
      resolutionMinutes: 1440,
      escalationAfterMinutes: 720,
      routingStrategy: "LEAST_OPEN",
      active: true
    }
  });

  const count = await prisma.company.count({ where: { organizationId: organization.id } });
  if (count === 0) {
    const company = await prisma.company.create({
      data: {
        organizationId: organization.id,
        ownerId: admin.id,
        name: "Atlas Studio",
        domain: "atlas.example",
        industry: "Design",
        city: "Paris",
        country: "France"
      }
    });
    const contact = await prisma.contact.create({
      data: {
        organizationId: organization.id,
        ownerId: admin.id,
        companyId: company.id,
        firstName: "Camille",
        lastName: "Durand",
        email: "camille@atlas.example",
        jobTitle: "Operations Director",
        status: "qualified",
        source: "Referral"
      }
    });
    const deal = await prisma.deal.create({
      data: {
        organizationId: organization.id,
        ownerId: admin.id,
        companyId: company.id,
        primaryContactId: contact.id,
        stageId: stages[1]!.id,
        name: "Atlas workspace rollout",
        value: 18500,
        probability: 45,
        expectedCloseAt: new Date(Date.now() + 21 * 86400000)
      }
    });
    await prisma.task.create({
      data: {
        organizationId: organization.id,
        createdById: admin.id,
        assignedToId: admin.id,
        dealId: deal.id,
        companyId: company.id,
        title: "Prepare discovery call",
        priority: "HIGH",
        dueAt: new Date(Date.now() + 2 * 86400000)
      }
    });
    await prisma.activity.create({
      data: {
        organizationId: organization.id,
        actorId: admin.id,
        contactId: contact.id,
        companyId: company.id,
        dealId: deal.id,
        type: "RECORD_CREATED",
        subject: "Demo workspace initialized"
      }
    });
  }

  const workspaceProduct = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: organization.id,
        sku: "WORKSPACE-PRO"
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Workspace Pro",
      sku: "WORKSPACE-PRO",
      description: "Annual workspace subscription with advanced collaboration.",
      unitPrice: 4500,
      currency: "EUR"
    }
  });
  await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: organization.id,
        sku: "ONBOARDING"
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Implementation and onboarding",
      sku: "ONBOARDING",
      description: "Discovery, configuration, migration and team onboarding.",
      unitPrice: 5000,
      currency: "EUR"
    }
  });

  const atlasDeal = await prisma.deal.findFirst({
    where: { organizationId: organization.id, name: "Atlas workspace rollout" }
  });
  if (atlasDeal) {
    await prisma.deal.update({
      where: { id: atlasDeal.id },
      data: {
        value: 13500,
        forecastCategory: "BEST_CASE",
        nextStep: "Confirm stakeholders and implementation calendar."
      }
    });
    await prisma.dealLineItem.upsert({
      where: {
        dealId_productId: {
          dealId: atlasDeal.id,
          productId: workspaceProduct.id
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        dealId: atlasDeal.id,
        productId: workspaceProduct.id,
        quantity: 3,
        unitPrice: 4500,
        discountPercent: 0,
        lineTotal: 13500
      }
    });
  }

  const leadCount = await prisma.lead.count({ where: { organizationId: organization.id } });
  if (leadCount === 0) {
    await prisma.lead.createMany({
      data: [
        {
          organizationId: organization.id,
          ownerId: admin.id,
          firstName: "Nora",
          lastName: "Martin",
          companyName: "Beacon Retail",
          email: "nora@beacon.example",
          jobTitle: "VP Operations",
          source: "Website",
          status: "WORKING",
          rating: "HOT",
          annualRevenue: 4200000,
          employeeCount: 85,
          description: "Evaluating a consolidated workspace for the operations team."
        },
        {
          organizationId: organization.id,
          ownerId: admin.id,
          firstName: "Elias",
          lastName: "Bernard",
          companyName: "Mistral Conseil",
          email: "elias@mistral.example",
          jobTitle: "Managing Partner",
          source: "Event",
          status: "NEW",
          rating: "WARM",
          employeeCount: 24
        }
      ]
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
