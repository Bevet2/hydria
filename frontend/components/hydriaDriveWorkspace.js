// Hydria Drive — unified library of existing Hydria work objects.
import { listDrivePdfs, storedPdfUrl } from "../services/drivePdfClient.js";
import { listDriveImages, imageAssetUrl } from "../services/driveImageClient.js";
import { designFileUrl, listDesigns } from "../services/driveDesignClient.js";
import { photoProjectFileUrl, listPhotoProjects } from "../services/drivePhotoProjectClient.js";
import { renameNativeDriveAsset } from "../services/driveAssetRenameClient.js";
import { searchNativeDriveAssets } from "../services/driveAssetSearch.js";
import { changeNativeDriveTrash } from "../services/driveAssetTrashClient.js";
import { fetchNativeDriveUsage } from "../services/driveStorageUsageClient.js";
// This is deliberately not a separate file store or a cloud-sync service.
const SORTS = new Set(["recent", "name", "kind"]);
const KINDS = new Set(["all", "document", "dataset", "presentation", "dashboard", "workflow", "design", "project", "code", "pdf", "image", "photo-project", "other"]);
let view = { query: "", kind: "all", sort: "recent", trashed: false };

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
  const trashToggle = node("button", "hydria-drive-trash-toggle", "Corbeille");
  trashToggle.type = "button";
  trashToggle.setAttribute("aria-pressed", String(view.trashed));
  trashToggle.setAttribute("aria-label", "Afficher la corbeille Drive");
  trashToggle.addEventListener("click", () => {
    view.trashed = !view.trashed;
    view.kind = "all";
    filter.value = "all";
    trashToggle.textContent = view.trashed ? "Retour aux fichiers" : "Corbeille";
    trashToggle.setAttribute("aria-pressed", String(view.trashed));
    trashToggle.setAttribute("aria-label", view.trashed ? "Afficher les fichiers actifs" : "Afficher la corbeille Drive");
    paintResults();
    updateTotal();
  });
  controls.append(search, filter, sort, trashToggle);

  const summary = node("p", "hydria-drive-results");
  // Counts every SQLite-indexed version, including the recycle bin. This is
  // not allocated disk space or a global quota; app/vendor/backup files differ.
  const usagePanel = node("section", "hydria-drive-usage");
  usagePanel.setAttribute("aria-label", "Stockage des fichiers natifs Drive");
  const usageTitle = node("h3", "", "Stockage des fichiers natifs");
  const usageOverview = node("p", "hydria-drive-usage-summary", "Calcul du stockage…");
  usageOverview.setAttribute("aria-live", "polite");
  const usageFamilies = node("div", "hydria-drive-usage-families");
  const usageHelp = node("p", "hydria-drive-usage-help",
    "Tailles des fichiers enregistrées en base, versions incluses. " +
    "Les sauvegardes externes, fichiers orphelins et ressources système ne sont pas comptés.");
  usagePanel.append(usageTitle, usageOverview, usageFamilies, usageHelp);
  function formatSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "—";
    const units = ["o", "Ko", "Mo", "Go", "To"];
    let size = value, unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
    return new Intl.NumberFormat("fr-FR", {maximumFractionDigits:unit===0?0:1})
      .format(size) + " " + units[unit];
  }
  async function loadUsage() {
    try {
      const usage = await fetchNativeDriveUsage();
      if (!root.isConnected) return;
      const t = usage.total;
      usageOverview.textContent = formatSize(t.storedBytes) +
        " conservés · " + t.activeFiles + " fichiers actifs · " +
        t.trashedFiles + " à la corbeille · " + t.versions + " versions";
      usageFamilies.replaceChildren();
      for (const family of usage.families) {
        const item = node("div", "hydria-drive-usage-family");
        const title = node("strong", "", family.label);
        const detail = node("small", "",
          formatSize(family.storedBytes) + " · " + family.activeFiles + " actifs · " +
          family.trashedFiles + " supprimés · " + family.versions + " versions");
        item.append(title, detail);
        usageFamilies.append(item);
      }
    } catch(error) {
      if (root.isConnected) usageOverview.textContent =
        "Bilan de stockage indisponible : " + String(error?.message || error);
    }
  }

  const renameNotice = node("p", "hydria-drive-rename-notice");
  renameNotice.setAttribute("role", "status");
  renameNotice.setAttribute("aria-live", "polite");

  function nativeRenameControl(row, item, family) {
    const button = node("button", "hydria-artcraft-button hydria-drive-rename", "Renommer");
    button.type = "button";
    button.setAttribute("aria-label", "Renommer " + String(item.filename || "fichier"));
    button.addEventListener("click", () => {
      if (row.querySelector(".hydria-drive-rename-form")) return;
      const form = node("form", "hydria-drive-rename-form");
      const field = node("input", "hydria-drive-rename-input");
      field.type = "text";
      field.value = String(item.filename || "");
      field.maxLength = 128;
      field.required = true;
      field.setAttribute("aria-label", "Nouveau nom du fichier, extension comprise");
      const save = node("button", "hydria-artcraft-button", "Enregistrer");
      save.type = "submit";
      const cancel = node("button", "hydria-artcraft-button", "Annuler");
      cancel.type = "button";
      const errorText = node("small", "hydria-drive-rename-error");
      errorText.setAttribute("role", "alert");
      const close = () => {
        form.remove();
        button.hidden = false;
        button.focus();
      };
      cancel.addEventListener("click", close);
      field.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
      });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (save.disabled) return;
        save.disabled = true;
        try {
          const updated = await renameNativeDriveAsset(family, item, field.value);
          if (!root.isConnected) return;
          item.filename = updated.filename;
          item.updated_at = updated.updated_at;
          searchNativeDriveAssets.invalidate();
          renameNotice.textContent = "Fichier renommé : " + updated.filename;
          paintResults();
        } catch (error) {
          if (!form.isConnected) return;
          errorText.textContent = String(error?.message || error);
          save.disabled = false;
          field.focus();
        }
      });
      form.append(field, save, cancel, errorText);
      button.hidden = true;
      row.append(form);
      field.focus();
      field.select();
    });
    return button;
  }

  // Native trash is not a permanent delete: retain every revision and binary.
  // Explicitly confirm trashing to avoid accidental clicks while navigating.
  async function reloadNativeFamily(family) {
    const loaders = {
      pdf: loadSavedPdfs,
      image: loadSavedImages,
      design: loadSavedDesigns,
      "photo-project": loadSavedPhotoProjects
    };
    if (!Object.hasOwn(loaders, family)) throw Error("Type de fichier inconnu");
    await loaders[family]();
  }
  function nativeTrashControl(row, item, family) {
    const restore = view.trashed;
    const button = node("button", "hydria-artcraft-button hydria-drive-trash-action",
      restore ? "Restaurer" : "Corbeille");
    button.type = "button";
    button.setAttribute("aria-label",
      (restore ? "Restaurer " : "Mettre à la corbeille ") + item.filename);
    const perform = async () => {
      button.disabled = true;
      try {
        await changeNativeDriveTrash(family, item, restore ? "restore" : "trash");
        if (!root.isConnected) return;
        searchNativeDriveAssets.invalidate();
        renameNotice.textContent = restore
          ? "Fichier restauré : " + item.filename
          : "Fichier placé dans la corbeille : " + item.filename;
        await reloadNativeFamily(family);
        void loadUsage();
      } catch (error) {
        if (!root.isConnected) return;
        button.disabled = false;
        renameNotice.textContent = String(error?.message || error);
      }
    };
    button.addEventListener("click", () => {
      if (restore) { void perform(); return; }
      if (row.querySelector(".hydria-drive-trash-confirm")) return;
      const confirm = node("span", "hydria-drive-trash-confirm");
      const yes = node("button", "hydria-artcraft-button", "Confirmer");
      yes.type = "button";
      const no = node("button", "hydria-artcraft-button", "Annuler");
      no.type = "button";
      const cancel = () => {
        confirm.remove();
        button.hidden = false;
        button.focus();
      };
      no.addEventListener("click", cancel);
      confirm.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); cancel(); }
      });
      yes.addEventListener("click", () => { yes.disabled = true; void perform(); });
      confirm.append(yes, no);
      button.hidden = true;
      row.append(confirm);
      no.focus();
    });
    return button;
  }

  let savedPdfs = [];
  let trashedPdfs = [];
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
    const filtered = (view.trashed ? trashedPdfs : savedPdfs).filter(item => String(item.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a,b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    pdfHeading.textContent = view.trashed ? "PDF dans la corbeille" : "PDF enregistrés";
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
      if (view.trashed) row.append(name, version, nativeTrashControl(row, item, "pdf"));
      else row.append(name, version, nativeRenameControl(row, item, "pdf"), open, download, nativeTrashControl(row, item, "pdf"));
      pdfList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedPdfs() {
    try {
      [savedPdfs, trashedPdfs] = await Promise.all([
        listDrivePdfs(), listDrivePdfs({trashed:true})
      ]);
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
  let trashedImages = [];
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
    const filtered = (view.trashed ? trashedImages : savedImages).filter(item => String(item.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a,b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.created_at).localeCompare(String(a.created_at)));
    imageTitle.textContent = view.trashed ? "Images dans la corbeille" : "Images enregistrées";
    if (!filtered.length) {
      imageList.append(node("p", "hydria-pdf-saved-empty", "Aucune image ne correspond à cette recherche."));
      return 0;
    }
    for (const item of filtered) {
      const row = node("div", "hydria-drive-image-row");
      const thumb = node("img", "hydria-drive-image-thumb");
      if (!view.trashed) thumb.src = imageAssetUrl(item.id, "preview");
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
      if (view.trashed) row.append(name, revision, nativeTrashControl(row, item, "image"));
      else row.append(thumb, name, revision, nativeRenameControl(row, item, "image"), download, open, nativeTrashControl(row, item, "image"));
      imageList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedImages() {
    try {
      [savedImages, trashedImages] = await Promise.all([
        listDriveImages(), listDriveImages({trashed:true})
      ]);
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
  let trashedDesigns = [];
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
    const filtered = (view.trashed ? trashedDesigns : savedDesigns).filter(x =>
      String(x.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a, b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    designTitle.textContent = view.trashed ? "FigCraft dans la corbeille" : "Projets FigCraft (.figcraft)";
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
      if (view.trashed) row.append(nativeTrashControl(row, item, "design"));
      else row.append(nativeRenameControl(row, item, "design"), download, open, nativeTrashControl(row, item, "design"));
      designList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedDesigns() {
    try {
      [savedDesigns, trashedDesigns] = await Promise.all([
        listDesigns(), listDesigns({trashed:true})
      ]);
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
  let trashedPhotoProjects = [];
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
    const filtered = (view.trashed ? trashedPhotoProjects : savedPhotoProjects).filter(x =>
      String(x.filename || "").toLocaleLowerCase().includes(q));
    filtered.sort((a, b) => view.sort === "name"
      ? String(a.filename).localeCompare(String(b.filename), "fr")
      : String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    photoProjectTitle.textContent = view.trashed ? "PhotoCraft dans la corbeille" : "Projets PhotoCraft (.pcraft)";
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
      if (view.trashed) row.append(nativeTrashControl(row, item, "photo-project"));
      else row.append(nativeRenameControl(row, item, "photo-project"), download, open, nativeTrashControl(row, item, "photo-project"));
      photoProjectList.append(row);
    }
    return filtered.length;
  }
  async function loadSavedPhotoProjects() {
    try {
      [savedPhotoProjects, trashedPhotoProjects] = await Promise.all([
        listPhotoProjects(), listPhotoProjects({trashed:true})
      ]);
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
    const count = view.trashed
      ? trashedPdfs.length + trashedImages.length + trashedDesigns.length + trashedPhotoProjects.length
      : workObjects.length + savedPdfs.length + savedImages.length + savedDesigns.length + savedPhotoProjects.length;
    total.textContent = String(count) + " éléments";
  }
  const list = node("div", "hydria-drive-list");
  list.setAttribute("role", "list");

  function paintResults() {
    quick.hidden = view.trashed;
    const filtered = view.trashed ? [] : filterDriveObjects(workObjects, view);
    const pdfCount = paintSavedPdfs();
    const imageCount = paintSavedImages();
    const designCount = paintSavedDesigns();
    const photoProjectCount = paintSavedPhotoProjects();
    const count = filtered.length + pdfCount + imageCount + designCount + photoProjectCount;
    summary.textContent = count + " résultat" + (count === 1 ? "" : "s");
    list.replaceChildren();
    if (!filtered.length && !pdfCount && !imageCount && !designCount && !photoProjectCount) {
      list.append(node("p", "hydria-drive-empty",
        view.trashed ? "Aucun fichier dans la corbeille." : workObjects.length
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
  root.append(heading, quick, controls, usagePanel, summary, renameNotice, list, pdfGroup, imageGroup, designGroup, photoProjectGroup);
  container.append(root);
  paintResults();
  void Promise.allSettled([
    loadSavedPdfs(), loadSavedImages(), loadSavedDesigns(), loadSavedPhotoProjects()
  ]).then(() => { if (root.isConnected) void loadUsage(); });
}
