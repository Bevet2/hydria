import { Building2, Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import type { Company } from "../types";
import { Link } from "react-router-dom";

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api<{ companies: Company[] }>(`/companies?limit=100&search=${encodeURIComponent(search)}`).then((data) => setCompanies(data.companies));
  }, [search]);
  useEffect(load, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/companies", { method: "POST", body: JSON.stringify(data) });
    setOpen(false);
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Accounts</p><h1>Companies</h1><p>Organizations connected to your pipeline</p></div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Company</button>
      </header>
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies" /></label></div>
      <section className="company-grid">
        {companies.map((company) => (
          <Link className="company-card" to={`/companies/${company.id}`} key={company.id}>
            <div className="company-icon"><Building2 size={20} /></div>
            <div><h2>{company.name}</h2><p>{company.domain || company.industry || "Company"}</p></div>
            <dl><div><dt>Contacts</dt><dd>{company._count?.contacts || 0}</dd></div><div><dt>Deals</dt><dd>{company._count?.deals || 0}</dd></div><div><dt>Location</dt><dd>{[company.city, company.country].filter(Boolean).join(", ") || "—"}</dd></div></dl>
          </Link>
        ))}
        {!companies.length && <div className="empty-state"><Building2 size={24} /><p>No companies found.</p></div>}
      </section>
      <Dialog title="New company" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <label>Company name<input name="name" required /></label>
          <div className="form-grid"><label>Domain<input name="domain" /></label><label>Industry<input name="industry" /></label></div>
          <label>Website<input name="website" type="url" placeholder="https://" /></label>
          <div className="form-grid"><label>City<input name="city" /></label><label>Country<input name="country" /></label></div>
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create company</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
