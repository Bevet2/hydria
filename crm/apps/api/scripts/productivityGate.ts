import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.CRM_API_URL || "http://localhost:4010/api";
const suffix = Date.now();
let token = "";
let organizationId = "";

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function login(email: string, password: string) {
  const result = await request<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  token = result.token;
}

async function main() {
  const adminEmail = `productivity-admin-${suffix}@example.com`;
  const memberEmail = `productivity-member-${suffix}@example.com`;
  const adminPassword = "Productivity123!";
  const memberPassword = "MemberProductivity123!";
  const registration = await request<{
    token: string;
    user: { organizationId: string };
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      organizationName: `Productivity Gate ${suffix}`,
      firstName: "Productivity",
      lastName: "Admin",
      email: adminEmail,
      password: adminPassword
    })
  });
  token = registration.token;
  organizationId = registration.user.organizationId;

  const member = await request<{ user: { id: string } }>("/users", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Productivity",
      lastName: "Member",
      email: memberEmail,
      password: memberPassword,
      role: "MEMBER"
    })
  });

  const now = Date.now();
  const dueAt = new Date(now - 60 * 60_000);
  const reminderAt = new Date(now - 2 * 60 * 60_000);
  const recurrenceEndsAt = new Date(now + 3 * 86400_000);
  const created = await request<{ task: { id: string } }>("/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: `Recurring follow-up ${suffix}`,
      status: "TODO",
      priority: "HIGH",
      assignedToId: member.user.id,
      dueAt: dueAt.toISOString(),
      reminderAt: reminderAt.toISOString(),
      recurrence: "DAILY",
      recurrenceInterval: 1,
      recurrenceEndsAt: recurrenceEndsAt.toISOString()
    })
  });

  await login(memberEmail, memberPassword);
  const memberNotifications = await request<{
    notifications: Array<{ id: string; type: string; readAt?: string | null }>;
    unreadCount: number;
  }>("/notifications?limit=20");
  const types = new Set(memberNotifications.notifications.map((item) => item.type));
  for (const expected of ["TASK_ASSIGNED", "TASK_REMINDER", "TASK_OVERDUE"]) {
    if (!types.has(expected)) throw new Error(`Missing ${expected} notification`);
  }
  if (memberNotifications.unreadCount < 3) throw new Error("Unread notification count is incorrect");

  await request(`/notifications/${memberNotifications.notifications[0]!.id}/read`, { method: "PATCH" });
  await request("/notifications/read-all", { method: "POST" });
  const readState = await request<{ unreadCount: number }>("/notifications?limit=20");
  if (readState.unreadCount !== 0) throw new Error("Notifications were not marked as read");

  const completed = await request<{
    task: { id: string; status: string };
    nextTask: { id: string; status: string; dueAt: string; recurrenceSeriesId: string } | null;
  }>(`/tasks/${created.task.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "DONE" })
  });
  if (completed.task.status !== "DONE" || !completed.nextTask) {
    throw new Error("Completing a recurring task did not create the next occurrence");
  }
  const expectedNextDue = dueAt.getTime() + 86400_000;
  if (Math.abs(new Date(completed.nextTask.dueAt).getTime() - expectedNextDue) > 1000) {
    throw new Error("Next recurring task has the wrong due date");
  }
  if (completed.nextTask.recurrenceSeriesId !== created.task.id) {
    throw new Error("Recurring task series was not linked");
  }

  await login(adminEmail, adminPassword);
  const adminNotifications = await request<{
    notifications: Array<{ type: string; taskId?: string | null }>;
  }>("/notifications?limit=20");
  if (!adminNotifications.notifications.some(
    (item) => item.type === "TASK_COMPLETED" && item.taskId === created.task.id
  )) {
    throw new Error("Task creator did not receive the completion notification");
  }

  console.log(JSON.stringify({
    ok: true,
    assignment: true,
    reminder: true,
    overdue: true,
    readState: true,
    recurrence: true,
    completion: true
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });
