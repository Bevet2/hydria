-- CreateEnum
CREATE TYPE "TaskRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_REMINDER', 'TASK_OVERDUE', 'TASK_COMPLETED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "recurrence" "TaskRecurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recurrenceEndsAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "recurrenceProcessedAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceSeriesId" TEXT,
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "NotificationType" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_readAt_createdAt_idx" ON "Notification"("organizationId", "userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_reminderAt_reminderSentAt_idx" ON "Task"("organizationId", "reminderAt", "reminderSentAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_recurrenceSeriesId_idx" ON "Task"("organizationId", "recurrenceSeriesId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
