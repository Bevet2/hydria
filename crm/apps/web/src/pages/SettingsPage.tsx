import { Building2, Columns3, DatabaseBackup, Download, History, Plus, Save, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import { SecuritySettings } from "../components/SecuritySettings";
import type { AuditLog, Role, Stage, User } from "../types";

type Definition = {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  options?: string[] | null;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  metadata?: { firstName?: string; lastName?: string };
};
type OrganizationSettings = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  brandColor: string;
  defaultCurrency: string;
  locale: string;
  timezone: string;
  defaultTaxPercent: number | string;
  paymentTermsDays: number;
  quotePrefix: string;
  invoicePrefix: string;
};
type Team = {
  id: string;
  name: string;
  permissionPolicy?: Record<string, unknown> | null;
  _count?: { users: number };
};
const permissionResources = ["contacts", "companies", "leads", "deals", "tasks", "tickets", "products", "quotes", "communications", "customObjects"];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageDrafts, setStageDrafts] = useState<Record<string, Stage>>({});
  const [fieldOpen, setFieldOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamOpen, setTeamOpen] = useState(false);
  const [permissionMember, setPermissionMember] = useState<User | null>(null);
  const [error, setError] = useState("");
  const restoreRef = useRef<HTMLInputElement>(null);
  const canAdmin = user?.role === "ADMIN";
  const canConfigure = user?.role === "ADMIN" || user?.role === "MANAGER";

  const load = useCallback(() => {
    Promise.all([
      api<{ users: User[] }>("/users"),
      api<{ definitions: Definition[] }>("/custom-fields"),
      api<{ stages: Stage[] }>("/pipeline"),
      api<{ organization: OrganizationSettings }>("/organization")
    ]).then(([userData, fieldData, pipelineData, organizationData]) => {
      setUsers(userData.users);
      setDefinitions(fieldData.definitions);
      setStages(pipelineData.stages);
      setStageDrafts(Object.fromEntries(pipelineData.stages.map((stage) => [stage.id, stage])));
      setOrganization(organizationData.organization);
    });
    if (canAdmin) {
      api<{ invitations: Invitation[] }>("/users/invitations")
        .then((data) => setInvitations(data.invitations));
    }
    if (canConfigure) {
      api<{ teams: Team[] }>("/users/teams").then((data) => setTeams(data.teams));
    }
  }, [canAdmin, canConfigure]);

  useEffect(load, [load]);
  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      api<{ logs: AuditLog[] }>("/audit-logs?limit=25")
        .then((data) => setAuditLogs(data.logs))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load audit log"));
    }
  }, [user?.role]);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ debugUrl?: string }>("/users/invitations", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (result.debugUrl) window.prompt("Development invitation link", result.debugUrl);
      setMemberOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create member");
    }
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      setError("");
      const result = await api<{ organization: OrganizationSettings }>("/organization", {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          logoUrl: data.logoUrl || null,
          brandColor: data.brandColor,
          defaultCurrency: data.defaultCurrency,
          locale: data.locale,
          timezone: data.timezone,
          defaultTaxPercent: Number(data.defaultTaxPercent),
          paymentTermsDays: Number(data.paymentTermsDays),
          quotePrefix: data.quotePrefix,
          invoicePrefix: data.invoicePrefix
        })
      });
      setOrganization(result.organization);
      await refreshUser();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save organization settings");
    }
  }

  async function changeRole(member: User, role: Role) {
    setError("");
    try {
      await api(`/users/${member.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update role");
      load();
    }
  }

  function policyFromForm(form: FormData) {
    return {
      objects: Object.fromEntries(permissionResources.map((resource) => [
        resource,
        {
          read: form.get(`${resource}:read`) === "on",
          write: form.get(`${resource}:write`) === "on"
        }
      ])),
      properties: Object.fromEntries(permissionResources
        .map((resource) => [
          resource,
          String(form.get(`${resource}:properties`) || "").split(",").map((item) => item.trim()).filter(Boolean)
        ])
        .filter(([, properties]) => (properties as string[]).length))
    };
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/users/teams", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name") || ""),
        permissionPolicy: policyFromForm(form)
      })
    });
    setTeamOpen(false);
    load();
  }

  async function saveMemberPermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissionMember) return;
    const form = new FormData(event.currentTarget);
    await api(`/users/${permissionMember.id}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({
        teamId: String(form.get("teamId") || "") || null,
        permissionPolicy: policyFromForm(form)
      })
    });
    setPermissionMember(null);
    load();
  }

  async function createField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/custom-fields", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          required: data.required === "on",
          options: String(data.options || "").split(",").map((option) => option.trim()).filter(Boolean)
        })
      });
      setFieldOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create custom field");
    }
  }

  async function deleteField(field: Definition) {
    if (!window.confirm(`Delete the custom field "${field.label}" and its values?`)) return;
    setError("");
    try {
      await api(`/custom-fields/${field.id}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete custom field");
    }
  }

  async function createStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/pipeline/stages", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          color: data.color,
          isWon: data.outcome === "won",
          isLost: data.outcome === "lost"
        })
      });
      setStageOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create pipeline stage");
    }
  }

  async function saveStage(stageId: string) {
    const stage = stageDrafts[stageId];
    setError("");
    try {
      await api(`/pipeline/stages/${stageId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: stage.name,
          color: stage.color,
          isWon: stage.isWon,
          isLost: stage.isLost
        })
      });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update pipeline stage");
    }
  }

  async function deleteStage(stage: Stage) {
    if (!window.confirm(`Delete the pipeline stage "${stage.name}"?`)) return;
    try {
      await api(`/pipeline/stages/${stage.id}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete pipeline stage");
    }
  }

  function updateStageDraft(stageId: string, patch: Partial<Stage>) {
    setStageDrafts((current) => ({
      ...current,
      [stageId]: { ...current[stageId], ...patch }
    }));
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    if (!window.confirm("Replace all CRM business data in this organization with this backup?")) {
      if (restoreRef.current) restoreRef.current.value = "";
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("confirmation", "RESTORE");
    try {
      setError("");
      await api("/backups/restore", { method: "POST", body });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to restore backup");
    } finally {
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  function permissionChecked(member: User | null, resource: string, action: "read" | "write") {
    const objects = member?.permissionPolicy?.objects as Record<string, Record<string, boolean>> | undefined;
    return objects?.[resource]?.[action] !== false;
  }

  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Settings</h1><p>Access, pipeline and data model configuration</p></div></header>
      {error && <p className="settings-error">{error}</p>}

      {canAdmin && organization && <section className="settings-section">
        <div className="section-title"><div><Building2 size={19} /><span><h2>Organization profile</h2><p>Brand, regional defaults and commercial numbering</p></span></div></div>
        <form className="organization-settings-form" onSubmit={(event) => void saveOrganization(event)} key={`${organization.id}-${organization.name}-${organization.defaultCurrency}`}>
          <div className="form-grid"><label>Name<input name="name" defaultValue={organization.name} required /></label><label>Logo URL<input name="logoUrl" type="url" defaultValue={organization.logoUrl || ""} /></label></div>
          <div className="form-grid"><label>Brand color<input name="brandColor" type="color" defaultValue={organization.brandColor} /></label><label>Default currency<input name="defaultCurrency" defaultValue={organization.defaultCurrency} minLength={3} maxLength={3} required /></label></div>
          <div className="form-grid"><label>Locale<input name="locale" defaultValue={organization.locale} required /></label><label>Timezone<input name="timezone" defaultValue={organization.timezone} required /></label></div>
          <div className="form-grid"><label>Default tax (%)<input name="defaultTaxPercent" type="number" min="0" max="100" step="0.01" defaultValue={Number(organization.defaultTaxPercent)} required /></label><label>Payment terms (days)<input name="paymentTermsDays" type="number" min="0" max="365" defaultValue={organization.paymentTermsDays} required /></label></div>
          <div className="form-grid"><label>Quote prefix<input name="quotePrefix" defaultValue={organization.quotePrefix} required /></label><label>Invoice prefix<input name="invoicePrefix" defaultValue={organization.invoicePrefix} required /></label></div>
          <footer><button className="primary-button"><Save size={16} />Save organization</button></footer>
        </form>
      </section>}

      <section className="settings-section">
        <div className="section-title">
          <div><ShieldCheck size={19} /><span><h2>Members and roles</h2><p>Role-based access applies to every CRM resource.</p></span></div>
          {canAdmin && <button className="secondary-button" onClick={() => { setError(""); setMemberOpen(true); }}><UserPlus size={16} />Member</button>}
        </div>
        <div className="member-list">
          {users.map((member) => (
            <div key={member.id}>
              <span className="avatar">{member.firstName[0]}{member.lastName[0]}</span>
              <p><strong>{member.firstName} {member.lastName}</strong><small>{member.email}</small></p>
              {canAdmin ? (
                <select className="compact-select" value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)}>
                  <option>ADMIN</option><option>MANAGER</option><option>MEMBER</option><option>VIEWER</option>
                </select>
              ) : <span className="role-pill">{member.role.toLowerCase()}</span>}
              {canAdmin && <button className="secondary-button" onClick={() => setPermissionMember(member)}>Permissions</button>}
            </div>
          ))}
          {invitations.map((invitation) => (
            <div key={invitation.id}>
              <span className="avatar">?</span>
              <p><strong>{invitation.metadata?.firstName || "Pending"} {invitation.metadata?.lastName || "invitation"}</strong><small>{invitation.email} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</small></p>
              <span className="role-pill">{invitation.role.toLowerCase()}</span>
              <button className="icon-button danger-icon" title="Cancel invitation" onClick={() => api(`/users/invitations/${invitation.id}`, { method: "DELETE" }).then(load)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </section>

      {canConfigure && <section className="settings-section">
        <div className="section-title">
          <div><ShieldCheck size={19} /><span><h2>Teams and permission policies</h2><p>Restrict read, write and property access by team or member.</p></span></div>
          {canAdmin && <button className="secondary-button" onClick={() => setTeamOpen(true)}><Plus size={16} />Team</button>}
        </div>
        <div className="field-list">
          {teams.map((team) => <div key={team.id}><strong>{team.name}</strong><span>{team._count?.users || 0} members</span><code>{Object.keys((team.permissionPolicy?.objects as object) || {}).length} object rules</code></div>)}
          {!teams.length && <p className="empty-state">No team policy configured.</p>}
        </div>
      </section>}

      <SecuritySettings />

      {canAdmin && (
        <section className="settings-section">
          <div className="section-title">
            <div><DatabaseBackup size={19} /><span><h2>Backup and restore</h2><p>Export or replace the organization data, including attached files.</p></span></div>
            <div className="header-actions">
              <button className="secondary-button" onClick={() => downloadFile("/backups/export", `hydria-crm-backup-${new Date().toISOString().slice(0, 10)}.json`)}><Download size={16} />Backup</button>
              <input ref={restoreRef} hidden type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} />
              <button className="secondary-button" onClick={() => restoreRef.current?.click()}><Upload size={16} />Restore</button>
            </div>
          </div>
        </section>
      )}

      {canConfigure && (
        <section className="settings-section">
          <div className="section-title">
            <div><History size={19} /><span><h2>Audit log</h2><p>Recent successful changes made through the CRM API.</p></span></div>
          </div>
          <div className="audit-list">
            {auditLogs.map((log) => (
              <div key={log.id}>
                <span className={`audit-method method-${log.method.toLowerCase()}`}>{log.method}</span>
                <p><strong>{log.path}</strong><small>{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"} - {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt))}</small></p>
                <b>{log.statusCode}</b>
              </div>
            ))}
            {!auditLogs.length && <p className="empty-state">No audited changes yet.</p>}
          </div>
        </section>
      )}

      <section className="settings-section">
        <div className="section-title">
          <div><Columns3 size={19} /><span><h2>Pipeline stages</h2><p>Define the sales process and its won or lost outcomes.</p></span></div>
          {canConfigure && <button className="secondary-button" onClick={() => { setError(""); setStageOpen(true); }}><Plus size={16} />Stage</button>}
        </div>
        <div className="stage-settings-list">
          {stages.map((stage) => {
            const draft = stageDrafts[stage.id] || stage;
            const outcome = draft.isWon ? "won" : draft.isLost ? "lost" : "open";
            return (
              <div key={stage.id}>
                <input type="color" value={draft.color} disabled={!canConfigure} aria-label={`Color for ${stage.name}`} onChange={(event) => updateStageDraft(stage.id, { color: event.target.value })} />
                <input value={draft.name} disabled={!canConfigure} aria-label="Stage name" onChange={(event) => updateStageDraft(stage.id, { name: event.target.value })} />
                <select value={outcome} disabled={!canConfigure} onChange={(event) => updateStageDraft(stage.id, { isWon: event.target.value === "won", isLost: event.target.value === "lost" })}>
                  <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option>
                </select>
                {canConfigure && <div className="row-actions"><button className="icon-button" title="Save stage" onClick={() => saveStage(stage.id)}><Save size={16} /></button><button className="icon-button danger-icon" title="Delete stage" onClick={() => deleteStage(stage)}><Trash2 size={16} /></button></div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <div><SlidersHorizontal size={19} /><span><h2>Custom fields</h2><p>Extend leads, contacts, companies and deals without changing the schema.</p></span></div>
          {canConfigure && <button className="secondary-button" onClick={() => { setError(""); setFieldOpen(true); }}><Plus size={16} />Field</button>}
        </div>
        <div className="field-list">
          {definitions.map((field) => (
            <div key={field.id}>
              <strong>{field.label}</strong><span>{field.entityType.toLowerCase()}</span><code>{field.key}</code><b>{field.fieldType.toLowerCase()}</b>
              {canConfigure && <button className="icon-button danger-icon" title="Delete field" onClick={() => deleteField(field)}><Trash2 size={15} /></button>}
            </div>
          ))}
          {!definitions.length && <p className="empty-state">No custom fields configured.</p>}
        </div>
      </section>

      <Dialog title="New member" open={memberOpen} onClose={() => setMemberOpen(false)}>
        <form className="dialog-form" onSubmit={createMember}>
          <div className="form-grid"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
          <label>Email<input name="email" type="email" required /></label>
          <label>Role<select name="role" defaultValue="MEMBER"><option>ADMIN</option><option>MANAGER</option><option>MEMBER</option><option>VIEWER</option></select></label>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setMemberOpen(false)}>Cancel</button><button className="primary-button">Send invitation</button></footer>
        </form>
      </Dialog>

      <Dialog title="New permission team" open={teamOpen} onClose={() => setTeamOpen(false)}>
        <form className="dialog-form" onSubmit={(event) => void createTeam(event)}>
          <label>Team name<input name="name" required /></label>
          <div className="permission-grid">{permissionResources.map((resource) => <div key={resource}>
            <strong>{resource}</strong>
            <label className="check-label"><input name={`${resource}:read`} type="checkbox" defaultChecked />Read</label>
            <label className="check-label"><input name={`${resource}:write`} type="checkbox" defaultChecked />Write</label>
            <input name={`${resource}:properties`} placeholder="Allowed write properties (optional)" />
          </div>)}</div>
          <footer><button type="button" className="secondary-button" onClick={() => setTeamOpen(false)}>Cancel</button><button className="primary-button">Create team</button></footer>
        </form>
      </Dialog>

      <Dialog title={`Permissions for ${permissionMember?.firstName || "member"}`} open={Boolean(permissionMember)} onClose={() => setPermissionMember(null)}>
        <form className="dialog-form" onSubmit={(event) => void saveMemberPermissions(event)} key={permissionMember?.id}>
          <label>Team<select name="teamId" defaultValue={permissionMember?.teamId || ""}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <div className="permission-grid">{permissionResources.map((resource) => <div key={resource}>
            <strong>{resource}</strong>
            <label className="check-label"><input name={`${resource}:read`} type="checkbox" defaultChecked={permissionChecked(permissionMember, resource, "read")} />Read</label>
            <label className="check-label"><input name={`${resource}:write`} type="checkbox" defaultChecked={permissionChecked(permissionMember, resource, "write")} />Write</label>
            <input name={`${resource}:properties`} placeholder="Allowed write properties (optional)" />
          </div>)}</div>
          <footer><button type="button" className="secondary-button" onClick={() => setPermissionMember(null)}>Cancel</button><button className="primary-button">Save permissions</button></footer>
        </form>
      </Dialog>

      <Dialog title="New pipeline stage" open={stageOpen} onClose={() => setStageOpen(false)}>
        <form className="dialog-form" onSubmit={createStage}>
          <label>Stage name<input name="name" required /></label>
          <div className="form-grid"><label>Color<input name="color" type="color" defaultValue="#667b74" /></label><label>Outcome<select name="outcome" defaultValue="open"><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select></label></div>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setStageOpen(false)}>Cancel</button><button className="primary-button">Create stage</button></footer>
        </form>
      </Dialog>

      <Dialog title="New custom field" open={fieldOpen} onClose={() => setFieldOpen(false)}>
        <form className="dialog-form" onSubmit={createField}>
          <label>Label<input name="label" required /></label>
          <label>API key<input name="key" required placeholder="renewal_date" /></label>
          <div className="form-grid"><label>Object<select name="entityType"><option>LEAD</option><option>CONTACT</option><option>COMPANY</option><option>DEAL</option></select></label><label>Type<select name="fieldType"><option>TEXT</option><option>NUMBER</option><option>DATE</option><option>BOOLEAN</option><option>SELECT</option><option>MULTI_SELECT</option></select></label></div>
          <label>Options<input name="options" placeholder="Option A, Option B" /></label>
          <label className="check-label"><input name="required" type="checkbox" />Required field</label>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setFieldOpen(false)}>Cancel</button><button className="primary-button">Create field</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
