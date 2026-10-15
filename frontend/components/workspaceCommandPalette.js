// Universal Hydria OS command palette: navigation and project/file search.
// Keyboard: Ctrl/Cmd+K to open; arrows, Enter, Escape.
function make(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}
export function installWorkspaceCommandPalette({ getActions, getObjects, getProjects = () => [], getFiles = () => [], openAction, openObject, openProject = () => {}, openFile = () => {}, onSave }) {
  const backdrop = make("div", "hydria-command-backdrop");
  backdrop.hidden = true;
  const panel = make("section", "hydria-command-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Search Hydria workspaces and files");
  const input = make("input", "hydria-command-input");
  input.type = "search";
  input.placeholder = "Search workspaces, projects, documents, files…";
  input.setAttribute("aria-label", "Search workspace commands");
  const results = make("div", "hydria-command-results");
  const help = make("p", "hydria-command-help", "↑↓ Navigate · Enter Open · Esc Close · Ctrl/⌘ K");
  panel.append(input, results, help);
  backdrop.appendChild(panel); document.body.appendChild(backdrop);
  let matches = [], active = 0, priorFocus = null;
  function close() {
    backdrop.hidden = true;
    document.body.classList.remove("hydria-command-open");
    priorFocus?.focus?.();
  }
  function open() {
    priorFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add("hydria-command-open");
    input.value = "";
    refresh();
    input.focus();
  }
  function dispatch(match) {
    if (!match) return;
    close();
    if (match.kind === "workspace") openAction(match.target);
    else if (match.kind === "project") openProject(match.target);
    else if (match.kind === "file") openFile(match.target);
    else openObject(match.target);
  }
  function refresh() {
    const text = input.value.trim().toLowerCase();
    const actions = (getActions() || []).map((action) => ({
      kind: "workspace", target: action,
      label: action.label || action.title || action.slug || "Workspace",
      hint: action.description || "Open workspace"
    }));
    const objects = (getObjects() || []).map((item) => ({
      kind: "object", target: item,
      label: item.title || item.name || item.primaryFile || "Untitled object",
      hint: (item.objectKind || item.kind || "File") + (item.primaryFile ? " · " + item.primaryFile : "")
    }));
    const projects = (getProjects() || []).map((project) => ({
      kind: "project", target: project,
      label: project.name || project.title || "Untitled project",
      hint: "Project · " + (project.description || project.id || "")
    }));
    const files = (getFiles() || []).map((file) => ({
      kind: "file", target: file,
      label: file.path.split("/").pop() || file.path,
      hint: (file.workObject?.title || "Work object") + " · " + file.path
    }));
    const queryTerms = text.split(/\s+/).filter(Boolean);
    matches = [...actions, ...projects, ...objects, ...files].filter((item) => {
      const searchable = (item.label + " " + item.hint).toLowerCase();
      return queryTerms.every((term) => searchable.includes(term));
    }).slice(0, 60);
    active = Math.min(active, Math.max(0, matches.length - 1));
    results.replaceChildren();
    if (!matches.length) { results.appendChild(make("p", "hydria-command-empty", "No matching workspaces or files.")); return; }
    matches.forEach((item, index) => {
      const btn = make("button", "hydria-command-result" + (index === active ? " is-active" : ""));
      btn.type = "button";
      btn.dataset.kind = item.kind;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", index === active ? "true" : "false");
      const icon = make("span", "hydria-command-kind", item.kind === "workspace" ? "◈" : item.kind === "project" ? "▦" : item.kind === "file" ? "▧" : "▤");
      const body = make("span", "hydria-command-result-body");
      body.append(make("strong", "", item.label), make("small", "", item.hint));
      btn.append(icon, body);
      btn.addEventListener("click", () => dispatch(item));
      btn.addEventListener("mouseenter", () => { active = index; results.querySelectorAll(".hydria-command-result").forEach((item, i) => { item.classList.toggle("is-active", i === index); item.setAttribute("aria-selected", i === index ? "true" : "false"); }); });
      results.appendChild(btn);
    });
  }
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (typeof onSave === "function") onSave();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && ((event.key.toLowerCase() === "k") || (event.shiftKey && event.key.toLowerCase() === "f"))) {
      event.preventDefault(); backdrop.hidden ? open() : close(); return;
    }
    if (backdrop.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); active = (active + 1) % Math.max(1, matches.length); refresh(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); active = (active + matches.length - 1) % Math.max(1, matches.length); refresh(); }
    else if (event.key === "Enter") { event.preventDefault(); dispatch(matches[active]); }
  });
  input.addEventListener("input", () => { active = 0; refresh(); });
  backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });
  return { open, close };
}
