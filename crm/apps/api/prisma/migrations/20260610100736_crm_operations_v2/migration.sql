-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BackgroundJobType" ADD VALUE 'AUTOMATION_ACTION';
ALTER TYPE "BackgroundJobType" ADD VALUE 'SEQUENCE_STEP';

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "steps" JSONB;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "competitor" TEXT,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "territoryId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#167d68',
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "defaultTaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr-FR',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "quotePrefix" TEXT NOT NULL DEFAULT 'Q',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "territoryId" TEXT;

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countries" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "budget" DECIMAL(14,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "groupBy" TEXT,
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Territory_organizationId_active_idx" ON "Territory"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_organizationId_name_key" ON "Territory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_status_startsAt_idx" ON "Campaign"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_organizationId_name_key" ON "Campaign"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Sequence_organizationId_active_idx" ON "Sequence"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_organizationId_name_key" ON "Sequence"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_organizationId_status_nextRunAt_idx" ON "SequenceEnrollment"("organizationId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_status_idx" ON "SequenceEnrollment"("sequenceId", "status");

-- CreateIndex
CREATE INDEX "CustomReport_organizationId_resource_idx" ON "CustomReport"("organizationId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "CustomReport_organizationId_name_key" ON "CustomReport"("organizationId", "name");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "Deal_organizationId_campaignId_idx" ON "Deal"("organizationId", "campaignId");

-- CreateIndex
CREATE INDEX "Deal_organizationId_territoryId_idx" ON "Deal"("organizationId", "territoryId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_score_idx" ON "Lead"("organizationId", "score");

-- CreateIndex
CREATE INDEX "Lead_organizationId_campaignId_idx" ON "Lead"("organizationId", "campaignId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_territoryId_idx" ON "Lead"("organizationId", "territoryId");

-- CreateIndex
CREATE INDEX "User_organizationId_territoryId_idx" ON "User"("organizationId", "territoryId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomReport" ADD CONSTRAINT "CustomReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
