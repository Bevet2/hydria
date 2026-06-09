import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Building2, CalendarDays, GripVertical, Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import { DataTransferButtons } from "../components/DataTransferButtons";
import { ResourceOperationsBar } from "../components/ResourceOperationsBar";
import type { Company, Deal, Stage, User } from "../types";

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function DealCard({ deal, canWrite, selected, onSelect }: { deal: Deal; canWrite: boolean; selected: boolean; onSelect: (checked: boolean) => void }) {
  const sortable = useSortable({ id: deal.id, data: { type: "deal" }, disabled: !canWrite });
  return (
    <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`deal-card ${sortable.isDragging ? "is-dragging" : ""}`} {...sortable.attributes} {...sortable.listeners}>
      {canWrite && <label className="record-selector deal-selector" onPointerDown={(event) => event.stopPropagation()}><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${deal.name}`} /></label>}
      <div className="deal-grip"><GripVertical size={15} /><span>{deal.probability}%</span></div>
      <Link to={`/deals/${deal.id}`} onPointerDown={(event) => event.stopPropagation()}><h3>{deal.name}</h3></Link>
      <p><Building2 size={14} />{deal.company?.name || "No company"}</p>
      <footer><strong>{money.format(Number(deal.value))}</strong>{deal.expectedCloseAt && <span><CalendarDays size={13} />{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(deal.expectedCloseAt))}</span>}</footer>
    </article>
  );
}

function StageColumn({ stage, deals, canWrite, selectedIds, onSelect }: { stage: Stage; deals: Deal[]; canWrite: boolean; selectedIds: string[]; onSelect: (id: string, checked: boolean) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage" } });
  return (
    <section ref={setNodeRef} className={`stage-column ${isOver ? "is-over" : ""}`}>
      <header><span className="stage-dot" style={{ background: stage.color }} /><strong>{stage.name}</strong><b>{deals.length}</b></header>
      <p className="stage-value">{money.format(deals.reduce((sum, deal) => sum + Number(deal.value), 0))}</p>
      <div className="stage-deals">{deals.map((deal) => <DealCard deal={deal} canWrite={canWrite} selected={selectedIds.includes(deal.id)} onSelect={(checked) => onSelect(deal.id, checked)} key={deal.id} />)}</div>
    </section>
  );
}

export function PipelinePage() {
  const { user } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const canWrite = user?.role !== "VIEWER";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const load = useCallback(() => {
    api<{ stages: Stage[]; deals: Deal[] }>("/pipeline").then((data) => {
      setStages(data.stages);
      setDeals(data.deals);
    });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ companies: Company[] }>("/companies?limit=100").then((data) => setCompanies(data.companies));
    api<{ users: User[] }>("/users").then((data) => setUsers(data.users));
  }, []);

  async function dragEnd(event: DragEndEvent) {
    if (!canWrite) return;
    const deal = deals.find((item) => item.id === event.active.id);
    const overId = String(event.over?.id || "");
    const overDeal = deals.find((item) => item.id === overId);
    const targetStage = stages.find((stage) => stage.id === overId || stage.id === overDeal?.stageId);
    if (!deal || !targetStage || deal.stageId === targetStage.id) return;
    setDeals((current) => current.map((item) => item.id === deal.id ? { ...item, stageId: targetStage.id } : item));
    try {
      await api(`/pipeline/deals/${deal.id}`, { method: "PATCH", body: JSON.stringify({ stageId: targetStage.id }) });
    } catch {
      load();
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/pipeline/deals", {
        method: "POST",
        body: JSON.stringify({ ...data, value: Number(data.value), probability: Number(data.probability), companyId: data.companyId || null, expectedCloseAt: data.expectedCloseAt || null })
      });
      setOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create deal");
    }
  }

  return (
    <div className="page pipeline-page">
      <header className="page-header">
        <div><p className="eyebrow">Sales process</p><h1>Pipeline</h1><p>Drag deals between stages to update their status</p></div>
        <div className="header-actions"><DataTransferButtons resource="deals" canImport={canWrite} onImported={load} />{canWrite && <button className="primary-button" onClick={() => { setError(""); setOpen(true); }} disabled={!stages.length}><Plus size={16} />Deal</button>}</div>
      </header>
      {error && !open && <p className="settings-error">{error}</p>}
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deals" /></label></div>
      <ResourceOperationsBar
        resource="DEALS"
        bulkResource="deals"
        filters={{ search }}
        onApplyFilters={(filters) => setSearch(String(filters.search || ""))}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onRefresh={load}
        canWrite={canWrite}
        users={users}
        stages={stages}
        actions={[
          { value: "ASSIGN_OWNER", label: "Assign owner" },
          { value: "MOVE_STAGE", label: "Move stage" },
          { value: "DELETE", label: "Delete" }
        ]}
      />
      <DndContext sensors={sensors} onDragEnd={dragEnd}>
        <div className="kanban">{stages.map((stage) => <StageColumn
          stage={stage}
          deals={deals.filter((deal) => deal.stageId === stage.id && (!search || deal.name.toLowerCase().includes(search.toLowerCase())))}
          canWrite={canWrite}
          selectedIds={selectedIds}
          onSelect={(id, checked) => setSelectedIds((current) => checked ? [...current, id] : current.filter((item) => item !== id))}
          key={stage.id}
        />)}</div>
      </DndContext>
      <Dialog title="New deal" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <label>Deal name<input name="name" required /></label>
          <div className="form-grid"><label>Value<input name="value" type="number" min="0" defaultValue="0" /></label><label>Probability<input name="probability" type="number" min="0" max="100" defaultValue="20" /></label></div>
          <div className="form-grid"><label>Stage<select name="stageId">{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label><label>Company<select name="companyId"><option value="">No company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label></div>
          <label>Expected close<input name="expectedCloseAt" type="date" /></label>
          <input name="currency" type="hidden" value="EUR" />
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create deal</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
