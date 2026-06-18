import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  Contact,
  FileText,
  Gauge,
  Handshake,
  LifeBuoy,
  Mail,
  MessageSquareText,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Target,
  Trash2,
  UserPlus,
  UserRoundSearch
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CustomFieldsPanel } from "../components/CustomFieldsPanel";
import { AttachmentsPanel } from "../components/AttachmentsPanel";
import { Dialog } from "../components/Dialog";
import { HydriaAssistPanel } from "../components/HydriaAssistPanel";
import { TaskDialog } from "../components/TaskDialog";
import type { DealLineItem, Product, Quote, Stage, Task } from "../types";

type Kind = "lead" | "contact" | "company" | "deal";
type RecordData = Record<string, any>;

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const config = {
  lead: { endpoint: "/leads", label: "Lead", back: "/leads", icon: UserRoundSearch },
  contact: { endpoint: "/contacts", label: "Contact", back: "/contacts", icon: Contact },
  company: { endpoint: "/companies", label: "Company", back: "/companies", icon: Building2 },
  deal: { endpoint: "/pipeline/deals", label: "Opportunity", back: "/pipeline", icon: Target }
} as const;

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function futureIso(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function Timeline({ items = [] }: { items?: RecordData[] }) {
  return (
    <div className="record-timeline">
      {items.map((item) => (
        <article key={item.id}>
          <span />
          <div>
            <strong>{item.subject}</strong>
            {item.body && <p>{item.body}</p>}
            <small>{item.actor ? `${item.actor.firstName} ${item.actor.lastName} · ` : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt || item.createdAt))}</small>
          </div>
        </article>
      ))}
      {!items.length && <p className="empty-state">No activity recorded yet.</p>}
    </div>
  );
}

export function RecordDetailPage({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = config[kind];
  const Icon = meta.icon;
  const [record, setRecord] = useState<RecordData | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [note, setNote] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [companyDealOpen, setCompanyDealOpen] = useState(false);
  const [companyTicketOpen, setCompanyTicketOpen] = useState(false);
  const [companyContactOpen, setCompanyContactOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<Partial<Task>>({});
  const [companyDealDefaults, setCompanyDealDefaults] = useState<Record<string, string>>({});
  const [companyTicketDefaults, setCompanyTicketDefaults] = useState<Record<string, string>>({});
  const [companyContactDefaults, setCompanyContactDefaults] = useState<Record<string, string>>({});
  const [activityDefaults, setActivityDefaults] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(() => {
    if (!id) return;
    api<Record<string, RecordData>>(`${meta.endpoint}/${id}`).then((data) => setRecord(data[kind]));
  }, [id, kind, meta.endpoint]);

  useEffect(load, [load]);
  useEffect(() => {
    if (kind === "deal" || kind === "lead" || kind === "company") {
      api<{ stages: Stage[] }>("/pipeline").then((data) => setStages(data.stages));
    }
    if (kind === "deal") {
      api<{ products: Product[] }>("/products").then((data) => setProducts(data.products.filter((product) => product.active)));
    }
  }, [kind]);

  const title = useMemo(() => {
    if (!record) return "";
    if (kind === "company" || kind === "deal") return record.name;
    return `${record.firstName} ${record.lastName}`;
  }, [kind, record]);

  const subtitle = useMemo(() => {
    if (!record) return "";
    if (kind === "lead") return [record.jobTitle, record.companyName].filter(Boolean).join(" at ") || "Prospect";
    if (kind === "contact") return [record.jobTitle, record.company?.name].filter(Boolean).join(" at ") || "Contact";
    if (kind === "company") return [record.industry, record.city, record.country].filter(Boolean).join(" · ") || "Account";
    return [record.company?.name, record.stage?.name].filter(Boolean).join(" · ") || "Opportunity";
  }, [kind, record]);

  const relationBody = id ? { [`${kind}Id`]: id } : {};
  const activities = record?.activities || [];
  const tasks = record?.tasks || [];
  const notes = record?.notes || [];
  const customer360 = record?.customer360;

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    await api("/timeline/notes", { method: "POST", body: JSON.stringify({ ...relationBody, body: note }) });
    setNote("");
    load();
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/timeline/activities", { method: "POST", body: JSON.stringify({ ...relationBody, ...data }) });
    setActivityOpen(false);
    load();
  }

  async function convertLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const converted = await api<{ deal?: { id: string } | null }>(`/leads/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          companyName: data.companyName,
          createDeal: data.createDeal === "on",
          dealName: data.dealName,
          dealValue: Number(data.dealValue || 0),
          stageId: data.stageId,
          expectedCloseAt: data.expectedCloseAt || null
        })
      });
      setConvertOpen(false);
      if (converted.deal) navigate(`/deals/${converted.deal.id}`);
      else load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversion failed");
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/products/deals/${id}/items`, {
      method: "POST",
      body: JSON.stringify({
        productId: data.productId,
        quantity: Number(data.quantity),
        discountPercent: Number(data.discountPercent || 0)
      })
    });
    setProductOpen(false);
    load();
  }

  async function removeProduct(itemId: string) {
    setError("");
    try {
      await api(`/products/deals/${id}/items/${itemId}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove product");
    }
  }

  async function createQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/products/deals/${id}/quotes`, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        validUntil: data.validUntil || null,
        discountPercent: Number(data.discountPercent || 0),
        taxPercent: Number(data.taxPercent || 0),
        notes: data.notes
      })
    });
    setQuoteOpen(false);
    load();
  }

  function openTask(defaults: Partial<Task> = {}) {
    setTaskDefaults(defaults);
    setTaskOpen(true);
  }

  function openCompanyAction(action: RecordData) {
    const title = String(action.title || "Follow up");
    const detail = String(action.detail || "");
    if (/ticket|support|sla/i.test(title)) {
      setCompanyTicketDefaults({ subject: title, description: detail, priority: action.severity === "critical" ? "URGENT" : "HIGH" });
      setCompanyTicketOpen(true);
      return;
    }
    if (/opportunity|pipeline|deal/i.test(title)) {
      setCompanyDealDefaults({ name: `${record?.name || "Account"} opportunity`, nextStep: detail, value: "0" });
      setCompanyDealOpen(true);
      return;
    }
    if (/contact|committee|buyer/i.test(title)) {
      setCompanyContactDefaults({ jobTitle: "Decision maker", source: "Customer 360" });
      setCompanyContactOpen(true);
      return;
    }
    openTask({ title, description: detail, priority: action.severity === "critical" ? "URGENT" : "HIGH", dueAt: futureIso(2) });
  }

  async function createCompanyDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const stageId = String(data.stageId || stages.find((stage) => !stage.isWon && !stage.isLost)?.id || "");
    try {
      await api("/pipeline/deals", {
        method: "POST",
        body: JSON.stringify({
          companyId: record.id,
          name: data.name,
          value: Number(data.value || 0),
          probability: Number(data.probability || 20),
          stageId,
          expectedCloseAt: data.expectedCloseAt || null,
          nextStep: data.nextStep || null
        })
      });
      setCompanyDealOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create opportunity");
    }
  }

  async function createCompanyTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/tickets", {
        method: "POST",
        body: JSON.stringify({
          companyId: record.id,
          subject: data.subject,
          description: data.description || null,
          priority: data.priority || "MEDIUM",
          status: "OPEN",
          source: "ACCOUNT_360",
          customerEmail: data.customerEmail || null
        })
      });
      setCompanyTicketOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create ticket");
    }
  }

  async function createCompanyContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/contacts", {
        method: "POST",
        body: JSON.stringify({
          companyId: record.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || "",
          phone: data.phone || "",
          jobTitle: data.jobTitle || "",
          source: data.source || "Customer 360",
          status: "qualified"
        })
      });
      setCompanyContactOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create contact");
    }
  }

  async function updateDealForecast(value: string) {
    await api(`/pipeline/deals/${id}`, { method: "PATCH", body: JSON.stringify({ forecastCategory: value }) });
    load();
  }

  async function updateLeadStatus(value: string) {
    await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    load();
  }

  async function updateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const body: Record<string, unknown> = { ...data };
    if (kind === "lead") {
      body.annualRevenue = data.annualRevenue ? Number(data.annualRevenue) : null;
      body.employeeCount = data.employeeCount ? Number(data.employeeCount) : null;
    }
    if (kind === "company") {
      body.size = data.size ? Number(data.size) : null;
    }
    if (kind === "deal") {
      body.value = Number(data.value || 0);
      body.probability = Number(data.probability || 0);
      body.expectedCloseAt = data.expectedCloseAt || null;
    }
    try {
      await api(`${meta.endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setEditOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update record");
    }
  }

  async function deleteRecord() {
    if (!window.confirm(`Delete this ${meta.label.toLowerCase()} permanently?`)) return;
    try {
      await api(`${meta.endpoint}/${id}`, { method: "DELETE" });
      navigate(meta.back);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete record");
    }
  }

  if (!record) return <div className="page-loading">Loading {meta.label.toLowerCase()}...</div>;

  const fields =
    kind === "lead"
      ? [
          ["Email", record.email], ["Phone", record.phone], ["Company", record.companyName],
          ["Title", record.jobTitle], ["Source", record.source], ["Rating", record.rating],
          ["Employees", record.employeeCount], ["Annual revenue", record.annualRevenue ? money.format(Number(record.annualRevenue)) : null]
        ]
      : kind === "contact"
        ? [
            ["Email", record.email], ["Phone", record.phone], ["Company", record.company?.name],
            ["Title", record.jobTitle], ["Status", record.status], ["Source", record.source]
          ]
        : kind === "company"
          ? [
              ["Domain", record.domain], ["Website", record.website], ["Phone", record.phone],
              ["Industry", record.industry], ["Employees", record.size], ["Location", [record.city, record.country].filter(Boolean).join(", ")],
              ["Address", record.address]
            ]
          : [
              ["Amount", money.format(Number(record.value))], ["Stage", record.stage?.name], ["Probability", `${record.probability}%`],
              ["Forecast", record.forecastCategory?.replace("_", " ")], ["Company", record.company?.name],
              ["Primary contact", record.primaryContact ? `${record.primaryContact.firstName} ${record.primaryContact.lastName}` : null],
              ["Close date", record.expectedCloseAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(record.expectedCloseAt)) : null],
              ["Next step", record.nextStep]
            ];

  return (
    <div className="page record-page">
      <Link to={meta.back} className="back-link"><ArrowLeft size={15} />Back to {meta.back.slice(1)}</Link>
      <header className="record-header">
        <div className="record-identity"><span><Icon size={24} /></span><div><p className="eyebrow">{meta.label}</p><h1>{title}</h1><p>{subtitle}</p></div></div>
        <div className="header-actions">
          {canWrite && kind === "lead" && record.status !== "CONVERTED" && <button className="primary-button" onClick={() => setConvertOpen(true)}>Convert lead</button>}
          {canWrite && kind === "lead" && record.status !== "CONVERTED" && <select className="action-select" value={record.status} onChange={(event) => updateLeadStatus(event.target.value)}><option>NEW</option><option>WORKING</option><option>QUALIFIED</option><option>UNQUALIFIED</option></select>}
          {canWrite && kind === "deal" && <select className="action-select" value={record.forecastCategory} onChange={(event) => updateDealForecast(event.target.value)}><option>PIPELINE</option><option>BEST_CASE</option><option>COMMIT</option><option>CLOSED</option><option>OMITTED</option></select>}
          {canWrite && <button className="secondary-button" onClick={() => setEditOpen(true)}><Pencil size={16} />Edit</button>}
          {canWrite && <button className="secondary-button" onClick={() => { setActivityDefaults({}); setActivityOpen(true); }}><Plus size={16} />Activity</button>}
          {canWrite && <button className="icon-button danger-icon" title={`Delete ${meta.label.toLowerCase()}`} onClick={deleteRecord}><Trash2 size={17} /></button>}
        </div>
      </header>
      {error && <p className="settings-error">{error}</p>}

      <section className="record-highlights">
        {fields.slice(0, 4).map(([label, value]) => <div key={label}><span>{label}</span><strong>{text(value)}</strong></div>)}
      </section>

      {kind === "company" && customer360 && (
        <section className="customer360-panel">
          <div className="customer360-score">
            <span><Gauge size={18} />Customer health</span>
            <strong>{customer360.healthScore}</strong>
            <small>{customer360.healthLabel} · last touch {customer360.daysSinceLastActivity}d ago</small>
          </div>
          <div className="customer360-metrics">
            <div><span>Open pipeline</span><strong>{money.format(Number(customer360.openDealsValue || 0))}</strong><small>{customer360.openDealsCount} opportunities</small></div>
            <div><span>Won revenue</span><strong>{money.format(Number(customer360.wonDealsValue || 0))}</strong><small>{customer360.wonDealsCount} wins</small></div>
            <div><span>Open tickets</span><strong>{customer360.openTicketsCount}</strong><small>{customer360.overdueTicketsCount} overdue</small></div>
            <div><span>Open tasks</span><strong>{customer360.openTasksCount}</strong><small>{customer360.overdueTasksCount} overdue</small></div>
          </div>
          <div className="customer360-actions">
            <div className="customer360-action-toolbar">
              <span>Next best actions</span>
              {canWrite && <div>
                <button type="button" onClick={() => setCompanyDealOpen(true)}><Handshake size={14} />Deal</button>
                <button type="button" onClick={() => openTask({ title: `Follow up with ${record.name}`, priority: "HIGH", dueAt: futureIso(2) })}><CheckSquare size={14} />Task</button>
                <button type="button" onClick={() => setCompanyTicketOpen(true)}><LifeBuoy size={14} />Ticket</button>
                <button type="button" onClick={() => setCompanyContactOpen(true)}><UserPlus size={14} />Contact</button>
                <button type="button" onClick={() => { setActivityDefaults({ type: "CALL", subject: `Call ${record.name}`, body: "Account follow-up from Customer 360." }); setActivityOpen(true); }}><MessageSquareText size={14} />Activity</button>
              </div>}
            </div>
            {customer360.nextBestActions?.map((action: RecordData) => (
              <article key={`${action.title}-${action.severity}`} className={`customer360-action customer360-${action.severity}`}>
                <strong>{action.title}</strong>
                <small>{action.detail}</small>
                {canWrite && <button type="button" onClick={() => openCompanyAction(action)}>Apply action</button>}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="record-grid">
        <div className="record-main">
          <section className="record-section">
            <header><h2>Details</h2></header>
            <dl className="record-fields">
              {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}
            </dl>
            {record.description && <div className="record-description"><strong>Description</strong><p>{record.description}</p></div>}
          </section>

          <CustomFieldsPanel entityType={kind.toUpperCase() as "CONTACT" | "COMPANY" | "DEAL" | "LEAD"} entityId={id!} canWrite={canWrite} />
          <AttachmentsPanel entityType={kind.toUpperCase() as "CONTACT" | "COMPANY" | "DEAL" | "LEAD"} entityId={id!} canWrite={canWrite} />

          {kind === "lead" && record.status === "CONVERTED" && (
            <section className="record-section">
              <header><h2>Conversion result</h2></header>
              <div className="related-links">
                {record.convertedCompany && <Link to={`/companies/${record.convertedCompany.id}`}><Building2 size={16} /><span><strong>{record.convertedCompany.name}</strong><small>Company</small></span></Link>}
                {record.convertedContact && <Link to={`/contacts/${record.convertedContact.id}`}><Contact size={16} /><span><strong>{record.convertedContact.firstName} {record.convertedContact.lastName}</strong><small>Contact</small></span></Link>}
                {record.convertedDeal && <Link to={`/deals/${record.convertedDeal.id}`}><Target size={16} /><span><strong>{record.convertedDeal.name}</strong><small>Opportunity</small></span></Link>}
              </div>
            </section>
          )}

          {kind === "contact" && (
            <section className="record-section">
              <header><h2>Opportunities</h2></header>
              <div className="related-list">{record.primaryDeals?.map((deal: RecordData) => <Link to={`/deals/${deal.id}`} key={deal.id}><Target size={16} /><p><strong>{deal.name}</strong><small>{deal.stage?.name} · {money.format(Number(deal.value))}</small></p></Link>)}{!record.primaryDeals?.length && <p className="empty-state">No opportunities.</p>}</div>
            </section>
          )}

          {kind === "company" && (
            <>
              <section className="record-section"><header><h2>Contacts</h2></header><div className="related-list">{record.contacts?.map((contact: RecordData) => <Link to={`/contacts/${contact.id}`} key={contact.id}><Contact size={16} /><p><strong>{contact.firstName} {contact.lastName}</strong><small>{contact.jobTitle || contact.email || "Contact"}</small></p></Link>)}</div></section>
              <section className="record-section"><header><h2>Opportunities</h2></header><div className="related-list">{record.deals?.map((deal: RecordData) => <Link to={`/deals/${deal.id}`} key={deal.id}><Target size={16} /><p><strong>{deal.name}</strong><small>{deal.stage?.name} · {money.format(Number(deal.value))}</small></p></Link>)}</div></section>
              <section className="record-section"><header><h2>Support tickets</h2></header><div className="related-list">{record.tickets?.map((ticket: RecordData) => <Link to={`/tickets/${ticket.id}`} key={ticket.id}><LifeBuoy size={16} /><p><strong>{ticket.number} · {ticket.subject}</strong><small>{ticket.status.toLowerCase().replace("_", " ")} · {ticket.priority.toLowerCase()}{ticket.queue ? ` · ${ticket.queue.name}` : ""}</small></p></Link>)}{!record.tickets?.length && <p className="empty-state">No support tickets.</p>}</div></section>
            </>
          )}

          {kind === "deal" && (
            <>
              <section className="record-section">
                <header><div><h2>Products</h2><p>Line items automatically update the opportunity amount.</p></div>{canWrite && <button className="secondary-button" onClick={() => setProductOpen(true)}><PackagePlus size={16} />Add product</button>}</header>
                <div className="line-items">
                  {(record.lineItems as DealLineItem[])?.map((item) => <div key={item.id}><p><strong>{item.product.name}</strong><small>{item.product.sku}</small></p><span>{Number(item.quantity)} × {money.format(Number(item.unitPrice))}</span><b>{money.format(Number(item.lineTotal))}</b>{canWrite && <button className="icon-button danger-icon" title={`Remove ${item.product.name}`} onClick={() => removeProduct(item.id)}><Trash2 size={15} /></button>}</div>)}
                  {!record.lineItems?.length && <p className="empty-state">No products added.</p>}
                </div>
              </section>
              <section className="record-section">
                <header><div><h2>Quotes</h2><p>Create a frozen commercial proposal from the product lines.</p></div>{canWrite && <button className="secondary-button" disabled={!record.lineItems?.length} onClick={() => setQuoteOpen(true)}><FileText size={16} />New quote</button>}</header>
                <div className="related-list">{(record.quotes as Quote[])?.map((quote) => <article key={quote.id}><FileText size={16} /><p><strong>{quote.number} · {quote.name}</strong><small>{quote.status.toLowerCase()} · {money.format(Number(quote.total))}</small></p></article>)}{!record.quotes?.length && <p className="empty-state">No quotes yet.</p>}</div>
              </section>
            </>
          )}

          <section className="record-section">
            <header><h2>Tasks</h2>{canWrite && <button className="secondary-button" onClick={() => openTask()}><Plus size={15} />Task</button>}</header>
            <div className="related-list">{tasks.map((task: RecordData) => <article key={task.id}><CheckSquare size={16} /><p><strong>{task.title}</strong><small>{task.status.toLowerCase().replace("_", " ")}{task.dueAt ? ` · ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(task.dueAt))}` : ""}</small></p></article>)}{!tasks.length && <p className="empty-state">No related tasks.</p>}</div>
          </section>
        </div>

        <aside className="record-side">
          <HydriaAssistPanel recordType={kind} recordId={id!} canWrite={canWrite} onExecuted={load} />
          <section className="record-section">
            <header><h2>Activity timeline</h2></header>
            <Timeline items={activities} />
          </section>
          <section className="record-section note-composer">
            <header><h2>Notes</h2></header>
            {canWrite && <form onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add context for the team" /><button className="primary-button" disabled={!note.trim()}><MessageSquareText size={15} />Add note</button></form>}
            <div>{notes.map((item: RecordData) => <article key={item.id}><p>{item.body}</p><small>{item.author?.firstName} {item.author?.lastName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.createdAt))}</small></article>)}</div>
          </section>
        </aside>
      </div>

      <Dialog title={`Edit ${meta.label.toLowerCase()}`} open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="dialog-form" onSubmit={updateRecord}>
          {kind === "lead" && <>
            <div className="form-grid"><label>First name<input name="firstName" defaultValue={record.firstName} required /></label><label>Last name<input name="lastName" defaultValue={record.lastName} required /></label></div>
            <label>Company<input name="companyName" defaultValue={record.companyName || ""} /></label>
            <div className="form-grid"><label>Email<input name="email" type="email" defaultValue={record.email || ""} /></label><label>Phone<input name="phone" defaultValue={record.phone || ""} /></label></div>
            <div className="form-grid"><label>Job title<input name="jobTitle" defaultValue={record.jobTitle || ""} /></label><label>Website<input name="website" type="url" defaultValue={record.website || ""} /></label></div>
            <div className="form-grid"><label>Source<input name="source" defaultValue={record.source || ""} /></label><label>Rating<select name="rating" defaultValue={record.rating}><option>HOT</option><option>WARM</option><option>COLD</option></select></label></div>
            <div className="form-grid"><label>Annual revenue<input name="annualRevenue" type="number" min="0" defaultValue={record.annualRevenue || ""} /></label><label>Employees<input name="employeeCount" type="number" min="0" defaultValue={record.employeeCount || ""} /></label></div>
            <label>Description<textarea name="description" rows={4} defaultValue={record.description || ""} /></label>
          </>}
          {kind === "contact" && <>
            <div className="form-grid"><label>First name<input name="firstName" defaultValue={record.firstName} required /></label><label>Last name<input name="lastName" defaultValue={record.lastName} required /></label></div>
            <div className="form-grid"><label>Email<input name="email" type="email" defaultValue={record.email || ""} /></label><label>Phone<input name="phone" defaultValue={record.phone || ""} /></label></div>
            <div className="form-grid"><label>Job title<input name="jobTitle" defaultValue={record.jobTitle || ""} /></label><label>Status<select name="status" defaultValue={record.status}><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option></select></label></div>
            <label>Source<input name="source" defaultValue={record.source || ""} /></label>
          </>}
          {kind === "company" && <>
            <label>Company name<input name="name" defaultValue={record.name} required /></label>
            <div className="form-grid"><label>Domain<input name="domain" defaultValue={record.domain || ""} /></label><label>Industry<input name="industry" defaultValue={record.industry || ""} /></label></div>
            <div className="form-grid"><label>Website<input name="website" type="url" defaultValue={record.website || ""} /></label><label>Phone<input name="phone" defaultValue={record.phone || ""} /></label></div>
            <label>Address<input name="address" defaultValue={record.address || ""} /></label>
            <div className="form-grid"><label>City<input name="city" defaultValue={record.city || ""} /></label><label>Country<input name="country" defaultValue={record.country || ""} /></label></div>
            <label>Employees<input name="size" type="number" min="0" defaultValue={record.size || ""} /></label>
          </>}
          {kind === "deal" && <>
            <label>Opportunity name<input name="name" defaultValue={record.name} required /></label>
            <div className="form-grid"><label>Amount<input name="value" type="number" min="0" step="0.01" defaultValue={record.value} /></label><label>Probability<input name="probability" type="number" min="0" max="100" defaultValue={record.probability} /></label></div>
            <div className="form-grid"><label>Stage<select name="stageId" defaultValue={record.stageId}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label><label>Forecast<select name="forecastCategory" defaultValue={record.forecastCategory}><option>PIPELINE</option><option>BEST_CASE</option><option>COMMIT</option><option>CLOSED</option><option>OMITTED</option></select></label></div>
            <label>Expected close<input name="expectedCloseAt" type="date" defaultValue={record.expectedCloseAt?.slice(0, 10) || ""} /></label>
            <label>Next step<input name="nextStep" defaultValue={record.nextStep || ""} /></label>
            <label>Description<textarea name="description" rows={4} defaultValue={record.description || ""} /></label>
          </>}
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setEditOpen(false)}>Cancel</button><button className="primary-button">Save changes</button></footer>
        </form>
      </Dialog>

      <TaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} onSaved={load} relation={relationBody} defaults={taskDefaults} />

      {kind === "company" && (
        <>
          <Dialog title="New account opportunity" open={companyDealOpen} onClose={() => setCompanyDealOpen(false)}>
            <form className="dialog-form" onSubmit={createCompanyDeal} key={`deal-${companyDealDefaults.name || ""}-${companyDealOpen ? "open" : "closed"}`}>
              <label>Opportunity name<input name="name" defaultValue={companyDealDefaults.name || `${record.name} opportunity`} required /></label>
              <div className="form-grid">
                <label>Amount<input name="value" type="number" min="0" step="0.01" defaultValue={companyDealDefaults.value || "0"} /></label>
                <label>Probability<input name="probability" type="number" min="0" max="100" defaultValue="20" /></label>
              </div>
              <label>Stage<select name="stageId" defaultValue={stages.find((stage) => !stage.isWon && !stage.isLost)?.id || ""}>{stages.filter((stage) => !stage.isLost).map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label>
              <label>Expected close<input name="expectedCloseAt" type="date" /></label>
              <label>Next step<input name="nextStep" defaultValue={companyDealDefaults.nextStep || ""} /></label>
              <footer><button type="button" className="secondary-button" onClick={() => setCompanyDealOpen(false)}>Cancel</button><button className="primary-button">Create opportunity</button></footer>
            </form>
          </Dialog>

          <Dialog title="New account ticket" open={companyTicketOpen} onClose={() => setCompanyTicketOpen(false)}>
            <form className="dialog-form" onSubmit={createCompanyTicket} key={`ticket-${companyTicketDefaults.subject || ""}-${companyTicketOpen ? "open" : "closed"}`}>
              <label>Subject<input name="subject" defaultValue={companyTicketDefaults.subject || `${record.name} support follow-up`} required /></label>
              <label>Description<textarea name="description" rows={4} defaultValue={companyTicketDefaults.description || ""} /></label>
              <div className="form-grid">
                <label>Priority<select name="priority" defaultValue={companyTicketDefaults.priority || "MEDIUM"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
                <label>Customer email<input name="customerEmail" type="email" /></label>
              </div>
              <footer><button type="button" className="secondary-button" onClick={() => setCompanyTicketOpen(false)}>Cancel</button><button className="primary-button">Create ticket</button></footer>
            </form>
          </Dialog>

          <Dialog title="New account contact" open={companyContactOpen} onClose={() => setCompanyContactOpen(false)}>
            <form className="dialog-form" onSubmit={createCompanyContact} key={`contact-${companyContactOpen ? "open" : "closed"}`}>
              <div className="form-grid"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
              <div className="form-grid"><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" /></label></div>
              <div className="form-grid"><label>Job title<input name="jobTitle" defaultValue={companyContactDefaults.jobTitle || ""} /></label><label>Source<input name="source" defaultValue={companyContactDefaults.source || "Customer 360"} /></label></div>
              <footer><button type="button" className="secondary-button" onClick={() => setCompanyContactOpen(false)}>Cancel</button><button className="primary-button">Create contact</button></footer>
            </form>
          </Dialog>
        </>
      )}

      <Dialog title="Log activity" open={activityOpen} onClose={() => setActivityOpen(false)}>
        <form className="dialog-form" onSubmit={addActivity} key={`activity-${activityDefaults.subject || ""}-${activityOpen ? "open" : "closed"}`}>
          <label>Type<select name="type" defaultValue={activityDefaults.type || "CALL"}><option>CALL</option><option>EMAIL</option><option>MEETING</option></select></label>
          <label>Subject<input name="subject" defaultValue={activityDefaults.subject || ""} required /></label>
          <label>Details<textarea name="body" rows={4} defaultValue={activityDefaults.body || ""} /></label>
          <footer><button type="button" className="secondary-button" onClick={() => setActivityOpen(false)}>Cancel</button><button className="primary-button">Save activity</button></footer>
        </form>
      </Dialog>

      <Dialog title="Convert lead" open={convertOpen} onClose={() => setConvertOpen(false)}>
        <form className="dialog-form" onSubmit={convertLead}>
          <p className="dialog-copy">This creates a contact and company, then optionally an opportunity in one transaction.</p>
          <label>Company name<input name="companyName" defaultValue={record.companyName || ""} /></label>
          <label className="check-label"><input name="createDeal" type="checkbox" defaultChecked />Create an opportunity</label>
          <label>Opportunity name<input name="dealName" defaultValue={`${record.companyName || record.lastName} opportunity`} /></label>
          <div className="form-grid"><label>Amount<input name="dealValue" type="number" min="0" defaultValue="0" /></label><label>Stage<select name="stageId">{stages.filter((stage) => !stage.isWon && !stage.isLost).map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label></div>
          <label>Expected close<input name="expectedCloseAt" type="date" /></label>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setConvertOpen(false)}>Cancel</button><button className="primary-button">Convert lead</button></footer>
        </form>
      </Dialog>

      <Dialog title="Add product" open={productOpen} onClose={() => setProductOpen(false)}>
        <form className="dialog-form" onSubmit={addProduct}>
          <label>Product<select name="productId">{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(Number(product.unitPrice))}</option>)}</select></label>
          <div className="form-grid"><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" /></label><label>Discount %<input name="discountPercent" type="number" min="0" max="100" defaultValue="0" /></label></div>
          <footer><button type="button" className="secondary-button" onClick={() => setProductOpen(false)}>Cancel</button><button className="primary-button">Add product</button></footer>
        </form>
      </Dialog>

      <Dialog title="Create quote" open={quoteOpen} onClose={() => setQuoteOpen(false)}>
        <form className="dialog-form" onSubmit={createQuote}>
          <label>Quote name<input name="name" required defaultValue={`${record.name} proposal`} /></label>
          <label>Valid until<input name="validUntil" type="date" /></label>
          <div className="form-grid"><label>Global discount %<input name="discountPercent" type="number" min="0" max="100" defaultValue="0" /></label><label>Tax %<input name="taxPercent" type="number" min="0" max="100" defaultValue="20" /></label></div>
          <label>Terms and notes<textarea name="notes" rows={4} /></label>
          <footer><button type="button" className="secondary-button" onClick={() => setQuoteOpen(false)}>Cancel</button><button className="primary-button">Create quote</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
