// Hydria OS data-flow engine. Safe, local, deterministic table operations only.
// Inspired by node/port graph semantics; no evaluated expressions or arbitrary code.
export const FLOW_NODE_CATALOG = Object.freeze([
  { type: "input.table", group: "Sources", label: "Table source", inputs: 0, outputs: 1, description: "Rows stored inside the workflow", defaults: { data: '[{"city":"Paris","sales":10},{"city":"Lyon","sales":7},{"city":"Paris","sales":5}]' } },
  { type: "transform.select", group: "Transform", label: "Select columns", inputs: 1, outputs: 1, description: "Keep columns in a specified order", defaults: { columns: "city,sales" } },
  { type: "transform.rename", group: "Transform", label: "Rename column", inputs: 1, outputs: 1, description: "Rename a column without overwriting existing data", defaults: { from: "city", to: "location" } },
  { type: "transform.fill", group: "Transform", label: "Fill missing", inputs: 1, outputs: 1, description: "Replace missing or blank values in a column", defaults: { column: "city", value: "Unknown" } },
  { type: "transform.unique", group: "Transform", label: "Remove duplicates", inputs: 1, outputs: 1, description: "Keep the first row for each combination of columns", defaults: { columns: "city" } },
  { type: "transform.union", group: "Transform", label: "Concatenate tables", inputs: 2, outputs: 1, description: "Append two tables while aligning their columns", defaults: {} },
  { type: "transform.filter", group: "Transform", label: "Row filter", inputs: 1, outputs: 1, description: "Compare a field against a value", defaults: { column: "sales", operator: "gte", value: "7" } },
  { type: "transform.sort", group: "Transform", label: "Sort rows", inputs: 1, outputs: 1, description: "Sort by field (ascending/descending)", defaults: { column: "sales", direction: "desc" } },
  { type: "transform.derive", group: "Transform", label: "Derived column", inputs: 1, outputs: 1, description: "Use safe arithmetic on a numeric column", defaults: { column: "sales", target: "with_tax", operator: "multiply", value: "1.2" } },
  { type: "transform.aggregate", group: "Transform", label: "Group by", inputs: 1, outputs: 1, description: "Group rows and aggregate a numeric column", defaults: { groupBy: "city", column: "sales", operation: "sum", target: "total_sales" } },
  { type: "transform.join", group: "Transform", label: "Join tables", inputs: 2, outputs: 1, description: "Join two tables using matching fields", defaults: { leftKey: "id", rightKey: "id", how: "left" } },
  { type: "output.table", group: "Outputs", label: "Table output", inputs: 1, outputs: 0, description: "Inspect the final table", defaults: {} }
]);
const catalog = new Map(FLOW_NODE_CATALOG.map((node) => [node.type, node]));
const MAX_NODES = 100;
const MAX_ROWS = 20000;
const MAX_LINKS = 250;
const MAX_CELL_CHARS = 10000;

function flowError(message, code = "INVALID_FLOW") {
  const e = new Error(message);
  e.code = code;
  throw e;
}
function safeString(value) {
  return String(value == null ? "" : value).slice(0, MAX_CELL_CHARS);
}
function normalizedRows(value) {
  if (!Array.isArray(value) || value.length > MAX_ROWS) flowError("Input must be an array with at most 20,000 rows.");
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) flowError("Each row must be a JSON object.");
    return Object.fromEntries(Object.entries(row).slice(0, 100).map(([k, v]) => [k.slice(0, 100), typeof v === "object" ? JSON.stringify(v).slice(0, MAX_CELL_CHARS) : v]));
  });
}
function numerical(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) flowError("Expected a finite number for " + label);
  return n;
}
function guardRows(rows) {
  if (rows.length > MAX_ROWS) flowError("Result exceeds 20,000 rows.");
  return rows;
}
function compare(lhs, operator, rhs) {
  const leftNum = Number(lhs), rightNum = Number(rhs);
  const bothNumeric = lhs !== "" && rhs !== "" && Number.isFinite(leftNum) && Number.isFinite(rightNum);
  const a = bothNumeric ? leftNum : safeString(lhs).toLowerCase();
  const b = bothNumeric ? rightNum : safeString(rhs).toLowerCase();
  switch (operator) {
    case "eq": return a === b;
    case "neq": return a !== b;
    case "gt": return a > b;
    case "gte": return a >= b;
    case "lt": return a < b;
    case "lte": return a <= b;
    case "contains": return safeString(lhs).toLowerCase().includes(safeString(rhs).toLowerCase());
    default: flowError("Unsupported filter operator: " + operator);
  }
}
function compute(type, inputTables, config) {
  const rows = inputTables[0] || [];
  if (type === "input.table") {
    let parsed;
    try { parsed = JSON.parse(String(config.data || "[]")); }
    catch { flowError("Source data is not valid JSON."); }
    return normalizedRows(parsed);
  }
  if (type === "transform.select") {
    const keys = String(config.columns || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!keys.length) flowError("Select needs at least one column.");
    return rows.map((row) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null])));
  }
  if (type === "transform.rename") {
    const from = safeString(config.from || "").trim();
    const to = safeString(config.to || "").trim();
    if (!from || !to) flowError("Source and destination column names are required.");
    if (from !== to && rows.some((row) => Object.hasOwn(row, from) && Object.hasOwn(row, to))) {
      flowError("Renaming would overwrite an existing column: " + to);
    }
    return rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key === from ? to : key, value])
    ));
  }
  if (type === "transform.fill") {
    const column = safeString(config.column || "").trim();
    if (!column) flowError("Choose a column to fill.");
    const replacement = safeString(config.value ?? "");
    return rows.map((row) => ({
      ...row,
      [column]: row[column] == null || row[column] === "" ? replacement : row[column]
    }));
  }
  if (type === "transform.unique") {
    const columns = [...new Set(String(config.columns || "").split(",").map((key) => key.trim()).filter(Boolean))];
    const seen = new Set();
    return rows.filter((row) => {
      const keys = columns.length ? columns : Object.keys(row).sort();
      const fingerprint = JSON.stringify(keys.map((key) => [key, row[key] ?? null]));
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }
  if (type === "transform.union") {
    const right = inputTables[1] || [];
    if (rows.length + right.length > MAX_ROWS) flowError("Concatenated table exceeds 20,000 rows.");
    const columns = [...new Set([...rows, ...right].flatMap((row) => Object.keys(row)))];
    if (columns.length > 100) flowError("Concatenated table exceeds 100 columns.");
    return [...rows, ...right].map((row) => Object.fromEntries(
      columns.map((column) => [column, row[column] ?? null])
    ));
  }
  if (type === "transform.filter") {
    if (!config.column) flowError("Choose a filter column.");
    return rows.filter((row) => compare(row[config.column], config.operator || "eq", config.value ?? ""));
  }
  if (type === "transform.sort") {
    const direction = config.direction === "desc" ? -1 : 1;
    return [...rows].sort((l, r) => {
      const a = l[config.column], b = r[config.column];
      if (a == null) return b == null ? 0 : 1;
      if (b == null) return -1;
      return direction * (Number.isFinite(Number(a)) && Number.isFinite(Number(b))
        ? Number(a) - Number(b)
        : safeString(a).localeCompare(safeString(b)));
    });
  }
  if (type === "transform.derive") {
    const amount = numerical(config.value, "derived value");
    const target = safeString(config.target || "").trim();
    if (!target) flowError("Choose a derived column name.");
    return rows.map((row) => {
      const n = numerical(row[config.column], config.column);
      let result;
      switch (config.operator) {
        case "add": result = n + amount; break;
        case "subtract": result = n - amount; break;
        case "divide":
          if (amount === 0) flowError("Cannot divide by zero.");
          result = n / amount; break;
        case "multiply": result = n * amount; break;
        default: flowError("Unsupported derived operation.");
      }
      if (!Number.isFinite(result)) flowError("Derived value is not finite.");
      return { ...row, [target]: result };
    });
  }
  if (type === "transform.aggregate") {
    const { groupBy, column } = config;
    const target = String(config.target || "result");
    if (!groupBy || !column) flowError("Group and numeric column are required.");
    const groups = new Map();
    for (const row of rows) {
      const key = JSON.stringify(row[groupBy] ?? null);
      const state = groups.get(key) || { group: row[groupBy] ?? null, values: [] };
      state.values.push(numerical(row[column], column));
      groups.set(key, state);
    }
    return [...groups.values()].map(({ group, values }) => {
      const sum = values.reduce((a, b) => a + b, 0);
      const operation = config.operation || "sum";
      const value = operation === "sum" ? sum : operation === "avg" ? sum / values.length
        : operation === "count" ? values.length : operation === "min" ? Math.min(...values)
        : operation === "max" ? Math.max(...values) : flowError("Invalid aggregate operation.");
      return { [groupBy]: group, [target]: value };
    });
  }
  if (type === "transform.join") {
    const right = inputTables[1] || [];
    const leftKey = String(config.leftKey || ""), rightKey = String(config.rightKey || "");
    if (!leftKey || !rightKey) flowError("Join keys are required.");
    const index = new Map();
    for (const row of right) {
      const key = JSON.stringify(row[rightKey] ?? null);
      const matches = index.get(key) || [];
      matches.push(row);
      index.set(key, matches);
    }
    const result = [];
    for (const row of rows) {
      const matches = index.get(JSON.stringify(row[leftKey] ?? null)) || [];
      for (const item of matches) result.push({ ...row, ...Object.fromEntries(Object.entries(item).map(([k,v]) => [k in row ? "right_" + k : k, v])) });
      if (!matches.length && config.how !== "inner") result.push({ ...row });
      if (result.length > MAX_ROWS) flowError("Join result exceeds 20,000 rows.");
    }
    return result;
  }
  if (type === "output.table") return rows;
  flowError("Unsupported node: " + type);
}
export function normalizeFlow(flow = {}) {
  const source = flow && typeof flow === "object" ? flow : {};
  return {
    title: safeString(source.title || "Data workflow"),
    version: 1,
    kind: "hydria-dataflow",
    trigger: "manual",
    stages: Array.isArray(source.stages) ? source.stages : [],
    links: Array.isArray(source.links) ? source.links : []
  };
}
export function validateFlow(source) {
  const flow = normalizeFlow(source);
  const errors = [];
  if (flow.stages.length > MAX_NODES) errors.push("Too many nodes (max 100).");
  if (flow.links.length > MAX_LINKS) errors.push("Too many links (max 250).");
  const nodes = new Map(), inCounts = new Map(), adjacency = new Map(), indegrees = new Map();
  for (const stage of flow.stages) {
    if (!stage || !stage.id || nodes.has(stage.id)) { errors.push("Node IDs must be unique and non-empty."); continue; }
    const type = stage.type || stage.kind;
    if (!catalog.has(type)) errors.push("Unsupported node type: " + type);
    nodes.set(stage.id, { ...stage, type });
    inCounts.set(stage.id, []);
    indegrees.set(stage.id, 0);
    adjacency.set(stage.id, []);
  }
  const connections = new Set();
  for (const link of flow.links) {
    const from = link?.from, to = link?.to, port = Number(link?.toPort ?? 0);
    if (!nodes.has(from) || !nodes.has(to)) { errors.push("Connection has a missing node."); continue; }
    if (from === to) { errors.push("Self-connections are not allowed."); continue; }
    const key = from + "->" + to + ":" + port;
    if (connections.has(key)) { errors.push("Duplicate connection: " + key); continue; }
    connections.add(key);
    if (!Number.isInteger(port) || port < 0 || port >= (catalog.get(nodes.get(to).type)?.inputs ?? 0)) {
      errors.push("Invalid input port for " + to); continue;
    }
    if ((catalog.get(nodes.get(from).type)?.outputs ?? 0) < 1) {
      errors.push("Output node cannot feed another node."); continue;
    }
    if (inCounts.get(to).some((x) => x.port === port)) {
      errors.push("Input port " + port + " on " + to + " has multiple connections."); continue;
    }
    inCounts.get(to).push({ from, port });
    adjacency.get(from).push(to);
    indegrees.set(to, indegrees.get(to) + 1);
  }
  for (const [id, node] of nodes) {
    const required = catalog.get(node.type)?.inputs || 0;
    if (inCounts.get(id).length !== required) errors.push("Node " + id + " needs " + required + " input connection(s).");
  }
  const ready = [...nodes.keys()].filter((id) => indegrees.get(id) === 0);
  const order = [];
  while (ready.length) {
    const id = ready.shift(); order.push(id);
    for (const next of adjacency.get(id)) {
      indegrees.set(next, indegrees.get(next) - 1);
      if (!indegrees.get(next)) ready.push(next);
    }
  }
  if (order.length !== nodes.size) errors.push("Workflow contains a cycle.");
  return { valid: !errors.length, errors, order, nodes, inCounts, flow };
}
export function runFlow(flow, { sampleLimit = 20, includeAllOutputs = false } = {}) {
  const validation = validateFlow(flow);
  if (!validation.valid) return { success: false, errors: validation.errors, order: validation.order, steps: [], outputs: [] };
  const results = new Map(), steps = [];
  for (const id of validation.order) {
    const stage = validation.nodes.get(id);
    const spec = catalog.get(stage.type);
    const inputs = validation.inCounts.get(id).sort((a,b) => a.port - b.port).map((c) => results.get(c.from));
    const started = Date.now();
    try {
      const rows = guardRows(compute(spec.type, inputs, stage.config || {}));
      results.set(id, rows);
      steps.push({ id, type: stage.type, label: stage.label || spec.label, status: "completed", rows: rows.length, durationMs: Date.now() - started, preview: rows.slice(0, Math.max(0, Math.min(100, sampleLimit))) });
    } catch (error) {
      steps.push({ id, type: stage.type, label: stage.label || spec.label, status: "failed", error: error.message, durationMs: Date.now() - started });
      return { success: false, errors: [error.message], failedNodeId: id, steps, order: validation.order, outputs: [] };
    }
  }
  const outputs = steps.filter((s) => s.type === "output.table").map((s) => ({ id: s.id, rows: s.rows, preview: s.preview, ...(includeAllOutputs ? { data: results.get(s.id) } : {}) }));
  return { success: true, errors: [], order: validation.order, steps, outputs };
}
