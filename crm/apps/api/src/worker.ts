import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { cleanupRateLimitBuckets } from "./middleware/rateLimit.js";
import { processBackgroundJobs, scheduleRecurringJobs } from "./services/backgroundJobs.js";
import { processTaskNotifications } from "./services/notifications.js";
import { processScheduledBackups } from "./services/scheduledBackups.js";
import { processTicketSlaPolicies } from "./services/supportSla.js";

let stopping = false;

async function runJobs() {
  if (stopping) return;
  try {
    await scheduleRecurringJobs();
    await processBackgroundJobs();
  } catch (error) {
    console.error("Background job processing failed", error);
  }
}

async function runMaintenance() {
  if (stopping) return;
  await Promise.allSettled([
    processTaskNotifications(),
    processTicketSlaPolicies(),
    processScheduledBackups(),
    cleanupRateLimitBuckets()
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") console.error("Worker maintenance failed", result.reason);
    }
  });
}

console.log("Hydria CRM worker started");
void runJobs();
void runMaintenance();

const jobTimer = setInterval(() => void runJobs(), env.JOB_POLL_INTERVAL_MS);
const maintenanceTimer = setInterval(() => void runMaintenance(), 60_000);

async function shutdown() {
  stopping = true;
  clearInterval(jobTimer);
  clearInterval(maintenanceTimer);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
