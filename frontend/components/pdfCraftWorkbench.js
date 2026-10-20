// Hydria PDF Studio — real, optional self-hosted ArtCraft PdfCraft WASM.
// Native PdfCraft handles file selection, PDF editing, and browser downloads.
// The Hydria document shortcut exports a PDF via the existing backend and hands
// it to PdfCraft as a same-origin blob URL. There is NO write-back yet.
const PDFCRAFT_PATH = "/vendor/pdfcraft/index.html";
let openedPdfUrl = null;

function element(tag, className = "", text = "") {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}

export function pdfCraftFrameUrl(fileUrl = "") {
  if (!fileUrl) return PDFCRAFT_PATH;
  // The caller exclusively supplies locally created PDF blob URLs.
  if (!/^blob:https?:\/\//.test(fileUrl)) throw Error("PDF handoff requires a local Blob URL");
  return PDFCRAFT_PATH + "?file=" + encodeURIComponent(fileUrl);
}

export function renderPdfCraftWorkbench(container, {
  documents = [], pdfFiles = [], initialPdfId = "",
  onReadSavedPdf = async () => { throw Error("Lecture indisponible"); },
  onStorePdf = async () => { throw Error("Enregistrement indisponible"); },
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
    "Éditez des PDF avec le moteur open source PdfCraft, directement dans votre espace Hydria."));
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
  const reset = element("button", "hydria-pdf-button", "Nouveau / Ouvrir un fichier local");
  reset.type = "button";
  reset.disabled = true;
  toolbar.append(documentSelect, openDocument, reset);


  const savedToolbar = element("div", "hydria-pdf-toolbar hydria-pdf-drive-toolbar");
  const savedSelect = element("select", "hydria-pdf-document-select hydria-pdf-saved-select");
  savedSelect.setAttribute("aria-label", "PDF Hydria Drive");
  const savedItems = pdfFiles.filter((pdf) => pdf && pdf.id &&
    String(pdf.kind || pdf.objectKind).toLowerCase() === "pdf");
  const newItem = element("option", "", "Nouveau fichier PDF dans Drive");
  newItem.value = "";
  savedSelect.append(newItem);
  for (const item of savedItems) {
    const option = element("option", "", String(item.title || "PDF sans titre"));
    option.value = String(item.id);
    savedSelect.append(option);
  }
  savedSelect.value = savedItems.some((item) => String(item.id) === String(initialPdfId))
    ? String(initialPdfId) : "";
  const openSaved = element("button", "hydria-pdf-button", "Ouvrir PDF Drive");
  openSaved.type = "button";
  openSaved.disabled = true;
  const upload = element("button", "hydria-pdf-button hydria-pdf-primary", "Importer / Enregistrer dans Drive");
  upload.type = "button";
  const fileInput = element("input", "hydria-pdf-upload-file");
  fileInput.type = "file";
  fileInput.accept = ".pdf,application/pdf";
  fileInput.setAttribute("aria-label", "Importer un fichier PDF dans Hydria Drive");
  fileInput.hidden = true;
  savedToolbar.append(savedSelect, openSaved, upload, fileInput);

  const hint = element("p", "hydria-pdf-hint",
    "Après modification, téléchargez votre PDF depuis PdfCraft, puis réimportez-le dans " +
    "Hydria Drive pour enregistrer une nouvelle révision. Le retour automatique n'est pas disponible.");
  const viewport = element("div", "hydria-pdf-viewport");
  const loading = element("p", "hydria-pdf-loading", "Vérification de l'installation locale de PdfCraft…");
  viewport.append(loading);
  const error = element("p", "hydria-pdf-error");
  error.hidden = true;
  error.setAttribute("role", "alert");

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
  function clearError() { error.textContent = ""; error.hidden = true; }
  let frame = null;
  let ready = false;
  let busy = false;
  function openPdfFrame(url = "") {
    if (!ready) return;
    if (openedPdfUrl) {
      URL.revokeObjectURL(openedPdfUrl);
      openedPdfUrl = null;
    }
    const next = url ? pdfCraftFrameUrl(url) : PDFCRAFT_PATH;
    if (url) openedPdfUrl = url;
    const nextFrame = element("iframe", "hydria-pdf-frame");
    nextFrame.title = "PdfCraft — éditeur PDF";
    nextFrame.src = next;
    nextFrame.loading = "eager";
    nextFrame.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
    nextFrame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups");
    nextFrame.allowFullscreen = true;
    viewport.replaceChildren(nextFrame);
    frame = nextFrame;
  }


  savedSelect.addEventListener("change", () => {
    openSaved.disabled = !savedSelect.value || busy || !ready;
  });
  upload.addEventListener("click", () => { if (!busy) fileInput.click(); });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = "";
    if (busy) return;
    if (file.size > 25 * 1024 * 1024) {
      showError("Un PDF ne peut pas dépasser 25 Mo.");
      return;
    }
    const selected = savedItems.find((item) => String(item.id) === savedSelect.value) || null;
    busy = true;
    upload.disabled = true;
    openSaved.disabled = true;
    clearError();
    status.textContent = "Enregistrement dans Hydria Drive…";
    try {
      const saved = await onStorePdf(file, selected);
      if (!saved?.id) throw Error("Aucun PDF sauvegardé");
      const index = savedItems.findIndex((item) => String(item.id) === String(saved.id));
      if (index === -1) {
        savedItems.push(saved);
        const option = element("option", "", String(saved.title || file.name));
        option.value = String(saved.id);
        savedSelect.append(option);
      } else {
        savedItems[index] = saved;
      }
      savedSelect.value = String(saved.id);
      status.textContent = "PDF enregistré · révision " + String(saved.revision || 1);
      if (ready) openPdfFrame(URL.createObjectURL(file));
    } catch (error) {
      showError(String(error?.message || "Enregistrement impossible"));
      status.textContent = "Enregistrement refusé";
    } finally {
      busy = false;
      upload.disabled = false;
      openSaved.disabled = !ready || !savedSelect.value;
    }
  });
  openSaved.addEventListener("click", async () => {
    const id = savedSelect.value;
    if (!id || !ready || busy) return;
    busy = true;
    openSaved.disabled = true;
    clearError();
    status.textContent = "Chargement du PDF Hydria…";
    try {
      const pdf = await onReadSavedPdf(id);
      if (!(pdf instanceof Blob) || !pdf.size || pdf.type !== "application/pdf") {
        throw Error("Document enregistré invalide");
      }
      openPdfFrame(URL.createObjectURL(pdf));
      status.textContent = "PDF Drive ouvert";
    } catch (error) {
      showError(String(error?.message || "Lecture impossible"));
      status.textContent = "Ouverture refusée";
    } finally {
      busy = false;
      openSaved.disabled = !ready || !savedSelect.value;
    }
  });

  documentSelect.addEventListener("change", () => {
    openDocument.disabled = !ready || busy || !documentSelect.value;
  });
  reset.addEventListener("click", () => {
    clearError();
    documentSelect.value = "";
    openDocument.disabled = true;
    openPdfFrame();
  });
  openDocument.addEventListener("click", async () => {
    const id = documentSelect.value;
    if (!ready || busy || !id || !entries.some((item) => String(item.id) === id)) return;
    busy = true;
    openDocument.disabled = true;
    reset.disabled = true;
    clearError();
    status.textContent = "Export du document…";
    try {
      const pdf = await onExportDocument(id);
      if (!(pdf instanceof Blob) || pdf.type !== "application/pdf" || !pdf.size) {
        throw Error("Le générateur n'a pas renvoyé de PDF valide.");
      }
      const url = URL.createObjectURL(pdf);
      openPdfFrame(url);
      status.textContent = "Document ouvert";
    } catch (err) {
      showError(String(err?.message || "Impossible d'ouvrir ce document PDF."));
      status.textContent = "Échec de l'ouverture";
    } finally {
      busy = false;
      reset.disabled = !ready;
      openDocument.disabled = !ready || !documentSelect.value;
    }
  });

  root.append(heading, toolbar, savedToolbar, hint, viewport, error);
  container.append(root);

  // A missing optional runtime never silently launches an external website.
  fetch(PDFCRAFT_PATH, { method: "HEAD", cache: "no-store", credentials: "same-origin" })
    .then((response) => {
      if (!root.isConnected) return;
      if (!response.ok) throw Error("PDFCRAFT_NOT_INSTALLED");
      ready = true;
      status.textContent = "PdfCraft disponible";
      reset.disabled = false;
      openDocument.disabled = !documentSelect.value;
      openSaved.disabled = !savedSelect.value;
      openPdfFrame();
    })
    .catch((err) => {
      if (!root.isConnected) return;
      ready = false;
      status.textContent = "Installation nécessaire";
      loading.textContent = "Le moteur PdfCraft n'est pas installé sur cette instance.";
      showError("Un administrateur doit installer la version vérifiée de PdfCraft avec : " +
        "node backend/scripts/installPdfCraft.mjs puis redémarrer / recharger Hydria OS.");
    });
}
