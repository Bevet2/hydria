import { AlertTriangle, CalendarPlus, Download, ExternalLink, Link2, MailPlus, Paperclip, Pencil, Plug, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";

type Connection = {
  id: string;
  provider: string;
  status: string;
  externalEmail?: string | null;
  lastSyncAt?: string | null;
};
type Template = { id: string; name: string; subject: string; body: string; shared?: boolean };
type Message = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  replyReceivedAt?: string | null;
  metadata?: { direction?: string; from?: string } | null;
  direction?: "INBOUND" | "OUTBOUND";
  attachments?: Array<{ id: string; originalName: string; mimeType: string; size: number }>;
};
type Conversation = { id: string; subject: string; lastMessageAt: string; unreadReplies: number; messages: Message[] };
type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  status: string;
};
type OAuthProvider = "GOOGLE" | "MICROSOFT";
type OAuthProviderConfig = {
  configured: boolean;
  missing: string[];
  setupUrl: string;
};
type OAuthConfig = {
  redirectUri: string;
  providers: Record<OAuthProvider, OAuthProviderConfig>;
};

const oauthChannelName = "northstar-crm-oauth";

export function CommunicationsPage() {
  const { user } = useAuth();
  const pendingOAuthState = useRef("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [oauthBusy, setOauthBusy] = useState(false);
  const [setupProvider, setSetupProvider] = useState<OAuthProvider | null>(null);
  const [composeFile, setComposeFile] = useState<File | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [error, setError] = useState("");
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(async () => {
    const [connectionData, templateData, conversationData, calendarData, providerConfig] = await Promise.all([
      api<{ connections: Connection[] }>("/integrations"),
      api<{ templates: Template[] }>("/communications/templates"),
      api<{ conversations: Conversation[] }>(
        `/communications/conversations${conversationSearch ? `?search=${encodeURIComponent(conversationSearch)}` : ""}`
      ),
      api<{ events: CalendarEvent[] }>("/communications/calendar"),
      api<OAuthConfig>("/integrations/oauth/config")
    ]);
    setConnections(connectionData.connections);
    setTemplates(templateData.templates);
    setConversations(conversationData.conversations);
    setSelectedConversationId((current) => {
      if (current && conversationData.conversations.some((item) => item.id === current)) return current;
      return conversationData.conversations[0]?.id || "";
    });
    setEvents(calendarData.events);
    setOauthConfig(providerConfig);
  }, [conversationSearch]);

  useEffect(() => {
    void load().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load communications");
    });
  }, [load]);

  useEffect(() => {
    function receiveResult(result: { ok?: boolean; error?: string; state?: string }) {
      if (!result.state || result.state !== pendingOAuthState.current) return;
      pendingOAuthState.current = "";
      setOauthBusy(false);
      if (result.ok) {
        setError("");
        void load();
      } else if (result.error) {
        setError(result.error);
      }
    }
    function receiveWindowMessage(event: MessageEvent) {
      if (event.data?.type !== "northstar-oauth-result") return;
      const callbackOrigin = oauthConfig ? new URL(oauthConfig.redirectUri).origin : "";
      if (!callbackOrigin || event.origin !== callbackOrigin) return;
      receiveResult(event.data);
    }
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(oauthChannelName) : null;
    if (channel) channel.onmessage = (event) => receiveResult(event.data);
    window.addEventListener("message", receiveWindowMessage);
    return () => {
      channel?.close();
      window.removeEventListener("message", receiveWindowMessage);
    };
  }, [load, oauthConfig]);

  const emailConnections = connections.filter((connection) => ["GOOGLE", "MICROSOFT"].includes(connection.provider));
  const template = useMemo(
    () => templates.find((item) => item.id === selectedTemplate),
    [selectedTemplate, templates]
  );
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  async function selectConversation(conversation: Conversation) {
    setSelectedConversationId(conversation.id);
    if (!conversation.unreadReplies) return;
    await api(`/communications/conversations/${encodeURIComponent(conversation.id)}/read`, { method: "POST" });
    setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unreadReplies: 0 } : item));
  }

  async function replyToConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || !replyBody.trim() || !emailConnections.length) return;
    setReplyBusy(true);
    try {
      await api(`/communications/conversations/${encodeURIComponent(selectedConversation.id)}/reply`, {
        method: "POST",
        body: JSON.stringify({ connectionId: emailConnections[0].id, body: replyBody.trim() })
      });
      setReplyBody("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send reply");
    } finally {
      setReplyBusy(false);
    }
  }

  async function connect(provider: OAuthProvider) {
    if (!oauthConfig?.providers[provider].configured) {
      setSetupProvider(provider);
      return;
    }
    setError("");
    setOauthBusy(true);
    try {
      const data = await api<{ authorizationUrl: string; state: string }>(
        `/integrations/oauth/${provider}/start`,
        { method: "POST", body: JSON.stringify({}) }
      );
      pendingOAuthState.current = data.state;
      const popup = window.open(
        data.authorizationUrl,
        `northstar-${provider.toLowerCase()}-oauth`,
        "popup=yes,width=620,height=760,resizable=yes,scrollbars=yes"
      );
      if (!popup) window.location.assign(data.authorizationUrl);
      else {
        const closeMonitor = window.setInterval(() => {
          if (!popup.closed) return;
          window.clearInterval(closeMonitor);
          setOauthBusy(false);
        }, 500);
      }
    } catch (cause) {
      pendingOAuthState.current = "";
      setOauthBusy(false);
      setError(cause instanceof Error ? cause.message : "Unable to start OAuth");
    }
  }

  async function sync(connection: Connection) {
    try {
      await api(`/integrations/${connection.id}/sync`, { method: "POST" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync failed");
    }
  }

  async function disconnect(connection: Connection) {
    if (!window.confirm(`Disconnect ${connection.provider}?`)) return;
    await api(`/integrations/${connection.id}`, { method: "DELETE" });
    await load();
  }

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api<{ message: Message }>("/communications/messages", { method: "POST", body: JSON.stringify(data) });
    if (composeFile) {
      const attachment = new FormData();
      attachment.append("entityType", "EMAIL");
      attachment.append("entityId", result.message.id);
      attachment.append("file", composeFile);
      await api("/attachments", { method: "POST", body: attachment });
    }
    setComposeFile(null);
    setComposeOpen(false);
    await load();
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(editingTemplate ? `/communications/templates/${editingTemplate.id}` : "/communications/templates", {
      method: editingTemplate ? "PATCH" : "POST",
      body: JSON.stringify({ ...data, shared: data.shared === "on" })
    });
    setTemplateOpen(false);
    setEditingTemplate(null);
    await load();
  }

  async function removeTemplate(item: Template) {
    if (!window.confirm(`Delete template "${item.name}"?`)) return;
    await api(`/communications/templates/${item.id}`, { method: "DELETE" });
    await load();
  }

  async function createConnector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/integrations/custom", {
      method: "POST",
      body: JSON.stringify({
        provider: data.provider,
        accessToken: data.accessToken || undefined,
        externalAccountId: data.externalAccountId || undefined,
        metadata: { endpoint: data.endpoint }
      })
    });
    setConnectorOpen(false);
    await load();
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/communications/calendar", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        connectionId: data.connectionId || null,
        attendeeEmails: String(data.attendeeEmails || "").split(",").map((value) => value.trim()).filter(Boolean),
        startsAt: new Date(String(data.startsAt)).toISOString(),
        endsAt: new Date(String(data.endsAt)).toISOString()
      })
    });
    setEventOpen(false);
    await load();
  }

  async function cancelEvent(item: CalendarEvent) {
    if (!window.confirm(`Cancel "${item.title}"?`)) return;
    await api(`/communications/calendar/${item.id}`, { method: "DELETE" });
    await load();
  }

  const providerButton = (provider: OAuthProvider, label: string) => {
    const configured = Boolean(oauthConfig?.providers[provider].configured);
    return (
      <button
        className="secondary-button"
        disabled={!oauthConfig || oauthBusy}
        title={configured ? `Connect ${label}` : `Configure ${label} OAuth`}
        onClick={() => connect(provider)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Customer communication</p>
          <h1>Email & calendar</h1>
          <p>Connected conversations, templates and meetings</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" disabled={!canWrite} onClick={() => { setEditingTemplate(null); setTemplateOpen(true); }}>Template</button>
          <button className="secondary-button" disabled={!canWrite} onClick={() => setConnectorOpen(true)}><Plug size={16} />Connector</button>
          <button className="secondary-button" disabled={!canWrite} onClick={() => setEventOpen(true)}>
            <CalendarPlus size={16} />Meeting
          </button>
          <button className="primary-button" disabled={!canWrite || !emailConnections.length} onClick={() => setComposeOpen(true)}>
            <MailPlus size={16} />Email
          </button>
        </div>
      </header>
      {error && <p className="settings-error">{error}</p>}

      <section className="settings-section">
        <div className="section-title">
          <div>
            <Link2 size={19} />
            <span><h2>Connected accounts</h2><p>Google Workspace and Microsoft 365</p></span>
          </div>
          <div className="header-actions">
            {providerButton("GOOGLE", "Google")}
            {providerButton("MICROSOFT", "Microsoft")}
          </div>
        </div>
        {oauthConfig && (!oauthConfig.providers.GOOGLE.configured || !oauthConfig.providers.MICROSOFT.configured) && (
          <div className="oauth-config-warning">
            <AlertTriangle size={17} />
            <div>
              <strong>OAuth setup required</strong>
              <p>Google or Microsoft credentials are missing. Select a provider to see the required configuration.</p>
              <small>Callback URI: <code>{oauthConfig.redirectUri}</code></small>
            </div>
          </div>
        )}
        <div className="member-list">
          {connections.map((connection) => (
            <div key={connection.id}>
              <span className="avatar">{connection.provider[0]}</span>
              <p>
                <strong>{connection.provider}</strong>
                <small>{connection.externalEmail || connection.status.toLowerCase()}</small>
              </p>
              <div className="row-actions">
                <button className="icon-button" title="Synchronize" onClick={() => sync(connection)}>
                  <RefreshCw size={16} />
                </button>
                <button className="icon-button danger-icon" title="Disconnect" onClick={() => disconnect(connection)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!connections.length && <p className="empty-state">No connected account.</p>}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <div><MailPlus size={19} /><span><h2>Email templates</h2><p>Reusable commercial and follow-up messages</p></span></div>
        </div>
        <div className="field-list">
          {templates.map((item) => (
            <div key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.subject}</span>
              <b>{item.shared === false ? "private" : "shared"}</b>
              {canWrite && <div className="row-actions">
                <button className="icon-button" title={`Edit ${item.name}`} onClick={() => { setEditingTemplate(item); setTemplateOpen(true); }}><Pencil size={15} /></button>
                <button className="icon-button danger-icon" title={`Delete ${item.name}`} onClick={() => removeTemplate(item)}><Trash2 size={15} /></button>
              </div>}
            </div>
          ))}
          {!templates.length && <p className="empty-state">No email template.</p>}
        </div>
      </section>

      <div className="two-column communications-layout">
        <section className="panel communications-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Recent</p><h2>Messages</h2></div>
            <Send size={18} />
          </div>
          <label className="search-field conversation-search">
            <Search size={16} />
            <input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search conversations" />
          </label>
          <div className="conversation-workspace">
            <div className="conversation-list">
              {conversations.map((conversation) => {
                const latest = conversation.messages[conversation.messages.length - 1];
                return <button
                  type="button"
                  className={selectedConversationId === conversation.id ? "active" : ""}
                  key={conversation.id}
                  onClick={() => void selectConversation(conversation)}
                >
                  <span className={`status-dot ${latest?.status.toLowerCase() || "queued"}`} />
                  <div><strong>{conversation.subject}</strong><p>{conversation.messages.length} message(s) · {latest?.direction === "INBOUND" ? latest.metadata?.from || "Received" : latest?.to}</p></div>
                  <small>{conversation.unreadReplies ? `${conversation.unreadReplies} unread` : latest?.status.toLowerCase()}</small>
                </button>;
              })}
              {!conversations.length && <p className="empty-state">No synchronized conversation.</p>}
            </div>
            <div className="conversation-detail">
              {selectedConversation ? <>
                <header>
                  <div><p className="eyebrow">Conversation</p><h3>{selectedConversation.subject}</h3></div>
                  <small>{selectedConversation.messages.length} message(s)</small>
                </header>
                <div className="message-thread">
                  {selectedConversation.messages.map((message) => (
                    <article className={message.direction === "INBOUND" ? "inbound" : "outbound"} key={message.id}>
                      <div>
                        <strong>{message.direction === "INBOUND" ? message.metadata?.from || "Received" : `To ${message.to}`}</strong>
                        <small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(message.sentAt || message.createdAt))}</small>
                      </div>
                      <p>{message.body}</p>
                      {!!message.attachments?.length && <div className="message-attachments">
                        {message.attachments.map((attachment) => (
                          <button type="button" key={attachment.id} onClick={() => void downloadFile(`/attachments/${attachment.id}/download`, attachment.originalName)}>
                            <Paperclip size={14} /><span>{attachment.originalName}</span><Download size={14} />
                          </button>
                        ))}
                      </div>}
                    </article>
                  ))}
                </div>
                <form className="conversation-reply" onSubmit={(event) => void replyToConversation(event)}>
                  <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={3} placeholder="Write a reply" disabled={!canWrite || !emailConnections.length} required />
                  <button className="primary-button" disabled={replyBusy || !replyBody.trim() || !emailConnections.length}>
                    <Send size={15} />{replyBusy ? "Sending..." : "Reply"}
                  </button>
                </form>
              </> : <p className="empty-state">Select a conversation.</p>}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Upcoming</p><h2>Calendar</h2></div>
            <CalendarPlus size={18} />
          </div>
          <div className="activity-list">
            {events.filter((item) => item.status !== "CANCELED").map((item) => (
              <article key={item.id}>
                <span className="status-dot done" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.location || new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.startsAt))}</p>
                </div>
                {canWrite && <button className="icon-button danger-icon" title={`Cancel ${item.title}`} onClick={() => cancelEvent(item)}><Trash2 size={15} /></button>}
              </article>
            ))}
            {!events.length && <p className="empty-state">No meeting scheduled.</p>}
          </div>
        </section>
      </div>

      <Dialog title="Send email" open={composeOpen} onClose={() => setComposeOpen(false)}>
        <form className="dialog-form" onSubmit={sendEmail}>
          <label>Account<select name="connectionId" required>{emailConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.provider} - {connection.externalEmail}</option>)}</select></label>
          <label>Template<select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">None</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>To<input name="to" type="email" required /></label>
          <label>Cc<input name="cc" /></label>
          <label>Subject<input name="subject" required defaultValue={template?.subject || ""} key={`subject-${selectedTemplate}`} /></label>
          <label>Message<textarea name="body" required defaultValue={template?.body || ""} key={`body-${selectedTemplate}`} rows={8} /></label>
          <label>Attachment<input type="file" onChange={(event) => setComposeFile(event.target.files?.[0] || null)} /></label>
          <footer><button type="button" className="secondary-button" onClick={() => setComposeOpen(false)}>Cancel</button><button className="primary-button">Send</button></footer>
        </form>
      </Dialog>
      <Dialog title={editingTemplate ? "Edit email template" : "New email template"} open={templateOpen} onClose={() => { setTemplateOpen(false); setEditingTemplate(null); }}>
        <form className="dialog-form" onSubmit={saveTemplate}>
          <label>Name<input name="name" required defaultValue={editingTemplate?.name || ""} /></label>
          <label>Subject<input name="subject" required defaultValue={editingTemplate?.subject || ""} /></label>
          <label>Message<textarea name="body" rows={8} required defaultValue={editingTemplate?.body || ""} /></label>
          <label className="check-label"><input name="shared" type="checkbox" defaultChecked={editingTemplate?.shared !== false} />Shared with the workspace</label>
          <footer><button type="button" className="secondary-button" onClick={() => { setTemplateOpen(false); setEditingTemplate(null); }}>Cancel</button><button className="primary-button">Save</button></footer>
        </form>
      </Dialog>
      <Dialog title="External connector" open={connectorOpen} onClose={() => setConnectorOpen(false)}>
        <form className="dialog-form" onSubmit={createConnector}>
          <label>Type<select name="provider"><option>ACCOUNTING</option><option>SUPPORT</option><option>MARKETING</option><option>CUSTOM</option></select></label>
          <label>HTTPS endpoint<input name="endpoint" type="url" required /></label>
          <label>Account identifier<input name="externalAccountId" /></label>
          <label>Bearer token<input name="accessToken" type="password" autoComplete="off" /></label>
          <footer><button type="button" className="secondary-button" onClick={() => setConnectorOpen(false)}>Cancel</button><button className="primary-button">Connect</button></footer>
        </form>
      </Dialog>
      <Dialog title="Schedule meeting" open={eventOpen} onClose={() => setEventOpen(false)}>
        <form className="dialog-form" onSubmit={createEvent}>
          <label>Calendar<select name="connectionId"><option value="">CRM only</option>{emailConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.provider} - {connection.externalEmail}</option>)}</select></label>
          <label>Title<input name="title" required /></label>
          <div className="form-grid">
            <label>Starts<input name="startsAt" type="datetime-local" required /></label>
            <label>Ends<input name="endsAt" type="datetime-local" required /></label>
          </div>
          <label>Attendees<input name="attendeeEmails" placeholder="name@example.com, team@example.com" /></label>
          <label>Location<input name="location" /></label>
          <label>Description<textarea name="description" rows={4} /></label>
          <footer><button type="button" className="secondary-button" onClick={() => setEventOpen(false)}>Cancel</button><button className="primary-button">Create meeting</button></footer>
        </form>
      </Dialog>
      <Dialog
        title={`Configure ${setupProvider === "GOOGLE" ? "Google" : "Microsoft"} OAuth`}
        open={Boolean(setupProvider)}
        onClose={() => setSetupProvider(null)}
      >
        {setupProvider && oauthConfig && <div className="oauth-setup-dialog">
          <p>
            Create an OAuth application for the CRM, register the callback URI below, then add the generated
            credentials to <code>crm/.env</code>.
          </p>
          <label>Authorized callback URI<code>{oauthConfig.redirectUri}</code></label>
          <div>
            <strong>Missing server variables</strong>
            <ul>
              {oauthConfig.providers[setupProvider].missing.map((name) => <li key={name}><code>{name}</code></li>)}
            </ul>
          </div>
          <p>
            Restart the CRM API after updating the environment file. Secrets stay on the server and must never
            be entered in the browser.
          </p>
          <footer>
            <button className="secondary-button" onClick={() => setSetupProvider(null)}>Close</button>
            <a
              className="primary-button"
              href={oauthConfig.providers[setupProvider].setupUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open provider console <ExternalLink size={15} />
            </a>
          </footer>
        </div>}
      </Dialog>
    </div>
  );
}
