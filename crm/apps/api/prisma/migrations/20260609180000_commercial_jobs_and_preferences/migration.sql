ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "WorkspaceEntityType" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "SavedViewResource" ADD VALUE IF NOT EXISTS 'PRODUCTS';
ALTER TYPE "SavedViewResource" ADD VALUE IF NOT EXISTS 'QUOTES';
ALTER TYPE "SavedViewResource" ADD VALUE IF NOT EXISTS 'INVOICES';

CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "BackgroundJobType" AS ENUM ('EMAIL_SEND', 'WEBHOOK_DELIVERY', 'INTEGRATION_SYNC', 'INVOICE_REMINDER');
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

ALTER TABLE "EmailMessage"
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "inReplyTo" TEXT,
  ADD COLUMN "direction" "EmailDirection" NOT NULL DEFAULT 'OUTBOUND';

ALTER TABLE "Invoice"
  ADD COLUMN "reminderAt" TIMESTAMP(3),
  ADD COLUMN "lastReminderAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "CreditNote" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackgroundJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "BackgroundJobType" NOT NULL,
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DashboardPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "widgets" JSONB NOT NULL,
  "layout" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditNote_organizationId_number_key" ON "CreditNote"("organizationId", "number");
CREATE INDEX "CreditNote_organizationId_invoiceId_createdAt_idx" ON "CreditNote"("organizationId", "invoiceId", "createdAt");
CREATE INDEX "BackgroundJob_status_runAt_createdAt_idx" ON "BackgroundJob"("status", "runAt", "createdAt");
CREATE INDEX "BackgroundJob_organizationId_type_status_createdAt_idx" ON "BackgroundJob"("organizationId", "type", "status", "createdAt");
CREATE UNIQUE INDEX "DashboardPreference_userId_key" ON "DashboardPreference"("userId");
CREATE INDEX "DashboardPreference_organizationId_userId_idx" ON "DashboardPreference"("organizationId", "userId");
CREATE INDEX "EmailMessage_organizationId_conversationId_createdAt_idx" ON "EmailMessage"("organizationId", "conversationId", "createdAt");

ALTER TABLE "CreditNote"
  ADD CONSTRAINT "CreditNote_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote"
  ADD CONSTRAINT "CreditNote_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackgroundJob"
  ADD CONSTRAINT "BackgroundJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardPreference"
  ADD CONSTRAINT "DashboardPreference_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardPreference"
  ADD CONSTRAINT "DashboardPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
