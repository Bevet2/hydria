// Universal Hydria OS command palette: navigation and project/file search.
// Keyboard: Ctrl/Cmd+K to open; arrows, Enter, Escape.
function make(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}
export function installWorkspaceCommandPalette({ getActions, getObjects, searchObjects, openAction, openObject, onSave }) {
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
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Search results");
  input.setAttribute("aria-controls", "hydria-command-results");
  results.id = "hydria-command-results";
  const help = make("p", "hydria-command-help", "↑↓ Navigate · Enter Open · Esc Close · Ctrl/⌘ K");
  panel.append(input, results, help);
  backdrop.appendChild(panel); document.body.appendChild(backdrop);
  let matches = [], active = 0, priorFocus = null, remoteObjects = [], searchHandle = null, searchGeneration = 0;
  function close() {
    searchGeneration++;
    clearTimeout(searchHandle);
    backdrop.hidden = true;
    document.body.classList.remove("hydria-command-open");
    if (priorFocus?.isConnected) priorFocus.focus();
  }
  function open() {
    priorFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add("hydria-command-open");
    input.value = "";
    remoteObjects = [];
    refresh();
    input.focus();
  }
  function dispatch(match) {
    if (!match) return;
    close();
    if (match.kind === "workspace") openAction(match.target);
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
    const found = remoteObjects.map((item) => ({
      kind: "object", target: item,
      label: item.title || item.name || item.primaryFile || "Untitled object",
      hint: [item.match?.entryPath || item.primaryFile, item.match?.snippet || ""].filter(Boolean).join(" · ")
    }));
    const seen = new Set();
    // Surface native Drive files even when a workspace has hundreds of
    // matching ordinary work objects. The 40-result cap must not hide them.
    const nativeAssets = found.filter(item => Boolean(item.target.assetFamily));
    const remoteWorkObjects = found.filter(item => !item.target.assetFamily);
    matches = [...actions, ...nativeAssets, ...objects, ...remoteWorkObjects]
      .filter((item) => !text || (item.label + " " + item.hint).toLowerCase().includes(text))
      .filter((item) => {
        const key = item.kind === "workspace"
          ? "workspace:" + item.target.slug
          : "object:" + (item.target.assetFamily || "work-object") + ":" +
            item.target.id + ":" + (item.target.match?.entryPath || item.target.primaryFile || "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 40);
    active = Math.min(active, Math.max(0, matches.length - 1));
    results.replaceChildren();
    if (!matches.length) { results.appendChild(make("p", "hydria-command-empty", "No matching workspaces or files.")); input.removeAttribute("aria-activedescendant"); return; }
    input.setAttribute("aria-activedescendant", "hydria-command-option-" + active);
    matches.forEach((item, index) => {
      const btn = make("button", "hydria-command-result" + (index === active ? " is-active" : ""));
      btn.type = "button";
      btn.id = "hydria-command-option-" + index;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", index === active ? "true" : "false");
      const icon = make("span", "hydria-command-kind", item.kind === "workspace" ? "◈" : "▤");
      const body = make("span", "hydria-command-result-body");
      body.append(make("strong", "", item.label), make("small", "", item.hint));
      btn.append(icon, body);
      btn.addEventListener("click", () => dispatch(item));
      btn.addEventListener("mouseenter", () => { active = index; input.setAttribute("aria-activedescendant", btn.id); results.querySelectorAll(".hydria-command-result").forEach((item, i) => { item.classList.toggle("is-active", i === index); item.setAttribute("aria-selected", i === index ? "true" : "false"); }); });
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
    if (event.key === "Tab") {
      const focusable = [input, ...results.querySelectorAll("button:not([disabled])")];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && (index === focusable.length - 1 || index < 0)) { event.preventDefault(); input.focus(); }
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); active = (active + 1) % Math.max(1, matches.length); refresh(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); active = (active + matches.length - 1) % Math.max(1, matches.length); refresh(); }
    else if (event.key === "Enter") { event.preventDefault(); dispatch(matches[active]); }
  });
  input.addEventListener("input", () => {
    active = 0;
    remoteObjects = [];
    clearTimeout(searchHandle);
    const generation = ++searchGeneration;
    const query = input.value.trim();
    refresh();
    if (query.length < 3 || typeof searchObjects !== "function") return;
    searchHandle = setTimeout(async () => {
      try {
        const results = await searchObjects(query);
        if (generation !== searchGeneration || backdrop.hidden || input.value.trim() !== query) return;
        remoteObjects = Array.isArray(results) ? results : [];
        refresh();
      } catch { /* local search remains available when server search fails */ }
    }, 240);
  });
  backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });
  return { open, close };
}
