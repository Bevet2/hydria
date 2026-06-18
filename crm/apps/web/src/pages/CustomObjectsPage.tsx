import { Box, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
  required: boolean;
  options?: string[];
};
type Definition = {
  id: string;
  key: string;
  name: string;
  pluralName: string;
  description?: string | null;
  fields: Field[];
  _count?: { records: number };
};
type CustomRecord = {
  id: string;
  displayName: string;
  values: Record<string, unknown>;
  updatedAt: string;
};

const blankField = (): Field => ({
  key: "",
  label: "",
  type: "text",
  required: false,
  options: []
});

export function CustomObjectsPage() {
  const { user } = useAuth();
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selected, setSelected] = useState<Definition | null>(null);
  const [records, setRecords] = useState<CustomRecord[]>([]);
  const [definitionOpen, setDefinitionOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>([blankField()]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const canConfigure = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canWrite = user?.role !== "VIEWER";

  const loadDefinitions = useCallback(async () => {
    const payload = await api<{ definitions: Definition[] }>("/custom-objects");
    setDefinitions(payload.definitions);
    setSelected((current) =>
      payload.definitions.find((item) => item.id === current?.id) || payload.definitions[0] || null
    );
  }, []);

  const loadRecords = useCallback(async () => {
    if (!selected) {
      setRecords([]);
      return;
    }
    const payload = await api<{ records: CustomRecord[] }>(
      `/custom-objects/${selected.id}/records?search=${encodeURIComponent(search)}`
    );
    setRecords(payload.records);
  }, [search, selected]);

  useEffect(() => {
    void loadDefinitions().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load custom objects"));
  }, [loadDefinitions]);
  useEffect(() => {
    void loadRecords().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load records"));
  }, [loadRecords]);

  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const normalizedFields = fields
      .filter((field) => field.key.trim() && field.label.trim())
      .map((field) => ({
        ...field,
        key: field.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        options: field.options?.filter(Boolean)
      }));
    await api("/custom-objects", {
      method: "POST",
      body: JSON.stringify({
        key: String(form.get("key") || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        name: String(form.get("name") || ""),
        pluralName: String(form.get("pluralName") || ""),
        description: String(form.get("description") || "") || null,
        fields: normalizedFields
      })
    });
    setDefinitionOpen(false);
    setFields([blankField()]);
    await loadDefinitions();
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(selected.fields.map((field) => {
      const raw = form.get(field.key);
      if (field.type === "boolean") return [field.key, raw === "on"];
      if (field.type === "number") return [field.key, raw === "" ? null : Number(raw)];
      if (field.type === "multi_select") return [field.key, form.getAll(field.key).map(String)];
      return [field.key, String(raw || "") || null];
    }));
    await api(`/custom-objects/${selected.id}/records`, {
      method: "POST",
      body: JSON.stringify({
        displayName: String(form.get("displayName") || ""),
        values
      })
    });
    setRecordOpen(false);
    await Promise.all([loadRecords(), loadDefinitions()]);
  }

  async function removeRecord(record: CustomRecord) {
    if (!selected || !window.confirm(`Delete ${record.displayName}?`)) return;
    await api(`/custom-objects/${selected.id}/records/${record.id}`, { method: "DELETE" });
    await loadRecords();
  }

  function updateField(index: number, patch: Partial<Field>) {
    setFields((current) => current.map((field, fieldIndex) =>
      fieldIndex === index ? { ...field, ...patch } : field
    ));
  }

  return <div className="page">
    <header className="page-header">
      <div><p className="eyebrow">Flexible data model</p><h1>Custom objects</h1><p>Create CRM resources specific to your business.</p></div>
      {canConfigure && <button className="primary-button" onClick={() => setDefinitionOpen(true)}><Plus size={16} />Object</button>}
    </header>
    {error && <p className="settings-error">{error}</p>}
    <div className="custom-object-layout">
      <aside className="custom-object-nav">
        {definitions.map((definition) => <button key={definition.id} className={selected?.id === definition.id ? "active" : ""} onClick={() => setSelected(definition)}>
          <Box size={16} /><span><strong>{definition.pluralName}</strong><small>{definition._count?.records || 0} records</small></span>
        </button>)}
        {!definitions.length && <p>No custom object.</p>}
      </aside>
      <section className="panel custom-object-records">
        <div className="panel-heading">
          <div><p className="eyebrow">{selected?.key || "Select an object"}</p><h2>{selected?.pluralName || "Records"}</h2></div>
          {selected && canWrite && <button className="primary-button" onClick={() => setRecordOpen(true)}><Plus size={15} />Record</button>}
        </div>
        {selected && <label className="search-field custom-object-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${selected.pluralName.toLowerCase()}`} /></label>}
        <div className="custom-record-list">
          {records.map((record) => <article key={record.id}>
            <div><strong>{record.displayName}</strong><small>{new Date(record.updatedAt).toLocaleString()}</small></div>
            <dl>{selected?.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{Array.isArray(record.values[field.key]) ? (record.values[field.key] as unknown[]).join(", ") : String(record.values[field.key] ?? "")}</dd></div>)}</dl>
            {canWrite && <button className="icon-button danger-icon" onClick={() => void removeRecord(record)} title="Delete record"><Trash2 size={15} /></button>}
          </article>)}
          {selected && !records.length && <p className="empty-state">No record yet.</p>}
        </div>
      </section>
    </div>

    <Dialog title="New custom object" open={definitionOpen} onClose={() => setDefinitionOpen(false)}>
      <form className="dialog-form" onSubmit={(event) => void createDefinition(event)}>
        <div className="form-grid"><label>Name<input name="name" required /></label><label>Plural name<input name="pluralName" required /></label></div>
        <label>API key<input name="key" required pattern="[a-z][a-z0-9_]+" placeholder="installations" /></label>
        <label>Description<textarea name="description" rows={2} /></label>
        <div className="custom-field-builder">
          {fields.map((field, index) => <div key={index}>
            <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Label" />
            <input value={field.key} onChange={(event) => updateField(index, { key: event.target.value })} placeholder="key" />
            <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as Field["type"] })}>
              <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Checkbox</option><option value="select">Select</option><option value="multi_select">Multi-select</option>
            </select>
            <label className="check-label"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label>
            <button type="button" className="icon-button" onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
          </div>)}
          <button type="button" className="secondary-button" onClick={() => setFields((current) => [...current, blankField()])}><Plus size={14} />Field</button>
        </div>
        <footer><button type="button" className="secondary-button" onClick={() => setDefinitionOpen(false)}>Cancel</button><button className="primary-button">Create object</button></footer>
      </form>
    </Dialog>

    <Dialog title={`New ${selected?.name || "record"}`} open={recordOpen} onClose={() => setRecordOpen(false)}>
      <form className="dialog-form" onSubmit={(event) => void createRecord(event)}>
        <label>Name<input name="displayName" required /></label>
        {selected?.fields.map((field) => <label key={field.key}>{field.label}
          {field.type === "boolean"
            ? <input name={field.key} type="checkbox" />
            : field.type === "select"
              ? <select name={field.key} required={field.required}><option value="">Select</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
              : <input name={field.key} required={field.required} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} />}
        </label>)}
        <footer><button type="button" className="secondary-button" onClick={() => setRecordOpen(false)}>Cancel</button><button className="primary-button">Create record</button></footer>
      </form>
    </Dialog>
  </div>;
}
