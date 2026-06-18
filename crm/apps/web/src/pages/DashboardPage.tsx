import { Activity, AlertTriangle, ArrowDown, ArrowUp, Building2, CheckSquare, CircleDollarSign, LifeBuoy, SlidersHorizontal, Target, UserRoundSearch, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
type WidgetId = "contacts" | "companies" | "leads" | "openDeals" | "wonDeals" | "dueTasks" | "pipeline" | "recentActivities" | "openTickets" | "slaBreaches";
type WidgetSize = "compact" | "wide";
type Preference = { widgets: WidgetId[]; layout?: Array<{ id: WidgetId; position: number; size?: WidgetSize }> };

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const widgetOptions: Array<{ id: WidgetId; label: string }> = [
  { id: "openDeals", label: "Open pipeline" },
  { id: "wonDeals", label: "Won revenue" },
  { id: "leads", label: "Active leads" },
  { id: "contacts", label: "Contacts" },
  { id: "companies", label: "Companies" },
  { id: "dueTasks", label: "Tasks due" },
  { id: "openTickets", label: "Open tickets" },
  { id: "slaBreaches", label: "SLA breaches" },
  { id: "pipeline", label: "Pipeline health" },
  { id: "recentActivities", label: "Recent activity" }
];

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<WidgetId[]>([]);
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>([]);
  const [widgetSizes, setWidgetSizes] = useState<Partial<Record<WidgetId, WidgetSize>>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<Dashboard>("/dashboard"),
      api<{ preference: Preference }>("/dashboard/preferences")
    ]).then(([dashboard, preferences]) => {
      setData(dashboard);
      const layout = preferences.preference.layout || [];
      const ordered = [...preferences.preference.widgets].sort((left, right) => {
        const leftPosition = layout.find((item) => item.id === left)?.position ?? 99;
        const rightPosition = layout.find((item) => item.id === right)?.position ?? 99;
        return leftPosition - rightPosition;
      });
      setWidgets([...ordered, ...widgetOptions.map((item) => item.id).filter((id) => !ordered.includes(id))]);
      setEnabledWidgets(preferences.preference.widgets);
      setWidgetSizes(Object.fromEntries(layout.map((item) => [item.id, item.size || "compact"])));
    });
  }, []);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedSet = new Set(new FormData(event.currentTarget).getAll("widgets").map(String) as WidgetId[]);
    const selected = widgets.filter((id) => selectedSet.has(id));
    await api("/dashboard/preferences", {
      method: "PUT",
      body: JSON.stringify({ widgets: selected, layout: selected.map((id, position) => ({ id, position, size: widgetSizes[id] || "compact" })) })
    });
    setEnabledWidgets(selected);
    setSettingsOpen(false);
  }

  if (!data) return <div className="page-loading">Loading dashboard...</div>;
  const metricDefinitions: Record<Exclude<WidgetId, "pipeline" | "recentActivities">, [string, string | number, typeof Target]> = {
    openDeals: ["Open pipeline", currency.format(data.metrics.openValue), Target],
    wonDeals: ["Won revenue", currency.format(data.metrics.wonValue), CircleDollarSign],
    leads: ["Active leads", data.metrics.leads, UserRoundSearch],
    contacts: ["Contacts", data.metrics.contacts, Users],
    companies: ["Companies", data.metrics.companies, Building2],
    dueTasks: ["Tasks due", data.metrics.dueTasks, CheckSquare],
    openTickets: ["Open tickets", data.metrics.openTickets, LifeBuoy],
    slaBreaches: ["SLA breaches", data.metrics.slaBreaches, AlertTriangle]
  };
  const metricWidgets = widgets.filter((id): id is keyof typeof metricDefinitions => enabledWidgets.includes(id) && id in metricDefinitions);
  const setupSteps = [
    {
      title: "Import contacts and companies",
      detail: `${data.metrics.contacts} contacts · ${data.metrics.companies} companies`,
      done: data.metrics.contacts > 0 && data.metrics.companies > 0,
      to: "/contacts"
    },
    {
      title: "Build active pipeline",
      detail: `${data.metrics.openDeals} open opportunities`,
      done: data.metrics.openDeals > 0,
      to: "/pipeline"
    },
    {
      title: "Capture follow-up work",
      detail: `${data.metrics.dueTasks} tasks due this week`,
      done: data.metrics.dueTasks > 0,
      to: "/tasks"
    },
    {
      title: "Operate support queues",
      detail: `${data.metrics.supportQueues || 0} queues · ${data.metrics.openTickets} open tickets · ${data.metrics.slaBreaches} SLA breaches`,
      done: Boolean(data.metrics.supportQueues),
      to: "/tickets"
    }
  ];
  const incompleteSteps = setupSteps.filter((step) => !step.done);
  function moveWidget(id: WidgetId, direction: -1 | 1) {
    setWidgets((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Revenue overview</p><h1>Dashboard</h1></div>
      <div className="header-actions">
        <span className="date-chip">{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date())}</span>
        <button className="icon-button" title="Customize dashboard" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={17} /></button>
      </div>
    </header>
    <section className="crm-command-center">
      <div>
        <p className="eyebrow">CRM readiness</p>
        <h2>{incompleteSteps.length ? `${incompleteSteps.length} setup gaps to close` : "CRM workspace is ready"}</h2>
        <p>Use the live data below to keep sales, success and support moving from the same workspace.</p>
      </div>
      <div className="crm-setup-list">
        {setupSteps.map((step) => (
          <Link key={step.title} to={step.to} className={step.done ? "crm-setup-step is-done" : "crm-setup-step"}>
            <span>{step.done ? "Done" : "Next"}</span>
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
          </Link>
        ))}
      </div>
    </section>
    <section className="metric-grid">
      {metricWidgets.map((id) => {
        const [label, value, Icon] = metricDefinitions[id];
        return <article className="metric" key={id}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>;
      })}
    </section>
    <div className="dashboard-grid">
      {enabledWidgets.includes("pipeline") && <section className={`panel dashboard-widget-${widgetSizes.pipeline || "compact"}`}>
        <div className="panel-heading"><div><p className="eyebrow">Current value</p><h2>Pipeline health</h2></div></div>
        <div className="pipeline-summary">{data.pipeline.map((stage) => <div className="pipeline-row" key={stage.id}>
          <span className="stage-dot" style={{ background: stage.color }} /><strong>{stage.name}</strong><span>{stage.count} deals</span><b>{currency.format(stage.value)}</b>
        </div>)}</div>
      </section>}
      {enabledWidgets.includes("recentActivities") && <section className={`panel dashboard-widget-${widgetSizes.recentActivities || "compact"}`}>
        <div className="panel-heading"><div><p className="eyebrow">Latest changes</p><h2>Activity</h2></div><Activity size={19} /></div>
        <div className="activity-list">{data.recentActivities.map((item) => <div key={item.id}>
          <span className="activity-mark" />
          <p><strong>{item.subject}</strong><small>{item.actor ? `${item.actor.firstName} ${item.actor.lastName} · ` : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.occurredAt))}</small></p>
        </div>)}{!data.recentActivities.length && <p className="empty-state">No activity yet.</p>}</div>
      </section>}
    </div>
    <Dialog title="Customize dashboard" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
      <form className="dialog-form" onSubmit={(event) => void savePreferences(event)}>
        <div className="dashboard-widget-list">{widgets.map((id, index) => {
          const widget = widgetOptions.find((item) => item.id === id)!;
          const canResize = id === "pipeline" || id === "recentActivities";
          return <div className="dashboard-widget-row" key={id}>
            <label className="check-label"><input name="widgets" value={id} type="checkbox" defaultChecked={enabledWidgets.includes(id)} />{widget.label}</label>
            {canResize && <select aria-label={`Size for ${widget.label}`} value={widgetSizes[id] || "compact"} onChange={(event) => setWidgetSizes((current) => ({ ...current, [id]: event.target.value as WidgetSize }))}><option value="compact">Half width</option><option value="wide">Full width</option></select>}
            <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveWidget(id, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-button" title="Move down" disabled={index === widgets.length - 1} onClick={() => moveWidget(id, 1)}><ArrowDown size={15} /></button>
          </div>;
        })}</div>
        <footer><button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button">Save dashboard</button></footer>
      </form>
    </Dialog>
  </div>;
}
