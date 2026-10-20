// Hydria PDF Studio — real optional PdfCraft WASM runtime.
// Official v0.9.0 host=parent protocol. Each exported PDF is reviewed in Hydria
// before it is committed; native tabs have no stable document ID in this API.
import {
  listDrivePdfs, savePdfToDrive, readDrivePdf, storedPdfUrl,
  DRIVE_PDF_MAX_BYTES, savePdfVersion, listPdfVersions, pdfRevisionUrl, readDrivePdfMetadata
} from "../services/drivePdfClient.js";

const PDFCRAFT_PATH = "/vendor/pdfcraft/index.html";
let openedPdfUrl = null;
let disposeCurrent = null;
let nativeDirty = false;
let unloadInstalled = false;
// Keep prepared exports across internal workspace navigation until saved. They
// remain in browser memory, not durable storage: warn before closing/reloading.
const preparedExports = [];

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
  if (!fileUrl) return PDFCRAFT_PATH + "?host=parent";
  if (!/^blob:https?:\/\//.test(fileUrl)) throw Error("PDF handoff requires a local Blob URL");
  return PDFCRAFT_PATH + "?host=parent&file=" + encodeURIComponent(fileUrl);
}

export function renderPdfCraftWorkbench(container, {
  documents = [],
  onExportDocument = async () => { throw Error("Export indisponible"); }
} = {}) {
  if (!container) return;
  disposeCurrent?.();
  if (!unloadInstalled) {
    window.addEventListener("beforeunload", event => {
      if (nativeDirty || preparedExports.length) { event.preventDefault(); event.returnValue = ""; }
    });
    unloadInstalled = true;
  }
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
    "Après modification, utilisez Enregistrer dans PdfCraft (Ctrl+S), puis choisissez ci-dessous " +
    "une nouvelle copie ou une version du PDF Drive ouvert. Les exports en attente restent " +
    "en mémoire jusqu’à leur enregistrement ; enregistrez-les avant de fermer ou recharger la page.");
  const prepared = element("section", "hydria-pdf-prepared");
  prepared.setAttribute("aria-label", "PDF à enregistrer dans Drive");
  prepared.hidden = true;
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
  let currentFrame = null;
  let currentTarget = null;
  let bridgeTimer = null;
  let frameGeneration = 0;
  const autoAssetId = new URLSearchParams(window.location.search).get("assetId");
  function setBusy(value) {
    busy = Boolean(value);
    documentSelect.disabled = busy;
    openDocument.disabled = !ready || busy || !documentSelect.value;
    saveDocument.disabled = busy || !documentSelect.value;
    reset.disabled = !ready || busy;
    fileInput.disabled = busy;
    prepared.querySelectorAll("button").forEach(button => { button.disabled = busy; });
  }

  function openPdfFrame(url = "", name = "document.pdf", target = null) {
    if (!ready) return;
    const generation = ++frameGeneration;
    clearTimeout(bridgeTimer);
    nativeDirty = false;
    currentTarget = target ? { ...target } : null;
    if (openedPdfUrl) {
      URL.revokeObjectURL(openedPdfUrl);
      openedPdfUrl = null;
    }
    if (url) openedPdfUrl = url;
    const frame = element("iframe", "hydria-pdf-frame");
    currentFrame = frame;
    frame.title = "PdfCraft — éditeur PDF";
    frame.src = pdfCraftFrameUrl();
    frame.loading = "eager";
    frame.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups");
    frame.allowFullscreen = true;
    viewport.replaceChildren(frame);
    status.textContent = "Démarrage de PdfCraft…";
    bridgeTimer = setTimeout(() => {
      if (root.isConnected && generation === frameGeneration) {
        showError("PdfCraft ne répond pas. Vous pouvez télécharger vos PDF et réessayer l’ouverture.");
      }
    }, 60000);
    frame.hydriaOpen = url ? { url, name } : null;
  }

  function canReplaceEditor() {
    return !nativeDirty || window.confirm("Quitter ce document sans exporter les modifications de PdfCraft ?");
  }

  function drawPrepared() {
    prepared.replaceChildren();
    prepared.hidden = !preparedExports.length;
    if (!preparedExports.length) return;
    prepared.append(element("h3", "", "PDF à enregistrer dans Drive"));
    for (const draft of preparedExports) {
      const row = element("article", "hydria-pdf-prepared-item");
      row.append(element("strong", "", draft.name));
      const actions = element("div", "hydria-pdf-toolbar");
      const fitsDrive = draft.blob.size <= DRIVE_PDF_MAX_BYTES;
      const copy = element("button", "hydria-pdf-button hydria-pdf-primary", "Enregistrer une nouvelle copie");
      copy.type = "button"; copy.disabled = busy;
      copy.addEventListener("click", () => commitPrepared(draft, false));
      if (fitsDrive) actions.append(copy);
      else row.append(element("p", "hydria-pdf-hint", "Ce PDF dépasse 20 Mio. Téléchargez-le pour le conserver localement."));
      if (fitsDrive && draft.target && draft.target.revision < 50) {
        const version = element("button", "hydria-pdf-button",
          "Ajouter à « " + draft.target.filename + " » · version " + (draft.target.revision + 1));
        version.type = "button"; version.disabled = busy;
        version.addEventListener("click", () => commitPrepared(draft, true));
        actions.append(version);
      }
      const download = element("a", "hydria-pdf-button", "Télécharger ce PDF");
      download.href = draft.url; download.download = draft.name;
      const discard = element("button", "hydria-pdf-button", "Retirer cet export");
      discard.type = "button"; discard.disabled = busy;
      discard.addEventListener("click", () => {
        if (busy || !window.confirm("Retirer cet export sans l’enregistrer dans Drive ? Conservez un téléchargement si nécessaire.")) return;
        preparedExports.splice(preparedExports.indexOf(draft), 1);
        URL.revokeObjectURL(draft.url); drawPrepared();
        status.textContent = "Export retiré de la liste d’attente";
      });
      actions.append(download, discard); row.append(actions); prepared.append(row);
    }
  }
  async function commitPrepared(draft, asVersion) {
    if (busy || !preparedExports.includes(draft)) return;
    setBusy(true); clearError(); status.textContent = "Enregistrement dans Drive…";
    try {
      const result = asVersion
        ? await savePdfVersion(draft.blob, draft.target.filename, draft.target.id, draft.target.revision)
        : await savePdfToDrive(draft.blob, draft.name);
      if (asVersion && currentTarget?.id === result.id && currentTarget.revision === draft.target.revision) {
        currentTarget = { ...currentTarget, ...result };
      }
      preparedExports.splice(preparedExports.indexOf(draft), 1);
      URL.revokeObjectURL(draft.url);
      drawPrepared(); await loadSaved();
      status.textContent = "PDF enregistré dans Drive · version " + result.revision;
      status.tabIndex = -1; status.focus({ preventScroll: true });
    } catch (err) {
      showError(String(err?.message || err) + " Le PDF reste en attente : réessayez, téléchargez-le ou enregistrez une copie.");
      status.textContent = "PDF non enregistré dans Drive";
    } finally { setBusy(false); }
  }
  async function receiveMessage(event) {
    if (!root.isConnected || !currentFrame || event.origin !== window.location.origin ||
        event.source !== currentFrame.contentWindow || !event.data || typeof event.data !== "object") return;
    const message = event.data;
    if (message.type === "pdfcraft:ready") {
      clearTimeout(bridgeTimer); clearError();
      const frame = currentFrame, opening = frame.hydriaOpen;
      frame.hydriaOpen = null;
      frame.dataset.bridgeReady = "true";
      status.textContent = "PdfCraft disponible";
      if (opening) {
        try {
          const bytes = await (await fetch(opening.url)).arrayBuffer();
          if (frame !== currentFrame || !root.isConnected) return;
          frame.contentWindow.postMessage({ type: "pdfcraft:open", name: opening.name, bytes },
            window.location.origin, [bytes]);
        } catch (err) { showError("Impossible de transmettre le PDF : " + String(err?.message || err)); }
      }
    } else if (message.type === "pdfcraft:failed") {
      clearTimeout(bridgeTimer);
      showError("Le moteur PdfCraft n’a pas démarré : " + String(message.error || "erreur inconnue").slice(0, 500));
      status.textContent = "PdfCraft indisponible";
    } else if (currentFrame.dataset.bridgeReady === "true" && message.type === "pdfcraft:dirty") {
      if (typeof message.dirty === "boolean") nativeDirty = message.dirty;
    } else if (currentFrame.dataset.bridgeReady === "true" && message.type === "pdfcraft:save") {
      const bytes = message.bytes;
      if (!(bytes instanceof ArrayBuffer || bytes instanceof Uint8Array) || bytes.byteLength < 14 ||
          typeof message.name !== "string" || typeof message.saveAs !== "boolean") {
        nativeDirty = true;
        showError("Export PdfCraft invalide. Aucun fichier n’a été enregistré.");
        return;
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const name = filenameFromTitle(message.name);
      preparedExports.push({ blob, name, url: URL.createObjectURL(blob),
        target: !message.saveAs && currentTarget ? { ...currentTarget } : null });
      drawPrepared();
      status.textContent = "PDF reçu de PdfCraft · enregistrement Drive à confirmer";
      if (blob.size > DRIVE_PDF_MAX_BYTES) {
        showError("Ce PDF dépasse la limite Drive de 20 Mio. L’export reste disponible en téléchargement.");
      }
      prepared.scrollIntoView({ block: "nearest" });
      prepared.querySelector("button")?.focus({ preventScroll: true });
    }
  }
  window.addEventListener("message", receiveMessage);
  const leaveGuard = event => {
    const action = event.target instanceof Element ? event.target.closest("a,button") : null;
    if (root.isConnected && nativeDirty && action && !root.contains(action) && !canReplaceEditor()) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  window.addEventListener("click", leaveGuard, true);
  const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
  function cleanup() {
    clearTimeout(bridgeTimer); observer.disconnect();
    window.removeEventListener("message", receiveMessage);
    window.removeEventListener("click", leaveGuard, true);
    nativeDirty = false; currentFrame = null;
    if (openedPdfUrl) { URL.revokeObjectURL(openedPdfUrl); openedPdfUrl = null; }
    if (disposeCurrent === cleanup) disposeCurrent = null;
  }
  disposeCurrent = cleanup;

  async function openStoredPdf(id) {
    if (!ready) {
      showError("PdfCraft doit être installé pour ouvrir ce PDF. Vous pouvez encore le télécharger.");
      return;
    }
    if (busy) return;
    if (!canReplaceEditor()) return;
    setBusy(true);
    clearError();
    status.textContent = "Ouverture du PDF…";
    try {
      const target = await readDrivePdfMetadata(id);
      const pdf = await readDrivePdf(id, target.revision);
      if (!root.isConnected) return;
      openPdfFrame(URL.createObjectURL(pdf), target.filename, target);
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
      label.append(element("small", "", Math.max(1, Math.round(Number(pdf.size || 0) / 1024)) + " Ko · Version " + Number(pdf.revision || 1)));
      const open = element("button", "hydria-pdf-button", "Ouvrir");
      open.type = "button";
      open.disabled = !ready;
      open.addEventListener("click", () => openStoredPdf(pdf.id));
      const download = element("a", "hydria-pdf-button", "Télécharger");
      download.href = storedPdfUrl(pdf.id);
      download.setAttribute("download", pdf.filename || "document.pdf");
      const history = element("details", "hydria-pdf-history");
      const summary = element("summary", "", "Historique");
      const versions = element("div", "hydria-pdf-history-list");
      history.append(summary, versions);
      history.addEventListener("toggle", async () => {
        if (!history.open) return;
        versions.replaceChildren(element("span", "", "Chargement…"));
        try {
          const value = await listPdfVersions(pdf.id);
          if (!history.isConnected) return;
          versions.replaceChildren();
          for (const version of value.items) {
            const link = element("a", "hydria-pdf-button", "Version " + version.revision);
            link.href = pdfRevisionUrl(pdf.id, version.revision); link.download = version.filename;
            versions.append(link);
          }
        } catch (err) { versions.textContent = String(err?.message || err); }
      });
      item.append(label, open, download, history);
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
    if (!save && !canReplaceEditor()) return;
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
        const item = entries.find(entry => String(entry.id) === id);
        openPdfFrame(URL.createObjectURL(pdf), filenameFromTitle(item?.title));
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
    if (!canReplaceEditor()) return;
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

  root.append(heading, toolbar, prepared, error, hint, viewport, saved, importWrap);
  container.append(root);
  observer.observe(document.body, { childList: true, subtree: true });
  setBusy(false);
  drawPrepared();
  loadSaved();

  fetch(PDFCRAFT_PATH, { method: "HEAD", cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      if (!root.isConnected) return;
      if (!response.ok) throw Error("PDFCRAFT_NOT_INSTALLED");
      ready = true;
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
