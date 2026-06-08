import { Download, Plus, Search, Upload, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, downloadCsv } from "../api";
import { Dialog } from "../components/Dialog";
import type { Company, Contact } from "../types";
import { Link } from "react-router-dom";

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<{ contacts: Contact[] }>(`/contacts?limit=100&search=${encodeURIComponent(search)}`).then((data) => setContacts(data.contacts));
  }, [search]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ companies: Company[] }>("/companies?limit=100").then((data) => setCompanies(data.companies));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/contacts", {
        method: "POST",
        body: JSON.stringify({ ...data, companyId: data.companyId || null })
      });
      setOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create contact");
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await api("/contacts/import", { method: "POST", body });
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">People</p><h1>Contacts</h1><p>{contacts.length} visible records</p></div>
        <div className="header-actions">
          <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => importFile(event.target.files?.[0])} />
          <button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} />Import</button>
          <button className="secondary-button" onClick={() => downloadCsv("/contacts/export.csv", "contacts.csv")}><Download size={16} />Export</button>
          <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Contact</button>
        </div>
      </header>
      <div className="toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" /></label>
      </div>
      <section className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Company</th><th>Title</th><th>Status</th><th>Email</th><th>Source</th></tr></thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td><Link className="person-cell record-link" to={`/contacts/${contact.id}`}><span className="avatar">{contact.firstName[0]}{contact.lastName[0]}</span><strong>{contact.firstName} {contact.lastName}</strong></Link></td>
                <td>{contact.company?.name || "—"}</td><td>{contact.jobTitle || "—"}</td>
                <td><span className="status-pill">{contact.status}</span></td>
                <td>{contact.email || "—"}</td><td>{contact.source || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contacts.length && <div className="empty-state"><Users size={24} /><p>No contacts found.</p></div>}
      </section>
      <Dialog title="New contact" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <div className="form-grid"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
          <label>Email<input name="email" type="email" /></label>
          <div className="form-grid"><label>Job title<input name="jobTitle" /></label><label>Phone<input name="phone" /></label></div>
          <label>Company<select name="companyId"><option value="">No company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
          <div className="form-grid"><label>Status<select name="status"><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option></select></label><label>Source<input name="source" placeholder="Referral, event..." /></label></div>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create contact</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
