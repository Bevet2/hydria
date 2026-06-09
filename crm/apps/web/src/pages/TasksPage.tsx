import { BellRing, Check, CheckSquare, Circle, Clock3, Pencil, Plus, Repeat2, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { TaskDialog } from "../components/TaskDialog";
import { DataTransferButtons } from "../components/DataTransferButtons";
import { ResourceOperationsBar } from "../components/ResourceOperationsBar";
import type { Task, User } from "../types";

const statusLabels = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", CANCELED: "Canceled" };

function taskContext(task: Task) {
  if (task.deal) return `Deal: ${task.deal.name}`;
  if (task.company) return `Company: ${task.company.name}`;
  if (task.contact) return `Contact: ${task.contact.firstName} ${task.contact.lastName}`;
  if (task.lead) return `Lead: ${task.lead.firstName} ${task.lead.lastName}`;
  return task.description || "General task";
}

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [ownership, setOwnership] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (ownership) params.set("assignedToId", ownership);
    if (overdue) params.set("overdue", "true");
    if (recurring) params.set("recurring", "true");
    api<{ tasks: Task[] }>(`/tasks?${params}`).then((data) => setTasks(data.tasks));
  }, [overdue, ownership, priority, recurring, status]);

  useEffect(load, [load]);
  useEffect(() => { void api<{ users: User[] }>("/users").then((data) => setUsers(data.users)); }, []);

  async function toggle(task: Task) {
    await api(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: task.status === "DONE" ? "TODO" : "DONE" }) });
    load();
  }

  async function remove(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    await api(`/tasks/${task.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Follow-up</p><h1>Tasks</h1><p>Keep ownership, deadlines and next actions visible</p></div>
        <div className="header-actions"><DataTransferButtons resource="tasks" canImport={canWrite} onImported={load} />{canWrite && <button className="primary-button" onClick={() => { setSelectedTask(null); setOpen(true); }}><Plus size={16} />Task</button>}</div>
      </header>
      <div className="toolbar filter-toolbar task-toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Task status"><option value="">All statuses</option><option>TODO</option><option>IN_PROGRESS</option><option>DONE</option><option>CANCELED</option></select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Task priority"><option value="">All priorities</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select>
        <select value={ownership} onChange={(event) => setOwnership(event.target.value)} aria-label="Task ownership"><option value="">Everyone</option><option value="me">Assigned to me</option></select>
        <label className="check-filter"><input type="checkbox" checked={overdue} onChange={(event) => setOverdue(event.target.checked)} />Overdue only</label>
        <label className="check-filter"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />Recurring only</label>
      </div>
      <ResourceOperationsBar
        resource="TASKS"
        bulkResource="tasks"
        filters={{ status, priority, ownership, overdue, recurring }}
        onApplyFilters={(filters) => {
          setStatus(String(filters.status || ""));
          setPriority(String(filters.priority || ""));
          setOwnership(String(filters.ownership || ""));
          setOverdue(Boolean(filters.overdue));
          setRecurring(Boolean(filters.recurring));
        }}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onRefresh={load}
        canWrite={canWrite}
        users={users}
        actions={[
          { value: "ASSIGN_OWNER", label: "Assign owner" },
          { value: "UPDATE_STATUS", label: "Update status", values: ["TODO", "IN_PROGRESS", "DONE", "CANCELED"].map((value) => ({ value, label: value.toLowerCase().replaceAll("_", " ") })) },
          { value: "DELETE", label: "Delete" }
        ]}
      />
      <section className="task-list">
        {tasks.map((task) => (
          <article key={task.id} className={task.status === "DONE" ? "is-done" : ""}>
            {canWrite && <label className="record-selector inline-selector"><input type="checkbox" checked={selectedIds.includes(task.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} aria-label={`Select ${task.title}`} /></label>}
            <button className="task-check" onClick={() => toggle(task)} aria-label="Toggle task" disabled={!canWrite}>{task.status === "DONE" ? <Check size={16} /> : <Circle size={16} />}</button>
            <div>
              <h2>{task.title}</h2>
              <p>{taskContext(task)}</p>
              <div className="task-meta">
                {task.assignedTo && <small className="task-owner"><UserRound size={12} />{task.assignedTo.firstName} {task.assignedTo.lastName}</small>}
                {task.reminderAt && <small><BellRing size={12} />Reminder {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.reminderAt))}</small>}
                {task.recurrence !== "NONE" && <small><Repeat2 size={12} />Every {task.recurrenceInterval > 1 ? `${task.recurrenceInterval} ` : ""}{task.recurrence.toLowerCase().replace("daily", "day").replace("weekly", "week").replace("monthly", "month")}{task.recurrenceInterval > 1 ? "s" : ""}</small>}
              </div>
            </div>
            <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority.toLowerCase()}</span>
            <span className="task-status">{statusLabels[task.status]}</span>
            <span className="task-due"><Clock3 size={15} />{task.dueAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.dueAt)) : "No due date"}</span>
            {canWrite && <div className="task-actions">
              <button className="icon-button" title={`Edit ${task.title}`} aria-label={`Edit ${task.title}`} onClick={() => { setSelectedTask(task); setOpen(true); }}><Pencil size={15} /></button>
              <button className="icon-button danger-icon" title={`Delete ${task.title}`} aria-label={`Delete ${task.title}`} onClick={() => remove(task)}><Trash2 size={15} /></button>
            </div>}
          </article>
        ))}
        {!tasks.length && <div className="empty-state"><CheckSquare size={24} /><p>No tasks match these filters.</p></div>}
      </section>
      <TaskDialog
        open={open}
        task={selectedTask}
        onClose={() => { setOpen(false); setSelectedTask(null); }}
        onSaved={load}
      />
    </div>
  );
}
