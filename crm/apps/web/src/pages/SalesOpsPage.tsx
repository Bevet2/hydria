import { Crosshair, MailPlus, Plus, RefreshCw, Route, Target, Trash2, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import type { Contact, Lead } from "../types";

type Territory = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count: { users: number; leads: number; deals: number };
};
type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  budget?: number | string | null;
  leadCount: number;
  dealCount: number;
  wonRevenue: number;
};
type SequenceStep = { type: "EMAIL" | "TASK"; delayDays: number; subject: string; body: string; title: string };
type Sequence = { id: string; name: string; description?: string | null; active: boolean; steps: SequenceStep[]; _count: { enrollments: number } };
type Enrollment = {
  id: string;
  email: string;
  status: string;
  currentStep: number;
  nextRunAt?: string | null;
  sequence: { id: string; name: string };
  lead?: Pick<Lead, "id" | "firstName" | "lastName"> | null;
  contact?: Pick<Contact, "id" | "firstName" | "lastName"> | null;
};

const emptyStep = (): SequenceStep => ({ type: "EMAIL", delayDays: 0, subject: "", body: "", title: "" });

export function SalesOpsPage() {
  const { user } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialog, setDialog] = useState<"territory" | "campaign" | "sequence" | "enroll" | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([emptyStep()]);
  const [error, setError] = useState("");
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const load = useCallback(async () => {
    const [operations, leadData, contactData] = await Promise.all([
      api<{ territories: Territory[]; campaigns: Campaign[]; sequences: Sequence[]; enrollments: Enrollment[] }>("/sales-ops"),
      api<{ leads: Lead[] }>("/leads?limit=100"),
      api<{ contacts: Contact[] }>("/contacts?limit=100")
    ]);
    setTerritories(operations.territories);
    setCampaigns(operations.campaigns);
    setSequences(operations.sequences);
    setEnrollments(operations.enrollments);
    setLeads(leadData.leads);
    setContacts(contactData.contacts);
  }, []);

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load sales operations")); }, [load]);

  async function submitTerritory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/sales-ops/territories", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        countries: String(data.countries || "").split(",").map((value) => value.trim()).filter(Boolean)
      })
    });
    setDialog(null);
    await load();
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/sales-ops/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        channel: data.channel,
        status: data.status,
        budget: data.budget ? Number(data.budget) : null,
        startsAt: data.startsAt ? new Date(String(data.startsAt)).toISOString() : null,
        endsAt: data.endsAt ? new Date(String(data.endsAt)).toISOString() : null,
        description: data.description || null
      })
    });
    setDialog(null);
    await load();
  }

  async function submitSequence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/sales-ops/sequences", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        steps: steps.map((step) => step.type === "EMAIL"
          ? { type: step.type, delayDays: step.delayDays, subject: step.subject, body: step.body }
          : { type: step.type, delayDays: step.delayDays, title: step.title, body: step.body })
      })
    });
    setDialog(null);
    setSteps([emptyStep()]);
    await load();
  }

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const [kind, recordId] = String(data.record).split(":");
    await api(`/sales-ops/sequences/${data.sequenceId}/enroll`, {
      method: "POST",
      body: JSON.stringify(kind === "lead" ? { leadId: recordId } : { contactId: recordId })
    });
    setDialog(null);
    await load();
  }

  async function recalculate() {
    await api("/sales-ops/scoring/recalculate", { method: "POST", body: JSON.stringify({}) });
    await load();
  }

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Revenue operations</p><h1>Sales operations</h1><p>Territories, campaigns, lead scoring and outreach sequences</p></div>
      <div className="header-actions">
        {canManage && <button className="secondary-button" onClick={() => void recalculate()}><RefreshCw size={16} />Recalculate scores</button>}
        <button className="primary-button" disabled={!sequences.length} onClick={() => setDialog("enroll")}><MailPlus size={16} />Enroll</button>
      </div>
    </header>
    {error && <p className="settings-error">{error}</p>}

    <section className="settings-section">
      <div className="section-title"><div><Crosshair size={19} /><span><h2>Territories</h2><p>Geographic and team ownership boundaries</p></span></div>{canManage && <button className="secondary-button" onClick={() => setDialog("territory")}><Plus size={16} />Territory</button>}</div>
      <div className="field-list">{territories.map((territory) => <div key={territory.id}><strong>{territory.name}</strong><span>{territory.description || "No description"}</span><code>{territory._count.users} users</code><b>{territory._count.leads} leads · {territory._count.deals} deals</b></div>)}{!territories.length && <p className="empty-state">No territory configured.</p>}</div>
    </section>

    <section className="settings-section">
      <div className="section-title"><div><Target size={19} /><span><h2>Campaigns</h2><p>Acquisition attribution and won revenue</p></span></div>{canManage && <button className="secondary-button" onClick={() => setDialog("campaign")}><Plus size={16} />Campaign</button>}</div>
      <div className="field-list">{campaigns.map((campaign) => <div key={campaign.id}><strong>{campaign.name}</strong><span>{campaign.channel} · {campaign.status.toLowerCase()}</span><code>{campaign.leadCount} leads · {campaign.dealCount} deals</code><b>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: user?.organization?.defaultCurrency || "EUR" }).format(campaign.wonRevenue)}</b></div>)}{!campaigns.length && <p className="empty-state">No campaign configured.</p>}</div>
    </section>

    <section className="settings-section">
      <div className="section-title"><div><Route size={19} /><span><h2>Sequences</h2><p>Timed email and task follow-ups</p></span></div>{canManage && <button className="secondary-button" onClick={() => setDialog("sequence")}><Plus size={16} />Sequence</button>}</div>
      <div className="field-list">{sequences.map((sequence) => <div key={sequence.id}><strong>{sequence.name}</strong><span>{sequence.steps.length} steps</span><code>{sequence._count.enrollments} enrollments</code><b>{sequence.active ? "active" : "paused"}</b></div>)}{!sequences.length && <p className="empty-state">No outreach sequence.</p>}</div>
      <div className="automation-runs">
        <h3>Recent enrollments</h3>
        {enrollments.map((enrollment) => <article key={enrollment.id}><span><strong>{enrollment.lead ? `${enrollment.lead.firstName} ${enrollment.lead.lastName}` : enrollment.contact ? `${enrollment.contact.firstName} ${enrollment.contact.lastName}` : enrollment.email}</strong><small>{enrollment.sequence.name} · step {enrollment.currentStep + 1}</small></span><b>{enrollment.status.toLowerCase()}</b><p>{enrollment.nextRunAt ? `Next ${new Date(enrollment.nextRunAt).toLocaleString()}` : enrollment.email}</p></article>)}
        {!enrollments.length && <p className="empty-state">No sequence enrollment.</p>}
      </div>
    </section>

    <Dialog title="New territory" open={dialog === "territory"} onClose={() => setDialog(null)}>
      <form className="dialog-form" onSubmit={(event) => void submitTerritory(event)}><label>Name<input name="name" required /></label><label>Countries<input name="countries" placeholder="France, Belgium, Switzerland" /></label><label>Description<textarea name="description" rows={3} /></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create territory</button></footer></form>
    </Dialog>
    <Dialog title="New campaign" open={dialog === "campaign"} onClose={() => setDialog(null)}>
      <form className="dialog-form" onSubmit={(event) => void submitCampaign(event)}><label>Name<input name="name" required /></label><div className="form-grid"><label>Channel<select name="channel"><option>Outbound</option><option>Email</option><option>Event</option><option>Partner</option><option>Paid search</option><option>Social</option></select></label><label>Status<select name="status"><option>PLANNED</option><option>ACTIVE</option><option>PAUSED</option><option>COMPLETED</option></select></label></div><div className="form-grid"><label>Start<input name="startsAt" type="date" /></label><label>End<input name="endsAt" type="date" /></label></div><label>Budget<input name="budget" type="number" min="0" step="0.01" /></label><label>Description<textarea name="description" rows={3} /></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create campaign</button></footer></form>
    </Dialog>
    <Dialog title="New sequence" open={dialog === "sequence"} onClose={() => setDialog(null)}>
      <form className="dialog-form sequence-builder" onSubmit={(event) => void submitSequence(event)}>
        <label>Name<input name="name" required /></label><label>Description<textarea name="description" rows={2} /></label>
        {steps.map((step, index) => <fieldset key={index}><legend>Step {index + 1}</legend><div className="form-grid"><label>Action<select value={step.type} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as SequenceStep["type"] } : item))}><option>EMAIL</option><option>TASK</option></select></label><label>Delay (days)<input type="number" min="0" value={step.delayDays} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, delayDays: Number(event.target.value) } : item))} /></label></div>{step.type === "EMAIL" ? <><label>Subject<input value={step.subject} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item))} required /></label><label>Message<textarea rows={3} value={step.body} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} required /></label></> : <><label>Task title<input value={step.title} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} required /></label><label>Description<textarea rows={2} value={step.body} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} /></label></>}{steps.length > 1 && <button type="button" className="text-button danger-icon" onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} />Remove step</button>}</fieldset>)}
        <button type="button" className="secondary-button" onClick={() => setSteps((current) => [...current, emptyStep()])}><Plus size={15} />Add step</button>
        <footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create sequence</button></footer>
      </form>
    </Dialog>
    <Dialog title="Enroll in sequence" open={dialog === "enroll"} onClose={() => setDialog(null)}>
      <form className="dialog-form" onSubmit={(event) => void enroll(event)}><label>Sequence<select name="sequenceId" required>{sequences.filter((sequence) => sequence.active).map((sequence) => <option value={sequence.id} key={sequence.id}>{sequence.name}</option>)}</select></label><label>Lead or contact<select name="record" required><optgroup label="Leads">{leads.filter((lead) => lead.email).map((lead) => <option value={`lead:${lead.id}`} key={`lead-${lead.id}`}>{lead.firstName} {lead.lastName} · {lead.email}</option>)}</optgroup><optgroup label="Contacts">{contacts.filter((contact) => contact.email).map((contact) => <option value={`contact:${contact.id}`} key={`contact-${contact.id}`}>{contact.firstName} {contact.lastName} · {contact.email}</option>)}</optgroup></select></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Enroll</button></footer></form>
    </Dialog>
  </div>;
}
