import { Save, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

type CustomField = {
  id: string;
  label: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "MULTI_SELECT";
  required: boolean;
  options?: unknown;
  value: unknown;
};

function inputValue(field: CustomField) {
  if (field.fieldType === "BOOLEAN") {
    return Boolean(field.value);
  }
  if (field.fieldType === "MULTI_SELECT") {
    return Array.isArray(field.value) ? field.value.join(", ") : "";
  }
  return field.value === null || field.value === undefined ? "" : String(field.value);
}

function normalizedValue(field: CustomField, value: unknown) {
  if (field.fieldType === "MULTI_SELECT") {
    return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (field.fieldType === "BOOLEAN") {
    return Boolean(value);
  }
  return value;
}

export function CustomFieldsPanel({
  entityType,
  entityId,
  canWrite = true
}: {
  entityType: "CONTACT" | "COMPANY" | "DEAL" | "LEAD";
  entityId: string;
  canWrite?: boolean;
}) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    api<{ fields: CustomField[] }>(`/custom-fields/values/${entityType}/${entityId}`).then((data) => {
      setFields(data.fields);
      setDrafts(Object.fromEntries(data.fields.map((field) => [field.id, inputValue(field)])));
    });
  }, [entityId, entityType]);

  useEffect(load, [load]);

  async function save() {
    setStatus("Saving...");
    try {
      await Promise.all(fields.map((field) =>
        api(`/custom-fields/${field.id}/values/${entityId}`, {
          method: "PUT",
          body: JSON.stringify({ value: normalizedValue(field, drafts[field.id]) })
        })
      ));
      setStatus("Saved");
      load();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Unable to save custom fields");
    }
  }

  if (!fields.length) {
    return null;
  }

  return (
    <section className="record-section custom-fields-section">
      <header>
        <div><h2>Custom fields</h2><p>Workspace-specific information configured by your team.</p></div>
        {canWrite && <button className="secondary-button" onClick={save}><Save size={15} />Save</button>}
      </header>
      <div className="custom-field-grid">
        {fields.map((field) => {
          const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : [];
          return (
            <label key={field.id}>
              <span>{field.label}{field.required ? " *" : ""}</span>
              {field.fieldType === "BOOLEAN" ? (
                <input type="checkbox" checked={Boolean(drafts[field.id])} disabled={!canWrite} onChange={(event) => setDrafts((current) => ({ ...current, [field.id]: event.target.checked }))} />
              ) : field.fieldType === "SELECT" && options.length ? (
                <select value={String(drafts[field.id] || "")} disabled={!canWrite} onChange={(event) => setDrafts((current) => ({ ...current, [field.id]: event.target.value }))}><option value="">Not set</option>{options.map((option) => <option key={option}>{option}</option>)}</select>
              ) : (
                <input
                  type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
                  value={String(drafts[field.id] || "")}
                  disabled={!canWrite}
                  placeholder={field.fieldType === "MULTI_SELECT" ? "Comma-separated values" : ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [field.id]: event.target.value }))}
                />
              )}
            </label>
          );
        })}
      </div>
      {status && <p className="inline-status"><SlidersHorizontal size={14} />{status}</p>}
    </section>
  );
}
