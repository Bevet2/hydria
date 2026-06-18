import { Combine, Layers3, Save, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { SavedView, Stage, User } from "../types";
import { Dialog } from "./Dialog";

type BulkAction = {
  value: "ASSIGN_OWNER" | "UPDATE_STATUS" | "MOVE_STAGE" | "SET_ACTIVE" | "DELETE";
  label: string;
  values?: Array<{ value: string; label: string }>;
};

type DuplicateRecord = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  domain?: string | null;
};

export function ResourceOperationsBar(props: {
  resource: SavedView["resource"];
  bulkResource?: "contacts" | "companies" | "leads" | "deals" | "products" | "tasks" | "tickets";
  filters: Record<string, unknown>;
  onApplyFilters: (filters: Record<string, unknown>) => void;
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void | Promise<void>;
  canWrite: boolean;
  actions?: BulkAction[];
  users?: User[];
  stages?: Stage[];
  duplicates?: "contacts" | "companies" | "leads";
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewId, setViewId] = useState("");
  const [action, setAction] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [dialog, setDialog] = useState<"view" | "duplicates" | null>(null);
  const [groups, setGroups] = useState<DuplicateRecord[][]>([]);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const loadViews = useCallback(async () => {
    const data = await api<{ views: SavedView[] }>(`/saved-views?resource=${props.resource}`);
    setViews(data.views);
  }, [props.resource]);

  useEffect(() => {
    void loadViews().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load views"));
  }, [loadViews]);

  const selectedAction = props.actions?.find((item) => item.value === action);
  const dynamicValues = action === "ASSIGN_OWNER"
    ? [{ value: "", label: "Unassigned" }, ...(props.users || []).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}` }))]
    : action === "MOVE_STAGE"
      ? (props.stages || []).map((stage) => ({ value: stage.id, label: stage.name }))
      : selectedAction?.values || [];

  async function saveView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/saved-views", {
      method: "POST",
      body: JSON.stringify({
        resource: props.resource,
        name: data.name,
        filters: props.filters,
        isDefault: data.isDefault === "on"
      })
    });
    setDialog(null);
    await loadViews();
  }

  async function runBulk() {
    if (!props.bulkResource || !action || !props.selectedIds.length) return;
    if (action === "DELETE" && !window.confirm(`Delete ${props.selectedIds.length} selected records?`)) return;
    const body: Record<string, unknown> = { ids: props.selectedIds, action };
    if (action === "ASSIGN_OWNER") body.ownerId = actionValue || null;
    if (action === "UPDATE_STATUS") body.status = actionValue;
    if (action === "MOVE_STAGE") body.stageId = actionValue;
    if (action === "SET_ACTIVE") body.active = actionValue === "true";
    if (action === "DELETE") body.confirmation = "DELETE";
    try {
      await api(`/data/bulk/${props.bulkResource}`, { method: "POST", body: JSON.stringify(body) });
      props.onClearSelection();
      await props.onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk action failed");
    }
  }

  async function openDuplicates() {
    if (!props.duplicates) return;
    const data = await api<{ groups: DuplicateRecord[][] }>(`/data/duplicates/${props.duplicates}`);
    setGroups(data.groups);
    setTargets(Object.fromEntries(data.groups.map((group, index) => [index, group[0]?.id || ""])));
    setDialog("duplicates");
  }

  async function mergeGroup(index: number) {
    if (!props.duplicates) return;
    const group = groups[index] || [];
    const targetId = targets[index];
    if (!targetId) return;
    await api(`/data/duplicates/${props.duplicates}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId, sourceIds: group.filter((item) => item.id !== targetId).map((item) => item.id) })
    });
    const next = groups.filter((_, groupIndex) => groupIndex !== index);
    setGroups(next);
    setTargets(Object.fromEntries(next.map((group, groupIndex) => [groupIndex, group[0]?.id || ""])));
    await props.onRefresh();
  }

  return <>
    <div className="resource-operations">
      <select value={viewId} onChange={(event) => {
        const next = event.target.value;
        setViewId(next);
        const view = views.find((item) => item.id === next);
        if (view) props.onApplyFilters(view.filters);
      }} aria-label={`${props.resource.toLowerCase()} saved view`}>
        <option value="">Current view</option>
        {views.map((view) => <option value={view.id} key={view.id}>{view.name}{view.isDefault ? " · default" : ""}</option>)}
      </select>
      {props.canWrite && <button className="secondary-button" onClick={() => setDialog("view")}><Save size={15} />Save view</button>}
      {props.duplicates && <button className="secondary-button" onClick={() => void openDuplicates()}><Combine size={15} />Duplicates</button>}
      {props.bulkResource && props.canWrite && <>
        <span className="selection-count"><Layers3 size={14} />{props.selectedIds.length} selected</span>
        <select value={action} onChange={(event) => { setAction(event.target.value); setActionValue(""); }} disabled={!props.selectedIds.length} aria-label="Bulk action">
          <option value="">Bulk action</option>
          {props.actions?.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
        {action && action !== "DELETE" && <select value={actionValue} onChange={(event) => setActionValue(event.target.value)} aria-label="Bulk action value">
          <option value="">Select value</option>
          {dynamicValues.map((value) => <option value={value.value} key={`${action}-${value.value}`}>{value.label}</option>)}
        </select>}
        <button className={action === "DELETE" ? "secondary-button danger-button" : "secondary-button"} disabled={!action || (!actionValue && !["DELETE", "ASSIGN_OWNER"].includes(action))} onClick={() => void runBulk()}>
          {action === "DELETE" ? <Trash2 size={15} /> : <Layers3 size={15} />}Apply
        </button>
      </>}
    </div>
    {error && <p className="settings-error">{error}</p>}

    <Dialog title="Save current view" open={dialog === "view"} onClose={() => setDialog(null)}>
      <form className="dialog-form" onSubmit={(event) => void saveView(event)}>
        <label>View name<input name="name" required /></label>
        <label className="check-label"><input name="isDefault" type="checkbox" />Use as default view</label>
        <footer><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button">Save view</button></footer>
      </form>
    </Dialog>

    <Dialog title="Duplicate review" open={dialog === "duplicates"} onClose={() => setDialog(null)}>
      <div className="duplicate-review">
        {groups.map((group, index) => <section key={`${group[0]?.id}-${index}`}>
          <header><strong>Possible duplicate group</strong><button className="secondary-button compact" onClick={() => void mergeGroup(index)}>Merge into selected</button></header>
          {group.map((item) => <label key={item.id}>
            <input type="radio" name={`duplicate-${index}`} checked={targets[index] === item.id} onChange={() => setTargets((current) => ({ ...current, [index]: item.id }))} />
            <span><strong>{item.name || `${item.firstName || ""} ${item.lastName || ""}`.trim()}</strong><small>{item.email || item.domain || item.id}</small></span>
          </label>)}
        </section>)}
        {!groups.length && <p className="empty-state">No duplicate group detected.</p>}
      </div>
    </Dialog>
  </>;
}
