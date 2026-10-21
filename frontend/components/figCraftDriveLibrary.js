// Real FigCraft .figcraft project library. FigCraft v0.8 supports File > Open,
// File > Save (browser download); it does not expose an authenticated iframe
// host protocol. Every upload is an explicit user action.
import { designFileUrl, listDesigns, listDesignVersions, storeDesign } from "../services/driveDesignClient.js";

const NATIVE_EXTENSION = ".figcraft";
function node(tag, className = "", text = "") {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}
function prettyBytes(value) {
  return Math.max(1, Math.round(Number(value || 0) / 1024)) + " Ko";
}

export function renderFigCraftDriveLibrary(container, {
  targetDesignId = new URLSearchParams(window.location.search).get("designId"),
  onOpen = null
} = {}) {
  if (!container) return;
  container.replaceChildren();
  const section = node("section", "hydria-artcraft-library hydria-figcraft-library");
  section.setAttribute("aria-label", "Projets FigCraft conservés dans Drive");
  const heading = node("div", "hydria-artcraft-library-head");
  heading.append(node("h3", "", "Projets FigCraft · Hydria Drive"));
  const reload = node("button", "hydria-artcraft-button", "Actualiser");
  reload.type = "button";
  heading.append(reload);
  const guide = node("p", "hydria-figcraft-guide",
    "Dans FigCraft v0.8 : Fichier > Enregistrer télécharge un projet .figcraft. " +
    "Importez ce fichier ci-dessous pour le conserver dans Hydria Drive. " +
    "Pour le rouvrir : téléchargez-le depuis Drive, puis choisissez Fichier > Ouvrir dans FigCraft.");
  const uploadBox = node("div", "hydria-artcraft-upload-box");
  const uploadLabel = node("label", "hydria-figcraft-upload-label", "Importer un projet .figcraft dans Drive");
  const importFile = node("input", "hydria-figcraft-project-upload");
  importFile.type = "file";
  importFile.accept = NATIVE_EXTENSION;
  importFile.setAttribute("aria-label", "Importer un projet FigCraft dans Drive");
  uploadLabel.append(importFile);
  uploadBox.append(uploadLabel, node("small", "",
    "Archive native .figcraft · 30 Mio maximum · import explicite, pas de synchronisation automatique"));
  const notice = node("p", "hydria-artcraft-image-feedback");
  notice.setAttribute("role", "status");
  const list = node("div", "hydria-figcraft-projects");
  let busy = false;
  let deepLinkOpened = false;
  const controls = new Set();
  function setBusy(value) {
    busy = value;
    importFile.disabled = busy;
    reload.disabled = busy;
    for (const button of controls) button.disabled = busy;
  }

  async function renderHistory(item, output, toggle) {
    output.replaceChildren(node("p", "hydria-artcraft-empty", "Chargement des versions…"));
    try {
      const data = await listDesignVersions(item.id);
      if (!output.isConnected) return;
      output.replaceChildren();
      for (const entry of data.items) {
        const row = node("div", "hydria-artcraft-history-row");
        row.append(node("span", "", "Version " + entry.revision +
          " · " + entry.filename + " · " + prettyBytes(entry.size)));
        const anchor = node("a", "hydria-artcraft-button", "Télécharger cette version");
        anchor.href = designFileUrl(item.id, entry.revision);
        anchor.setAttribute("download", entry.filename || "design.figcraft");
        row.append(anchor);
        output.append(row);
      }
      if (!data.items.length) output.append(node("p", "", "Aucune version disponible."));
    } catch (error) {
      if (!output.isConnected) return;
      output.replaceChildren(node("p", "hydria-artcraft-empty",
        "Historique indisponible : " + String(error?.message || error)));
      toggle.setAttribute("aria-expanded", "true");
    }
  }

  async function refresh() {
    list.replaceChildren(node("p", "hydria-artcraft-empty", "Chargement des projets…"));
    controls.clear();
    try {
      const items = await listDesigns();
      if (!section.isConnected) return;
      list.replaceChildren();
      if (!items.length) {
        list.append(node("p", "hydria-artcraft-empty",
          "Aucun projet dans Drive. Enregistrez un projet dans FigCraft puis importez son fichier ici."));
      }
      for (const item of items) {
        const row = node("article", "hydria-figcraft-project-item");
        row.dataset.designId = item.id;
        const icon = node("span", "hydria-figcraft-project-icon", "◆");
        icon.setAttribute("aria-hidden", "true");
        const details = node("div", "hydria-artcraft-image-copy");
        details.append(node("strong", "", item.filename || "design.figcraft"));
        details.append(node("small", "", prettyBytes(item.size) +
          " · Version " + Number(item.revision || 1)));
        const download = node("a", "hydria-artcraft-button", "Télécharger pour ouvrir");
        download.href = designFileUrl(item.id);
        download.setAttribute("download", item.filename || "design.figcraft");
        download.title = "Téléchargez le fichier puis ouvrez-le dans FigCraft avec Fichier > Ouvrir";
        const openEditor = node("button", "hydria-artcraft-button hydria-artcraft-direct-open", "Ouvrir directement");
        openEditor.type = "button";
        openEditor.title = "Ouvrir les octets du projet Drive dans le moteur créatif sans téléchargement";
        openEditor.addEventListener("click", () => {
          if (typeof onOpen === "function" && !busy) onOpen({ ...item, kind:"project" });
        });
        const newVersion = node("button", "hydria-artcraft-button hydria-figcraft-version-button",
          "Nouvelle version");
        newVersion.type = "button";
        const versionFile = node("input", "hydria-figcraft-version-upload");
        versionFile.type = "file";
        versionFile.accept = NATIVE_EXTENSION;
        versionFile.hidden = true;
        versionFile.setAttribute("aria-label", "Importer une nouvelle version de " + item.filename);
        newVersion.addEventListener("click", () => {
          if (!busy) versionFile.click();
        });
        versionFile.addEventListener("change", async () => {
          const file = versionFile.files?.[0];
          if (!file || busy) return;
          setBusy(true);
          notice.textContent = "Sauvegarde de la nouvelle version…";
          try {
            const saved = await storeDesign(file, {
              id: item.id, expectedRevision: Number(item.revision || 1)
            });
            notice.textContent = "Version " + saved.revision + " enregistrée dans Drive.";
            await refresh();
          } catch (error) {
            notice.textContent = String(error?.message || error) +
              " En cas de conflit, actualisez la bibliothèque et choisissez la bonne version.";
          } finally {
            versionFile.value = "";
            setBusy(false);
          }
        });
        const historyButton = node("button", "hydria-artcraft-button hydria-figcraft-history-button",
          "Historique");
        historyButton.type = "button";
        historyButton.setAttribute("aria-expanded", "false");
        const history = node("div", "hydria-artcraft-version-history");
        history.hidden = true;
        historyButton.addEventListener("click", async () => {
          const open = history.hidden;
          history.hidden = !open;
          historyButton.setAttribute("aria-expanded", String(open));
          if (open) await renderHistory(item, history, historyButton);
        });
        controls.add(historyButton);
        controls.add(newVersion);
        row.append(icon, details, openEditor, download, newVersion, historyButton, versionFile, history);
        list.append(row);
        if (targetDesignId && String(item.id) === targetDesignId) {
          row.classList.add("hydria-artcraft-target-image");
          // A Drive link is an explicit request to OPEN the actual editor file,
          // not just highlight its metadata. Only open once after navigation:
          // history/refresh triggered by a save must never reload the editor.
          if (!deepLinkOpened && typeof onOpen === "function") {
            deepLinkOpened = true;
            void onOpen({ ...item, kind: "project" });
          }
          historyButton.click();
        }
      }
    } catch (error) {
      if (!section.isConnected) return;
      list.replaceChildren(node("p", "hydria-artcraft-empty",
        "Impossible de charger Drive FigCraft : " + String(error?.message || error)));
    }
  }

  reload.addEventListener("click", () => { if (!busy) refresh(); });
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    notice.textContent = "Enregistrement du projet FigCraft dans Drive…";
    try {
      const asset = await storeDesign(file);
      notice.textContent = "Projet " + asset.filename + " enregistré dans Drive (version 1).";
      await refresh();
    } catch (error) {
      notice.textContent = String(error?.message || error);
    } finally {
      importFile.value = "";
      setBusy(false);
    }
  });

  section.append(heading, guide, uploadBox, notice, list);
  container.append(section);
  refresh();
  return { refresh };
}
