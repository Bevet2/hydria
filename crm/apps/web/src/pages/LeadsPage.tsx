import { Flame, Plus, Search, UserRoundSearch } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import type { Lead } from "../types";

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: "100", search });
    if (status) params.set("status", status);
    if (rating) params.set("rating", rating);
    api<{ leads: Lead[] }>(`/leads?${params}`).then((data) => setLeads(data.leads));
  }, [search, status, rating]);
  useEffect(load, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/leads", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : null,
          employeeCount: data.employeeCount ? Number(data.employeeCount) : null
        })
      });
      setOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create lead");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Prospecting</p><h1>Leads</h1><p>Qualify prospects before creating accounts and opportunities</p></div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Lead</button>
      </header>
      <div className="toolbar filter-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lead status">
          <option value="">All statuses</option><option>NEW</option><option>WORKING</option><option>QUALIFIED</option><option>UNQUALIFIED</option><option>CONVERTED</option>
        </select>
        <select value={rating} onChange={(event) => setRating(event.target.value)} aria-label="Lead rating">
          <option value="">All ratings</option><option>HOT</option><option>WARM</option><option>COLD</option>
        </select>
      </div>
      <section className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Lead</th><th>Company</th><th>Rating</th><th>Status</th><th>Source</th><th>Owner</th></tr></thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td><Link className="person-cell record-link" to={`/leads/${lead.id}`}><span className="avatar">{lead.firstName[0]}{lead.lastName[0]}</span><span><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.email || lead.jobTitle || "Lead"}</small></span></Link></td>
                <td>{lead.companyName || "—"}</td>
                <td><span className={`rating-pill rating-${lead.rating.toLowerCase()}`}><Flame size={13} />{lead.rating.toLowerCase()}</span></td>
                <td><span className="status-pill">{lead.status.toLowerCase()}</span></td>
                <td>{lead.source || "—"}</td>
                <td>{lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}` : "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!leads.length && <div className="empty-state"><UserRoundSearch size={24} /><p>No leads found.</p></div>}
      </section>
      <Dialog title="New lead" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <div className="form-grid"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
          <label>Company<input name="companyName" /></label>
          <div className="form-grid"><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" /></label></div>
          <div className="form-grid"><label>Job title<input name="jobTitle" /></label><label>Website<input name="website" type="url" /></label></div>
          <div className="form-grid"><label>Source<select name="source"><option>Website</option><option>Referral</option><option>Event</option><option>Outbound</option><option>Partner</option></select></label><label>Rating<select name="rating"><option>HOT</option><option defaultValue="WARM">WARM</option><option>COLD</option></select></label></div>
          <div className="form-grid"><label>Annual revenue<input name="annualRevenue" type="number" min="0" /></label><label>Employees<input name="employeeCount" type="number" min="0" /></label></div>
          <label>Description<textarea name="description" rows={3} /></label>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create lead</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
