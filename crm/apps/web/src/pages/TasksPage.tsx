import { Check, CheckSquare, Circle, Clock3, Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import type { Task } from "../types";

const statusLabels = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", CANCELED: "Canceled" };

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api<{ tasks: Task[] }>("/tasks").then((data) => setTasks(data.tasks));
  }, []);
  useEffect(load, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/tasks", { method: "POST", body: JSON.stringify({ ...data, dueAt: data.dueAt || null }) });
    setOpen(false);
    load();
  }
  async function toggle(task: Task) {
    await api(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: task.status === "DONE" ? "TODO" : "DONE" }) });
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Follow-up</p><h1>Tasks</h1><p>Keep ownership and next actions visible</p></div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Task</button>
      </header>
      <section className="task-list">
        {tasks.map((task) => (
          <article key={task.id} className={task.status === "DONE" ? "is-done" : ""}>
            <button className="task-check" onClick={() => toggle(task)} aria-label="Toggle task">{task.status === "DONE" ? <Check size={16} /> : <Circle size={16} />}</button>
            <div><h2>{task.title}</h2><p>{task.description || task.company?.name || task.deal?.name || "General task"}</p></div>
            <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority.toLowerCase()}</span>
            <span className="task-status">{statusLabels[task.status]}</span>
            <span className="task-due"><Clock3 size={15} />{task.dueAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(task.dueAt)) : "No due date"}</span>
          </article>
        ))}
        {!tasks.length && <div className="empty-state"><CheckSquare size={24} /><p>No tasks yet.</p></div>}
      </section>
      <Dialog title="New task" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <label>Title<input name="title" required /></label>
          <label>Description<textarea name="description" rows={3} /></label>
          <div className="form-grid"><label>Priority<select name="priority"><option>LOW</option><option defaultValue="MEDIUM">MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label><label>Due date<input name="dueAt" type="date" /></label></div>
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create task</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
