import { AlertTriangle, ChartNoAxesCombined, CircleDollarSign, Gauge, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";

type Reports = {
  summary: {
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    winRate: number;
    leadConversionRate: number;
    overdueTasks: number;
  };
  ownerForecast: Array<{ ownerId: string; owner: string; pipeline: number; weighted: number; commit: number; deals: number }>;
  funnel: Array<{ id: string; name: string; count: number; value: number }>;
  sources: Array<{ source: string; count: number }>;
};

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ReportsPage() {
  const [data, setData] = useState<Reports | null>(null);
  useEffect(() => { api<Reports>("/reports").then(setData); }, []);
  if (!data) return <div className="page-loading">Loading reports...</div>;
  const maxFunnel = Math.max(1, ...data.funnel.map((item) => item.value));
  const maxSource = Math.max(1, ...data.sources.map((item) => item.count));

  const metrics = [
    ["Pipeline", money.format(data.summary.pipelineValue), Gauge],
    ["Weighted forecast", money.format(data.summary.weightedValue), CircleDollarSign],
    ["Won revenue", money.format(data.summary.wonValue), Trophy],
    ["Win rate", `${data.summary.winRate}%`, ChartNoAxesCombined],
    ["Lead conversion", `${data.summary.leadConversionRate}%`, ChartNoAxesCombined],
    ["Overdue tasks", data.summary.overdueTasks, AlertTriangle]
  ] as const;

  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Analytics</p><h1>Reports & forecast</h1><p>Monitor pipeline quality, conversion and team commitments</p></div></header>
      <section className="metric-grid report-metrics">
        {metrics.map(([label, value, Icon]) => <article className="metric" key={label}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <div className="reports-grid">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Stage analysis</p><h2>Opportunity funnel</h2></div></div>
          <div className="bar-report">
            {data.funnel.map((item) => <div key={item.id}><p><strong>{item.name}</strong><span>{item.count} deals · {money.format(item.value)}</span></p><div><i style={{ width: `${Math.max(3, (item.value / maxFunnel) * 100)}%` }} /></div></div>)}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Acquisition</p><h2>Lead sources</h2></div></div>
          <div className="bar-report source-report">
            {data.sources.map((item) => <div key={item.source}><p><strong>{item.source}</strong><span>{item.count}</span></p><div><i style={{ width: `${Math.max(5, (item.count / maxSource) * 100)}%` }} /></div></div>)}
          </div>
        </section>
      </div>
      <section className="panel forecast-table">
        <div className="panel-heading"><div><p className="eyebrow">Team view</p><h2>Forecast by owner</h2></div></div>
        <div className="data-table-wrap">
          <table className="data-table"><thead><tr><th>Owner</th><th>Deals</th><th>Pipeline</th><th>Weighted</th><th>Commit</th><th>Coverage</th></tr></thead><tbody>
            {data.ownerForecast.map((row) => <tr key={row.ownerId}><td><strong>{row.owner}</strong></td><td>{row.deals}</td><td>{money.format(row.pipeline)}</td><td>{money.format(row.weighted)}</td><td>{money.format(row.commit)}</td><td><span className="coverage-bar"><i style={{ width: `${Math.min(100, row.pipeline ? (row.commit / row.pipeline) * 100 : 0)}%` }} /></span></td></tr>)}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}
