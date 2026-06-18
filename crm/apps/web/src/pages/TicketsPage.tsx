import {
  Building2,
  Clock3,
  LifeBuoy,
  ListTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { DataTransferButtons } from "../components/DataTransferButtons";
import { Dialog } from "../components/Dialog";
import { ResourceOperationsBar } from "../components/ResourceOperationsBar";
import type { Company, Contact, SupportQueue, Ticket, User } from "../types";

const statusLabels = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [ownership, setOwnership] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [open, setOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<SupportQueue | null>(null);
  const [error, setError] = useState("");
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (ownership) params.set("assignedToId", ownership);
    if (search) params.set("search", search);
    api<{ tickets: Ticket[] }>(`/tickets?${params}`)
      .then((data) => {
        setTickets(data.tickets);
        setSelectedIds((current) => current.filter((id) => data.tickets.some((ticket) => ticket.id === id)));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load tickets"));
  }, [ownership, priority, search, status]);

  useEffect(load, [load]);
  useEffect(() => {
    void Promise.all([
      api<{ users: User[] }>("/users"),
      api<{ contacts: Contact[] }>("/contacts?limit=100"),
      api<{ companies: Company[] }>("/companies?limit=100"),
      api<{ queues: SupportQueue[] }>("/tickets/queues")
    ]).then(([userData, contactData, companyData, queueData]) => {
      setUsers(userData.users);
      setContacts(contactData.contacts);
      setCompanies(companyData.companies);
      setQueues(queueData.queues);
    });
  }, []);

  function openEditor(ticket: Ticket | null) {
    setSelected(ticket);
    setError("");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      subject: String(form.get("subject") || ""),
      description: String(form.get("description") || "") || null,
      status: String(form.get("status") || "OPEN"),
      priority: String(form.get("priority") || "MEDIUM"),
      source: String(form.get("source") || "MANUAL"),
      assignedToId: String(form.get("assignedToId") || "") || null,
      contactId: String(form.get("contactId") || "") || null,
      companyId: String(form.get("companyId") || "") || null,
      queueId: String(form.get("queueId") || "") || null,
      customerEmail: String(form.get("customerEmail") || "") || null,
      dueAt: String(form.get("dueAt") || "") || null
    };
    try {
      await api(selected ? `/tickets/${selected.id}` : "/tickets", {
        method: selected ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setOpen(false);
      setSelected(null);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save ticket");
    }
  }

  async function remove(ticket: Ticket) {
    if (!window.confirm(`Delete ticket ${ticket.number}?`)) return;
    await api(`/tickets/${ticket.id}`, { method: "DELETE" });
    load();
  }

  function toggleTicket(ticketId: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, ticketId])]
      : current.filter((id) => id !== ticketId)
    );
  }

  async function saveQueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedWorkdays = form.getAll("workdays").map(String);
    const start = String(form.get("businessStart") || "09:00");
    const end = String(form.get("businessEnd") || "17:00");
    const escalationAfterMinutes = Number(form.get("escalationAfterMinutes") || 720);
    const secondEscalation = Number(form.get("secondEscalationMinutes") || 0);
    const payload = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || "") || null,
      firstResponseMinutes: Number(form.get("firstResponseMinutes") || 240),
      resolutionMinutes: Number(form.get("resolutionMinutes") || 1440),
      escalationAfterMinutes,
      routingStrategy: String(form.get("routingStrategy") || "ROUND_ROBIN"),
      businessHours: {
        timezone: String(form.get("timezone") || "Europe/Paris"),
        weekdays: Object.fromEntries(
          selectedWorkdays.map((day) => [day, [[start, end]]])
        )
      },
      holidays: String(form.get("holidays") || "")
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
      pauseStatuses: form.getAll("pauseStatuses").map(String),
      escalationPolicy: [
        {
          afterMinutes: escalationAfterMinutes,
          priority: String(form.get("firstEscalationPriority") || "HIGH"),
          status: "IN_PROGRESS"
        },
        ...(secondEscalation > escalationAfterMinutes
          ? [{
              afterMinutes: secondEscalation,
              priority: String(form.get("secondEscalationPriority") || "URGENT"),
              status: "IN_PROGRESS"
            }]
          : [])
      ],
      active: form.get("active") === "on"
    };
    await api(selectedQueue ? `/tickets/queues/${selectedQueue.id}` : "/tickets/queues", {
      method: selectedQueue ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    const data = await api<{ queues: SupportQueue[] }>("/tickets/queues");
    setQueues(data.queues);
    setSelectedQueue(null);
    setQueueOpen(false);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Customer support</p>
          <h1>Tickets</h1>
          <p>Track customer issues, ownership and resolution</p>
        </div>
        <div className="header-actions">
          <DataTransferButtons resource="tickets" canImport={canWrite} onImported={load} />
          {canWrite && <button className="secondary-button" onClick={() => { setSelectedQueue(null); setQueueOpen(true); }}><ListTree size={16} />Queues</button>}
          {canWrite && <button className="primary-button" onClick={() => openEditor(null)}><Plus size={16} />Ticket</button>}
        </div>
      </header>

      {error && !open && <p className="settings-error">{error}</p>}
      <div className="toolbar filter-toolbar ticket-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Ticket status">
          <option value="">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Ticket priority">
          <option value="">All priorities</option>
          <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
        </select>
        <select value={ownership} onChange={(event) => setOwnership(event.target.value)} aria-label="Ticket ownership">
          <option value="">Everyone</option>
          <option value="me">Assigned to me</option>
          {users.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
        </select>
      </div>
      <ResourceOperationsBar
        resource="TICKETS"
        bulkResource="tickets"
        filters={{ search, status, priority, ownership }}
        onApplyFilters={(filters) => {
          setSearch(String(filters.search || ""));
          setStatus(String(filters.status || ""));
          setPriority(String(filters.priority || ""));
          setOwnership(String(filters.ownership || ""));
        }}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onRefresh={load}
        canWrite={canWrite}
        users={users}
        actions={[
          {
            value: "UPDATE_STATUS",
            label: "Update status",
            values: Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
          },
          { value: "ASSIGN_OWNER", label: "Assign owner" },
          { value: "DELETE", label: "Delete" }
        ]}
      />

      <section className="ticket-list">
        {tickets.map((ticket) => (
          <article key={ticket.id}>
            <div className={`ticket-priority priority-${ticket.priority.toLowerCase()}`} />
            {canWrite ? (
              <label className="ticket-selector">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(ticket.id)}
                  onChange={(event) => toggleTicket(ticket.id, event.target.checked)}
                  aria-label={`Select ${ticket.number}`}
                />
              </label>
            ) : <span className="ticket-selector" />}
            <div className="ticket-main">
              <div className="ticket-title-row">
                <strong><Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link></strong>
                <span>{ticket.number}</span>
              </div>
              <p>{ticket.description || "No description"}</p>
              <div className="ticket-meta">
                {ticket.assignedTo && <span><UserRound size={13} />{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</span>}
                {ticket.company && <span><Building2 size={13} />{ticket.company.name}</span>}
                {ticket.contact && <span><UserRound size={13} />{ticket.contact.firstName} {ticket.contact.lastName}</span>}
                {ticket.dueAt && <span><Clock3 size={13} />{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(ticket.dueAt))}</span>}
                {ticket.queue && <span><LifeBuoy size={13} />{ticket.queue.name}</span>}
              </div>
            </div>
            <span className={`ticket-status status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status]}</span>
            <span className={`priority priority-${ticket.priority.toLowerCase()}`}>{ticket.priority.toLowerCase()}</span>
            {canWrite && (
              <div className="ticket-actions">
                <button className="icon-button" onClick={() => openEditor(ticket)} aria-label={`Edit ${ticket.number}`} title="Edit ticket"><Pencil size={15} /></button>
                <button className="icon-button danger-icon" onClick={() => void remove(ticket)} aria-label={`Delete ${ticket.number}`} title="Delete ticket"><Trash2 size={15} /></button>
              </div>
            )}
          </article>
        ))}
        {!tickets.length && <div className="empty-state"><LifeBuoy size={24} /><p>No tickets match these filters.</p></div>}
      </section>

      <Dialog title={selected ? `Edit ${selected.number}` : "New ticket"} open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={save}>
          <label>Subject<input name="subject" required defaultValue={selected?.subject || ""} /></label>
          <label>Description<textarea name="description" rows={4} defaultValue={selected?.description || ""} /></label>
          <div className="form-grid">
            <label>Status<select name="status" defaultValue={selected?.status || "OPEN"}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Priority<select name="priority" defaultValue={selected?.priority || "MEDIUM"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
          </div>
          <div className="form-grid">
            <label>Queue<select name="queueId" defaultValue={selected?.queue?.id || ""}><option value="">Default queue</option>{queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}</select></label>
            <label>Customer email<input name="customerEmail" type="email" defaultValue={selected?.customerEmail || ""} /></label>
          </div>
          <div className="form-grid">
            <label>Owner<select name="assignedToId" defaultValue={selected?.assignedTo?.id || user?.id || ""}><option value="">Unassigned</option>{users.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
            <label>Due date<input name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(selected?.dueAt)} /></label>
          </div>
          <div className="form-grid">
            <label>Contact<select name="contactId" defaultValue={selected?.contact?.id || ""}><option value="">No contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></label>
            <label>Company<select name="companyId" defaultValue={selected?.company?.id || ""}><option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          </div>
          <label>Source<select name="source" defaultValue={selected?.source || "MANUAL"}><option>MANUAL</option><option>EMAIL</option><option>PHONE</option><option>WEB</option><option>CHAT</option></select></label>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">{selected ? "Save changes" : "Create ticket"}</button></footer>
        </form>
      </Dialog>
      <Dialog title={selectedQueue ? `Edit ${selectedQueue.name}` : "Support queues"} open={queueOpen} onClose={() => setQueueOpen(false)}>
        <div className="support-queue-picker">
          {queues.map((queue) => <button type="button" key={queue.id} onClick={() => setSelectedQueue(queue)}>
            <span><strong>{queue.name}</strong><small>{queue._count?.tickets || 0} tickets</small></span>
            <span>{queue.firstResponseMinutes}m / {queue.resolutionMinutes}m</span>
          </button>)}
        </div>
        <form className="dialog-form" onSubmit={(event) => void saveQueue(event)} key={selectedQueue?.id || "new"}>
          <label>Name<input name="name" required defaultValue={selectedQueue?.name || ""} /></label>
          <label>Description<textarea name="description" rows={2} defaultValue={selectedQueue?.description || ""} /></label>
          <div className="form-grid">
            <label>First response (minutes)<input name="firstResponseMinutes" type="number" min={5} defaultValue={selectedQueue?.firstResponseMinutes || 240} /></label>
            <label>Resolution (minutes)<input name="resolutionMinutes" type="number" min={15} defaultValue={selectedQueue?.resolutionMinutes || 1440} /></label>
          </div>
          <div className="form-grid">
            <label>Routing<select name="routingStrategy" defaultValue={selectedQueue?.routingStrategy || "ROUND_ROBIN"}><option value="ROUND_ROBIN">Round robin</option><option value="LEAST_OPEN">Least open tickets</option></select></label>
            <label>Timezone<input name="timezone" defaultValue={selectedQueue?.businessHours?.timezone || "Europe/Paris"} /></label>
          </div>
          <div className="form-grid">
            <label>Business day starts<input name="businessStart" type="time" defaultValue={selectedQueue?.businessHours?.weekdays?.["1"]?.[0]?.[0] || "09:00"} /></label>
            <label>Business day ends<input name="businessEnd" type="time" defaultValue={selectedQueue?.businessHours?.weekdays?.["1"]?.[0]?.[1] || "17:00"} /></label>
          </div>
          <fieldset className="queue-policy-fieldset"><legend>Business days</legend>
            {[["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]].map(([value, label]) => <label className="check-label" key={value}><input name="workdays" value={value} type="checkbox" defaultChecked={Boolean(selectedQueue?.businessHours?.weekdays?.[value]?.length ?? ["1", "2", "3", "4", "5"].includes(value))} />{label}</label>)}
          </fieldset>
          <label>Holidays<textarea name="holidays" rows={2} placeholder="2026-12-25, 2027-01-01" defaultValue={(selectedQueue?.holidays || []).join("\n")} /></label>
          <fieldset className="queue-policy-fieldset"><legend>Pause SLA while</legend>
            {["OPEN", "IN_PROGRESS", "WAITING"].map((value) => <label className="check-label" key={value}><input name="pauseStatuses" value={value} type="checkbox" defaultChecked={(selectedQueue?.pauseStatuses || ["WAITING"]).includes(value as "OPEN" | "IN_PROGRESS" | "WAITING")} />{statusLabels[value as keyof typeof statusLabels]}</label>)}
          </fieldset>
          <div className="form-grid">
            <label>First escalation (minutes)<input name="escalationAfterMinutes" type="number" min={5} defaultValue={selectedQueue?.escalationPolicy?.[0]?.afterMinutes || selectedQueue?.escalationAfterMinutes || 720} /></label>
            <label>Priority<select name="firstEscalationPriority" defaultValue={selectedQueue?.escalationPolicy?.[0]?.priority || "HIGH"}><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
          </div>
          <div className="form-grid">
            <label>Second escalation (minutes)<input name="secondEscalationMinutes" type="number" min={5} defaultValue={selectedQueue?.escalationPolicy?.[1]?.afterMinutes || 1440} /></label>
            <label>Priority<select name="secondEscalationPriority" defaultValue={selectedQueue?.escalationPolicy?.[1]?.priority || "URGENT"}><option>HIGH</option><option>URGENT</option></select></label>
          </div>
          <label className="check-label"><input name="active" type="checkbox" defaultChecked={selectedQueue?.active ?? true} />Active queue</label>
          <footer><button type="button" className="secondary-button" onClick={() => setSelectedQueue(null)}>New queue</button><button className="primary-button">{selectedQueue ? "Save queue" : "Create queue"}</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
