// Hydria Drive — unified library of existing Hydria work objects.
import { listDrivePdfs, storedPdfUrl } from "../services/drivePdfClient.js";
import { listDriveImages, imageAssetUrl } from "../services/driveImageClient.js";
import { designFileUrl, listDesigns } from "../services/driveDesignClient.js";
import { photoProjectFileUrl, listPhotoProjects } from "../services/drivePhotoProjectClient.js";
// This is deliberately not a separate file store or a cloud-sync service.
const SORTS = new Set(["recent", "name", "kind"]);
const KINDS = new Set(["all", "document", "dataset", "presentation", "dashboard", "workflow", "design", "project", "code", "pdf", "image", "photo-project", "other"]);
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
    document: "Document", dataset: "Tableur", presentation: "Présentation",
    dashboard: "Dashboard", workflow: "Flux", design: "Design",
    project: "Projet", code: "Code", image: "Image", audio: "Audio",
    video: "Vidéo", pdf: "PDF", "photo-project": "Projet PhotoCraft"
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
    ["all", "Tous les types"], ["document", "Documents"], ["dataset", "Tableurs"],
    ["presentation", "Présentations"], ["dashboard", "Dashboards"], ["pdf", "PDF enregistrés"], ["image", "Images enregistrées"],
    ["workflow", "Flux et automatisations"], ["design", "Designs et projets FigCraft"],
    ["photo-project", "Projets PhotoCraft (.pcraft)"],
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
  let savedPdfs = [];
  const pdfGroup = node("section", "hydria-drive-pdf-group");
  pdfGroup.setAttribute("aria-label", "PDF enregistrés dans Hydria Drive");
  const pdfHeading = node("h3", "", "PDF enregistrés");
  const pdfList = node("div", "hydria-drive-pdf-list");
  pdfGroup.append(pdfHeading, pdfList);
  function paintSavedPdfs() {
    pdfGroup.hidden = view.kind !== "all" && view.kind !== "pdf";
    pdfList.replaceChildren();
    if (pdfGroup.hidden) return 0;
    const q = String(view.query).toLocaleLowerCase().trim();
    const filtered = savedPdfs.filter(item => String(item.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a,b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    if (!filtered.length) {
      pdfList.append(node("p", "hydria-pdf-saved-empty", "Aucun PDF ne correspond à cette recherche."));
      return 0;
    }
    for (const item of filtered) {
      const row = node("div", "hydria-drive-pdf-row");
      const name = node("strong", "", String(item.filename || "document.pdf"));
      const open = node("a", "hydria-pdf-button", "Ouvrir dans PDF Studio");
      open.href = "/workspace/pdf?assetId=" + encodeURIComponent(item.id);
      const download = node("a", "hydria-pdf-button", "Télécharger");
      download.href = storedPdfUrl(item.id);
      download.setAttribute("download", String(item.filename || "document.pdf"));
      const version = node("small", "", "Version " + Number(item.revision || 1));
      row.append(name, version, open, download);
      pdfList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedPdfs() {
    try {
      savedPdfs = await listDrivePdfs();
      if (!root.isConnected) return;
      paintResults();
      updateTotal();
    } catch (error) {
      if (!root.isConnected) return;
      pdfList.replaceChildren(node("p", "hydria-pdf-saved-empty",
        "Impossible de charger les PDF Drive : " + String(error?.message || error)));
    }
  }
  let savedImages = [];
  const imageGroup = node("section", "hydria-drive-pdf-group hydria-drive-image-group");
  imageGroup.setAttribute("aria-label", "Images enregistrées dans Hydria Drive");
  const imageTitle = node("h3", "", "Images enregistrées");
  const imageList = node("div", "hydria-drive-image-list");
  imageGroup.append(imageTitle, imageList);
  function paintSavedImages() {
    imageGroup.hidden = view.kind !== "all" && view.kind !== "image";
    imageList.replaceChildren();
    if (imageGroup.hidden) return 0;
    const q = String(view.query).toLocaleLowerCase().trim();
    const filtered = savedImages.filter(item => String(item.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a,b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.created_at).localeCompare(String(a.created_at)));
    if (!filtered.length) {
      imageList.append(node("p", "hydria-pdf-saved-empty", "Aucune image ne correspond à cette recherche."));
      return 0;
    }
    for (const item of filtered) {
      const row = node("div", "hydria-drive-image-row");
      const thumb = node("img", "hydria-drive-image-thumb");
      thumb.src = imageAssetUrl(item.id, "preview");
      thumb.alt = "";
      thumb.loading = "lazy";
      const name = node("strong", "", String(item.filename || "image.png"));
      const open = node("a", "hydria-artcraft-button", "Photo Studio");
      open.href = "/workspace/photo?imageId=" + encodeURIComponent(item.id);
      open.title = "Télécharger cette image, puis l'ouvrir dans PhotoCraft";
      const download = node("a", "hydria-artcraft-button", "Télécharger");
      download.href = imageAssetUrl(item.id);
      download.setAttribute("download", String(item.filename || "image.png"));
      const revision = node("small", "hydria-drive-image-revision", "Version " + Number(item.revision || 1));
      row.append(thumb, name, revision, download, open);
      imageList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedImages() {
    try {
      savedImages = await listDriveImages();
      if (!root.isConnected) return;
      paintResults();
      updateTotal();
    } catch (error) {
      if (!root.isConnected) return;
      imageList.replaceChildren(node("p", "hydria-pdf-saved-empty",
        "Impossible de charger les images Drive : " + String(error?.message || error)));
    }
  }
  let savedDesigns = [];
  const designGroup = node("section", "hydria-drive-pdf-group hydria-drive-design-group");
  designGroup.setAttribute("aria-label", "Projets FigCraft dans Hydria Drive");
  const designTitle = node("h3", "", "Projets FigCraft (.figcraft)");
  const designList = node("div", "hydria-drive-design-list");
  designGroup.append(designTitle, designList);
  function paintSavedDesigns() {
    designGroup.hidden = view.kind !== "all" && view.kind !== "design";
    designList.replaceChildren();
    if (designGroup.hidden) return 0;
    const q = String(view.query).toLocaleLowerCase().trim();
    const filtered = savedDesigns.filter(x =>
      String(x.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a, b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    if (!filtered.length) {
      designList.append(node("p", "hydria-pdf-saved-empty",
        "Aucun projet FigCraft ne correspond à cette recherche."));
      return 0;
    }
    for (const item of filtered) {
      const row = node("div", "hydria-drive-design-row");
      row.append(node("span", "hydria-figcraft-project-icon", "◆"));
      row.append(node("strong", "", String(item.filename || "design.figcraft")));
      row.append(node("small", "hydria-drive-image-revision", "Version " + Number(item.revision || 1)));
      const open = node("a", "hydria-artcraft-button", "Design Studio");
      open.href = "/workspace/fig?designId=" + encodeURIComponent(item.id);
      open.title = "Téléchargez le fichier et ouvrez-le dans FigCraft avec Fichier > Ouvrir";
      const download = node("a", "hydria-artcraft-button", "Télécharger");
      download.href = designFileUrl(item.id);
      download.setAttribute("download", item.filename || "design.figcraft");
      row.append(download, open);
      designList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedDesigns() {
    try {
      savedDesigns = await listDesigns();
      if (!root.isConnected) return;
      paintResults();
      updateTotal();
    } catch (error) {
      if (!root.isConnected) return;
      designList.replaceChildren(node("p", "hydria-pdf-saved-empty",
        "Impossible de charger les projets FigCraft : " + String(error?.message || error)));
    }
  }
  let savedPhotoProjects = [];
  const photoProjectGroup = node("section", "hydria-drive-pdf-group hydria-drive-photo-project-group");
  photoProjectGroup.setAttribute("aria-label", "Projets PhotoCraft dans Hydria Drive");
  const photoProjectTitle = node("h3", "", "Projets PhotoCraft (.pcraft)");
  const photoProjectList = node("div", "hydria-drive-photo-project-list");
  photoProjectGroup.append(photoProjectTitle, photoProjectList);
  function paintSavedPhotoProjects() {
    photoProjectGroup.hidden = view.kind !== "all" && view.kind !== "photo-project";
    photoProjectList.replaceChildren();
    if (photoProjectGroup.hidden) return 0;
    const q = String(view.query).toLocaleLowerCase().trim();
    const filtered = savedPhotoProjects.filter(x =>
      String(x.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a, b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    if (!filtered.length) {
      photoProjectList.append(node("p", "hydria-pdf-saved-empty",
        "Aucun projet PhotoCraft ne correspond à cette recherche."));
      return 0;
    }
    for (const item of filtered) {
      const row = node("div", "hydria-drive-design-row hydria-drive-photo-project-row");
      row.append(node("span", "hydria-photocraft-project-icon", "◆"));
      row.append(node("strong", "", String(item.filename || "image.pcraft")));
      row.append(node("small", "hydria-drive-image-revision", "Version " + Number(item.revision || 1)));
      const open = node("a", "hydria-artcraft-button", "Photo Studio");
      open.href = "/workspace/photo?photoProjectId=" + encodeURIComponent(item.id);
      open.title = "Téléchargez le fichier et ouvrez-le dans PhotoCraft avec Fichier > Ouvrir";
      const download = node("a", "hydria-artcraft-button", "Télécharger");
      download.href = photoProjectFileUrl(item.id);
      download.setAttribute("download", item.filename || "image.pcraft");
      row.append(download, open);
      photoProjectList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedPhotoProjects() {
    try {
      savedPhotoProjects = await listPhotoProjects();
      if (!root.isConnected) return;
      paintResults();
      updateTotal();
    } catch (error) {
      if (!root.isConnected) return;
      photoProjectList.replaceChildren(node("p", "hydria-pdf-saved-empty",
        "Impossible de charger les projets PhotoCraft : " + String(error?.message || error)));
    }
  }
  function updateTotal() {
    total.textContent = String(workObjects.length + savedPdfs.length +
      savedImages.length + savedDesigns.length + savedPhotoProjects.length) + " éléments";
  }
  const list = node("div", "hydria-drive-list");
  list.setAttribute("role", "list");

  function paintResults() {
    const filtered = filterDriveObjects(workObjects, view);
    const pdfCount = paintSavedPdfs();
    const imageCount = paintSavedImages();
    const designCount = paintSavedDesigns();
    const photoProjectCount = paintSavedPhotoProjects();
    const count = filtered.length + pdfCount + imageCount + designCount + photoProjectCount;
    summary.textContent = count + " résultat" + (count === 1 ? "" : "s");
    list.replaceChildren();
    if (!filtered.length && !pdfCount && !imageCount && !designCount && !photoProjectCount) {
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
        document: "▤", dataset: "▦", presentation: "▣", dashboard: "◫",
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
  root.append(heading, quick, controls, summary, list, pdfGroup, imageGroup, designGroup, photoProjectGroup);
  container.append(root);
  paintResults();
  loadSavedPdfs();
  loadSavedImages();
  loadSavedDesigns();
  loadSavedPhotoProjects();
}
