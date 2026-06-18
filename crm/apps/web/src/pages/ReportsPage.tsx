import { AlertTriangle, ChartNoAxesCombined, CircleDollarSign, Download, Gauge, Plus, Save, Trash2, Trophy } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadCsv } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import type { User } from "../types";

type Reports = {
  summary: { pipelineValue: number; weightedValue: number; wonValue: number; winRate: number; leadConversionRate: number; overdueTasks: number };
  ownerForecast: Array<{ ownerId: string; owner: string; pipeline: number; weighted: number; commit: number; deals: number }>;
  funnel: Array<{ id: string; name: string; count: number; value: number }>;
  sources: Array<{ source: string; count: number }>;
  campaigns: Array<{ id: string; name: string; leads: number; deals: number; revenue: number }>;
  trend: Array<{ month: string; pipeline: number; won: number; created: number }>;
};
type Campaign = { id: string; name: string };
type SavedReport = { id: string; name: string; resource: string; metric: string; filters: Record<string, string> };
type Filters = { from: string; to: string; ownerId: string; campaignId: string };

export function ReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Reports | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", ownerId: "", campaignId: "" });
  const [saveOpen, setSaveOpen] = useState(false);
  const [error, setError] = useState("");
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const money = useMemo(() => new Intl.NumberFormat(user?.organization?.locale || "en", {
    style: "currency",
    currency: user?.organization?.defaultCurrency || "EUR",
    maximumFractionDigits: 0
  }), [user]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);

  const loadReport = useCallback(async () => {
    setData(await api<Reports>(`/reports${query ? `?${query}` : ""}`));
  }, [query]);

  useEffect(() => {
    void Promise.all([
      api<{ users: User[] }>("/users"),
      api<{ campaigns: Campaign[] }>("/sales-ops"),
      api<{ reports: SavedReport[] }>("/reports/saved")
    ]).then(([userData, salesData, savedData]) => {
      setUsers(userData.users);
      setCampaigns(salesData.campaigns);
      setSavedReports(savedData.reports);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load report filters"));
  }, []);

  useEffect(() => { void loadReport().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load reports")); }, [loadReport]);

  async function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/reports/saved", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), resource: "DEALS", metric: "VALUE", groupBy: "STAGE", filters })
    });
    setSavedReports((await api<{ reports: SavedReport[] }>("/reports/saved")).reports);
    setSaveOpen(false);
  }

  async function removeSaved(report: SavedReport) {
    if (!window.confirm(`Delete saved report "${report.name}"?`)) return;
    await api(`/reports/saved/${report.id}`, { method: "DELETE" });
    setSavedReports((current) => current.filter((item) => item.id !== report.id));
  }

  function applySaved(report: SavedReport) {
    setFilters({
      from: String(report.filters?.from || ""),
      to: String(report.filters?.to || ""),
      ownerId: String(report.filters?.ownerId || ""),
      campaignId: String(report.filters?.campaignId || "")
    });
  }

  if (!data) return <div className="page-loading">Loading reports...</div>;
  const maxFunnel = Math.max(1, ...data.funnel.map((item) => item.value));
  const maxSource = Math.max(1, ...data.sources.map((item) => item.count));
  const maxTrend = Math.max(1, ...data.trend.map((item) => Math.max(item.pipeline, item.won)));
  const metrics = [
    ["Pipeline", money.format(data.summary.pipelineValue), Gauge],
    ["Weighted forecast", money.format(data.summary.weightedValue), CircleDollarSign],
    ["Won revenue", money.format(data.summary.wonValue), Trophy],
    ["Win rate", `${data.summary.winRate}%`, ChartNoAxesCombined],
    ["Lead conversion", `${data.summary.leadConversionRate}%`, ChartNoAxesCombined],
    ["Overdue tasks", data.summary.overdueTasks, AlertTriangle]
  ] as const;

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Analytics</p><h1>Reports & forecast</h1><p>Monitor pipeline quality, conversion and team commitments</p></div>
      <div className="header-actions">
        {canManage && <button className="secondary-button" onClick={() => setSaveOpen(true)}><Save size={16} />Save view</button>}
        <button className="secondary-button" onClick={() => void downloadCsv(`/reports/export.csv${query ? `?${query}` : ""}`, "crm-report.csv")}><Download size={16} />Export</button>
      </div>
    </header>
    {error && <p className="settings-error">{error}</p>}
    <section className="panel report-filter-panel">
      <div className="report-filters">
        <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
        <label>Owner<select value={filters.ownerId} onChange={(event) => setFilters((current) => ({ ...current, ownerId: event.target.value }))}><option value="">All owners</option>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
        <label>Campaign<select value={filters.campaignId} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value }))}><option value="">All campaigns</option>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></label>
        <button className="secondary-button" onClick={() => setFilters({ from: "", to: "", ownerId: "", campaignId: "" })}>Reset</button>
      </div>
      {!!savedReports.length && <div className="saved-report-list">
        {savedReports.map((report) => <span key={report.id}><button onClick={() => applySaved(report)}>{report.name}</button>{canManage && <button className="icon-button danger-icon" title={`Delete ${report.name}`} onClick={() => void removeSaved(report)}><Trash2 size={14} /></button>}</span>)}
      </div>}
    </section>
    <section className="metric-grid report-metrics">
      {metrics.map(([label, value, Icon]) => <article className="metric" key={label}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <div className="reports-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Stage analysis</p><h2>Opportunity funnel</h2></div></div><div className="bar-report">
        {data.funnel.map((item) => <div key={item.id}><p><strong>{item.name}</strong><span>{item.count} deals · {money.format(item.value)}</span></p><div><i style={{ width: `${Math.max(3, (item.value / maxFunnel) * 100)}%` }} /></div></div>)}
      </div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Acquisition</p><h2>Lead sources</h2></div></div><div className="bar-report source-report">
        {data.sources.map((item) => <div key={item.source}><p><strong>{item.source}</strong><span>{item.count}</span></p><div><i style={{ width: `${Math.max(5, (item.count / maxSource) * 100)}%` }} /></div></div>)}
      </div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Revenue trend</p><h2>Monthly performance</h2></div></div><div className="trend-report">
        {data.trend.map((item) => <div key={item.month}><span>{item.month}</span><div><i style={{ height: `${Math.max(4, item.pipeline / maxTrend * 100)}%` }} /><b style={{ height: `${Math.max(4, item.won / maxTrend * 100)}%` }} /></div><small>{money.format(item.won)}</small></div>)}
        {!data.trend.length && <p className="empty-state">No data for this period.</p>}
      </div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Attribution</p><h2>Campaign performance</h2></div></div><div className="campaign-report">
        {data.campaigns.map((campaign) => <article key={campaign.id}><strong>{campaign.name}</strong><span>{campaign.leads} leads</span><span>{campaign.deals} deals</span><b>{money.format(campaign.revenue)}</b></article>)}
        {!data.campaigns.length && <p className="empty-state">No campaign data.</p>}
      </div></section>
    </div>
    <section className="panel forecast-table"><div className="panel-heading"><div><p className="eyebrow">Team view</p><h2>Forecast by owner</h2></div></div><div className="data-table-wrap">
      <table className="data-table"><thead><tr><th>Owner</th><th>Deals</th><th>Pipeline</th><th>Weighted</th><th>Commit</th><th>Coverage</th></tr></thead><tbody>
        {data.ownerForecast.map((row) => <tr key={row.ownerId}><td><strong>{row.owner}</strong></td><td>{row.deals}</td><td>{money.format(row.pipeline)}</td><td>{money.format(row.weighted)}</td><td>{money.format(row.commit)}</td><td><span className="coverage-bar"><i style={{ width: `${Math.min(100, row.pipeline ? row.commit / row.pipeline * 100 : 0)}%` }} /></span></td></tr>)}
      </tbody></table>
    </div></section>
    <Dialog title="Save report view" open={saveOpen} onClose={() => setSaveOpen(false)}>
      <form className="dialog-form" onSubmit={(event) => void saveReport(event)}><label>Name<input name="name" required /></label><p>The current date, owner and campaign filters will be saved.</p><footer><button type="button" className="secondary-button" onClick={() => setSaveOpen(false)}>Cancel</button><button className="primary-button"><Plus size={15} />Save view</button></footer></form>
    </Dialog>
  </div>;
}
