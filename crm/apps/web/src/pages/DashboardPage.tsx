import { Activity, Building2, CheckSquare, CircleDollarSign, Target, UserRoundSearch, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";

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

const currency = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    api<Dashboard>("/dashboard").then(setData);
  }, []);
  if (!data) return <div className="page-loading">Loading dashboard...</div>;

  const metrics = [
    ["Open pipeline", currency.format(data.metrics.openValue), Target],
    ["Won revenue", currency.format(data.metrics.wonValue), CircleDollarSign],
    ["Active leads", data.metrics.leads, UserRoundSearch],
    ["Contacts", data.metrics.contacts, Users],
    ["Companies", data.metrics.companies, Building2],
    ["Tasks due", data.metrics.dueTasks, CheckSquare]
  ] as const;

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Revenue overview</p><h1>Dashboard</h1></div>
        <span className="date-chip">{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date())}</span>
      </header>
      <section className="metric-grid">
        {metrics.map(([label, value, Icon]) => (
          <article className="metric" key={label}>
            <Icon size={19} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Current value</p><h2>Pipeline health</h2></div></div>
          <div className="pipeline-summary">
            {data.pipeline.map((stage) => (
              <div className="pipeline-row" key={stage.id}>
                <span className="stage-dot" style={{ background: stage.color }} />
                <strong>{stage.name}</strong>
                <span>{stage.count} deals</span>
                <b>{currency.format(stage.value)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Latest changes</p><h2>Activity</h2></div><Activity size={19} /></div>
          <div className="activity-list">
            {data.recentActivities.map((item) => (
              <div key={item.id}>
                <span className="activity-mark" />
                <p><strong>{item.subject}</strong><small>{item.actor ? `${item.actor.firstName} ${item.actor.lastName} · ` : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.occurredAt))}</small></p>
              </div>
            ))}
            {!data.recentActivities.length && <p className="empty-state">No activity yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
