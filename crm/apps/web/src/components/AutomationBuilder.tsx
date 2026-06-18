import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { Stage, User } from "../types";

const triggerFields: Record<string, string[]> = {
  LEAD_CREATED: ["source", "rating", "status", "companyName", "email"],
  LEAD_STATUS_CHANGED: ["status", "rating", "source"],
  DEAL_CREATED: ["value", "probability", "forecastCategory", "companyId"],
  DEAL_STAGE_CHANGED: ["stageId", "status", "probability", "value"],
  TASK_OVERDUE: ["priority", "assignedToId", "status"],
  QUOTE_ACCEPTED: ["total", "companyId", "contactId", "dealId"]
};

type ActionType = "ASSIGN_OWNER" | "CREATE_TASK" | "SEND_EMAIL" | "UPDATE_FIELD" | "MOVE_DEAL_STAGE";
type StepDraft = { action: ActionType; delayMinutes: number; configuration?: Record<string, unknown> };
export type EditableAutomationRule = {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  action: ActionType;
  conditions?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  steps?: StepDraft[] | null;
  priority?: number;
  active?: boolean;
};

function initialSteps(rule?: EditableAutomationRule | null): StepDraft[] {
  if (rule?.steps?.length) return rule.steps;
  return [{ action: rule?.action || "ASSIGN_OWNER", delayMinutes: 0, configuration: rule?.configuration }];
}

function configurationFor(step: StepDraft, index: number, data: FormData) {
  const value = (name: string) => data.get(`step-${index}-${name}`);
  if (step.action === "ASSIGN_OWNER") {
    return value("assignmentStrategy") === "ROUND_ROBIN"
      ? { strategy: "ROUND_ROBIN" }
      : { ownerId: value("ownerId") };
  }
  if (step.action === "CREATE_TASK") {
    return {
      title: value("taskTitle"),
      description: value("taskDescription") || undefined,
      dueInDays: Number(value("dueInDays") || 1),
      assignedToId: value("assignedToId") || undefined
    };
  }
  if (step.action === "SEND_EMAIL") {
    return { to: value("emailTo") || undefined, subject: value("emailSubject"), body: value("emailBody") };
  }
  if (step.action === "UPDATE_FIELD") {
    return { field: value("updateField"), value: value("updateValue") };
  }
  return { stageId: value("stageId") };
}

export function AutomationBuilder({
  rule,
  onSaved,
  onCancel
}: {
  rule?: EditableAutomationRule | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [trigger, setTrigger] = useState(rule?.trigger || "LEAD_CREATED");
  const [steps, setSteps] = useState<StepDraft[]>(() => initialSteps(rule));
  const [conditionField, setConditionField] = useState(() => Object.keys(rule?.conditions || {})[0] || "");
  const [error, setError] = useState("");
  const initialCondition = conditionField ? rule?.conditions?.[conditionField] : undefined;
  const initialConditionContains = initialCondition && typeof initialCondition === "object" && "contains" in initialCondition
    ? String((initialCondition as { contains: unknown }).contains)
    : "";
  const initialConditionValue = initialConditionContains || (initialCondition === undefined ? "" : String(initialCondition));

  useEffect(() => {
    void Promise.all([
      api<{ users: User[] }>("/users"),
      api<{ stages: Stage[]; deals: unknown[] }>("/pipeline")
    ]).then(([userData, pipelineData]) => {
      setUsers(userData.users);
      setStages(pipelineData.stages);
    });
  }, []);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const conditionValue = form.get("conditionValue");
    const conditions = conditionField && conditionValue
      ? { [conditionField]: form.get("conditionOperator") === "contains" ? { contains: conditionValue } : conditionValue }
      : {};
    const normalizedSteps = steps.map((step, index) => ({
      action: step.action,
      delayMinutes: Number(step.delayMinutes || 0),
      configuration: configurationFor(step, index, form)
    }));
    try {
      setError("");
      await api(rule ? `/automations/${rule.id}` : "/automations", {
        method: rule ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || undefined,
          trigger,
          action: normalizedSteps[0].action,
          conditions,
          configuration: normalizedSteps[0].configuration,
          steps: normalizedSteps,
          priority: Number(form.get("priority") || 100),
          active: rule?.active ?? true
        })
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save automation");
    }
  }

  return <form className="dialog-form automation-builder" onSubmit={(event) => void submit(event)}>
    <label>Rule name<input name="name" defaultValue={rule?.name || ""} required /></label>
    <label>Description<textarea name="description" rows={2} defaultValue={rule?.description || ""} /></label>
    <label>Trigger<select value={trigger} onChange={(event) => { setTrigger(event.target.value); setConditionField(""); }}>
      <option>LEAD_CREATED</option><option>LEAD_STATUS_CHANGED</option><option>DEAL_CREATED</option><option>DEAL_STAGE_CHANGED</option><option>TASK_OVERDUE</option><option>QUOTE_ACCEPTED</option>
    </select></label>
    <fieldset>
      <legend>Optional condition</legend>
      <div className="automation-condition">
        <select value={conditionField} onChange={(event) => setConditionField(event.target.value)} aria-label="Condition field">
          <option value="">Always run</option>
          {(triggerFields[trigger] || []).map((field) => <option value={field} key={field}>{field}</option>)}
        </select>
        {conditionField && <>
          <select name="conditionOperator" defaultValue={initialConditionContains ? "contains" : "equals"} aria-label="Condition operator"><option value="equals">equals</option><option value="contains">contains</option></select>
          <input name="conditionValue" defaultValue={initialConditionValue} placeholder="Expected value" required />
        </>}
      </div>
    </fieldset>
    <div className="automation-step-list">
      {steps.map((step, index) => <fieldset key={`${index}-${step.action}`} className="automation-step">
        <legend>Step {index + 1}</legend>
        <div className="automation-step-heading">
          <label>Action<select value={step.action} onChange={(event) => updateStep(index, { action: event.target.value as ActionType, configuration: undefined })}>
            <option>ASSIGN_OWNER</option><option>CREATE_TASK</option><option>SEND_EMAIL</option><option>UPDATE_FIELD</option><option>MOVE_DEAL_STAGE</option>
          </select></label>
          <label>Delay (minutes)<input type="number" min="0" max="525600" value={step.delayMinutes} onChange={(event) => updateStep(index, { delayMinutes: Number(event.target.value) })} /></label>
          {steps.length > 1 && <button type="button" className="icon-button danger-icon" title="Remove step" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}><Trash2 size={16} /></button>}
        </div>
        {step.action === "ASSIGN_OWNER" && <div className="form-grid">
          <label>Strategy<select name={`step-${index}-assignmentStrategy`} defaultValue={step.configuration?.strategy === "ROUND_ROBIN" ? "ROUND_ROBIN" : "FIXED"}><option value="ROUND_ROBIN">Round robin</option><option value="FIXED">Fixed owner</option></select></label>
          <label>Fixed owner<select name={`step-${index}-ownerId`} defaultValue={String(step.configuration?.ownerId || "")}><option value="">Select owner</option>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
        </div>}
        {step.action === "CREATE_TASK" && <>
          <label>Task title<input name={`step-${index}-taskTitle`} defaultValue={String(step.configuration?.title || "")} required /></label>
          <div className="form-grid"><label>Due in days<input name={`step-${index}-dueInDays`} type="number" min="0" defaultValue={Number(step.configuration?.dueInDays || 1)} /></label><label>Assignee<select name={`step-${index}-assignedToId`} defaultValue={String(step.configuration?.assignedToId || "")}><option value="">Rule creator</option>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label></div>
          <label>Description<textarea name={`step-${index}-taskDescription`} rows={2} defaultValue={String(step.configuration?.description || "")} /></label>
        </>}
        {step.action === "SEND_EMAIL" && <>
          <label>Recipient override<input name={`step-${index}-emailTo`} type="email" defaultValue={String(step.configuration?.to || "")} placeholder="Use the record email when empty" /></label>
          <label>Subject<input name={`step-${index}-emailSubject`} defaultValue={String(step.configuration?.subject || "")} required /></label>
          <label>Message<textarea name={`step-${index}-emailBody`} rows={4} defaultValue={String(step.configuration?.body || "")} required /></label>
        </>}
        {step.action === "UPDATE_FIELD" && <div className="form-grid">
          <label>Field<select name={`step-${index}-updateField`} defaultValue={String(step.configuration?.field || "status")}><option>status</option><option>rating</option><option>source</option><option>description</option><option>probability</option><option>forecastCategory</option><option>nextStep</option><option>industry</option><option>city</option><option>country</option></select></label>
          <label>Value<input name={`step-${index}-updateValue`} defaultValue={String(step.configuration?.value || "")} required /></label>
        </div>}
        {step.action === "MOVE_DEAL_STAGE" && <label>Target stage<select name={`step-${index}-stageId`} defaultValue={String(step.configuration?.stageId || "")} required>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label>}
      </fieldset>)}
    </div>
    <button type="button" className="secondary-button automation-add-step" onClick={() => setSteps((current) => [...current, { action: "CREATE_TASK", delayMinutes: 0 }])}><Plus size={15} />Add step</button>
    <label>Priority<input name="priority" type="number" min="1" max="1000" defaultValue={rule?.priority || 100} /></label>
    {error && <p className="form-error">{error}</p>}
    <footer><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button">{rule ? "Save rule" : "Create rule"}</button></footer>
  </form>;
}
