import { Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import type { User } from "../types";

type Definition = { id: string; entityType: string; key: string; label: string; fieldType: string; required: boolean };

export function SettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api<{ users: User[] }>("/users").then((data) => setUsers(data.users));
    api<{ definitions: Definition[] }>("/custom-fields").then((data) => setDefinitions(data.definitions));
  }, []);
  useEffect(load, [load]);

  async function createField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/custom-fields", { method: "POST", body: JSON.stringify({ ...data, required: false }) });
    setOpen(false);
    load();
  }

  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Settings</h1><p>Access and data model configuration</p></div></header>
      <section className="settings-section">
        <div className="section-title"><div><ShieldCheck size={19} /><span><h2>Members and roles</h2><p>Role-based access applies to every CRM resource.</p></span></div></div>
        <div className="member-list">
          {users.map((member) => <div key={member.id}><span className="avatar">{member.firstName[0]}{member.lastName[0]}</span><p><strong>{member.firstName} {member.lastName}</strong><small>{member.email}</small></p><span className="role-pill">{member.role.toLowerCase()}</span></div>)}
        </div>
      </section>
      <section className="settings-section">
        <div className="section-title">
          <div><SlidersHorizontal size={19} /><span><h2>Custom fields</h2><p>Extend contacts, companies and deals without changing the schema.</p></span></div>
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && <button className="secondary-button" onClick={() => setOpen(true)}><Plus size={16} />Field</button>}
        </div>
        <div className="field-list">
          {definitions.map((field) => <div key={field.id}><strong>{field.label}</strong><span>{field.entityType.toLowerCase()}</span><code>{field.key}</code><b>{field.fieldType.toLowerCase()}</b></div>)}
          {!definitions.length && <p className="empty-state">No custom fields configured.</p>}
        </div>
      </section>
      <Dialog title="New custom field" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={createField}>
          <label>Label<input name="label" required /></label>
          <label>API key<input name="key" required placeholder="renewal_date" /></label>
          <div className="form-grid"><label>Object<select name="entityType"><option>CONTACT</option><option>COMPANY</option><option>DEAL</option></select></label><label>Type<select name="fieldType"><option>TEXT</option><option>NUMBER</option><option>DATE</option><option>BOOLEAN</option><option>SELECT</option><option>MULTI_SELECT</option></select></label></div>
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create field</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
