import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Download,
  ExternalLink,
  FileUp,
  MessageSquare,
  Send
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { HydriaAssistPanel } from "../components/HydriaAssistPanel";
import type { Attachment, Ticket } from "../types";

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not set";
}

function deadlineState(value?: string | null) {
  if (!value) return "neutral";
  return new Date(value).getTime() < Date.now() ? "breached" : "active";
}

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(async () => {
    try {
      const [ticketPayload, attachmentPayload] = await Promise.all([
        api<{ ticket: Ticket }>(`/tickets/${id}`),
        api<{ attachments: Attachment[] }>(`/attachments?entityType=TICKET&entityId=${id}`)
      ]);
      setTicket(ticketPayload.ticket);
      setAttachments(attachmentPayload.attachments);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load ticket");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: String(form.get("body") || ""),
        public: form.get("public") === "on"
      })
    });
    event.currentTarget.reset();
    await load();
  }

  async function uploadAttachment(file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("entityType", "TICKET");
    body.append("entityId", id);
    body.append("file", file);
    await api("/attachments", { method: "POST", body });
    await load();
  }

  async function escalate() {
    await api(`/tickets/${id}/escalate`, { method: "POST", body: JSON.stringify({}) });
    await load();
  }

  if (!ticket) {
    return <div className="page-loading">{error || "Loading ticket..."}</div>;
  }

  const portalUrl = `${window.location.origin}/crm/support/${ticket.portalToken}`;
  return (
    <div className="page ticket-detail-page">
      <header className="page-header">
        <div>
          <Link className="back-link" to="/tickets"><ArrowLeft size={15} />Tickets</Link>
          <p className="eyebrow">{ticket.number}</p>
          <h1>{ticket.subject}</h1>
          <p>{ticket.description || "No description"}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => {
            void navigator.clipboard?.writeText(portalUrl);
          }}><ExternalLink size={16} />Copy portal link</button>
          {canWrite && <button className="primary-button" onClick={() => void escalate()}>
            <AlertTriangle size={16} />Escalate
          </button>}
        </div>
      </header>
      {error && <p className="settings-error">{error}</p>}

      <section className="ticket-detail-summary">
        <div><span>Status</span><strong>{ticket.status.replaceAll("_", " ").toLowerCase()}</strong></div>
        <div><span>Queue</span><strong>{ticket.queue?.name || "Default"}</strong></div>
        <div className={`sla-${deadlineState(ticket.firstResponseDueAt)}`}>
          <span>First response SLA</span><strong>{ticket.firstRespondedAt ? `Met ${formatDate(ticket.firstRespondedAt)}` : formatDate(ticket.firstResponseDueAt)}</strong>
        </div>
        <div className={`sla-${deadlineState(ticket.resolutionDueAt)}`}>
          <span>Resolution SLA</span><strong>{formatDate(ticket.resolutionDueAt)}</strong>
        </div>
      </section>

      <div className="ticket-detail-grid">
        <section className="panel ticket-conversation">
          <div className="panel-heading"><div><p className="eyebrow">Conversation</p><h2>Customer exchanges</h2></div><MessageSquare size={19} /></div>
          <div className="ticket-message-list">
            {(ticket.messages || []).map((message) => (
              <article key={message.id} className={message.inbound ? "inbound" : "outbound"}>
                <div><strong>{message.author?.firstName || message.authorName || (message.inbound ? "Customer" : "Support")}</strong><span>{message.public ? "Public" : "Internal"} · {formatDate(message.createdAt)}</span></div>
                <p>{message.body}</p>
              </article>
            ))}
            {!ticket.messages?.length && <p className="empty-state">No exchange yet.</p>}
          </div>
          {canWrite && <form className="ticket-reply-form" onSubmit={(event) => void sendMessage(event)}>
            <textarea name="body" required rows={4} placeholder="Write a reply or an internal note" />
            <footer>
              <label className="check-label"><input type="checkbox" name="public" defaultChecked />Visible to customer</label>
              <button className="primary-button"><Send size={15} />Send</button>
            </footer>
          </form>}
        </section>

        <aside className="ticket-detail-side">
          <HydriaAssistPanel recordType="ticket" recordId={id} canWrite={canWrite} onExecuted={load} />
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Files</p><h2>Attachments</h2></div>
              {canWrite && <button className="icon-button" title="Upload file" onClick={() => fileInput.current?.click()}><FileUp size={17} /></button>}
            </div>
            <input ref={fileInput} hidden type="file" onChange={(event) => void uploadAttachment(event.target.files?.[0])} />
            <div className="ticket-attachment-list">
              {attachments.map((attachment) => <button key={attachment.id} onClick={() => void downloadFile(`/attachments/${attachment.id}/download`, attachment.originalName)}>
                <span>{attachment.originalName}<small>{Math.ceil(attachment.size / 1024)} KB</small></span><Download size={15} />
              </button>)}
              {!attachments.length && <p className="empty-state">No attachment.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>History</h2></div><Clock3 size={19} /></div>
            <div className="ticket-event-list">
              {(ticket.events || []).map((event) => <div key={event.id}><span /><p><strong>{event.summary}</strong><small>{formatDate(event.createdAt)}</small></p></div>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
