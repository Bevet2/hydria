// Focus mode for genuine editor work, not a CSS-only mock action.
// Keeps editor content and current selection untouched; never mutates work objects.
const button = document.getElementById("os-editor-focus");
const root = document.getElementById("workspace-panel-root");
if (button && root) {
  function setFocus(enabled) {
    const active = Boolean(enabled) && root.dataset.hasWorkspace === "true";
    document.body.classList.toggle("os-editor-focus", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Quitter le mode concentration" : "Activer le mode concentration");
    button.title = active ? "Quitter le mode concentration · Échap" : "Mode concentration";
  }
  function reconcile() {
    const isEditing = root.dataset.hasWorkspace === "true";
    button.hidden = !isEditing;
    if (!isEditing) setFocus(false);
  }
  button.addEventListener("click", () => setFocus(!document.body.classList.contains("os-editor-focus")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("os-editor-focus")) {
      setFocus(false);
    }
  });
  new MutationObserver(reconcile).observe(root, { attributes: true, attributeFilter: ["data-has-workspace"] });
  reconcile();
}
