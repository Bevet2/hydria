import { Building2, Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { DataTransferButtons } from "../components/DataTransferButtons";
import { Dialog } from "../components/Dialog";
import { ResourceOperationsBar } from "../components/ResourceOperationsBar";
import type { Company, User } from "../types";

export function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const canWrite = user?.role !== "VIEWER";
  const load = useCallback(() => {
    api<{ companies: Company[] }>(`/companies?limit=100&search=${encodeURIComponent(search)}`)
      .then((data) => setCompanies(data.companies))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load companies"));
  }, [search]);

  useEffect(load, [load]);
  useEffect(() => { void api<{ users: User[] }>("/users").then((data) => setUsers(data.users)); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/companies", { method: "POST", body: JSON.stringify(data) });
      setOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create company");
    }
  }

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Accounts</p><h1>Companies</h1><p>Organizations connected to your pipeline</p></div>
      <div className="header-actions"><DataTransferButtons resource="companies" canImport={canWrite} onImported={load} />{canWrite && <button className="primary-button" onClick={() => { setError(""); setOpen(true); }}><Plus size={16} />Company</button>}</div>
    </header>
    {error && !open && <p className="settings-error">{error}</p>}
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies" /></label></div>
    <ResourceOperationsBar
      resource="COMPANIES"
      bulkResource="companies"
      filters={{ search }}
      onApplyFilters={(filters) => setSearch(String(filters.search || ""))}
      selectedIds={selectedIds}
      onClearSelection={() => setSelectedIds([])}
      onRefresh={load}
      canWrite={canWrite}
      users={users}
      duplicates="companies"
      actions={[{ value: "ASSIGN_OWNER", label: "Assign owner" }, { value: "DELETE", label: "Delete" }]}
    />
    <section className="company-grid">
      {companies.map((company) => <div className="selectable-card-wrap" key={company.id}>
        {canWrite && <label className="record-selector"><input type="checkbox" checked={selectedIds.includes(company.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, company.id] : current.filter((id) => id !== company.id))} aria-label={`Select ${company.name}`} /></label>}
        <Link className="company-card" to={`/companies/${company.id}`}>
          <div className="company-icon"><Building2 size={20} /></div>
          <div><h2>{company.name}</h2><p>{company.domain || company.industry || "Company"}</p></div>
          <dl><div><dt>Contacts</dt><dd>{company._count?.contacts || 0}</dd></div><div><dt>Deals</dt><dd>{company._count?.deals || 0}</dd></div><div><dt>Location</dt><dd>{[company.city, company.country].filter(Boolean).join(", ") || "-"}</dd></div></dl>
        </Link>
      </div>)}
      {!companies.length && <div className="empty-state"><Building2 size={24} /><p>No companies found.</p></div>}
    </section>
    <Dialog title="New company" open={open} onClose={() => setOpen(false)}>
      <form className="dialog-form" onSubmit={create}>
        <label>Company name<input name="name" required /></label>
        <div className="form-grid"><label>Domain<input name="domain" /></label><label>Industry<input name="industry" /></label></div>
        <label>Website<input name="website" type="url" placeholder="https://" /></label>
        <div className="form-grid"><label>City<input name="city" /></label><label>Country<input name="country" /></label></div>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create company</button></footer>
      </form>
    </Dialog>
  </div>;
}
