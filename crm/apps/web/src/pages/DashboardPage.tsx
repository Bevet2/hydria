import { Activity, Building2, CheckSquare, CircleDollarSign, SlidersHorizontal, Target, UserRoundSearch, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Dialog } from "../components/Dialog";

type Dashboard = {
  metrics: Record<string, number>;
  pipeline: Array<{ id: string; name: string; color: string; count: number; value: number }>;
  recentActivities: Array<{
    id: string;
    subject: string;
    occurredAt: string;
    actor?: { firstName: string; lastName: string } | null;
  }>;
};
type WidgetId = "contacts" | "companies" | "leads" | "openDeals" | "wonDeals" | "dueTasks" | "pipeline" | "recentActivities";
type Preference = { widgets: WidgetId[] };

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const widgetOptions: Array<{ id: WidgetId; label: string }> = [
  { id: "openDeals", label: "Open pipeline" },
  { id: "wonDeals", label: "Won revenue" },
  { id: "leads", label: "Active leads" },
  { id: "contacts", label: "Contacts" },
  { id: "companies", label: "Companies" },
  { id: "dueTasks", label: "Tasks due" },
  { id: "pipeline", label: "Pipeline health" },
  { id: "recentActivities", label: "Recent activity" }
];

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<WidgetId[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<Dashboard>("/dashboard"),
      api<{ preference: Preference }>("/dashboard/preferences")
    ]).then(([dashboard, preferences]) => {
      setData(dashboard);
      setWidgets(preferences.preference.widgets);
    });
  }, []);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = new FormData(event.currentTarget).getAll("widgets").map(String) as WidgetId[];
    await api("/dashboard/preferences", {
      method: "PUT",
      body: JSON.stringify({ widgets: selected, layout: selected.map((id, position) => ({ id, position })) })
    });
    setWidgets(selected);
    setSettingsOpen(false);
  }

  if (!data) return <div className="page-loading">Loading dashboard...</div>;
  const metricDefinitions: Record<Exclude<WidgetId, "pipeline" | "recentActivities">, [string, string | number, typeof Target]> = {
    openDeals: ["Open pipeline", currency.format(data.metrics.openValue), Target],
    wonDeals: ["Won revenue", currency.format(data.metrics.wonValue), CircleDollarSign],
    leads: ["Active leads", data.metrics.leads, UserRoundSearch],
    contacts: ["Contacts", data.metrics.contacts, Users],
    companies: ["Companies", data.metrics.companies, Building2],
    dueTasks: ["Tasks due", data.metrics.dueTasks, CheckSquare]
  };
  const metricWidgets = widgets.filter((id): id is keyof typeof metricDefinitions => id in metricDefinitions);

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Revenue overview</p><h1>Dashboard</h1></div>
      <div className="header-actions">
        <span className="date-chip">{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date())}</span>
        <button className="icon-button" title="Customize dashboard" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={17} /></button>
      </div>
    </header>
    <section className="metric-grid">
      {metricWidgets.map((id) => {
        const [label, value, Icon] = metricDefinitions[id];
        return <article className="metric" key={id}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>;
      })}
    </section>
    <div className="dashboard-grid">
      {widgets.includes("pipeline") && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Current value</p><h2>Pipeline health</h2></div></div>
        <div className="pipeline-summary">{data.pipeline.map((stage) => <div className="pipeline-row" key={stage.id}>
          <span className="stage-dot" style={{ background: stage.color }} /><strong>{stage.name}</strong><span>{stage.count} deals</span><b>{currency.format(stage.value)}</b>
        </div>)}</div>
      </section>}
      {widgets.includes("recentActivities") && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Latest changes</p><h2>Activity</h2></div><Activity size={19} /></div>
        <div className="activity-list">{data.recentActivities.map((item) => <div key={item.id}>
          <span className="activity-mark" />
          <p><strong>{item.subject}</strong><small>{item.actor ? `${item.actor.firstName} ${item.actor.lastName} · ` : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.occurredAt))}</small></p>
        </div>)}{!data.recentActivities.length && <p className="empty-state">No activity yet.</p>}</div>
      </section>}
    </div>
    <Dialog title="Customize dashboard" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
      <form className="dialog-form" onSubmit={(event) => void savePreferences(event)}>
        <div className="dashboard-widget-list">{widgetOptions.map((widget) => <label className="check-label" key={widget.id}><input name="widgets" value={widget.id} type="checkbox" defaultChecked={widgets.includes(widget.id)} />{widget.label}</label>)}</div>
        <footer><button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button">Save dashboard</button></footer>
      </form>
    </Dialog>
  </div>;
}
