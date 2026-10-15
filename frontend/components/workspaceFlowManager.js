// Hydria OS native data-flow workbench. Zero UI dependencies.
// Graph editing is local; revisions are persisted by the existing work-object editor.
const DEFINITIONS = [
  { type: "input.table", group: "Sources", label: "Table source", inputs: 0, defaults: { data: '[{"city":"Paris","sales":10},{"city":"Lyon","sales":7},{"city":"Paris","sales":5}]' } },
  { type: "transform.select", group: "Transform", label: "Select columns", inputs: 1, defaults: { columns: "city,sales" } },
  { type: "transform.filter", group: "Transform", label: "Row filter", inputs: 1, defaults: { column: "sales", operator: "gte", value: "7" } },
  { type: "transform.sort", group: "Transform", label: "Sort", inputs: 1, defaults: { column: "sales", direction: "desc" } },
  { type: "transform.derive", group: "Transform", label: "Derived column", inputs: 1, defaults: { column: "sales", target: "with_tax", operator: "multiply", value: "1.2" } },
  { type: "transform.aggregate", group: "Transform", label: "Group by", inputs: 1, defaults: { groupBy: "city", column: "sales", operation: "sum", target: "total_sales" } },
  { type: "transform.join", group: "Transform", label: "Join tables", inputs: 2, defaults: { leftKey: "id", rightKey: "id", how: "left" } },
  { type: "output.table", group: "Outputs", label: "Table output", inputs: 1, defaults: {} }
];
const byType = new Map(DEFINITIONS.map((item) => [item.type, item]));
let sequence = 0;
function element(tag, cls = "", text = "") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
function button(text, action, cls = "") {
  const el = element("button", cls, text);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}
function parseFlow(content) {
  try {
    const obj = JSON.parse(String(content || "{}"));
    return obj && obj.kind === "hydria-dataflow" && Array.isArray(obj.stages) && Array.isArray(obj.links) ? obj : null;
  } catch { return null; }
}
function parseCSV(text) {
  // RFC4180-compatible quotes, escaped quotes, commas and newlines.
  const matrix = [], row = []; let cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i+1] === "\n") i++;
      row.push(cell); matrix.push([...row]); row.length = 0; cell = "";
      if (matrix.length > 20001) throw new Error("CSV exceeds 20,000 rows");
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell.length || row.length) { row.push(cell); matrix.push([...row]); }
  const headers = (matrix.shift() || []).map((v, i) => String(v).trim() || "column_" + (i+1));
  if (!headers.length || headers.length > 100) throw new Error("CSV must contain 1–100 columns");
  return matrix.filter((line) => line.some((v) => v.trim())).map((line) => Object.fromEntries(headers.map((header, i) => [header, line[i] ?? ""])));
}
function csvEscape(value) {
  const str = String(value == null ? "" : value);
  return /[,"\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}
function download(name, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = element("a");
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderTable(host, rows) {
  host.replaceChildren();
  if (!rows || !rows.length) { host.appendChild(element("p", "flow-muted", "No preview rows.")); return; }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 30);
  const table = element("table", "hydria-flow-table"), head = element("thead"), tr = element("tr");
  cols.forEach((col) => tr.appendChild(element("th", "", col)));
  head.appendChild(tr); table.appendChild(head);
  const body = element("tbody");
  rows.slice(0, 100).forEach((row) => {
    const line = element("tr");
    cols.forEach((col) => line.appendChild(element("td", "", String(row[col] ?? ""))));
    body.appendChild(line);
  });
  table.appendChild(body); host.appendChild(table);
}
function configurationField(labelText, value, update, options = null, multiline = false) {
  const row = element("label", "hydria-flow-field");
  row.appendChild(element("span", "", labelText));
  const control = options ? element("select") : element(multiline ? "textarea" : "input");
  if (options) options.forEach(([value, label]) => {
    const opt = element("option", "", label);
    opt.value = value;
    control.appendChild(opt);
  });
  control.value = String(value == null ? "" : value);
  if (multiline) { control.rows = 9; control.spellcheck = false; }
  control.addEventListener("change", () => update(control.value));
  row.appendChild(control);
  return row;
}
const OPTIONS = {
  operator: [["eq","="],["neq","≠"],["gt",">"],["gte","≥"],["lt","<"],["lte","≤"],["contains","Contains"],["add","Add"],["subtract","Subtract"],["multiply","Multiply"],["divide","Divide"]],
  direction: [["asc","Ascending"],["desc","Descending"]],
  operation: [["sum","Sum"],["avg","Average"],["count","Count"],["min","Min"],["max","Max"]],
  how: [["left","Left join"],["inner","Inner join"]]
};
function isFormControl(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName);
}
export function renderHydriaFlowManager(host, { content = "", onChange = null, title = "Data workflow" } = {}) {
  if (!host) return;
  const previous = host.__hydriaFlowCleanup;
  if (typeof previous === "function") previous();
  const model = parseFlow(content);
  if (!model) {
    host.replaceChildren(element("p", "flow-muted", "This workflow uses the classic automation format."));
    return;
  }
  host.replaceChildren();
  const state = { flow: structuredClone(model), selected: model.stages[0]?.id || "", pending: "", zoom: 1, results: null, error: "", running: false, history: [], future: [] };
  const root = element("section", "hydria-flow-manager");
  const toolbar = element("div", "hydria-flow-toolbar");
  const name = element("div", "hydria-flow-title");
  name.append(element("strong", "", "Flow Manager"), element("span", "flow-muted", "Data workflows · node-based ETL"));
  const actions = element("div", "hydria-flow-actions");
  toolbar.append(name, actions);
  const body = element("div", "hydria-flow-layout");
  const palette = element("aside", "hydria-flow-palette"), middle = element("div", "hydria-flow-central");
  const inspector = element("aside", "hydria-flow-inspector");
  const graphWrapper = element("div", "hydria-flow-scroll");
  const graph = element("div", "hydria-flow-graph");
  const wires = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wires.setAttribute("class", "hydria-flow-wires");
  wires.setAttribute("viewBox", "0 0 1800 1200");
  wires.setAttribute("preserveAspectRatio", "none");
  graph.append(wires);
  graphWrapper.appendChild(graph);
  const consoleView = element("section", "hydria-flow-console");
  middle.append(graphWrapper, consoleView);
  body.append(palette, middle, inspector);
  root.append(toolbar, body); host.appendChild(root);
  const abort = new AbortController();
  const onKey = (event) => {
    if (!host.isConnected || !host.contains(document.activeElement) || isFormControl(event.target)) return;
    if ((event.key === "Delete" || event.key === "Backspace") && state.selected) {
      event.preventDefault(); removeSelected();
    } else if (event.key === "Escape") {
      state.pending = ""; render();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); event.shiftKey ? redo() : undo();
    }
  };
  document.addEventListener("keydown", onKey, { signal: abort.signal });
  host.__hydriaFlowCleanup = () => {
    abort.abort();
    if (root.classList.contains("is-expanded")) document.body.classList.remove("hydria-flow-fullscreen");
  };
  function persist() {
    if (typeof onChange === "function") onChange(JSON.stringify(state.flow, null, 2));
  }
  function mutate(change) {
    state.history.push(JSON.stringify(state.flow));
    if (state.history.length > 40) state.history.shift();
    state.future = [];
    change();
    state.results = null; state.error = "";
    persist(); render();
  }
  function undo() {
    if (!state.history.length) return;
    state.future.push(JSON.stringify(state.flow));
    state.flow = JSON.parse(state.history.pop()); state.results = null;
    persist(); render();
  }
  function redo() {
    if (!state.future.length) return;
    state.history.push(JSON.stringify(state.flow));
    state.flow = JSON.parse(state.future.pop()); state.results = null;
    persist(); render();
  }
  function addNode(type) {
    const spec = byType.get(type);
    if (!spec) return;
    mutate(() => {
      const id = "node-" + (++sequence) + "-" + Date.now();
      const idx = state.flow.stages.length;
      state.flow.stages.push({ id, type, kind: type, label: spec.label, x: 100 + (idx % 5) * 260, y: 95 + Math.floor(idx / 5) * 210, config: structuredClone(spec.defaults) });
      state.selected = id;
    });
  }
  function removeSelected() {
    const id = state.selected;
    if (!id) return;
    mutate(() => {
      state.flow.stages = state.flow.stages.filter((s) => s.id !== id);
      state.flow.links = state.flow.links.filter((l) => l.from !== id && l.to !== id);
      state.selected = ""; state.pending = "";
    });
  }
  function connect(from, to, port = 0) {
    if (!from || !to || from === to) { state.pending = ""; render(); return; }
    if (!byType.get(state.flow.stages.find((s) => s.id === to)?.type)) return;
    mutate(() => {
      state.flow.links = state.flow.links.filter((l) => !(l.to === to && Number(l.toPort || 0) === port));
      state.flow.links.push({ id: "edge-" + Date.now() + "-" + (++sequence), from, to, toPort: port });
      state.pending = "";
    });
  }
  function nodeById(id) { return state.flow.stages.find((s) => s.id === id); }
  function svgEl(tag, attributes = {}) {
    const x = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([k, v]) => x.setAttribute(k, String(v)));
    return x;
  }
  function renderWires() {
    wires.replaceChildren();
    const definitions = svgEl("defs");
    const marker = svgEl("marker", { id: "hydria-flow-arrow", markerWidth: 7, markerHeight: 7, refX: 5, refY: 3, orient: "auto" });
    marker.append(svgEl("path", { d: "M 0 0 L 6 3 L 0 6", fill: "none", stroke: "#528ac9", "stroke-width": 1.5 }));
    definitions.append(marker); wires.append(definitions);
    state.flow.links.forEach((link) => {
      const from = nodeById(link.from), to = nodeById(link.to);
      if (!from || !to) return;
      const x1 = Number(from.x || 0) + 216, y1 = Number(from.y || 0) + 59;
      const x2 = Number(to.x || 0), y2 = Number(to.y || 0) + 55 + 24 * Number(link.toPort || 0);
      const d = "M " + x1 + " " + y1 + " C " + (x1 + 70) + " " + y1 + ", " + (x2 - 70) + " " + y2 + ", " + x2 + " " + y2;
      const path = svgEl("path", { d, stroke: "#528ac9", "stroke-width": 3, fill: "none", "marker-end": "url(#hydria-flow-arrow)" });
      path.classList.add("hydria-flow-edge");
      path.addEventListener("click", () => mutate(() => { state.flow.links = state.flow.links.filter((edge) => edge.id !== link.id); }));
      const hit = svgEl("path", { d, "stroke-width": 15, stroke: "transparent", fill: "none" });
      hit.addEventListener("click", () => {
        if (window.confirm("Remove this connection?")) mutate(() => { state.flow.links = state.flow.links.filter((edge) => edge.id !== link.id); });
      });
      wires.append(path, hit);
    });
  }
  function renderNodes() {
    graph.querySelectorAll(".hydria-flow-node").forEach((n) => n.remove());
    state.flow.stages.forEach((node) => {
      const spec = byType.get(node.type), card = element("div", "hydria-flow-node" + (node.id === state.selected ? " is-selected" : ""));
      card.style.left = Number(node.x || 0) + "px";
      card.style.top = Number(node.y || 0) + "px";
      card.dataset.nodeId = node.id;
      card.tabIndex = 0;
      const heading = element("div", "hydria-flow-node-heading", node.label || spec?.label || "Node");
      const subtitle = element("div", "hydria-flow-node-subtitle", node.type || "unknown");
      const contents = element("div", "hydria-flow-node-meta", spec ? spec.group : "Unknown");
      card.append(heading, subtitle, contents);
      card.addEventListener("click", () => { state.selected = node.id; renderInspector(); renderNodes(); });
      if (spec && spec.inputs > 0) for (let i = 0; i < spec.inputs; i++) {
        const input = button("◉", (event) => {
          if (state.pending) connect(state.pending, node.id, i);
          else { state.selected = node.id; renderInspector(); }
        }, "hydria-flow-input-port");
        input.title = "Input port " + (i + 1);
        input.style.top = (46 + i * 24) + "px";
        card.append(input);
      }
      if (spec?.type !== "output.table") {
        const output = button("◉", () => { state.pending = node.id; render(); }, "hydria-flow-output-port");
        output.title = "Connect output to another node's input";
        card.append(output);
      }
      heading.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        state.selected = node.id;
        const startX = event.clientX, startY = event.clientY;
        const oldX = Number(node.x || 0), oldY = Number(node.y || 0);
        let nextX = oldX, nextY = oldY;
        const move = (evt) => {
          nextX = Math.max(0, Math.round(oldX + (evt.clientX - startX) / state.zoom));
          nextY = Math.max(0, Math.round(oldY + (evt.clientY - startY) / state.zoom));
          node.x = nextX; node.y = nextY;
          card.style.left = nextX + "px"; card.style.top = nextY + "px";
          renderWires();
        };
        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          if (nextX !== oldX || nextY !== oldY) {
            state.history.push(JSON.stringify({ ...state.flow, stages: state.flow.stages.map((s) => s.id === node.id ? { ...s, x: oldX, y: oldY } : s) }));
            state.future = []; persist();
          }
          render();
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up, { once: true });
      });
      graph.append(card);
    });
  }
  function renderInspector() {
    inspector.replaceChildren();
    inspector.appendChild(element("h3", "", "Properties"));
    const node = nodeById(state.selected);
    if (!node) { inspector.appendChild(element("p", "flow-muted", "Select a node to configure its operation.")); return; }
    const spec = byType.get(node.type);
    inspector.appendChild(element("span", "hydria-flow-type-chip", node.type));
    inspector.appendChild(configurationField("Label", node.label || "", (v) => mutate(() => { node.label = v; })));
    const config = node.config || (node.config = {});
    Object.entries(spec?.defaults || {}).forEach(([key, initial]) => {
      const multiline = key === "data";
      inspector.appendChild(configurationField(key === "data" ? "Source rows (JSON array)" : key, config[key] ?? initial, (v) => mutate(() => { config[key] = v; }), OPTIONS[key] || null, multiline));
    });
    if (node.type === "input.table") {
      const csv = element("input"); csv.type = "file"; csv.accept = ".csv,text/csv"; csv.hidden = true;
      csv.addEventListener("change", async () => {
        const file = csv.files?.[0];
        if (!file) return;
        try {
          if (file.size > 2_000_000) throw new Error("CSV file is larger than 2 MB");
          const rows = parseCSV(await file.text());
          mutate(() => { config.data = JSON.stringify(rows); node.label = file.name; });
        } catch (error) { state.error = error.message || "CSV import failed"; renderConsole(); }
        csv.value = "";
      });
      inspector.append(csv, button("Import CSV", () => csv.click(), "hydria-flow-secondary"));
    }

    inspector.appendChild(button("Delete node", removeSelected, "hydria-flow-danger"));
    if (state.results?.steps) {
      const step = state.results.steps.find((s) => s.id === node.id);
      if (step) {
        inspector.appendChild(element("h4", "", "Node preview"));
        inspector.appendChild(element("p", "flow-muted", step.status + " · " + (step.rows ?? 0) + " rows"));
        const table = element("div", "hydria-flow-preview"); renderTable(table, step.preview);
        inspector.appendChild(table);
      }
    }
  }
  function renderPalette() {
    palette.replaceChildren(element("h3", "", "Node repository"));
    const search = element("input", "hydria-flow-search");
    search.type = "search"; search.placeholder = "Search nodes…";
    palette.appendChild(search);
    const list = element("div", "hydria-flow-catalog");
    palette.appendChild(list);
    const draw = () => {
      list.replaceChildren();
      const groups = [...new Set(DEFINITIONS.map((d) => d.group))];
      groups.forEach((group) => {
        const items = DEFINITIONS.filter((d) => d.group === group && (d.label + " " + d.type).toLowerCase().includes(search.value.toLowerCase()));
        if (!items.length) return;
        list.appendChild(element("h4", "", group));
        items.forEach((spec) => list.appendChild(button("+  " + spec.label, () => addNode(spec.type), "hydria-flow-catalog-item")));
      });
    };
    search.addEventListener("input", draw);
    draw();
  }
  function renderConsole() {
    consoleView.replaceChildren();
    const header = element("div", "hydria-flow-console-header");
    header.appendChild(element("strong", "", "Execution & previews"));
    if (state.running) header.appendChild(element("span", "flow-muted", "Executing…"));
    consoleView.appendChild(header);
    if (state.pending) consoleView.appendChild(element("p", "hydria-flow-banner", "Connecting from " + (nodeById(state.pending)?.label || state.pending) + " · click an input port · Escape cancels"));
    if (state.error) consoleView.appendChild(element("p", "hydria-flow-error", state.error));
    if (!state.results) {
      consoleView.appendChild(element("p", "flow-muted", "Run the flow to inspect row counts and table samples at every node."));
      return;
    }
    if (state.results.errors?.length) state.results.errors.forEach((err) => consoleView.appendChild(element("p", "hydria-flow-error", err)));
    (state.results.steps || []).forEach((step) => {
      const item = button((step.status === "completed" ? "✓ " : "✕ ") + step.label + " · " + (step.rows ?? "failed") + " rows", () => {
        state.selected = step.id; renderInspector(); renderNodes();
      }, "hydria-flow-run-step");
      consoleView.appendChild(item);
    });
    const output = state.results.outputs?.[0];
    if (output) {
      const host = element("div", "hydria-flow-preview");
      renderTable(host, output.preview);
      consoleView.appendChild(host);
      consoleView.appendChild(button("Download full output CSV", async () => {
        try {
          const response = await fetch("/api/flows/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flow: state.flow, outputId: output.id })
          });
          if (!response.ok) {
            const reason = await response.json().catch(() => ({}));
            throw new Error((reason.errors || []).join("; ") || "CSV export failed");
          }
          download("hydria-flow-output.csv", await response.blob(), "text/csv;charset=utf-8");
        } catch (error) { state.error = error.message || String(error); renderConsole(); }
      }, "hydria-flow-secondary"));
    }
  }
  async function run() {
    state.running = true; state.error = ""; state.results = null; renderConsole();
    try {
      const response = await fetch("/api/flows/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flow: state.flow, sampleLimit: 30 }) });
      const result = await response.json();
      state.results = result;
      if (!response.ok && !result.errors?.length) state.error = "Flow execution failed.";
    } catch (error) { state.error = error.message || String(error); }
    finally { state.running = false; renderConsole(); renderInspector(); }
  }
  function renderActions() {
    actions.replaceChildren();
    actions.append(
      button("▶ Run", () => { void run(); }, "hydria-flow-primary"),
      button("Undo", undo, "hydria-flow-secondary"),
      button("Redo", redo, "hydria-flow-secondary"),
      button("−", () => { state.zoom = Math.max(0.5, state.zoom - 0.1); renderScale(); }, "hydria-flow-secondary"),
      button("+", () => { state.zoom = Math.min(1.5, state.zoom + 0.1); renderScale(); }, "hydria-flow-secondary"),
      button("Export JSON", () => download("hydria-flow.json", JSON.stringify(state.flow, null, 2), "application/json"), "hydria-flow-secondary")
    );
    const importInput = element("input"); importInput.type = "file"; importInput.accept = ".json,application/json"; importInput.hidden = true;
    importInput.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const parsed = parseFlow(await file.text());
      if (!parsed) { state.error = "Not a valid Hydria data-flow JSON file."; renderConsole(); return; }
      mutate(() => { state.flow = parsed; state.selected = parsed.stages[0]?.id || ""; });
      importInput.value = "";
    });
    const importButton = button("Import JSON", () => importInput.click(), "hydria-flow-secondary");
    actions.append(importButton, importInput);
    actions.appendChild(button(root.classList.contains("is-expanded") ? "Exit full screen" : "Full screen", () => {
      root.classList.toggle("is-expanded");
      document.body.classList.toggle("hydria-flow-fullscreen", root.classList.contains("is-expanded"));
      renderActions();
    }, "hydria-flow-secondary"));
  }
  function renderScale() {
    graph.style.transform = "scale(" + state.zoom + ")";
    graphWrapper.style.setProperty("--flow-zoom", String(state.zoom));
  }
  function render() { renderActions(); renderPalette(); renderInspector(); renderNodes(); renderWires(); renderConsole(); renderScale(); }
  render();
}
