export function showWorkspaceActionConsent({ results = [], userId, onApplied, onError } = {}) {
  const pending = results.filter(result => result.status === "needs_confirmation" && result.confirmationToken);
  if (!pending.length || document.getElementById("workspace-action-consent")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "workspace-action-consent";
  dialog.className = "workspace-action-consent";
  dialog.setAttribute("aria-labelledby", "workspace-action-consent-title");
  const title = document.createElement("h2"); title.id = "workspace-action-consent-title";
  title.textContent = "Autoriser les modifications proposées ?";
  const explanation = document.createElement("p");
  explanation.textContent = "Ces actions peuvent supprimer ou remplacer du contenu. L’accord concerne uniquement la version affichée et expire dans cinq minutes.";
  const list = document.createElement("ul");
  for (const result of pending) {
    const row = document.createElement("li");
    const operations = result.trace?.action?.operations || [];
    row.textContent = `${result.toolName} · ${operations.map(operation => operation.type).join(", ")}`;
    list.appendChild(row);
  }
  const actions = document.createElement("div"); actions.className = "workspace-action-consent-buttons";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Annuler";
  const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = "Confirmer ces actions";
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  confirm.addEventListener("click", async () => {
    confirm.disabled = true; cancel.disabled = true;
    try {
      for (const result of pending) {
        const response = await fetch("/api/hydria/confirm-workspace-action", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId, confirmationToken: result.confirmationToken })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "La confirmation a échoué");
        await onApplied?.(payload);
      }
      dialog.close();
    } catch (error) { dialog.close(); onError?.(error); }
  });
  actions.append(cancel, confirm); dialog.append(title, explanation, list, actions);
  document.body.appendChild(dialog); dialog.showModal(); cancel.focus();
}
