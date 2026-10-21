// Real PhotoCraft .pcraft project library. PhotoCraft v0.11.1 supports File > Open,
// File > Save (browser download); it does not expose an authenticated iframe
// host protocol. Every upload is an explicit user action.
import { photoProjectFileUrl, listPhotoProjects, listPhotoProjectVersions, storePhotoProject } from "../services/drivePhotoProjectClient.js";

const NATIVE_EXTENSION = ".pcraft,.psd,.psb";
function node(tag, className = "", text = "") {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}
function prettyBytes(value) {
  return Math.max(1, Math.round(Number(value || 0) / 1024)) + " Ko";
}

export function renderPhotoCraftDriveLibrary(container, {
  targetPhotoProjectId = new URLSearchParams(window.location.search).get("photoProjectId"),
  onOpen = null
} = {}) {
  if (!container) return;
  container.replaceChildren();
  const section = node("section", "hydria-artcraft-library hydria-photocraft-library");
  section.setAttribute("aria-label", "Projets PhotoCraft conservés dans Drive");
  const heading = node("div", "hydria-artcraft-library-head");
  heading.append(node("h3", "", "Projets PhotoCraft · Hydria Drive"));
  const reload = node("button", "hydria-artcraft-button", "Actualiser");
  reload.type = "button";
  heading.append(reload);
  const guide = node("p", "hydria-photocraft-guide",
    "Dans PhotoCraft v0.11.1 : Fichier > Enregistrer télécharge un projet .pcraft. " +
    "Importez ce fichier ci-dessous pour le conserver dans Hydria Drive. " +
    "Pour le rouvrir : téléchargez-le depuis Drive, puis choisissez Fichier > Ouvrir dans PhotoCraft.");
  const uploadBox = node("div", "hydria-artcraft-upload-box");
  const uploadLabel = node("label", "hydria-photocraft-upload-label", "Importer un projet .pcraft / .psd / .psb dans Drive");
  const importFile = node("input", "hydria-photocraft-project-upload");
  importFile.type = "file";
  importFile.accept = NATIVE_EXTENSION;
  importFile.setAttribute("aria-label", "Importer un projet PhotoCraft dans Drive");
  uploadLabel.append(importFile);
  uploadBox.append(uploadLabel, node("small", "",
    "PhotoCraft .pcraft / Photoshop .psd,.psb · 30 Mio maximum · contrôle de version automatique via Drive"));
  const notice = node("p", "hydria-artcraft-image-feedback");
  notice.setAttribute("role", "status");
  const list = node("div", "hydria-photocraft-projects");
  let busy = false;
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
      const data = await listPhotoProjectVersions(item.id);
      if (!output.isConnected) return;
      output.replaceChildren();
      for (const entry of data.items) {
        const row = node("div", "hydria-artcraft-history-row");
        row.append(node("span", "", "Version " + entry.revision +
          " · " + entry.filename + " · " + prettyBytes(entry.size)));
        const anchor = node("a", "hydria-artcraft-button", "Télécharger cette version");
        anchor.href = photoProjectFileUrl(item.id, entry.revision);
        anchor.setAttribute("download", entry.filename || "photoProject.pcraft");
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
      const items = await listPhotoProjects();
      if (!section.isConnected) return;
      list.replaceChildren();
      if (!items.length) {
        list.append(node("p", "hydria-artcraft-empty",
          "Aucun projet dans Drive. Enregistrez un projet dans PhotoCraft puis importez son fichier ici."));
      }
      for (const item of items) {
        const row = node("article", "hydria-photocraft-project-item");
        row.dataset.photoProjectId = item.id;
        const icon = node("span", "hydria-photocraft-project-icon", "▧");
        icon.setAttribute("aria-hidden", "true");
        const details = node("div", "hydria-artcraft-image-copy");
        details.append(node("strong", "", item.filename || "photoProject.pcraft"));
        details.append(node("small", "", prettyBytes(item.size) +
          " · Version " + Number(item.revision || 1)));
        const download = node("a", "hydria-artcraft-button", "Télécharger pour ouvrir");
        download.href = photoProjectFileUrl(item.id);
        download.setAttribute("download", item.filename || "photoProject.pcraft");
        download.title = "Téléchargez le fichier puis ouvrez-le dans PhotoCraft avec Fichier > Ouvrir";
        const openEditor = node("button", "hydria-artcraft-button hydria-artcraft-direct-open", "Ouvrir directement");
        openEditor.type = "button";
        openEditor.title = "Ouvrir les octets du projet Drive dans le moteur créatif sans téléchargement";
        openEditor.addEventListener("click", () => {
          if (typeof onOpen === "function" && !busy) onOpen({ ...item, kind:"project" });
        });
        const newVersion = node("button", "hydria-artcraft-button hydria-photocraft-version-button",
          "Nouvelle version");
        newVersion.type = "button";
        const versionFile = node("input", "hydria-photocraft-version-upload");
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
            const saved = await storePhotoProject(file, {
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
        const historyButton = node("button", "hydria-artcraft-button hydria-photocraft-history-button",
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
        if (targetPhotoProjectId && String(item.id) === targetPhotoProjectId) {
          row.classList.add("hydria-artcraft-target-image");
          // Open the file's history on direct navigation from Drive.
          historyButton.click();
        }
      }
    } catch (error) {
      if (!section.isConnected) return;
      list.replaceChildren(node("p", "hydria-artcraft-empty",
        "Impossible de charger Drive PhotoCraft : " + String(error?.message || error)));
    }
  }

  reload.addEventListener("click", () => { if (!busy) refresh(); });
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    notice.textContent = "Enregistrement du projet PhotoCraft dans Drive…";
    try {
      const asset = await storePhotoProject(file);
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
