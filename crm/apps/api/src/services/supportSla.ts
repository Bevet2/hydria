import type { Prisma, SupportQueue, Ticket, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type BusinessHours = {
  timezone?: string;
  weekdays?: Record<string, Array<[string, string]>>;
};

type EscalationLevel = {
  afterMinutes: number;
  priority?: TicketPriority;
  status?: TicketStatus;
};

const DEFAULT_HOURS: Required<BusinessHours> = {
  timezone: "Europe/Paris",
  weekdays: {
    "1": [["09:00", "17:00"]],
    "2": [["09:00", "17:00"]],
    "3": [["09:00", "17:00"]],
    "4": [["09:00", "17:00"]],
    "5": [["09:00", "17:00"]]
  }
};

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function jsonStrings(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map(String) : [];
}

function queueHours(queue?: Pick<SupportQueue, "businessHours"> | null): Required<BusinessHours> {
  const value = jsonObject(queue?.businessHours);
  const weekdays = jsonObject(value.weekdays as Prisma.JsonValue);
  return {
    timezone: String(value.timezone || DEFAULT_HOURS.timezone),
    weekdays: Object.keys(weekdays).length
      ? Object.fromEntries(
          Object.entries(weekdays).map(([day, intervals]) => [
            day,
            Array.isArray(intervals)
              ? intervals
                  .filter((item): item is [string, string] =>
                    Array.isArray(item) && item.length === 2
                  )
                  .map(([start, end]) => [String(start), String(end)])
              : []
          ])
        )
      : DEFAULT_HOURS.weekdays
  };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  return {
    weekday: weekdayMap[values.weekday || "Sun"] ?? 0,
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour || 0) * 60 + Number(values.minute || 0)
  };
}

function timeMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isBusinessMinute(
  date: Date,
  queue?: Pick<SupportQueue, "businessHours" | "holidays"> | null
) {
  const hours = queueHours(queue);
  const parts = zonedParts(date, hours.timezone);
  if (jsonStrings(queue?.holidays).includes(parts.date)) return false;
  return (hours.weekdays[String(parts.weekday)] || []).some(
    ([start, end]) =>
      parts.minutes >= timeMinutes(start) && parts.minutes < timeMinutes(end)
  );
}

export function addBusinessMinutes(
  start: Date,
  minutes: number,
  queue?: Pick<SupportQueue, "businessHours" | "holidays"> | null
) {
  const result = new Date(start);
  let remaining = Math.max(0, Math.trunc(minutes));
  let guard = 0;
  while (remaining > 0 && guard < 600_000) {
    result.setUTCMinutes(result.getUTCMinutes() + 1);
    if (isBusinessMinute(result, queue)) remaining -= 1;
    guard += 1;
  }
  return result;
}

export function ticketDeadlines(
  createdAt: Date,
  queue?: Pick<
    SupportQueue,
    "firstResponseMinutes" | "resolutionMinutes" | "businessHours" | "holidays"
  > | null
) {
  return {
    firstResponseDueAt: addBusinessMinutes(
      createdAt,
      queue?.firstResponseMinutes || 240,
      queue
    ),
    resolutionDueAt: addBusinessMinutes(
      createdAt,
      queue?.resolutionMinutes || 1440,
      queue
    )
  };
}

export async function routeTicketOwner(
  organizationId: string,
  queue?: Pick<SupportQueue, "id" | "routingStrategy"> | null
) {
  const users = await prisma.user.findMany({
    where: { organizationId, role: { not: "VIEWER" } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true }
  });
  if (!users.length) return null;
  if (queue?.routingStrategy === "LEAST_OPEN") {
    const counts = await prisma.ticket.groupBy({
      by: ["assignedToId"],
      where: {
        organizationId,
        queueId: queue.id,
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        assignedToId: { not: null }
      },
      _count: true
    });
    const byUser = new Map(
      counts.map((entry) => [entry.assignedToId, entry._count])
    );
    return [...users].sort(
      (left, right) =>
        Number(byUser.get(left.id) || 0) - Number(byUser.get(right.id) || 0)
    )[0]?.id || null;
  }
  const lastAssigned = await prisma.ticket.findFirst({
    where: {
      organizationId,
      queueId: queue?.id,
      assignedToId: { in: users.map((user) => user.id) }
    },
    orderBy: { createdAt: "desc" },
    select: { assignedToId: true }
  });
  const currentIndex = users.findIndex(
    (user) => user.id === lastAssigned?.assignedToId
  );
  return users[(currentIndex + 1) % users.length]?.id || users[0]?.id || null;
}

function escalationLevels(queue: SupportQueue): EscalationLevel[] {
  const configured = Array.isArray(queue.escalationPolicy)
    ? queue.escalationPolicy
        .map((value) => jsonObject(value as Prisma.JsonValue))
        .map((value) => ({
          afterMinutes: Math.max(1, Number(value.afterMinutes || 0)),
          priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(value.priority))
            ? String(value.priority) as TicketPriority
            : undefined,
          status: ["OPEN", "IN_PROGRESS", "WAITING"].includes(String(value.status))
            ? String(value.status) as TicketStatus
            : undefined
        }))
        .filter((value) => value.afterMinutes > 0)
    : [];
  return (configured.length
    ? configured
    : [{
        afterMinutes: queue.escalationAfterMinutes,
        priority: "URGENT" as TicketPriority,
        status: "IN_PROGRESS" as TicketStatus
      }]).sort((left, right) => left.afterMinutes - right.afterMinutes);
}

async function notifyTicket(
  ticket: Ticket,
  type: "TICKET_ESCALATED" | "TICKET_SLA_BREACH",
  title: string,
  body: string,
  suffix: string
) {
  if (!ticket.assignedToId) return;
  await prisma.notification.upsert({
    where: { eventKey: `ticket:${ticket.id}:${suffix}` },
    update: { title, body },
    create: {
      organizationId: ticket.organizationId,
      userId: ticket.assignedToId,
      type,
      eventKey: `ticket:${ticket.id}:${suffix}`,
      title,
      body
    }
  });
}

export async function processTicketSlaPolicies() {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    include: { queue: true }
  });
  const now = new Date();
  let updated = 0;
  for (const ticket of tickets) {
    const queue = ticket.queue;
    if (!queue) continue;
    const pauseStatuses = jsonStrings(queue.pauseStatuses);
    const paused = (pauseStatuses.length ? pauseStatuses : ["WAITING"]).includes(
      ticket.status
    );
    if (paused && !ticket.slaPausedAt) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaPausedAt: now }
      });
      updated += 1;
      continue;
    }
    if (!paused && ticket.slaPausedAt) {
      const pausedMs = Math.max(0, now.getTime() - ticket.slaPausedAt.getTime());
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          slaPausedAt: null,
          slaPausedMinutes: {
            increment: Math.ceil(pausedMs / 60_000)
          },
          firstResponseDueAt: ticket.firstResponseDueAt
            ? new Date(ticket.firstResponseDueAt.getTime() + pausedMs)
            : undefined,
          resolutionDueAt: ticket.resolutionDueAt
            ? new Date(ticket.resolutionDueAt.getTime() + pausedMs)
            : undefined
        }
      });
      updated += 1;
      continue;
    }
    if (paused) continue;

    const firstResponseBreached =
      !ticket.firstRespondedAt &&
      Boolean(ticket.firstResponseDueAt && ticket.firstResponseDueAt <= now);
    const resolutionBreached =
      Boolean(ticket.resolutionDueAt && ticket.resolutionDueAt <= now);
    if ((firstResponseBreached || resolutionBreached) && !ticket.slaBreachedAt) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreachedAt: now }
      });
      await prisma.ticketEvent.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          type: "SLA_BREACH",
          summary: firstResponseBreached
            ? "First response SLA breached"
            : "Resolution SLA breached"
        }
      });
      await notifyTicket(
        ticket,
        "TICKET_SLA_BREACH",
        `SLA breached for ${ticket.number}`,
        ticket.subject,
        "sla-breach"
      );
      updated += 1;
    }

    const levels = escalationLevels(queue);
    let targetLevel = ticket.escalationLevel;
    levels.forEach((level, index) => {
      const dueAt = addBusinessMinutes(ticket.createdAt, level.afterMinutes, queue);
      if (dueAt <= now) targetLevel = Math.max(targetLevel, index + 1);
    });
    if (targetLevel > ticket.escalationLevel) {
      const level = levels[targetLevel - 1]!;
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          escalationLevel: targetLevel,
          escalatedAt: now,
          priority: level.priority,
          status: level.status
        }
      });
      await prisma.ticketEvent.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          type: "ESCALATED",
          summary: `Ticket escalated to level ${targetLevel}`,
          metadata: level as unknown as Prisma.InputJsonValue
        }
      });
      await notifyTicket(
        ticket,
        "TICKET_ESCALATED",
        `Escalation level ${targetLevel}: ${ticket.number}`,
        ticket.subject,
        `escalation-${targetLevel}`
      );
      updated += 1;
    }
  }
  return updated;
}
