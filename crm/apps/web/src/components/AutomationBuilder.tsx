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

export function AutomationBuilder({ onSaved, onCancel }: { onSaved: () => void | Promise<void>; onCancel: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [trigger, setTrigger] = useState("LEAD_CREATED");
  const [action, setAction] = useState("ASSIGN_OWNER");
  const [conditionField, setConditionField] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      api<{ users: User[] }>("/users"),
      api<{ stages: Stage[]; deals: unknown[] }>("/pipeline")
    ]).then(([userData, pipelineData]) => {
      setUsers(userData.users);
      setStages(pipelineData.stages);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const conditions = conditionField && data.conditionValue
      ? { [conditionField]: data.conditionOperator === "contains" ? { contains: data.conditionValue } : data.conditionValue }
      : {};
    let configuration: Record<string, unknown>;
    if (action === "ASSIGN_OWNER") {
      configuration = data.assignmentStrategy === "ROUND_ROBIN"
        ? { strategy: "ROUND_ROBIN" }
        : { ownerId: data.ownerId };
    } else if (action === "CREATE_TASK") {
      configuration = {
        title: data.taskTitle,
        description: data.taskDescription || undefined,
        dueInDays: Number(data.dueInDays || 1),
        assignedToId: data.assignedToId || undefined
      };
    } else if (action === "SEND_EMAIL") {
      configuration = {
        to: data.emailTo || undefined,
        subject: data.emailSubject,
        body: data.emailBody
      };
    } else if (action === "UPDATE_FIELD") {
      configuration = { field: data.updateField, value: data.updateValue };
    } else {
      configuration = { stageId: data.stageId };
    }
    try {
      setError("");
      await api("/automations", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          description: data.description || undefined,
          trigger,
          action,
          conditions,
          configuration,
          priority: Number(data.priority || 100),
          active: true
        })
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create automation");
    }
  }

  return <form className="dialog-form automation-builder" onSubmit={(event) => void submit(event)}>
    <label>Rule name<input name="name" required /></label>
    <label>Description<textarea name="description" rows={2} /></label>
    <div className="form-grid">
      <label>Trigger<select value={trigger} onChange={(event) => { setTrigger(event.target.value); setConditionField(""); }}>
        <option>LEAD_CREATED</option><option>LEAD_STATUS_CHANGED</option><option>DEAL_CREATED</option><option>DEAL_STAGE_CHANGED</option><option>TASK_OVERDUE</option><option>QUOTE_ACCEPTED</option>
      </select></label>
      <label>Action<select value={action} onChange={(event) => setAction(event.target.value)}>
        <option>ASSIGN_OWNER</option><option>CREATE_TASK</option><option>SEND_EMAIL</option><option>UPDATE_FIELD</option><option>MOVE_DEAL_STAGE</option>
      </select></label>
    </div>
    <fieldset>
      <legend>Optional condition</legend>
      <div className="automation-condition">
        <select value={conditionField} onChange={(event) => setConditionField(event.target.value)} aria-label="Condition field">
          <option value="">Always run</option>
          {(triggerFields[trigger] || []).map((field) => <option value={field} key={field}>{field}</option>)}
        </select>
        {conditionField && <>
          <select name="conditionOperator" aria-label="Condition operator"><option value="equals">equals</option><option value="contains">contains</option></select>
          <input name="conditionValue" placeholder="Expected value" required />
        </>}
      </div>
    </fieldset>
    <fieldset>
      <legend>Action configuration</legend>
      {action === "ASSIGN_OWNER" && <div className="form-grid">
        <label>Strategy<select name="assignmentStrategy"><option value="ROUND_ROBIN">Round robin</option><option value="FIXED">Fixed owner</option></select></label>
        <label>Fixed owner<select name="ownerId"><option value="">Select owner</option>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
      </div>}
      {action === "CREATE_TASK" && <>
        <label>Task title<input name="taskTitle" required /></label>
        <div className="form-grid"><label>Due in days<input name="dueInDays" type="number" min="0" defaultValue="1" /></label><label>Assignee<select name="assignedToId"><option value="">Rule creator</option>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label></div>
        <label>Description<textarea name="taskDescription" rows={2} /></label>
      </>}
      {action === "SEND_EMAIL" && <>
        <label>Recipient override<input name="emailTo" type="email" placeholder="Leave empty to use the record email" /></label>
        <label>Subject<input name="emailSubject" required /></label>
        <label>Message<textarea name="emailBody" rows={4} required /></label>
      </>}
      {action === "UPDATE_FIELD" && <div className="form-grid">
        <label>Field<select name="updateField"><option>status</option><option>rating</option><option>source</option><option>description</option><option>probability</option><option>forecastCategory</option><option>nextStep</option><option>industry</option><option>city</option><option>country</option></select></label>
        <label>Value<input name="updateValue" required /></label>
      </div>}
      {action === "MOVE_DEAL_STAGE" && <label>Target stage<select name="stageId" required>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></label>}
    </fieldset>
    <label>Priority<input name="priority" type="number" min="1" max="1000" defaultValue="100" /></label>
    {error && <p className="form-error">{error}</p>}
    <footer><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button">Create rule</button></footer>
  </form>;
}
