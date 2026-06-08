import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Building2, CalendarDays, GripVertical, Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Dialog } from "../components/Dialog";
import type { Company, Deal, Stage } from "../types";

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function DealCard({ deal }: { deal: Deal }) {
  const sortable = useSortable({ id: deal.id, data: { type: "deal" } });
  return (
    <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`deal-card ${sortable.isDragging ? "is-dragging" : ""}`} {...sortable.attributes} {...sortable.listeners}>
      <div className="deal-grip"><GripVertical size={15} /><span>{deal.probability}%</span></div>
      <Link to={`/deals/${deal.id}`} onPointerDown={(event) => event.stopPropagation()}><h3>{deal.name}</h3></Link>
      <p><Building2 size={14} />{deal.company?.name || "No company"}</p>
      <footer><strong>{money.format(Number(deal.value))}</strong>{deal.expectedCloseAt && <span><CalendarDays size={13} />{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(deal.expectedCloseAt))}</span>}</footer>
    </article>
  );
}

function StageColumn({ stage, deals }: { stage: Stage; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: "stage" } });
  return (
    <section ref={setNodeRef} className={`stage-column ${isOver ? "is-over" : ""}`}>
      <header><span className="stage-dot" style={{ background: stage.color }} /><strong>{stage.name}</strong><b>{deals.length}</b></header>
      <p className="stage-value">{money.format(deals.reduce((sum, deal) => sum + Number(deal.value), 0))}</p>
      <div className="stage-deals">{deals.map((deal) => <DealCard deal={deal} key={deal.id} />)}</div>
    </section>
  );
}

export function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
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
  }, []);

  async function dragEnd(event: DragEndEvent) {
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
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/pipeline/deals", {
      method: "POST",
      body: JSON.stringify({ ...data, value: Number(data.value), probability: Number(data.probability), companyId: data.companyId || null, expectedCloseAt: data.expectedCloseAt || null })
    });
    setOpen(false);
    load();
  }

  return (
    <div className="page pipeline-page">
      <header className="page-header">
        <div><p className="eyebrow">Sales process</p><h1>Pipeline</h1><p>Drag deals between stages to update their status</p></div>
        <button className="primary-button" onClick={() => setOpen(true)} disabled={!stages.length}><Plus size={16} />Deal</button>
      </header>
      <DndContext sensors={sensors} onDragEnd={dragEnd}>
        <div className="kanban">{stages.map((stage) => <StageColumn stage={stage} deals={deals.filter((deal) => deal.stageId === stage.id)} key={stage.id} />)}</div>
      </DndContext>
      <Dialog title="New deal" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <label>Deal name<input name="name" required /></label>
          <div className="form-grid"><label>Value<input name="value" type="number" min="0" defaultValue="0" /></label><label>Probability<input name="probability" type="number" min="0" max="100" defaultValue="20" /></label></div>
          <div className="form-grid"><label>Stage<select name="stageId">{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label><label>Company<select name="companyId"><option value="">No company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label></div>
          <label>Expected close<input name="expectedCloseAt" type="date" /></label>
          <input name="currency" type="hidden" value="EUR" />
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create deal</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
