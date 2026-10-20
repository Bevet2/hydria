// Hydria PDF Studio — real optional PdfCraft WASM runtime.
// PdfCraft exports edited PDFs via browser download; upload is an explicit user
// action. No unverified postMessage protocol or implicit iframe write-back.
import {
  listDrivePdfs, savePdfToDrive, readDrivePdf, storedPdfUrl
} from "../services/drivePdfClient.js";

const PDFCRAFT_PATH = "/vendor/pdfcraft/index.html";
let openedPdfUrl = null;

function element(tag, className = "", text = "") {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}
function filenameFromTitle(title) {
  const normalized = String(title || "Document").replace(/[\\/\x00-\x1f\x7f]/g, "_").trim();
  return (normalized || "Document").slice(0, 120).replace(/\.pdf$/i, "") + ".pdf";
}

export function pdfCraftFrameUrl(fileUrl = "") {
  if (!fileUrl) return PDFCRAFT_PATH;
  if (!/^blob:https?:\/\//.test(fileUrl)) throw Error("PDF handoff requires a local Blob URL");
  return PDFCRAFT_PATH + "?file=" + encodeURIComponent(fileUrl);
}

export function renderPdfCraftWorkbench(container, {
  documents = [],
  onExportDocument = async () => { throw Error("Export indisponible"); }
} = {}) {
  if (!container) return;
  if (openedPdfUrl) {
    URL.revokeObjectURL(openedPdfUrl);
    openedPdfUrl = null;
  }
  container.replaceChildren();
  const root = element("section", "hydria-pdf-workbench");
  root.setAttribute("aria-label", "Hydria PDF Studio");
  const heading = element("div", "hydria-pdf-heading");
  const copy = element("div");
  copy.append(element("p", "hydria-pdf-eyebrow", "ARTCRAFT / PDF"));
  copy.append(element("h2", "", "PDF Studio"));
  copy.append(element("p", "hydria-pdf-desc",
    "Modifiez vos PDF avec PdfCraft et conservez des versions PDF dans Hydria Drive."));
  const status = element("span", "hydria-pdf-status", "Chargement…");
  status.setAttribute("role", "status");
  heading.append(copy, status);

  const toolbar = element("div", "hydria-pdf-toolbar");
  const documentSelect = element("select", "hydria-pdf-document-select");
  documentSelect.setAttribute("aria-label", "Document Hydria à exporter en PDF");
  const entries = documents.filter((doc) => doc && doc.id);
  const placeholder = element("option", "", "Choisir un document Hydria");
  placeholder.value = "";
  documentSelect.append(placeholder);
  for (const doc of entries) {
    const option = element("option", "", String(doc.title || "Sans titre"));
    option.value = String(doc.id);
    documentSelect.append(option);
  }
  const openDocument = element("button", "hydria-pdf-button hydria-pdf-primary", "Ouvrir en PDF");
  openDocument.type = "button";
  openDocument.disabled = true;
  const saveDocument = element("button", "hydria-pdf-button", "Exporter dans Drive");
  saveDocument.type = "button";
  saveDocument.disabled = true;
  const reset = element("button", "hydria-pdf-button", "Nouveau / Ouvrir un fichier local");
  reset.type = "button";
  reset.disabled = true;
  toolbar.append(documentSelect, openDocument, saveDocument, reset);

  const fileInput = element("input", "hydria-pdf-upload");
  fileInput.type = "file";
  fileInput.accept = ".pdf,application/pdf";
  fileInput.setAttribute("aria-label", "Importer un PDF dans Hydria Drive");
  const importWrap = element("div", "hydria-pdf-import");
  importWrap.append(element("strong", "", "Importer un PDF terminé ou téléchargé depuis PdfCraft"), fileInput);

  const hint = element("p", "hydria-pdf-hint",
    "Après modification dans PdfCraft, utilisez son menu de téléchargement, puis " +
    "« Importer un PDF » ci-dessus. Hydria ne lit pas automatiquement le document " +
    "modifié dans l’éditeur intégré. Chaque import crée une copie PDF conservée dans Drive.");
  const saved = element("section", "hydria-pdf-saved");
  saved.setAttribute("aria-label", "PDF conservés dans Hydria Drive");
  const savedHeading = element("div", "hydria-pdf-saved-heading");
  const savedTitle = element("h3", "", "PDF conservés dans Drive");
  const refresh = element("button", "hydria-pdf-button", "Actualiser");
  refresh.type = "button";
  savedHeading.append(savedTitle, refresh);
  const savedList = element("div", "hydria-pdf-saved-list");
  saved.append(savedHeading, savedList);

  const viewport = element("div", "hydria-pdf-viewport");
  const loading = element("p", "hydria-pdf-loading", "Vérification de l'installation de PdfCraft…");
  viewport.append(loading);
  const error = element("p", "hydria-pdf-error");
  error.hidden = true;
  error.setAttribute("role", "alert");

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
  function clearError() { error.textContent = ""; error.hidden = true; }
  let ready = false;
  let busy = false;
  let latestSaved = [];
  const autoAssetId = new URLSearchParams(window.location.search).get("assetId");
  function setBusy(value) {
    busy = Boolean(value);
    documentSelect.disabled = busy;
    openDocument.disabled = !ready || busy || !documentSelect.value;
    saveDocument.disabled = busy || !documentSelect.value;
    reset.disabled = !ready || busy;
    fileInput.disabled = busy;
  }

  function openPdfFrame(url = "") {
    if (!ready) return;
    if (openedPdfUrl) {
      URL.revokeObjectURL(openedPdfUrl);
      openedPdfUrl = null;
    }
    const next = url ? pdfCraftFrameUrl(url) : PDFCRAFT_PATH;
    if (url) openedPdfUrl = url;
    const frame = element("iframe", "hydria-pdf-frame");
    frame.title = "PdfCraft — éditeur PDF";
    frame.src = next;
    frame.loading = "eager";
    frame.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups");
    frame.allowFullscreen = true;
    viewport.replaceChildren(frame);
  }

  async function openStoredPdf(id) {
    if (!ready) {
      showError("PdfCraft doit être installé pour ouvrir ce PDF. Vous pouvez encore le télécharger.");
      return;
    }
    if (busy) return;
    setBusy(true);
    clearError();
    status.textContent = "Ouverture du PDF…";
    try {
      const pdf = await readDrivePdf(id);
      openPdfFrame(URL.createObjectURL(pdf));
      status.textContent = "PDF Drive ouvert";
    } catch (err) {
      showError(String(err?.message || "Impossible d'ouvrir ce PDF."));
      status.textContent = "Erreur d'ouverture";
    } finally { setBusy(false); }
  }
  function drawSaved() {
    savedList.replaceChildren();
    if (!latestSaved.length) {
      savedList.append(element("p", "hydria-pdf-saved-empty", "Aucun PDF sauvegardé dans Drive."));
      return;
    }
    for (const pdf of latestSaved) {
      const item = element("div", "hydria-pdf-saved-item");
      const label = element("span", "hydria-pdf-saved-copy");
      label.append(element("strong", "", pdf.filename || "Document.pdf"));
      label.append(element("small", "", Math.max(1, Math.round(Number(pdf.size || 0) / 1024)) + " Ko"));
      const open = element("button", "hydria-pdf-button", "Ouvrir");
      open.type = "button";
      open.disabled = !ready;
      open.addEventListener("click", () => openStoredPdf(pdf.id));
      const download = element("a", "hydria-pdf-button", "Télécharger");
      download.href = storedPdfUrl(pdf.id);
      download.setAttribute("download", pdf.filename || "document.pdf");
      item.append(label, open, download);
      savedList.append(item);
    }
  }
  async function loadSaved() {
    savedList.replaceChildren(element("p", "hydria-pdf-saved-empty", "Chargement des PDF…"));
    try {
      const items = await listDrivePdfs();
      if (!root.isConnected) return;
      latestSaved = items;
      drawSaved();
    } catch (err) {
      if (!root.isConnected) return;
      savedList.replaceChildren(element("p", "hydria-pdf-saved-empty",
        "Impossible de charger Drive : " + String(err?.message || err)));
    }
  }
  async function exportDocumentToBlob(id) {
    if (!entries.some((item) => String(item.id) === id)) throw Error("Document introuvable.");
    const pdf = await onExportDocument(id);
    if (!(pdf instanceof Blob) || pdf.type !== "application/pdf" || !pdf.size) {
      throw Error("Le générateur n'a pas renvoyé de PDF valide.");
    }
    return pdf;
  }
  async function documentAction(save = false) {
    const id = documentSelect.value;
    if (!id || busy || (save === false && !ready)) return;
    setBusy(true);
    clearError();
    status.textContent = save ? "Enregistrement dans Drive…" : "Export du document…";
    try {
      const pdf = await exportDocumentToBlob(id);
      if (save) {
        const item = entries.find((entry) => String(entry.id) === id);
        await savePdfToDrive(pdf, filenameFromTitle(item?.title));
        await loadSaved();
        status.textContent = "PDF enregistré dans Drive";
      } else {
        openPdfFrame(URL.createObjectURL(pdf));
        status.textContent = "Document ouvert";
      }
    } catch (err) {
      showError(String(err?.message || "Impossible de traiter ce document PDF."));
      status.textContent = "Échec de l'opération";
    } finally { setBusy(false); }
  }

  documentSelect.addEventListener("change", () => setBusy(false));
  openDocument.addEventListener("click", () => documentAction(false));
  saveDocument.addEventListener("click", () => documentAction(true));
  reset.addEventListener("click", () => {
    clearError();
    documentSelect.value = "";
    setBusy(false);
    openPdfFrame();
  });
  refresh.addEventListener("click", () => loadSaved());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    clearError();
    status.textContent = "Import du PDF dans Drive…";
    try {
      await savePdfToDrive(file, file.name);
      await loadSaved();
      status.textContent = "PDF importé dans Drive";
    } catch (err) {
      showError(String(err?.message || "Impossible d'importer ce fichier PDF."));
      status.textContent = "Échec de l'import";
    } finally {
      fileInput.value = "";
      setBusy(false);
    }
  });

  root.append(heading, toolbar, importWrap, hint, saved, viewport, error);
  container.append(root);
  setBusy(false);
  loadSaved();

  fetch(PDFCRAFT_PATH, { method: "HEAD", cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      if (!root.isConnected) return;
      if (!response.ok) throw Error("PDFCRAFT_NOT_INSTALLED");
      ready = true;
      status.textContent = "PdfCraft disponible";
      setBusy(false);
      drawSaved();
      openPdfFrame();
      if (autoAssetId) await openStoredPdf(autoAssetId);
    })
    .catch(() => {
      if (!root.isConnected) return;
      ready = false;
      status.textContent = "Installation nécessaire";
      loading.textContent = "Le moteur PdfCraft n'est pas installé sur cette instance.";
      showError("Installer PdfCraft : node backend/scripts/installPdfCraft.mjs. " +
        "Les fichiers PDF restent accessibles en téléchargement dans Drive.");
      setBusy(false);
      drawSaved();
    });
}
