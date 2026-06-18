ALTER TYPE "WorkspaceEntityType" ADD VALUE IF NOT EXISTS 'TICKET';
ALTER TYPE "SavedViewResource" ADD VALUE IF NOT EXISTS 'TICKETS';

CREATE TABLE "SupportQueue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 240,
    "resolutionMinutes" INTEGER NOT NULL DEFAULT 1440,
    "escalationAfterMinutes" INTEGER NOT NULL DEFAULT 720,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportQueue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ticket"
  ADD COLUMN "queueId" TEXT,
  ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
  ADD COLUMN "firstRespondedAt" TIMESTAMP(3),
  ADD COLUMN "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "portalToken" TEXT;

UPDATE "Ticket" SET "portalToken" = md5(random()::text || clock_timestamp()::text || "id") WHERE "portalToken" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "portalToken" SET NOT NULL;

CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "body" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "inbound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportQueue_organizationId_name_key" ON "SupportQueue"("organizationId", "name");
CREATE INDEX "SupportQueue_organizationId_active_idx" ON "SupportQueue"("organizationId", "active");
CREATE UNIQUE INDEX "Ticket_portalToken_key" ON "Ticket"("portalToken");
CREATE INDEX "Ticket_organizationId_queueId_status_idx" ON "Ticket"("organizationId", "queueId", "status");
CREATE INDEX "Ticket_organizationId_resolutionDueAt_status_idx" ON "Ticket"("organizationId", "resolutionDueAt", "status");
CREATE INDEX "TicketMessage_organizationId_ticketId_createdAt_idx" ON "TicketMessage"("organizationId", "ticketId", "createdAt");
CREATE INDEX "TicketEvent_organizationId_ticketId_createdAt_idx" ON "TicketEvent"("organizationId", "ticketId", "createdAt");

ALTER TABLE "SupportQueue" ADD CONSTRAINT "SupportQueue_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
