import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  Contact,
  FileText,
  Mail,
  MessageSquareText,
  PackagePlus,
  Phone,
  Plus,
  Target,
  UserRoundSearch
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import type { DealLineItem, Product, Quote, Stage } from "../types";

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
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    api<Record<string, RecordData>>(`${meta.endpoint}/${id}`).then((data) => setRecord(data[kind]));
  }, [id, kind, meta.endpoint]);

  useEffect(load, [load]);
  useEffect(() => {
    if (kind === "deal" || kind === "lead") {
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

  async function updateDealForecast(value: string) {
    await api(`/pipeline/deals/${id}`, { method: "PATCH", body: JSON.stringify({ forecastCategory: value }) });
    load();
  }

  async function updateLeadStatus(value: string) {
    await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    load();
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
          {kind === "lead" && record.status !== "CONVERTED" && <button className="primary-button" onClick={() => setConvertOpen(true)}>Convert lead</button>}
          {kind === "lead" && record.status !== "CONVERTED" && <select className="action-select" value={record.status} onChange={(event) => updateLeadStatus(event.target.value)}><option>NEW</option><option>WORKING</option><option>QUALIFIED</option><option>UNQUALIFIED</option></select>}
          {kind === "deal" && <select className="action-select" value={record.forecastCategory} onChange={(event) => updateDealForecast(event.target.value)}><option>PIPELINE</option><option>BEST_CASE</option><option>COMMIT</option><option>CLOSED</option><option>OMITTED</option></select>}
          <button className="secondary-button" onClick={() => setActivityOpen(true)}><Plus size={16} />Activity</button>
        </div>
      </header>

      <section className="record-highlights">
        {fields.slice(0, 4).map(([label, value]) => <div key={label}><span>{label}</span><strong>{text(value)}</strong></div>)}
      </section>

      <div className="record-grid">
        <div className="record-main">
          <section className="record-section">
            <header><h2>Details</h2></header>
            <dl className="record-fields">
              {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}
            </dl>
            {record.description && <div className="record-description"><strong>Description</strong><p>{record.description}</p></div>}
          </section>

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
            </>
          )}

          {kind === "deal" && (
            <>
              <section className="record-section">
                <header><div><h2>Products</h2><p>Line items automatically update the opportunity amount.</p></div><button className="secondary-button" onClick={() => setProductOpen(true)}><PackagePlus size={16} />Add product</button></header>
                <div className="line-items">
                  {(record.lineItems as DealLineItem[])?.map((item) => <div key={item.id}><p><strong>{item.product.name}</strong><small>{item.product.sku}</small></p><span>{Number(item.quantity)} × {money.format(Number(item.unitPrice))}</span><b>{money.format(Number(item.lineTotal))}</b></div>)}
                  {!record.lineItems?.length && <p className="empty-state">No products added.</p>}
                </div>
              </section>
              <section className="record-section">
                <header><div><h2>Quotes</h2><p>Create a frozen commercial proposal from the product lines.</p></div><button className="secondary-button" disabled={!record.lineItems?.length} onClick={() => setQuoteOpen(true)}><FileText size={16} />New quote</button></header>
                <div className="related-list">{(record.quotes as Quote[])?.map((quote) => <article key={quote.id}><FileText size={16} /><p><strong>{quote.number} · {quote.name}</strong><small>{quote.status.toLowerCase()} · {money.format(Number(quote.total))}</small></p></article>)}{!record.quotes?.length && <p className="empty-state">No quotes yet.</p>}</div>
              </section>
            </>
          )}

          <section className="record-section">
            <header><h2>Tasks</h2></header>
            <div className="related-list">{tasks.map((task: RecordData) => <article key={task.id}><CheckSquare size={16} /><p><strong>{task.title}</strong><small>{task.status.toLowerCase().replace("_", " ")}{task.dueAt ? ` · ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(task.dueAt))}` : ""}</small></p></article>)}{!tasks.length && <p className="empty-state">No related tasks.</p>}</div>
          </section>
        </div>

        <aside className="record-side">
          <section className="record-section">
            <header><h2>Activity timeline</h2></header>
            <Timeline items={activities} />
          </section>
          <section className="record-section note-composer">
            <header><h2>Notes</h2></header>
            <form onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add context for the team" /><button className="primary-button" disabled={!note.trim()}><MessageSquareText size={15} />Add note</button></form>
            <div>{notes.map((item: RecordData) => <article key={item.id}><p>{item.body}</p><small>{item.author?.firstName} {item.author?.lastName} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.createdAt))}</small></article>)}</div>
          </section>
        </aside>
      </div>

      <Dialog title="Log activity" open={activityOpen} onClose={() => setActivityOpen(false)}>
        <form className="dialog-form" onSubmit={addActivity}>
          <label>Type<select name="type"><option>CALL</option><option>EMAIL</option><option>MEETING</option></select></label>
          <label>Subject<input name="subject" required /></label>
          <label>Details<textarea name="body" rows={4} /></label>
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
