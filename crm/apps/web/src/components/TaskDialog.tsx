import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { Task, User } from "../types";
import { Dialog } from "./Dialog";

type TaskRelation = {
  contactId?: string;
  companyId?: string;
  dealId?: string;
  leadId?: string;
};

export function TaskDialog({
  open,
  onClose,
  onSaved,
  task = null,
  relation = {}
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  task?: Task | null;
  relation?: TaskRelation;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>("NONE");

  useEffect(() => {
    if (open) {
      setError("");
      setRecurrence(task?.recurrence || "NONE");
      api<{ users: User[] }>("/users").then((data) => setUsers(data.users)).catch(() => setUsers([]));
    }
  }, [open, task]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(task ? `/tasks/${task.id}` : "/tasks", {
        method: task ? "PATCH" : "POST",
        body: JSON.stringify({
          ...relation,
          title: data.title,
          description: data.description,
          priority: data.priority,
          status: data.status,
          assignedToId: data.assignedToId || null,
          dueAt: data.dueAt || null,
          reminderAt: data.reminderAt || null,
          recurrence: data.recurrence,
          recurrenceInterval: Number(data.recurrenceInterval || 1),
          recurrenceEndsAt: data.recurrenceEndsAt || null
        })
      });
      onClose();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create task");
    }
  }

  return (
    <Dialog title={task ? "Edit task" : "New task"} open={open} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit} key={task?.id || "new-task"}>
        <label>Title<input name="title" defaultValue={task?.title || ""} required /></label>
        <label>Description<textarea name="description" rows={3} defaultValue={task?.description || ""} /></label>
        <div className="form-grid">
          <label>Priority<select name="priority" defaultValue={task?.priority || "MEDIUM"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
          <label>Status<select name="status" defaultValue={task?.status || "TODO"}><option>TODO</option><option>IN_PROGRESS</option><option>DONE</option><option>CANCELED</option></select></label>
        </div>
        <div className="form-grid">
          <label>Assignee<select name="assignedToId" defaultValue={task?.assignedTo?.id || ""}><option value="">Assign to me</option>{users.map((user) => <option value={user.id} key={user.id}>{user.firstName} {user.lastName}</option>)}</select></label>
          <label>Due date<input name="dueAt" type="datetime-local" defaultValue={toLocalInput(task?.dueAt)} /></label>
        </div>
        <div className="form-grid">
          <label>Reminder<input name="reminderAt" type="datetime-local" defaultValue={toLocalInput(task?.reminderAt)} /></label>
          <label>Repeat<select name="recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value as Task["recurrence"])}><option value="NONE">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
        </div>
        {recurrence !== "NONE" && (
          <div className="form-grid">
            <label>Repeat every<input name="recurrenceInterval" type="number" min="1" max="52" defaultValue={task?.recurrenceInterval || 1} /></label>
            <label>Repeat until<input name="recurrenceEndsAt" type="date" defaultValue={task?.recurrenceEndsAt?.slice(0, 10) || ""} /></label>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">{task ? "Save changes" : "Create task"}</button></footer>
      </form>
    </Dialog>
  );
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
