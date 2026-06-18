import { Bot, CheckCircle2, Play, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../api";

type RecordType = "company" | "contact" | "deal" | "lead" | "ticket";
type AssistAction = {
  id: string;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  operation: Record<string, unknown>;
};
type AssistPlan = {
  summary: string;
  record: { id: string; type: RecordType; name: string };
  actions: AssistAction[];
  requiresConfirmation: boolean;
};

export function HydriaAssistPanel({
  recordType,
  recordId,
  canWrite,
  onExecuted
}: {
  recordType: RecordType;
  recordId: string;
  canWrite: boolean;
  onExecuted: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<AssistPlan | null>(null);
  const [results, setResults] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(event?: FormEvent<HTMLFormElement>, quickPrompt = "") {
    event?.preventDefault();
    const request = (quickPrompt || prompt).trim();
    if (!request) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const payload = await api<{ plan: AssistPlan }>("/hydria-assist/plan", {
        method: "POST",
        body: JSON.stringify({ recordType, recordId, prompt: request })
      });
      setPrompt(request);
      setPlan(payload.plan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hydria could not prepare a plan");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!plan?.actions.length) return;
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ results: Array<Record<string, any>> }>("/hydria-assist/execute", {
        method: "POST",
        body: JSON.stringify({
          recordType,
          recordId,
          prompt,
          confirmed: true,
          operations: plan.actions.map((action) => action.operation)
        })
      });
      setResults(payload.results || []);
      setPlan(null);
      onExecuted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hydria action failed");
    } finally {
      setLoading(false);
    }
  }

  const canExecute = Boolean(plan?.actions.length) && (!plan?.requiresConfirmation || canWrite);

  return (
    <section className="record-section hydria-assist-panel">
      <header><div><h2>Ask Hydria</h2><p>{recordType}</p></div><Bot size={18} /></header>
      <form onSubmit={(event) => void ask(event)}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          placeholder="Ex: cree une tache de relance urgente, resume le risque, assigne ce compte a Alex"
        />
        <div className="hydria-assist-quick">
          <button type="button" onClick={() => void ask(undefined, "Resume le risque et propose la prochaine action.")}><Sparkles size={13} />Risk</button>
          <button type="button" onClick={() => void ask(undefined, "Cree une tache de relance pour ce record.")}><CheckCircle2 size={13} />Task</button>
          <button type="button" onClick={() => void ask(undefined, "Cree un ticket support urgent lie a ce record.")}><Play size={13} />Ticket</button>
        </div>
        <button className="primary-button" disabled={loading || !prompt.trim()}>{loading ? "Working..." : "Ask Hydria"}</button>
      </form>
      {error && <p className="inline-error">{error}</p>}
      {plan && (
        <div className="hydria-plan">
          <p>{plan.summary}</p>
          {plan.actions.map((action) => (
            <article key={action.id}>
              <strong>{action.label}</strong>
              <small>{action.description}</small>
              {action.requiresConfirmation && <span>confirmation required</span>}
            </article>
          ))}
          {plan.actions.length
            ? <button className="primary-button" disabled={loading || !canExecute} onClick={() => void execute()}>
                {plan.requiresConfirmation ? "Confirm actions" : "Run"}
              </button>
            : <p>No executable action proposed.</p>}
        </div>
      )}
      {!!results.length && (
        <div className="hydria-results">
          {results.map((result, index) => (
            <p key={index} className={result.status === "completed" ? "is-success" : "is-error"}>
              {result.status === "completed" ? "Done" : "Failed"}: {(result.operationsApplied || [])[0] || (result.issues || [])[0] || "CRM action"}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
