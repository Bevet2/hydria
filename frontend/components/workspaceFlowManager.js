// Hydria OS native data-flow workbench. Zero UI dependencies.
// Graph editing is local; revisions are persisted by the existing work-object editor.
const DEFINITIONS = [
  { type: "input.table", group: "Sources", label: "Table source", inputs: 0, defaults: { data: '[{"city":"Paris","sales":10},{"city":"Lyon","sales":7},{"city":"Paris","sales":5}]' } },
  { type: "transform.select", group: "Transform", label: "Select columns", inputs: 1, defaults: { columns: "city,sales" } },
  { type: "transform.rename", group: "Transform", label: "Rename column", inputs: 1, defaults: { from: "city", to: "location" } },
  { type: "transform.fill", group: "Transform", label: "Fill missing", inputs: 1, defaults: { column: "city", value: "Unknown" } },
  { type: "transform.unique", group: "Transform", label: "Remove duplicates", inputs: 1, defaults: { columns: "city" } },
  { type: "transform.union", group: "Transform", label: "Concatenate tables", inputs: 2, defaults: {} },
  { type: "transform.text", group: "Clean", label: "Clean text", inputs: 1, defaults: { column: "city", target: "city", textAction: "trim", find: "", replacement: "" } },
  { type: "transform.cast", group: "Clean", label: "Convert type", inputs: 1, defaults: { column: "sales", target: "sales", valueType: "number" } },
  { type: "transform.profile", group: "Inspect", label: "Column profile", inputs: 1, defaults: {} },
  { type: "transform.filter", group: "Transform", label: "Row filter", inputs: 1, defaults: { column: "sales", operator: "gte", value: "7" } },
  { type: "transform.sort", group: "Transform", label: "Sort", inputs: 1, defaults: { column: "sales", direction: "desc" } },
  { type: "transform.derive", group: "Transform", label: "Derived column", inputs: 1, defaults: { column: "sales", target: "with_tax", operator: "multiply", value: "1.2" } },
  { type: "transform.aggregate", group: "Transform", label: "Group by", inputs: 1, defaults: { groupBy: "city", column: "sales", operation: "sum", target: "total_sales" } },
  { type: "transform.pivot", group: "Reshape", label: "Pivot table", inputs: 1, defaults: { index: "city", pivotColumn: "year", valueColumn: "sales", operation: "sum" } },
  { type: "transform.unpivot", group: "Reshape", label: "Unpivot columns", inputs: 1, defaults: { columns: "sales,cost", nameColumn: "field", valueColumn: "amount" } },
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
function detectTableDelimiter(text) {
  // Rank separators by how consistently they appear across logical records.
  // This covers French Excel CSV (semicolon) and tab-delimited files without
  // confusing punctuation contained inside quoted cells with delimiters.
  const separators = [",", ";", "\t"];
  const records = [];
  let counts = [0, 0, 0], quoted = false, hasContent = false;
  for (let i = 0; i < text.length && records.length < 6; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (hasContent) records.push(counts);
      counts = [0, 0, 0]; hasContent = false;
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else {
      if (!/\s/.test(char)) hasContent = true;
      if (!quoted) {
        const index = separators.indexOf(char);
        if (index !== -1) counts[index]++;
      }
    }
  }
  if (hasContent && records.length < 6) records.push(counts);
  const score = separators.map((_, index) => {
    const occurrences = records.map((record) => record[index]);
    return occurrences.filter((count) => count > 0).length * 100 +
      occurrences.reduce((sum, count) => sum + count, 0);
  });
  const best = score.indexOf(Math.max(...score));
  return score[best] > 0 ? separators[best] : ",";
}

export function parseCSV(text) {
  // Quotes, multiline cells, French semicolon CSV, TSV, UTF-8 BOM and duplicate
  // headers are all handled before storing rows as JSON in a source node.
  const source = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectTableDelimiter(source);
  const matrix = [], row = [];
  let cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); matrix.push([...row]); row.length = 0; cell = "";
      if (matrix.length > 20001) throw new Error("Table exceeds 20,000 rows");
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell.length || row.length) { row.push(cell); matrix.push([...row]); }
  const seen = new Set();
  const headers = (matrix.shift() || []).map((value, index) => {
    const base = String(value).trim().slice(0, 100) || "column_" + (index + 1);
    let key = base, suffix = 2;
    while (seen.has(key)) key = base.slice(0, 90) + "_" + suffix++;
    seen.add(key);
    return key;
  });
  if (!headers.length || headers.length > 100) throw new Error("Table must contain 1–100 columns");
  const rows = matrix.filter((line) => line.some((v) => v.trim()));
  if (rows.length > 20000) throw new Error("Table exceeds 20,000 rows");
  return rows.map((line) => Object.fromEntries(headers.map((header, index) => [header, (line[index] ?? "").slice(0, 10000)])));
}
export function normalizedJsonApiRows(payload) {
  const rows = Array.isArray(payload) ? payload :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.rows) ? payload.rows : null;
  if (!rows || rows.length > 20000) throw new Error("REST JSON source must contain up to 20,000 object rows");
  return rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length > 100) {
      throw new Error("Invalid REST JSON object row " + (index + 1));
    }
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
      String(key).slice(0, 100),
      value === null ? null : typeof value === "object"
        ? JSON.stringify(value).slice(0, 10000)
        : typeof value === "string" ? value.slice(0, 10000) : value
    ]));
  });
}
export function selectableExcelSheets(model = {}) {
  const all = Array.isArray(model?.sheets) ? model.sheets : [];
  const usable = all.filter((sheet) => Array.isArray(sheet?.columns) && sheet.columns.length > 0 && Array.isArray(sheet.rows));
  const visible = usable.filter((sheet) => !sheet.hidden);
  // Hidden worksheets are not offered if at least one visible worksheet exists.
  return visible.length ? visible : usable;
}
export function spreadsheetSheetToFlowRows(sheet = {}) {
  const names = sheet?.columns;
  if (!Array.isArray(names) || names.length === 0 || names.length > 100) {
    throw new Error("Excel sheet must contain 1–100 columns");
  }
  const seen = new Set();
  const columns = names.map((value, index) => {
    const base = String(value ?? "").trim().slice(0, 100) || `Column ${index + 1}`;
    let name = base, suffix = 2;
    while (seen.has(name)) name = base.slice(0, 90) + "_" + suffix++;
    seen.add(name);
    return name;
  });
  const data = Array.isArray(sheet.rows) ? sheet.rows : [];
  if (data.length > 20000) throw new Error("Excel sheet exceeds 20,000 rows");
  return data
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()))
    .map((row) => Object.fromEntries(columns.map((column, index) => [
      column, String(row[index] ?? "").slice(0, 10000)
    ])));
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
  how: [["left","Left join"],["inner","Inner join"]],
  textAction: [["trim","Trim whitespace"],["lower","Lowercase"],["upper","Uppercase"],["replace","Replace substring"]],
  valueType: [["string","Text"],["number","Number"],["boolean","Boolean"]]
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
  const state = { flow: structuredClone(model), selected: model.stages[0]?.id || "", activeOutputId: "", pending: "", zoom: 1, results: null, error: "", running: false, history: [], future: [], runHistory: [], snapshotToken: "", snapshots: [], loadedSnapshot: null, snapshotBusy: false };
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
      const csv = element("input"); csv.type = "file"; csv.accept = ".csv,.tsv,.txt,text/csv,text/tab-separated-values"; csv.hidden = true;
      csv.addEventListener("change", async () => {
        const file = csv.files?.[0];
        if (!file) return;
        try {
          if (file.size > 2_000_000) throw new Error("Delimited text file is larger than 2 MB");
          const rows = parseCSV(await file.text());
          mutate(() => { config.data = JSON.stringify(rows); node.label = file.name; });
        } catch (error) { state.error = error.message || "Table import failed"; renderConsole(); }
        csv.value = "";
      });
      inspector.append(csv, button("Import CSV / TSV", () => csv.click(), "hydria-flow-secondary"));

      // Reuse the OS Sheets import route, so Flow Manager and Sheets decode
      // XLSX files consistently (formats, dates and sheet names included).
      const excel = element("input");
      excel.type = "file";
      excel.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      excel.hidden = true;
      let availableSheets = [];
      let workbookFilename = "";
      const sheetChooser = element("div", "hydria-flow-excel-sheet-chooser");
      sheetChooser.hidden = true;
      const sheetLabel = element("label", "hydria-flow-field");
      sheetLabel.appendChild(element("span", "", "Choose Excel worksheet"));
      const worksheetSelect = element("select");
      sheetLabel.appendChild(worksheetSelect);
      sheetChooser.appendChild(sheetLabel);
      const importSheet = (sheet) => {
        const rows = spreadsheetSheetToFlowRows(sheet);
        const target = nodeById(node.id);
        if (!target) throw new Error("Selected source node no longer exists");
        mutate(() => {
          target.config = { ...(target.config || {}), data: JSON.stringify(rows) };
          target.label = workbookFilename + " · " + String(sheet.name || "Sheet");
        });
      };
      sheetChooser.appendChild(button("Load selected worksheet", () => {
        try {
          const sheet = availableSheets[Number(worksheetSelect.value)];
          if (!sheet) throw new Error("Choose a worksheet before importing");
          importSheet(sheet);
        } catch (error) {
          state.error = String(error.message || error);
          renderConsole();
        }
      }, "hydria-flow-secondary"));
      excel.addEventListener("change", async () => {
        const file = excel.files?.[0];
        if (!file) return;
        try {
          if (file.size > 5_000_000) throw new Error("Excel workbook exceeds the 5 MB import limit");
          const data = new FormData();
          data.append("workbook", file);
          const response = await fetch("/api/sheets/import-xlsx", { method: "POST", body: data });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success !== true) {
            throw new Error(String(result.message || result.error?.message || result.error || "Excel import failed"));
          }
          availableSheets = selectableExcelSheets(result.model);
          if (!availableSheets.length) throw new Error("No usable worksheet in the imported Excel workbook");
          workbookFilename = file.name;
          if (availableSheets.length === 1) {
            importSheet(availableSheets[0]);
          } else {
            worksheetSelect.replaceChildren();
            availableSheets.forEach((sheet, index) => {
              const option = element("option", "", String(sheet.name || "Sheet " + (index + 1)) +
                " · " + sheet.rows.length + " rows");
              option.value = String(index);
              worksheetSelect.appendChild(option);
            });
            worksheetSelect.value = "0";
            sheetChooser.hidden = false;
            state.error = "";
            renderConsole();
          }
        } catch (error) {
          state.error = error.message || "Excel import failed";
          renderConsole();
        } finally {
          excel.value = "";
        }
      });
      inspector.append(excel, button("Import Excel (XLSX)", () => excel.click(), "hydria-flow-secondary"), sheetChooser);

      // The SQLite connector is opted into by a server administrator.
      // The token stays in this temporary password field and is NEVER saved
      // to workflow.json, node config, browser local storage or the API URL.
      const dbPanel = element("div", "hydria-flow-sqlite-source");
      dbPanel.appendChild(element("h4", "", "SQLite source"));
      const tokenLabel = element("label", "hydria-flow-field");
      tokenLabel.appendChild(element("span", "", "Connector token (not saved)"));
      const tokenInput = element("input");
      tokenInput.type = "password";
      tokenInput.autocomplete = "off";
      tokenInput.placeholder = "Server connector token";
      tokenLabel.appendChild(tokenInput);
      dbPanel.appendChild(tokenLabel);
      const tableLabel = element("label", "hydria-flow-field");
      tableLabel.appendChild(element("span", "", "Table"));
      const tableSelect = element("select");
      tableSelect.disabled = true;
      tableLabel.appendChild(tableSelect);
      dbPanel.appendChild(tableLabel);
      const limitLabel = element("label", "hydria-flow-field");
      limitLabel.appendChild(element("span", "", "Maximum rows"));
      const limitInput = element("input");
      limitInput.type = "number"; limitInput.min = "1"; limitInput.max = "20000";
      limitInput.value = "1000";
      limitLabel.appendChild(limitInput);
      dbPanel.appendChild(limitLabel);
      const parseConnectorResponse = async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success !== true) {
          throw new Error(String(payload.error || "SQL connector request failed"));
        }
        return payload;
      };
      dbPanel.appendChild(button("List SQLite tables", async () => {
        try {
          const token = tokenInput.value.trim();
          if (!token) throw new Error("Enter the connector token");
          const payload = await parseConnectorResponse(await fetch("/api/flow-sources/sqlite/tables", {
            headers: { "x-hydria-flow-token": token }
          }));
          tableSelect.replaceChildren();
          (payload.tables || []).forEach((table) => {
            const option = element("option", "", table);
            option.value = table;
            tableSelect.appendChild(option);
          });
          tableSelect.disabled = !(payload.tables || []).length;
          state.error = tableSelect.disabled ? "No accessible SQLite tables" : "";
          renderConsole();
        } catch (error) {
          state.error = String(error.message || error);
          renderConsole();
        }
      }, "hydria-flow-secondary"));
      dbPanel.appendChild(button("Import selected SQLite table", async () => {
        try {
          const token = tokenInput.value.trim();
          const table = tableSelect.value;
          const limit = Number(limitInput.value);
          if (!token || tableSelect.disabled || !table) throw new Error("Authenticate and select a table first");
          if (!Number.isInteger(limit) || limit < 1 || limit > 20000) throw new Error("Choose 1–20,000 rows");
          const payload = await parseConnectorResponse(await fetch("/api/flow-sources/sqlite/read", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-hydria-flow-token": token
            },
            body: JSON.stringify({ table, limit })
          }));
          const target = nodeById(node.id);
          if (!target) throw new Error("The source node has been removed");
          mutate(() => {
            target.config = { ...(target.config || {}), data: JSON.stringify(payload.rows || []) };
            target.label = "SQLite · " + table;
          });
          state.error = "";
          renderConsole();
        } catch (error) {
          state.error = String(error.message || error);
          renderConsole();
        }
      }, "hydria-flow-secondary"));
      inspector.appendChild(dbPanel);

      // Explicit public/CORS-accessible REST JSON data import. The browser
      // never forwards cookies, secrets or privileged backend credentials.
      const restPanel = element("div", "hydria-flow-rest-source");
      restPanel.appendChild(element("h4", "", "REST JSON source"));
      const urlLabel = element("label", "hydria-flow-field");
      urlLabel.appendChild(element("span", "", "Public HTTPS JSON URL"));
      const urlInput = element("input");
      urlInput.type = "url";
      urlInput.placeholder = "https://example.com/data.json";
      urlInput.autocomplete = "off";
      urlLabel.appendChild(urlInput);
      restPanel.appendChild(urlLabel);
      restPanel.appendChild(button("Import REST JSON (CORS)", async () => {
        try {
          const address = new URL(urlInput.value.trim());
          if (address.protocol !== "https:" &&
              !(address.protocol === "http:" && ["localhost", "127.0.0.1"].includes(address.hostname))) {
            throw new Error("Only HTTPS URLs are supported (HTTP on localhost for development)");
          }
          if (address.username || address.password) throw new Error("Credentials must not be embedded in URLs");
          const response = await fetch(address.href, {
            mode: "cors", credentials: "omit", redirect: "error",
            headers: { Accept: "application/json" }
          });
          if (!response.ok) throw new Error("REST source returned HTTP " + response.status);
          if (Number(response.headers.get("content-length") || 0) > 2_000_000) throw new Error("REST source exceeds 2 MB");
          const reader = response.body?.getReader();
          if (!reader) throw new Error("REST source response has no readable body");
          const decoder = new TextDecoder();
          let text = "", bytes = 0;
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 2_000_000) {
                await reader.cancel();
                throw new Error("REST source exceeds 2 MB");
              }
              text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
          } finally { reader.releaseLock(); }
          const rows = normalizedJsonApiRows(JSON.parse(text));
          const target = nodeById(node.id);
          if (!target) throw new Error("The source node has been removed");
          mutate(() => {
            target.config = { ...(target.config || {}), data: JSON.stringify(rows) };
            target.label = "REST · " + address.hostname;
          });
        } catch (error) {
          state.error = "REST import: " + String(error.message || error);
          renderConsole();
        }
      }, "hydria-flow-secondary"));
      inspector.appendChild(restPanel);
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
    if (state.flow.executionHistoryId) {
      header.appendChild(button("Refresh history", () => { void loadRunHistory(); }, "hydria-flow-secondary"));
    }
    consoleView.appendChild(header);
    if (state.runHistory.length) {
      const historySection = element("details", "hydria-flow-run-history");
      const summary = element("summary", "", "Run history · " + state.runHistory.length + " recent runs");
      historySection.appendChild(summary);
      const entries = element("ul", "hydria-flow-run-list");
      state.runHistory.slice(0, 10).forEach((run) => {
        const item = element("li", "", (run.status === "success" ? "✓ " : "✕ ") +
          new Date(run.startedAt).toLocaleString() + " · " + run.status +
          " · " + run.stepCount + " steps · " + run.outputRows + " output rows · " +
          run.durationMs + " ms");
        entries.appendChild(item);
      });
      historySection.appendChild(entries);
      consoleView.appendChild(historySection);
    }

    if (state.flow.executionHistoryId) {
      const saved = element("section", "hydria-flow-run-history");
      saved.appendChild(element("strong", "", "Saved datasets · opt-in"));
      saved.appendChild(element("p", "flow-muted",
        "Snapshots are stored on this server. Enter the administrator's connector token; it is kept only in memory."));
      const tokenField = element("label", "hydria-flow-field");
      tokenField.appendChild(element("span", "", "Connector token (not saved)"));
      const tokenInput = element("input");
      tokenInput.type = "password"; tokenInput.autocomplete = "off";
      tokenInput.value = state.snapshotToken;
      tokenInput.placeholder = "HYDRIA_FLOW_CONNECTOR_TOKEN";
      tokenInput.addEventListener("input", () => { state.snapshotToken = tokenInput.value; });
      tokenField.appendChild(tokenInput);
      saved.appendChild(tokenField);
      saved.appendChild(button("Refresh saved datasets", () => { void loadSnapshots(); }, "hydria-flow-secondary"));
      for (const entry of state.snapshots) {
        const item = element("div", "hydria-flow-run-step");
        item.appendChild(element("span", "", entry.label + " · " + entry.rowCount +
          " rows · " + new Date(entry.createdAt).toLocaleString()));
        item.appendChild(button("Open", () => { void openSnapshot(entry.id); }, "hydria-flow-secondary"));
        item.appendChild(button("Delete", () => { void removeSnapshot(entry.id); }, "hydria-flow-secondary"));
        saved.appendChild(item);
      }
      if (state.loadedSnapshot) {
        const snapshot = state.loadedSnapshot;
        saved.appendChild(element("h4", "", "Saved result: " + snapshot.label));
        const preview = element("div", "hydria-flow-preview");
        renderTable(preview, snapshot.rows.slice(0, 100));
        saved.appendChild(preview);
        saved.appendChild(button("Use saved rows as new source node", () => {
          if (state.flow.stages.length >= 100) {
            state.error = "The flow already has 100 nodes."; renderConsole(); return;
          }
          mutate(() => {
            const id = "node-" + (++sequence) + "-" + Date.now();
            state.flow.stages.push({
              id, type: "input.table", kind: "input.table", label: "Saved · " + snapshot.label,
              x: 120, y: 100, config: { data: JSON.stringify(snapshot.rows) }
            });
            state.selected = id;
          });
        }, "hydria-flow-secondary"));
      }
      consoleView.appendChild(saved);
    }
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
    const outputs = state.results.outputs || [];
    if (outputs.length > 1) {
      const selection = element("label", "hydria-flow-field");
      selection.appendChild(element("span", "", "Output dataset"));
      const picker = element("select", "hydria-flow-output-picker");
      for (const candidate of outputs) {
        const option = element("option", "", (nodeById(candidate.id)?.label || candidate.id) + " · " + candidate.rows + " rows");
        option.value = candidate.id;
        picker.appendChild(option);
      }
      if (!outputs.some((candidate) => candidate.id === state.activeOutputId)) {
        state.activeOutputId = outputs[0].id;
      }
      picker.value = state.activeOutputId;
      picker.addEventListener("change", () => {
        state.activeOutputId = picker.value;
        renderConsole();
      });
      selection.appendChild(picker);
      consoleView.appendChild(selection);
    }
    const output = outputs.find((item) => item.id === state.activeOutputId) || outputs[0];
    if (output) {
      consoleView.appendChild(button("Save selected output to SQLite", () => {
        void saveSnapshot(output.id);
      }, "hydria-flow-secondary"));
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
      if ((state.results.outputs || []).length > 1) {
        consoleView.appendChild(button("Download all outputs Excel", async () => {
          try {
            const response = await fetch("/api/flows/export-workbook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ flow: state.flow })
            });
            if (!response.ok) {
              const reason = await response.json().catch(() => ({}));
              throw new Error((reason.errors || []).join("; ") || "Multi-output Excel export failed");
            }
            download("hydria-flow-all-outputs.xlsx", await response.blob(),
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          } catch (error) { state.error = error.message || String(error); renderConsole(); }
        }, "hydria-flow-secondary"));
        consoleView.appendChild(button("Download all outputs (ZIP)", async () => {
          try {
            const response = await fetch("/api/flows/export-bundle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ flow: state.flow })
            });
            if (!response.ok) {
              const reason = await response.json().catch(() => ({}));
              throw new Error((reason.errors || []).join("; ") || "Bundle export failed");
            }
            download("hydria-flow-outputs.zip", await response.blob(), "application/zip");
          } catch (error) { state.error = error.message || String(error); renderConsole(); }
        }, "hydria-flow-secondary"));
      }
      consoleView.appendChild(button("Download full output Excel", async () => {
        try {
          const response = await fetch("/api/flows/export-xlsx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flow: state.flow, outputId: output.id })
          });
          if (!response.ok) {
            const reason = await response.json().catch(() => ({}));
            throw new Error((reason.errors || []).join("; ") || "Excel export failed");
          }
          download("hydria-flow-output.xlsx", await response.blob(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        } catch (error) { state.error = error.message || String(error); renderConsole(); }
      }, "hydria-flow-secondary"));
    }
  }
  async function snapshotRequest(url, options = {}) {
    const token = state.snapshotToken.trim();
    if (!token) throw new Error("Enter the connector token to access saved results.");
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        "x-hydria-flow-token": token
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success !== true) {
      throw new Error(String(payload.error || (payload.errors || []).join("; ") || "Snapshot request failed"));
    }
    return payload;
  }
  async function loadSnapshots() {
    if (!state.flow.executionHistoryId) return;
    try {
      const key = encodeURIComponent(state.flow.executionHistoryId);
      const result = await snapshotRequest("/api/flows/snapshots/" + key);
      state.snapshots = Array.isArray(result.snapshots) ? result.snapshots : [];
      state.error = "";
    } catch (error) {
      state.error = "Saved datasets: " + String(error.message || error);
    }
    renderConsole();
  }
  async function saveSnapshot(outputId) {
    if (state.snapshotBusy) return;
    state.snapshotBusy = true;
    try {
      await snapshotRequest("/api/flows/snapshots", {
        method: "POST",
        body: JSON.stringify({
          flow: state.flow, historyId: state.flow.executionHistoryId, outputId
        })
      });
      await loadSnapshots();
    } catch (error) {
      state.error = "Save dataset: " + String(error.message || error); renderConsole();
    } finally {
      state.snapshotBusy = false;
    }
  }
  async function openSnapshot(snapshotId) {
    try {
      const key = encodeURIComponent(state.flow.executionHistoryId);
      const result = await snapshotRequest("/api/flows/snapshots/" +
        key + "/" + encodeURIComponent(snapshotId));
      state.loadedSnapshot = result.snapshot;
      state.error = "";
    } catch (error) {
      state.error = "Load dataset: " + String(error.message || error);
    }
    renderConsole();
  }
  async function removeSnapshot(snapshotId) {
    if (!window.confirm("Permanently delete this saved dataset?")) return;
    try {
      const key = encodeURIComponent(state.flow.executionHistoryId);
      await snapshotRequest("/api/flows/snapshots/" +
        key + "/" + encodeURIComponent(snapshotId), { method: "DELETE" });
      if (state.loadedSnapshot?.id === snapshotId) state.loadedSnapshot = null;
      await loadSnapshots();
    } catch (error) {
      state.error = "Delete dataset: " + String(error.message || error); renderConsole();
    }
  }
  async function loadRunHistory() {
    if (!state.flow.executionHistoryId) return;
    try {
      const response = await fetch("/api/flows/history/" + encodeURIComponent(state.flow.executionHistoryId));
      if (!response.ok) throw new Error("Cannot load flow execution history");
      const body = await response.json();
      state.runHistory = Array.isArray(body.runs) ? body.runs : [];
      renderConsole();
    } catch (error) {
      state.error = String(error.message || error);
      renderConsole();
    }
  }
  async function run() {
    if (!state.flow.executionHistoryId) {
      state.flow.executionHistoryId = crypto.randomUUID();
      persist();
    }
    state.running = true; state.error = ""; state.results = null; renderConsole();
    try {
      const response = await fetch("/api/flows/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flow: state.flow, historyId: state.flow.executionHistoryId, sampleLimit: 30 }) });
      const result = await response.json();
      state.results = result;
      if (!result.outputs?.some((item) => item.id === state.activeOutputId)) {
        state.activeOutputId = result.outputs?.[0]?.id || "";
      }
      if (!response.ok && !result.errors?.length) state.error = "Flow execution failed.";
    } catch (error) { state.error = error.message || String(error); }
    finally {
      state.running = false; renderConsole(); renderInspector();
      await loadRunHistory();
    }
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
  if (state.flow.executionHistoryId) void loadRunHistory();
}
