import {
  Download,
  GitMerge,
  ListFilter,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadCsv } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import type { Company, Contact, SavedView, User } from "../types";

type DuplicateGroup = { contacts: Contact[] };

export function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [activeViewId, setActiveViewId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (companyId) params.set("companyId", companyId);
    api<{ contacts: Contact[] }>(`/contacts?${params}`).then((data) => {
      setContacts(data.contacts);
      setSelected((current) => new Set([...current].filter((id) => data.contacts.some((contact) => contact.id === id))));
    });
  }, [companyId, search, status]);

  const loadViews = useCallback(() => {
    api<{ views: SavedView[] }>("/saved-views?resource=CONTACTS").then((data) => {
      setViews(data.views);
      const defaultView = data.views.find((view) => view.isDefault);
      if (defaultView && !activeViewId) applyView(defaultView);
    });
  }, [activeViewId]);

  useEffect(load, [load]);
  useEffect(() => {
    Promise.all([
      api<{ companies: Company[] }>("/companies?limit=100"),
      api<{ users: User[] }>("/users")
    ]).then(([companyData, userData]) => {
      setCompanies(companyData.companies);
      setUsers(userData.users);
    });
  }, []);
  useEffect(loadViews, [loadViews]);

  function applyView(view: SavedView) {
    setActiveViewId(view.id);
    setSearch(String(view.filters.search || ""));
    setStatus(String(view.filters.status || ""));
    setCompanyId(String(view.filters.companyId || ""));
  }

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
    try {
      setError("");
      await api("/contacts/import", { method: "POST", body });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to import contacts");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ view: SavedView }>("/saved-views", {
        method: "POST",
        body: JSON.stringify({
          resource: "CONTACTS",
          name: data.name,
          isDefault: data.isDefault === "on",
          filters: { search, status, companyId }
        })
      });
      setSaveViewOpen(false);
      setActiveViewId(result.view.id);
      loadViews();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save view");
    }
  }

  async function deleteActiveView() {
    if (!activeViewId) return;
    const view = views.find((item) => item.id === activeViewId);
    if (!window.confirm(`Delete the saved view "${view?.name || ""}"?`)) return;
    await api(`/saved-views/${activeViewId}`, { method: "DELETE" });
    setActiveViewId("");
    loadViews();
  }

  async function runBulk(action: "UPDATE_STATUS" | "ASSIGN_OWNER" | "DELETE", value?: string) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "DELETE" && !window.confirm(`Delete ${ids.length} selected contacts permanently?`)) return;
    try {
      await api("/contacts/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids,
          action,
          ...(action === "UPDATE_STATUS" ? { status: value } : {}),
          ...(action === "ASSIGN_OWNER" ? { ownerId: value || null } : {})
        })
      });
      setSelected(new Set());
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk action failed");
    }
  }

  async function loadDuplicates() {
    try {
      setError("");
      const data = await api<{ groups: DuplicateGroup[] }>("/contacts/duplicates");
      setDuplicateGroups(data.groups);
      setDuplicatesOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to find duplicates");
    }
  }

  async function merge(primaryId: string, duplicateIds: string[]) {
    if (!window.confirm(`Merge ${duplicateIds.length} duplicate contact${duplicateIds.length > 1 ? "s" : ""} into the selected primary record?`)) return;
    try {
      await api("/contacts/merge", {
        method: "POST",
        body: JSON.stringify({ primaryId, duplicateIds })
      });
      await loadDuplicates();
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to merge contacts");
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = contacts.length > 0 && contacts.every((contact) => selected.has(contact.id));

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">People</p><h1>Contacts</h1><p>{contacts.length} visible records</p></div>
        <div className="header-actions">
          {canWrite && <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => importFile(event.target.files?.[0])} />}
          {canWrite && <button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} />Import</button>}
          <button className="secondary-button" onClick={() => downloadCsv("/contacts/export.csv", "contacts.csv")}><Download size={16} />Export</button>
          {canWrite && <button className="secondary-button" onClick={loadDuplicates}><GitMerge size={16} />Duplicates</button>}
          {canWrite && <button className="primary-button" onClick={() => { setError(""); setOpen(true); }}><Plus size={16} />Contact</button>}
        </div>
      </header>
      {error && !open && <p className="settings-error">{error}</p>}
      <div className="toolbar contact-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setActiveViewId(""); }} placeholder="Search contacts" /></label>
        <select aria-label="Saved view" value={activeViewId} onChange={(event) => {
          const view = views.find((item) => item.id === event.target.value);
          if (view) applyView(view);
          else setActiveViewId("");
        }}>
          <option value="">All contacts</option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}{view.isDefault ? " (default)" : ""}</option>)}
        </select>
        <select aria-label="Status filter" value={status} onChange={(event) => { setStatus(event.target.value); setActiveViewId(""); }}>
          <option value="">All statuses</option><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option>
        </select>
        <select aria-label="Company filter" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setActiveViewId(""); }}>
          <option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        {canWrite && <button className="icon-button" title="Save current view" onClick={() => setSaveViewOpen(true)}><Save size={16} /></button>}
        {canWrite && activeViewId && <button className="icon-button danger-icon" title="Delete saved view" onClick={deleteActiveView}><Trash2 size={16} /></button>}
      </div>
      {canWrite && selected.size > 0 && (
        <div className="bulk-toolbar">
          <strong>{selected.size} selected</strong>
          <select aria-label="Set contact status" defaultValue="" onChange={(event) => { if (event.target.value) runBulk("UPDATE_STATUS", event.target.value); event.target.value = ""; }}>
            <option value="">Set status...</option><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option>
          </select>
          <select aria-label="Assign owner" defaultValue="" onChange={(event) => { if (event.target.value) runBulk("ASSIGN_OWNER", event.target.value); event.target.value = ""; }}>
            <option value="">Assign owner...</option>{users.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
          </select>
          {selected.size > 1 && <button className="secondary-button" onClick={() => {
            const [primaryId, ...duplicateIds] = [...selected];
            if (primaryId) merge(primaryId, duplicateIds);
          }}><GitMerge size={15} />Merge into first</button>}
          <button className="icon-button danger-icon" title="Delete selected contacts" onClick={() => runBulk("DELETE")}><Trash2 size={16} /></button>
        </div>
      )}
      <section className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th className="selection-cell"><input type="checkbox" aria-label="Select all contacts" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(contacts.map((contact) => contact.id)))} /></th><th>Name</th><th>Company</th><th>Title</th><th>Status</th><th>Email</th><th>Source</th></tr></thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td className="selection-cell"><input type="checkbox" aria-label={`Select ${contact.firstName} ${contact.lastName}`} checked={selected.has(contact.id)} onChange={() => toggle(contact.id)} /></td>
                <td><Link className="person-cell record-link" to={`/contacts/${contact.id}`}><span className="avatar">{contact.firstName[0]}{contact.lastName[0]}</span><strong>{contact.firstName} {contact.lastName}</strong></Link></td>
                <td>{contact.company?.name || "-"}</td><td>{contact.jobTitle || "-"}</td>
                <td><span className="status-pill">{contact.status}</span></td>
                <td>{contact.email || "-"}</td><td>{contact.source || "-"}</td>
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

      <Dialog title="Save contact view" open={saveViewOpen} onClose={() => setSaveViewOpen(false)}>
        <form className="dialog-form" onSubmit={saveView}>
          <label>View name<input name="name" required maxLength={80} /></label>
          <label className="check-label"><input name="isDefault" type="checkbox" />Use as default view</label>
          <footer><button type="button" className="secondary-button" onClick={() => setSaveViewOpen(false)}>Cancel</button><button className="primary-button"><Save size={15} />Save view</button></footer>
        </form>
      </Dialog>

      <Dialog title="Duplicate contacts" open={duplicatesOpen} onClose={() => setDuplicatesOpen(false)}>
        <div className="duplicate-list">
          {duplicateGroups.map((group, index) => (
            <section key={group.contacts.map((contact) => contact.id).join("-")}>
              <header><ListFilter size={16} /><strong>Possible duplicate group {index + 1}</strong></header>
              {group.contacts.map((contact) => (
                <div key={contact.id}>
                  <span><strong>{contact.firstName} {contact.lastName}</strong><small>{contact.email || "No email"} - {contact.company?.name || "No company"}</small></span>
                  <button className="secondary-button" onClick={() => merge(contact.id, group.contacts.filter((item) => item.id !== contact.id).map((item) => item.id))}>Keep this record</button>
                </div>
              ))}
            </section>
          ))}
          {!duplicateGroups.length && <div className="empty-state"><Users size={22} /><p>No exact duplicates found.</p></div>}
        </div>
      </Dialog>
    </div>
  );
}
