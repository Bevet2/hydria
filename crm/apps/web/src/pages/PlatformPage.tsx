import { Activity, DatabaseBackup, Goal, KeyRound, Plus, ShieldCheck, Trash2, Webhook, Workflow } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import { AutomationBuilder } from "../components/AutomationBuilder";

type Rule = { id: string; name: string; trigger: string; action: string; active: boolean; _count?: { runs: number } };
type AutomationRun = { id: string; entityType: string; entityId: string; status: string; error?: string | null; createdAt: string; rule: { name: string; trigger: string; action: string } };
type ApiKey = { id: string; name: string; prefix: string; revokedAt?: string | null; lastUsedAt?: string | null };
type Endpoint = { id: string; name: string; url: string; active: boolean; events: string[] };
type GoalItem = { id: string; name: string; metric: string; target: number | string; achieved: number; progressPercent: number };
type PrivacyRequest = { id: string; type: string; subjectEmail: string; status: string; createdAt: string };
type Consent = { id: string; email: string; purpose: string; status: string; legalBasis?: string | null; capturedAt: string };
type Monitor = { errors: number; failedAutomations: number; failedWebhooks: number; failedEmails: number; activeSessions: number; deadLetterJobs: number };
type BackgroundJob = { id: string; type: string; status: string; attempts: number; maxAttempts: number; lastError?: string | null; createdAt: string };
type BackupSchedule = { enabled: boolean; cron: string; target: string; lastStatus?: string | null; lastRunAt?: string | null; lastError?: string | null };
type Readiness = { services: Record<"google" | "microsoft" | "stripe" | "transactionalEmail" | "externalAlerts" | "remoteBackup", boolean> };

export function PlatformPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyRequest[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [retentionDays, setRetentionDays] = useState(2555);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [dialog, setDialog] = useState<"rule" | "key" | "webhook" | "goal" | "privacy" | "consent" | "retention" | "backup" | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    const [ruleData, runData, goalData, monitorData, readinessData] = await Promise.all([
      api<{ rules: Rule[] }>("/automations"),
      api<{ runs: AutomationRun[] }>("/automations/runs/history?limit=30"),
      api<{ goals: GoalItem[] }>("/commercial/goals"),
      api<Monitor>("/monitoring/summary"),
      api<Readiness>("/integrations/readiness")
    ]);
    setRules(ruleData.rules);
    setRuns(runData.runs);
    setGoals(goalData.goals);
    setMonitor(monitorData);
    setReadiness(readinessData);
    if (isAdmin) {
      const [keyData, webhookData, privacyData, consentData, retentionData, backupData, jobData] = await Promise.all([
        api<{ keys: ApiKey[] }>("/api-keys"),
        api<{ endpoints: Endpoint[] }>("/webhooks"),
        api<{ requests: PrivacyRequest[] }>("/compliance/privacy-requests"),
        api<{ consents: Consent[] }>("/compliance/consents"),
        api<{ retentionDays: number }>("/compliance/retention"),
        api<{ schedule: BackupSchedule | null }>("/backups/schedule"),
        api<{ jobs: BackgroundJob[] }>("/monitoring/jobs?status=DEAD_LETTER")
      ]);
      setKeys(keyData.keys);
      setEndpoints(webhookData.endpoints);
      setPrivacy(privacyData.requests);
      setConsents(consentData.consents);
      setRetentionDays(retentionData.retentionDays);
      setSchedule(backupData.schedule);
      setJobs(jobData.jobs);
    }
  }, [isAdmin]);

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load platform settings")); }, [load]);

  async function submitKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api<{ token: string }>("/api-keys", { method: "POST", body: JSON.stringify({
      name: form.get("name"),
      scopes: form.getAll("scopes").map(String)
    }) });
    setSecret(result.token); setDialog(null); await load();
  }

  async function submitWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api<{ secret: string }>("/webhooks", { method: "POST", body: JSON.stringify({
      name: data.name, url: data.url,
      events: String(data.events).split(",").map((item) => item.trim()).filter(Boolean)
    }) });
    setSecret(result.secret); setDialog(null); await load();
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/commercial/goals", { method: "POST", body: JSON.stringify({
      name: data.name, metric: data.metric, target: data.target,
      periodStart: new Date(String(data.periodStart)).toISOString(),
      periodEnd: new Date(String(data.periodEnd)).toISOString()
    }) });
    setDialog(null); await load();
  }

  async function submitPrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/compliance/privacy-requests", { method: "POST", body: JSON.stringify(data) });
    setDialog(null); await load();
  }

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/compliance/consents", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        purpose: data.purpose,
        status: data.status,
        source: data.source || undefined,
        legalBasis: data.legalBasis || undefined
      })
    });
    setDialog(null);
    await load();
  }

  async function submitRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/compliance/retention", {
      method: "PUT",
      body: JSON.stringify({ retentionDays: Number(data.retentionDays) })
    });
    setDialog(null);
    await load();
  }

  async function submitBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/backups/schedule", { method: "PUT", body: JSON.stringify({
      enabled: data.enabled === "on", cron: data.cron, target: data.target,
      endpoint: data.endpoint || undefined
    }) });
    setDialog(null); await load();
  }

  async function remove(path: string, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    await api(path, { method: "DELETE" }); await load();
  }

  async function toggleRule(rule: Rule) {
    await api(`/automations/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !rule.active })
    });
    await load();
  }

  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">Operations</p><h1>Automation & platform</h1><p>Rules, integrations, governance and reliability</p></div></header>
    {error && <p className="settings-error">{error}</p>}
    {secret && <section className="settings-section secret-banner"><div><KeyRound size={18} /><p><strong>Secret shown once</strong><code>{secret}</code></p><button className="icon-button" onClick={() => setSecret("")}>×</button></div></section>}

    <section className="settings-section">
      <div className="section-title"><div><Workflow size={19} /><span><h2>Automation rules</h2><p>Assignment, tasks, email and pipeline actions</p></span></div><button className="secondary-button" onClick={() => setDialog("rule")}><Plus size={16} />Rule</button></div>
      <div className="field-list">{rules.map((rule) => <div key={rule.id}><strong>{rule.name}</strong><span>{rule.trigger.toLowerCase().replaceAll("_", " ")}</span><code>{rule.action.toLowerCase().replaceAll("_", " ")}</code><b>{rule._count?.runs || 0} runs</b><label className="switch-label"><input type="checkbox" checked={rule.active} onChange={() => void toggleRule(rule)} /><span>{rule.active ? "Active" : "Paused"}</span></label><button className="icon-button danger-icon" title="Delete rule" onClick={() => remove(`/automations/${rule.id}`, `Delete ${rule.name}?`)}><Trash2 size={15} /></button></div>)}{!rules.length && <p className="empty-state">No automation rule.</p>}</div>
      <div className="automation-runs">
        <h3>Recent executions</h3>
        {runs.map((run) => <article key={run.id} className={run.status === "FAILED" ? "is-failed" : ""}>
          <span><strong>{run.rule.name}</strong><small>{run.entityType} · {new Date(run.createdAt).toLocaleString()}</small></span>
          <b>{run.status.toLowerCase()}</b>
          <p>{run.error || `${run.rule.trigger.toLowerCase()} → ${run.rule.action.toLowerCase()}`}</p>
        </article>)}
        {!runs.length && <p className="empty-state">No automation execution yet.</p>}
      </div>
    </section>

    <section className="settings-section">
      <div className="section-title"><div><Goal size={19} /><span><h2>Sales goals</h2><p>Revenue, won deals and activity targets</p></span></div><button className="secondary-button" onClick={() => setDialog("goal")}><Plus size={16} />Goal</button></div>
      <div className="goal-grid">{goals.map((goal) => <article key={goal.id}><strong>{goal.name}</strong><span>{goal.achieved} / {Number(goal.target)}</span><div className="progress-track"><i style={{ width: `${Math.min(100, goal.progressPercent)}%` }} /></div><small>{goal.progressPercent}%</small></article>)}{!goals.length && <p className="empty-state">No sales goal.</p>}</div>
    </section>

    {monitor && <section className="settings-section"><div className="section-title"><div><Activity size={19} /><span><h2>Health</h2><p>Last 24 hours</p></span></div></div><div className="platform-health-grid"><article><span>API errors</span><strong>{monitor.errors}</strong></article><article><span>Automation failures</span><strong>{monitor.failedAutomations}</strong></article><article><span>Webhook failures</span><strong>{monitor.failedWebhooks}</strong></article><article><span>Email failures</span><strong>{monitor.failedEmails}</strong></article><article><span>Dead-letter jobs</span><strong>{monitor.deadLetterJobs}</strong></article><article><span>Active sessions</span><strong>{monitor.activeSessions}</strong></article></div></section>}
    {readiness && <section className="settings-section"><div className="section-title"><div><ShieldCheck size={19} /><span><h2>Production readiness</h2><p>External services required for live operation</p></span></div></div><div className="readiness-grid">{Object.entries(readiness.services).map(([service, configured]) => <article key={service} className={configured ? "is-ready" : "is-missing"}><span>{service.replace(/([A-Z])/g, " $1").toLowerCase()}</span><strong>{configured ? "Configured" : "Missing"}</strong></article>)}</div></section>}

    {isAdmin && <>
      <section className="settings-section"><div className="section-title"><div><KeyRound size={19} /><span><h2>API keys</h2><p>Scoped access for third-party applications</p></span></div><button className="secondary-button" onClick={() => setDialog("key")}><Plus size={16} />Key</button></div><div className="field-list">{keys.filter((key) => !key.revokedAt).map((key) => <div key={key.id}><strong>{key.name}</strong><code>{key.prefix}</code><span>{key.lastUsedAt ? "used" : "unused"}</span><button className="icon-button danger-icon" title="Revoke key" onClick={() => remove(`/api-keys/${key.id}`, `Revoke ${key.name}?`)}><Trash2 size={15} /></button></div>)}</div></section>
      <section className="settings-section"><div className="section-title"><div><Webhook size={19} /><span><h2>Webhooks</h2><p>Signed outbound event delivery</p></span></div><button className="secondary-button" onClick={() => setDialog("webhook")}><Plus size={16} />Endpoint</button></div><div className="field-list">{endpoints.map((endpoint) => <div key={endpoint.id}><strong>{endpoint.name}</strong><code>{endpoint.url}</code><span>{endpoint.active ? "active" : "paused"}</span><button className="icon-button danger-icon" title="Delete webhook" onClick={() => remove(`/webhooks/${endpoint.id}`, `Delete ${endpoint.name}?`)}><Trash2 size={15} /></button></div>)}</div></section>
      <section className="settings-section"><div className="section-title"><div><ShieldCheck size={19} /><span><h2>Privacy requests</h2><p>Export, anonymization and deletion workflow</p></span></div><button className="secondary-button" onClick={() => setDialog("privacy")}><Plus size={16} />Request</button></div><div className="field-list">{privacy.map((item) => <div key={item.id}><strong>{item.subjectEmail}</strong><span>{item.type.toLowerCase()}</span><b>{item.status.toLowerCase()}</b>{item.status === "PENDING" && <button className="secondary-button compact" onClick={() => api(`/compliance/privacy-requests/${item.id}/process`, { method: "POST", body: JSON.stringify({ confirmation: item.subjectEmail }) }).then(load)}>Process</button>}</div>)}</div></section>
      <section className="settings-section"><div className="section-title"><div><ShieldCheck size={19} /><span><h2>Consent register</h2><p>Legal basis and opt-in history</p></span></div><button className="secondary-button" onClick={() => setDialog("consent")}><Plus size={16} />Consent</button></div><div className="field-list">{consents.slice(0, 50).map((consent) => <div key={consent.id}><strong>{consent.email}</strong><span>{consent.purpose}</span><code>{consent.legalBasis || "unspecified"}</code><b>{consent.status.toLowerCase()}</b></div>)}{!consents.length && <p className="empty-state">No consent record.</p>}</div></section>
      <section className="settings-section"><div className="section-title"><div><ShieldCheck size={19} /><span><h2>Data retention</h2><p>{retentionDays} days for audit, error and webhook history</p></span></div><div className="header-actions"><button className="secondary-button" onClick={() => api("/compliance/retention/run", { method: "POST", body: JSON.stringify({}) }).then(load)}>Run cleanup</button><button className="secondary-button" onClick={() => setDialog("retention")}>Configure</button></div></div></section>
      <section className="settings-section"><div className="section-title"><div><DatabaseBackup size={19} /><span><h2>Scheduled backup</h2><p>{schedule?.lastStatus ? `${schedule.lastStatus.toLowerCase()} · ${schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : ""}` : "Not configured"}</p></span></div><div className="header-actions">{schedule && <button className="secondary-button" onClick={() => api("/backups/schedule/run", { method: "POST" }).then(load)}>Run now</button>}<button className="secondary-button" onClick={() => setDialog("backup")}>Configure</button></div></div>{schedule?.lastError && <p className="form-error">{schedule.lastError}</p>}</section>
      <section className="settings-section"><div className="section-title"><div><Activity size={19} /><span><h2>Dead-letter queue</h2><p>Jobs that exhausted automatic retries</p></span></div></div><div className="field-list">{jobs.map((job) => <div key={job.id}><strong>{job.type.toLowerCase().replaceAll("_", " ")}</strong><span>{job.attempts}/{job.maxAttempts} attempts</span><code>{job.lastError || "Unknown failure"}</code><button className="secondary-button compact" onClick={() => api(`/monitoring/jobs/${job.id}/retry`, { method: "POST", body: JSON.stringify({ confirmation: "RETRY" }) }).then(load)}>Retry</button></div>)}{!jobs.length && <p className="empty-state">No dead-letter job.</p>}</div></section>
    </>}

    <Dialog title="New automation rule" open={dialog === "rule"} onClose={() => setDialog(null)}><AutomationBuilder onCancel={() => setDialog(null)} onSaved={async () => { setDialog(null); await load(); }} /></Dialog>
    <Dialog title="New API key" open={dialog === "key"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitKey}><label>Name<input name="name" required /></label><fieldset><legend>Scopes</legend><div className="dashboard-widget-list"><label className="check-label"><input name="scopes" value="crm:read" type="checkbox" defaultChecked />Read CRM</label><label className="check-label"><input name="scopes" value="crm:write" type="checkbox" />Write CRM</label><label className="check-label"><input name="scopes" value="crm:commercial" type="checkbox" />Commercial operations</label><label className="check-label"><input name="scopes" value="crm:communications" type="checkbox" />Email and integrations</label><label className="check-label"><input name="scopes" value="crm:admin" type="checkbox" />Administration</label></div></fieldset><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create key</button></footer></form></Dialog>
    <Dialog title="New webhook" open={dialog === "webhook"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitWebhook}><label>Name<input name="name" required /></label><label>HTTPS URL<input name="url" type="url" required /></label><label>Events<input name="events" defaultValue="*" required /></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create endpoint</button></footer></form></Dialog>
    <Dialog title="New sales goal" open={dialog === "goal"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitGoal}><label>Name<input name="name" required /></label><div className="form-grid"><label>Metric<select name="metric"><option>WON_REVENUE</option><option>WON_DEALS</option><option>ACTIVITIES</option></select></label><label>Target<input name="target" type="number" min="1" required /></label></div><div className="form-grid"><label>Start<input name="periodStart" type="date" required /></label><label>End<input name="periodEnd" type="date" required /></label></div><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create goal</button></footer></form></Dialog>
    <Dialog title="Privacy request" open={dialog === "privacy"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitPrivacy}><label>Subject email<input name="subjectEmail" type="email" required /></label><label>Request<select name="type"><option>EXPORT</option><option>ANONYMIZE</option><option>DELETE</option></select></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Create request</button></footer></form></Dialog>
    <Dialog title="Record consent" open={dialog === "consent"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitConsent}><label>Email<input name="email" type="email" required /></label><label>Purpose<input name="purpose" placeholder="Commercial email" required /></label><div className="form-grid"><label>Status<select name="status"><option>GRANTED</option><option>WITHDRAWN</option></select></label><label>Legal basis<select name="legalBasis"><option>Consent</option><option>Contract</option><option>Legitimate interest</option><option>Legal obligation</option></select></label></div><label>Source<input name="source" placeholder="Web form, contract, phone..." /></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Record consent</button></footer></form></Dialog>
    <Dialog title="Retention policy" open={dialog === "retention"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitRetention}><label>Retention period (days)<input name="retentionDays" type="number" min="30" max="3650" defaultValue={retentionDays} required /></label><p>Cleanup removes expired audit logs, error events and webhook delivery history.</p><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Save policy</button></footer></form></Dialog>
    <Dialog title="Backup schedule" open={dialog === "backup"} onClose={() => setDialog(null)}><form className="dialog-form" onSubmit={submitBackup}><label className="check-label"><input name="enabled" type="checkbox" defaultChecked={schedule?.enabled} />Enabled</label><label>Daily schedule<input name="cron" defaultValue={schedule?.cron || "0 2 * * *"} required /></label><label>Target<select name="target" defaultValue={schedule?.target || "LOCAL"}><option>LOCAL</option><option>HTTPS</option></select></label><label>Remote endpoint<input name="endpoint" type="url" /></label><footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Save schedule</button></footer></form></Dialog>
  </div>;
}
