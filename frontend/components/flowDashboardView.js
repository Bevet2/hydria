// Read-only, token-gated dashboard for Hydria Flow snapshots.
// No dependencies, no eval or HTML injection, and no persisted credentials.
export function aggregateSnapshotRows(rows, { groupBy, measure, operation = "sum", filter = "" } = {}) {
  if (!Array.isArray(rows)) return { rows: [], groups: [] };
  const search = String(filter).toLocaleLowerCase();
  const visible = rows.filter((row) => row && typeof row === "object" &&
    Object.values(row).some((value) => String(value ?? "").toLocaleLowerCase().includes(search)));
  const buckets = new Map();
  for (const row of visible) {
    const name = String(row[groupBy] ?? "(vide)").slice(0, 120);
    const numeric = Number(row[measure]);
    const allowed = row[measure] != null && row[measure] !== "" && Number.isFinite(numeric);
    let bucket = buckets.get(name);
    if (!bucket) { bucket = { name, sum: 0, count: 0, valid: 0 }; buckets.set(name, bucket); }
    bucket.count++;
    if (allowed) { bucket.sum += numeric; bucket.valid++; }
  }
  const groups = Array.from(buckets.values()).map((bucket) => ({
    name: bucket.name,
    value: operation === "count" ? bucket.count
      : operation === "avg" ? (bucket.valid ? bucket.sum / bucket.valid : 0) : bucket.sum,
    count: bucket.count
  })).sort((a,b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 20);
  return { rows: visible, groups, totalGroups: buckets.size };
}
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (typeof document !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const flowKey = params.get("flowKey") || "";
  const el = (name) => document.getElementById(name);
  const state = { token: "", metadata: [], snapshot: null, activeId: "", pollBusy: false };
  const status = (text) => { el("status").textContent = text; };
  const error = (text) => { el("error").textContent = text || ""; };
  const element = (tag, value = "") => {
    const item = document.createElement(tag);
    item.textContent = value;
    return item;
  };
  const compact = (value) => Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  function columns() {
    return [...new Set((state.snapshot?.rows || []).flatMap((row) => Object.keys(row || {})))].slice(0, 100);
  }
  function selectOptions(control, fields, preferred) {
    const previous = preferred || control.value;
    control.replaceChildren();
    for (const field of fields) {
      const option = element("option", field);
      option.value = field;
      control.appendChild(option);
    }
    control.value = fields.includes(previous) ? previous : (fields[0] || "");
  }
  function render() {
    const rows = state.snapshot?.rows || [];
    const cols = columns();
    if (!rows.length) {
      el("chart").replaceChildren(element("p", "Aucune ligne pour ce résultat."));
      el("table").replaceChildren();
      el("row-count").textContent = "0";
      el("group-count").textContent = "0";
      return;
    }
    selectOptions(el("group"), cols);
    const numeric = cols.filter((key) => rows.some((row) =>
      row[key] !== null && row[key] !== "" && row[key] !== undefined &&
      Number.isFinite(Number(row[key]))));
    selectOptions(el("measure"), numeric.length ? numeric : cols);
    renderData();
  }
  function renderData() {
    if (!state.snapshot) return;
    const source = state.snapshot.rows || [];
    const result = aggregateSnapshotRows(source, {
      groupBy: el("group").value, measure: el("measure").value,
      operation: el("operation").value, filter: el("filter").value
    });
    el("row-count").textContent = compact(result.rows.length);
    el("group-count").textContent = compact(result.totalGroups || 0);
    el("updated").textContent = state.snapshot.createdAt
      ? new Date(state.snapshot.createdAt).toLocaleString("fr-FR") : "—";
    const chart = el("chart");
    chart.replaceChildren();
    const max = Math.max(0, ...result.groups.map((r) => r.value));
    const min = Math.min(0, ...result.groups.map((r) => r.value));
    const scale = Math.max(max - min, 1);
    for (const row of result.groups) {
      const line = element("div"); line.className = "bar-row";
      const label = element("span", row.name); label.className = "bar-label"; label.title = row.name;
      const track = element("div"); track.className = "bar-bg";
      const value = element("div"); value.className = "bar-value";
      // Zero-based values are shown as empty bars. Negative results remain
      // visible in the numeric labels rather than misleading bar widths.
      value.style.width = Math.max(0, Math.min(100, (Math.max(0, row.value) / Math.max(max, 1)) * 100)) + "%";
      track.appendChild(value);
      const number = element("span", compact(row.value)); number.className = "bar-number";
      line.append(label,track,number); chart.appendChild(line);
    }
    if (!result.groups.length) chart.appendChild(element("p", "Aucun résultat pour ce filtre."));
    const holder = el("table"); holder.replaceChildren();
    const table = element("table");
    const head = element("thead"), hr = element("tr");
    colsForResult().forEach((column) => hr.appendChild(element("th", column)));
    head.appendChild(hr); table.appendChild(head);
    const body = element("tbody");
    for (const row of result.rows.slice(0,100)) {
      const tr = element("tr");
      colsForResult().forEach((column) => tr.appendChild(element("td", String(row[column] ?? ""))));
      body.appendChild(tr);
    }
    table.appendChild(body);
    holder.appendChild(table);
    if (result.rows.length > 100) holder.appendChild(element("p", "Aperçu limité à 100 lignes."));
  }
  function colsForResult() { return columns().slice(0, 30); }
  async function request(path) {
    if (!state.token) throw new Error("Saisissez le jeton du connecteur.");
    const response = await fetch(path, {
      headers: { "x-hydria-flow-token": state.token },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) {
      throw new Error(data.error || "Impossible de récupérer les résultats (" + response.status + ").");
    }
    return data;
  }
  async function loadSnapshot(id) {
    const payload = await request("/api/flows/snapshots/" +
      encodeURIComponent(flowKey) + "/" + encodeURIComponent(id));
    state.snapshot = payload.snapshot;
    state.activeId = id;
    render();
  }
  async function refresh() {
    if (state.pollBusy || !state.token) return;
    if (!KEY.test(flowKey)) { error("Identifiant de flux invalide."); return; }
    state.pollBusy = true;
    status("Synchronisation…");
    try {
      const result = await request("/api/flows/snapshots/" + encodeURIComponent(flowKey));
      state.metadata = result.snapshots || [];
      const picker = el("snapshot");
      const preferred = picker.value;
      picker.replaceChildren();
      picker.appendChild(element("option","Dernier résultat (auto)"));
      picker.options[0].value = "";
      for (const item of state.metadata) {
        const option = element("option", item.label + " · " +
          new Date(item.createdAt).toLocaleString("fr-FR"));
        option.value = item.id;
        picker.appendChild(option);
      }
      picker.value = state.metadata.some((x) => x.id === preferred) ? preferred : "";
      const id = picker.value || state.metadata[0]?.id;
      if (id && id !== state.activeId) await loadSnapshot(id);
      if (!id) {
        state.activeId = ""; state.snapshot = null;
        el("chart").replaceChildren(element("p","Aucun jeu de données enregistré."));
        el("table").replaceChildren();
      }
      status("Connecté · " + new Date().toLocaleTimeString("fr-FR"));
      error("");
    } catch (err) {
      error(String(err.message || err));
      status("Échec de synchronisation");
    } finally { state.pollBusy = false; }
  }
  el("connect").addEventListener("click", () => {
    state.token = el("token").value.trim();
    state.activeId = ""; state.snapshot = null;
    void refresh();
  });
  el("refresh").addEventListener("click", () => { void refresh(); });
  el("snapshot").addEventListener("change", () => {
    state.activeId = ""; void refresh();
  });
  for (const name of ["group","measure","operation","filter"]) {
    el(name).addEventListener(name === "filter" ? "input" : "change", renderData);
  }
  if (!KEY.test(flowKey)) {
    error("Ouvrez ce tableau de bord depuis un Flow Manager disposant d'un historique d'exécution.");
  }
  setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
}
