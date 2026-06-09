import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { processTaskNotifications } from "./services/notifications.js";
import { processScheduledBackups } from "./services/scheduledBackups.js";
import { processBackgroundJobs, scheduleRecurringJobs } from "./services/backgroundJobs.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`Northstar CRM API listening on http://localhost:${env.API_PORT}/api`);
  void processTaskNotifications().catch((error) => console.error("Task notification processing failed", error));
  void scheduleRecurringJobs()
    .then(() => processBackgroundJobs())
    .catch((error) => console.error("Background job startup failed", error));
});

const notificationTimer = setInterval(() => {
  void processTaskNotifications().catch((error) => console.error("Task notification processing failed", error));
}, 60_000);
notificationTimer.unref();

const backupTimer = setInterval(() => {
  void processScheduledBackups().catch((error) => console.error("Scheduled backup processing failed", error));
}, 60_000);
backupTimer.unref();

const jobTimer = setInterval(() => {
  void scheduleRecurringJobs()
    .then(() => processBackgroundJobs())
    .catch((error) => console.error("Background job processing failed", error));
}, env.JOB_POLL_INTERVAL_MS);
jobTimer.unref();

async function shutdown() {
  clearInterval(notificationTimer);
  clearInterval(backupTimer);
  clearInterval(jobTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
