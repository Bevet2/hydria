// Hydria Drive — unified library of existing Hydria work objects.
// This is deliberately not a separate file store or a cloud-sync service.
const SORTS = new Set(["recent", "name", "kind"]);
const KINDS = new Set(["all", "document", "pdf", "dataset", "presentation", "dashboard", "workflow", "design", "project", "code", "other"]);
let view = { query: "", kind: "all", sort: "recent" };

function kindOf(item) {
  return String(item?.objectKind || item?.kind || "other").trim().toLowerCase() || "other";
}
function dateOf(item) {
  const raw = item?.updatedAt || item?.updated_at || item?.createdAt || item?.created_at || "";
  const date = Date.parse(raw);
  return Number.isFinite(date) ? date : 0;
}
function titleOf(item) {
  return String(item?.title || item?.name || "Sans titre");
}
function typeLabel(kind) {
  return ({
    document: "Document", pdf: "PDF", dataset: "Tableur", presentation: "Présentation",
    dashboard: "Dashboard", workflow: "Flux", design: "Design",
    project: "Projet", code: "Code", image: "Image", audio: "Audio",
    video: "Vidéo"
  })[kind] || "Autre";
}
function node(tag, className = "", label = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (label) element.textContent = label;
  return element;
}

export function filterDriveObjects(items = [], { query = "", kind = "all", sort = "recent" } = {}) {
  const wanted = String(query).trim().toLocaleLowerCase();
  const group = KINDS.has(kind) ? kind : "all";
  const order = SORTS.has(sort) ? sort : "recent";
  const results = (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object" && item.id)
    .filter((item) => {
      const itemKind = kindOf(item);
      if (group !== "all" && (group === "other" ? itemKind !== "other" && KINDS.has(itemKind) : itemKind !== group)) {
        return false;
      }
      if (!wanted) return true;
      const fileNames = [
        item.primaryFile,
        ...(Array.isArray(item.editableFiles) ? item.editableFiles : []),
        ...(Array.isArray(item.entries) ? item.entries.map((entry) => entry?.path) : [])
      ].filter(Boolean);
      return [
        titleOf(item), itemKind, item.workspaceFamilyId, item.description, ...fileNames
      ].some((value) => String(value || "").toLocaleLowerCase().includes(wanted));
    });
  results.sort((a, b) => {
    if (order === "name") return titleOf(a).localeCompare(titleOf(b), "fr", { numeric: true });
    if (order === "kind") {
      return typeLabel(kindOf(a)).localeCompare(typeLabel(kindOf(b)), "fr") ||
        titleOf(a).localeCompare(titleOf(b), "fr", { numeric: true });
    }
    return dateOf(b) - dateOf(a) ||
      titleOf(a).localeCompare(titleOf(b), "fr", { numeric: true });
  });
  return results;
}

export function renderHydriaDriveWorkspace(container, {
  workObjects = [], onOpen = () => {}, onCreate = () => {}
} = {}) {
  if (!container) return;
  container.replaceChildren();
  const root = node("section", "hydria-drive");
  root.setAttribute("aria-label", "Bibliothèque Hydria Drive");

  const heading = node("div", "hydria-drive-heading");
  const titleBlock = node("div");
  titleBlock.append(node("p", "hydria-drive-eyebrow", "HYDRIA / FICHIERS"));
  titleBlock.append(node("h2", "", "Tous vos espaces, au même endroit"));
  titleBlock.append(node("p", "hydria-drive-subtitle",
    "Retrouvez les documents et projets Hydria existants, sans duplication des données."));
  const total = node("span", "hydria-drive-total");
  total.textContent = String(workObjects.length) + " éléments";
  heading.append(titleBlock, total);

  const quick = node("div", "hydria-drive-quick");
  for (const [label, kind, family] of [
    ["Nouveau document", "document", "document_knowledge"],
    ["Nouveau tableur", "dataset", "data_spreadsheet"],
    ["Nouvelle présentation", "presentation", "presentation"]
  ]) {
    const button = node("button", "hydria-drive-new", label);
    button.type = "button";
    button.addEventListener("click", () => onCreate(kind, family, label));
    quick.append(button);
  }

  const controls = node("div", "hydria-drive-controls");
  const search = node("input", "hydria-drive-search");
  search.type = "search";
  search.placeholder = "Rechercher un nom, un fichier, un workspace…";
  search.setAttribute("aria-label", "Rechercher dans Hydria Drive");
  search.value = view.query;

  const filter = node("select", "hydria-drive-filter");
  filter.setAttribute("aria-label", "Filtrer les types");
  for (const [value, label] of [
    ["all", "Tous les types"], ["document", "Documents"], ["pdf", "PDF"], ["dataset", "Tableurs"],
    ["presentation", "Présentations"], ["dashboard", "Dashboards"],
    ["workflow", "Flux et automatisations"], ["design", "Designs"],
    ["project", "Projets"], ["code", "Code"], ["other", "Autres"]
  ]) {
    const opt = node("option", "", label);
    opt.value = value;
    filter.append(opt);
  }
  filter.value = view.kind;

  const sort = node("select", "hydria-drive-sort");
  sort.setAttribute("aria-label", "Trier les éléments");
  for (const [value, label] of [
    ["recent", "Plus récents"], ["name", "Nom A–Z"], ["kind", "Par type"]
  ]) {
    const opt = node("option", "", label);
    opt.value = value;
    sort.append(opt);
  }
  sort.value = view.sort;
  controls.append(search, filter, sort);

  const summary = node("p", "hydria-drive-results");
  const list = node("div", "hydria-drive-list");
  list.setAttribute("role", "list");

  function paintResults() {
    const filtered = filterDriveObjects(workObjects, view);
    summary.textContent = filtered.length + " résultat" + (filtered.length === 1 ? "" : "s");
    list.replaceChildren();
    if (!filtered.length) {
      list.append(node("p", "hydria-drive-empty",
        workObjects.length
          ? "Aucun élément ne correspond à cette recherche."
          : "Aucun document ni projet pour le moment. Créez votre premier fichier ci-dessus."));
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const kind = kindOf(item);
      const button = node("button", "hydria-drive-item");
      button.type = "button";
      const row = node("div", "hydria-drive-list-row");
      row.setAttribute("role", "listitem");
      button.title = "Ouvrir " + titleOf(item);
      const symbol = node("span", "hydria-drive-item-symbol", ({
        document: "▤", pdf: "▣", dataset: "▦", presentation: "▣", dashboard: "◫",
        workflow: "◇", design: "◈", project: "▥", code: "⌘"
      })[kind] || "▢");
      symbol.setAttribute("aria-hidden", "true");
      const copy = node("span", "hydria-drive-item-copy");
      copy.append(node("strong", "", titleOf(item)));
      copy.append(node("small", "", [
        typeLabel(kind), item.primaryFile || "", item.revision ? "Révision " + item.revision : ""
      ].filter(Boolean).join(" · ")));
      const arrow = node("span", "hydria-drive-item-arrow", "Ouvrir →");
      arrow.setAttribute("aria-hidden", "true");
      button.append(symbol, copy, arrow);
      button.addEventListener("click", () => onOpen(item));
      row.append(button);
      fragment.append(row);
    }
    list.append(fragment);
  }
  search.addEventListener("input", () => { view.query = search.value; paintResults(); });
  filter.addEventListener("change", () => { view.kind = filter.value; paintResults(); });
  sort.addEventListener("change", () => { view.sort = sort.value; paintResults(); });
  root.append(heading, quick, controls, summary, list);
  container.append(root);
  paintResults();
}
