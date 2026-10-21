import {
  imageAssetUrl, imageRevisionDownloadUrl, listDriveImages,
  listImageVersions, saveImageToDrive, saveImageVersion
} from "../services/driveImageClient.js";
import { renderFigCraftDriveLibrary } from "./figCraftDriveLibrary.js";
import { renderPhotoCraftDriveLibrary } from "./photoCraftProjectLibrary.js";
import { createArtCraftHostBridge } from "./artCraftHostAdapter.js";

// Upstream distributions are pinned and installed separately. In the browser
// their native renderers operate in an iframe; no fictitious postMessage API.
export const ARTCRAFT_EDITORS = Object.freeze({
  photo: Object.freeze({
    slug: "photo", title: "Hydria Photo", product: "PhotoCraft",
    version: "0.11.1", path: "/vendor/photocraft/index.html",
    sandbox: "allow-scripts allow-same-origin allow-downloads allow-popups",
    install: "node backend/scripts/installArtCraftWeb.mjs photo"
  }),
  fig: Object.freeze({
    slug: "fig", title: "Hydria Design", product: "FigCraft",
    version: "0.8.0", path: "/vendor/figcraft/index.html",
    sandbox: "allow-scripts allow-same-origin allow-downloads allow-popups",
    install: "node backend/scripts/installArtCraftWeb.mjs fig"
  })
});
function node(tag, css = "", content = "") {
  const result = document.createElement(tag);
  if (css) result.className = css;
  if (content) result.textContent = content;
  return result;
}
export function artCraftWebPath(which) {
  const item = ARTCRAFT_EDITORS[which];
  if (!item) throw Error("Unknown ArtCraft workspace");
  return item.path;
}
export function renderArtCraftWorkspace(container, { editor = "photo" } = {}) {
  const config = ARTCRAFT_EDITORS[editor];
  if (!container || !config) throw Error("ArtCraft workspace is not available");
  container.replaceChildren();
  const root = node("section", "hydria-artcraft");
  root.dataset.artcraftEditor = editor;
  root.setAttribute("aria-label", config.title + " (" + config.product + ")");
  const top = node("header", "hydria-artcraft-header");
  const names = node("div", "hydria-artcraft-heading");
  names.append(
    node("p", "hydria-artcraft-eyebrow", "HYDRIA / CREATIVE STUDIO"),
    node("h2", "", config.title),
    node("p", "hydria-artcraft-description", editor === "photo"
      ? "Éditez des projets PhotoCraft .pcraft et conservez vos documents et exports dans Hydria Drive."
      : "Concevez vos interfaces avec FigCraft Web, dans l'espace de travail Hydria.")
  );
  const status = node("span", "hydria-artcraft-status", "Vérification du moteur…");
  status.setAttribute("role", "status");
  top.append(names, status);

  const instructions = node("div", "hydria-artcraft-instructions");
  instructions.append(
    node("strong", "", editor === "photo" ? "Comment travailler avec Drive ?" : "Éditeur web en accès anticipé"),
    node("p", "", editor === "photo"
      ? "PhotoCraft v0.11.1 sait ouvrir des images et des projets .pcraft dans le navigateur et les enregistrer par téléchargement. Drive conserve séparément les projets natifs .pcraft éditables et les exports PNG/JPEG/WebP. Depuis Drive, cliquez sur « Ouvrir directement » pour transmettre le document natif ou l’image au moteur. Fichier > Enregistrer transmet les projets natifs à Drive ; si la sauvegarde échoue, une copie est téléchargée. Vous pouvez toujours utiliser les imports et téléchargements classiques."
      : "FigCraft Web v0.8 sait ouvrir et sauvegarder un fichier natif .figcraft par le navigateur. Cliquez sur « Ouvrir directement » dans la bibliothèque pour transmettre un projet au moteur. Fichier > Enregistrer renvoie le projet natif vers Drive en nouvelle version, avec un téléchargement de secours si nécessaire.")
  );

  const viewport = node("div", "hydria-artcraft-viewport");
  const message = node("p", "hydria-artcraft-placeholder", "Chargement de l'éditeur…");
  viewport.append(message);

  const buttonRow = node("div", "hydria-artcraft-toolbar");
  const reload = node("button", "hydria-artcraft-button", "Redémarrer l'éditeur");
  reload.type = "button";
  reload.disabled = true;
  const openTab = node("button", "hydria-artcraft-button", "Ouvrir en plein écran");
  openTab.type = "button";
  openTab.disabled = true;
  buttonRow.append(reload, openTab);
  let ready = false;
  let photoNativeLibrary = null;
  let figNativeLibrary = null;
  let photoImageRefresh = null;
  const bridgeStatus = node("p", "hydria-artcraft-bridge-status",
    "Hydria Drive : connexion de l'éditeur en attente.");
  bridgeStatus.setAttribute("role", "status");
  const bridge = createArtCraftHostBridge({
    editor,
    onNotice(message, level) {
      bridgeStatus.textContent = message;
      bridgeStatus.dataset.status = level;
    },
    onSaved() {
      photoNativeLibrary?.refresh();
      figNativeLibrary?.refresh();
      photoImageRefresh?.();
    }
  });
  function mountFrame() {
    if (!ready || !root.isConnected) return;
    const iframe = node("iframe", "hydria-artcraft-frame");
    iframe.setAttribute("title", config.product + " — éditeur créatif");
    iframe.setAttribute("sandbox", config.sandbox);
    iframe.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
    iframe.setAttribute("loading", "eager");
    const flags = new URLSearchParams({ hydriaHost:"1" });
    if (new URLSearchParams(window.location.search).has("webgl")) flags.set("webgl","1");
    if (editor === "photo" && new URLSearchParams(window.location.search).has("cpu")) flags.set("cpu","1");
    iframe.src = config.path + "?" + flags.toString();
    bridge.setFrame(iframe);
    iframe.allowFullscreen = true;
    viewport.replaceChildren(iframe);
  }
  reload.addEventListener("click", () => {
    if (!ready) return;
    mountFrame(); // Reload may discard unsaved changes inside the upstream app.
  });
  openTab.addEventListener("click", () => {
    if (!ready) return;
    window.open(config.path, "_blank", "noopener,noreferrer");
  });
  const caution = node("p", "hydria-artcraft-caution", editor === "photo"
    ? "PhotoCraft fonctionne dans votre navigateur. Vos sauvegardes natives .pcraft peuvent être transférées directement dans Drive. Vérifiez la confirmation de sauvegarde avant de fermer : sans confirmation, une copie locale est téléchargée."
    : "Enregistrez dans FigCraft et vérifiez la confirmation Drive avant de fermer. En cas d'échec, récupérez la copie locale. Il n'y a pas de sauvegarde périodique automatique.");
  let library = null;
  if (editor === "photo") {
    library = node("section", "hydria-artcraft-library");
    library.setAttribute("aria-label", "Images Hydria Drive");
    const libraryHeader = node("div", "hydria-artcraft-library-head");
    libraryHeader.append(node("h3", "", "Images conservées dans Drive"));
    const refresh = node("button", "hydria-artcraft-button", "Actualiser");
    refresh.type = "button";
    libraryHeader.append(refresh);
    const uploadBox = node("div", "hydria-artcraft-upload-box");
    const fileInput = node("input", "hydria-artcraft-image-upload");
    fileInput.type = "file";
    fileInput.accept = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
    fileInput.setAttribute("aria-label", "Importer une image PhotoCraft dans Drive");
    const note = node("small", "", "PNG, JPEG, WebP · 15 Mio maximum · chaque import conserve une nouvelle copie");
    uploadBox.append(fileInput, note);
    const result = node("div", "hydria-artcraft-images");
    const notice = node("p", "hydria-artcraft-image-feedback");
    notice.setAttribute("role", "status");
    let busy = false;
    const targetImageId = new URLSearchParams(window.location.search).get("imageId");
    async function loadImages() {
      result.replaceChildren(node("p", "hydria-artcraft-empty", "Chargement des images…"));
      try {
        const images = await listDriveImages();
        if (!root.isConnected) return;
        result.replaceChildren();
        if (!images.length) {
          result.append(node("p", "hydria-artcraft-empty", "Aucune image dans Drive pour le moment."));
          return;
        }
        for (const image of images) {
          const item = node("article", "hydria-artcraft-image-item");
          const thumb = node("img", "hydria-artcraft-thumbnail");
          thumb.src = imageAssetUrl(image.id, "preview");
          thumb.alt = "";
          thumb.loading = "lazy";
          const details = node("div", "hydria-artcraft-image-copy");
          details.append(node("strong", "", String(image.filename || "Image")));
          details.append(node("small", "",
            Math.round(Number(image.size || 0) / 1024) + " Ko · Version " +
            Number(image.revision || 1)));
          const link = node("a", "hydria-artcraft-button", "Télécharger");
          link.href = imageAssetUrl(image.id);
          link.setAttribute("download", image.filename || "image.png");
          link.title = "Télécharger l'image, puis l'ouvrir dans PhotoCraft avec Fichier > Ouvrir";
          const nextVersion = node("button", "hydria-artcraft-button hydria-artcraft-version-button", "Nouvelle version");
          nextVersion.type = "button";
          nextVersion.title = "Importer le rendu téléchargé depuis PhotoCraft en gardant l’historique";
          const versionInput = node("input", "hydria-artcraft-version-input");
          versionInput.type = "file";
          versionInput.accept = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
          versionInput.hidden = true;
          versionInput.setAttribute("aria-label", "Importer une nouvelle version de " + image.filename);
          nextVersion.addEventListener("click", () => {
            if (!busy) versionInput.click();
          });
          versionInput.addEventListener("change", async () => {
            const file = versionInput.files?.[0];
            if (!file || busy) return;
            busy = true;
            nextVersion.disabled = true;
            fileInput.disabled = true;
            notice.textContent = "Enregistrement de la nouvelle version…";
            try {
              const updated = await saveImageVersion(file, image.id, Number(image.revision || 1));
              notice.textContent = "Version " + updated.revision + " enregistrée dans Drive.";
              await loadImages();
            } catch (error) {
              notice.textContent = String(error?.message || error) +
                " Si une autre version a été enregistrée, actualisez la bibliothèque.";
            } finally {
              versionInput.value = "";
              fileInput.disabled = false;
              nextVersion.disabled = false;
              busy = false;
            }
          });
          const historyButton = node("button", "hydria-artcraft-button hydria-artcraft-history-button", "Historique");
          historyButton.type = "button";
          historyButton.setAttribute("aria-expanded", "false");
          const history = node("div", "hydria-artcraft-version-history");
          history.hidden = true;
          historyButton.addEventListener("click", async () => {
            const nowOpen = history.hidden;
            history.hidden = !nowOpen;
            historyButton.setAttribute("aria-expanded", String(nowOpen));
            if (!nowOpen) return;
            history.replaceChildren(node("p", "hydria-artcraft-empty", "Chargement de l’historique…"));
            try {
              const payload = await listImageVersions(image.id);
              if (!item.isConnected) return;
              history.replaceChildren();
              for (const version of payload.items) {
                const line = node("div", "hydria-artcraft-history-row");
                line.append(node("span", "", "Version " + version.revision +
                  " · " + (version.filename || "image") +
                  " · " + Math.round(Number(version.size || 0) / 1024) + " Ko"));
                const downloadVersion = node("a", "hydria-artcraft-button", "Télécharger cette version");
                downloadVersion.href = imageRevisionDownloadUrl(image.id, version.revision);
                downloadVersion.setAttribute("download", version.filename || "image.png");
                line.append(downloadVersion);
                history.append(line);
              }
            } catch (error) {
              history.replaceChildren(node("p", "hydria-artcraft-empty",
                "Historique indisponible : " + String(error?.message || error)));
            }
          });
          const directOpen = node("button", "hydria-artcraft-button hydria-artcraft-direct-open", "Ouvrir directement");
          directOpen.type = "button";
          directOpen.title = "Charger cette image dans PhotoCraft sans passer par un téléchargement";
          directOpen.addEventListener("click", () =>
            bridge.openAsset({ ...image, kind:"image" }));
          item.append(thumb, details, directOpen, link, nextVersion, historyButton, versionInput, history);
          result.append(item);
          if (targetImageId && String(image.id) === targetImageId) {
            item.classList.add("hydria-artcraft-target-image");
            requestAnimationFrame(() => {
              if (item.isConnected) {
                item.scrollIntoView({ block: "nearest", behavior: "smooth" });
                historyButton.click();
              }
            });
          }
        }
      } catch (error) {
        if (!root.isConnected) return;
        result.replaceChildren(node("p", "hydria-artcraft-empty", String(error?.message || error)));
      }
    }
    photoImageRefresh = loadImages;
    refresh.addEventListener("click", () => { loadImages(); });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file || busy) return;
      busy = true;
      fileInput.disabled = true;
      notice.textContent = "Importation de l'image…";
      try {
        await saveImageToDrive(file);
        notice.textContent = "Image enregistrée dans Hydria Drive.";
        await loadImages();
      } catch (error) {
        notice.textContent = String(error?.message || error);
      } finally {
        fileInput.value = "";
        fileInput.disabled = false;
        busy = false;
      }
    });
    library.append(libraryHeader, uploadBox, notice, result);
    loadImages();
  }
  if (editor === "fig") library = node("div", "hydria-figcraft-library-mount");
  if (editor === "photo" && library) {
    const nativeMount = node("div", "hydria-photocraft-library-mount");
    // Layered .pcraft projects and raster exports use distinct data stores.
    library.prepend(nativeMount);
    library.setAttribute("aria-label", "Projets PhotoCraft et images dans Hydria Drive");
    photoNativeLibrary = renderPhotoCraftDriveLibrary(nativeMount, {
      onOpen: item => bridge.openAsset(item)
    });
  }
  root.append(top, buttonRow, instructions, bridgeStatus,
    library || node("div", "hydria-artcraft-no-library"), viewport, caution);
  container.append(root);
  const lifeObserver = new MutationObserver(() => {
    if (!root.isConnected) { lifeObserver.disconnect(); bridge.dispose(); }
  });
  lifeObserver.observe(document.body, { childList: true, subtree: true });
  if (editor === "fig") figNativeLibrary = renderFigCraftDriveLibrary(library, {
    onOpen: item => bridge.openAsset(item)
  });

  // Optional WASM bundles are self-hosted, never redirected to third parties.
  fetch(config.path, { method:"HEAD", cache:"no-store", credentials:"same-origin" })
    .then((response) => {
      if (!root.isConnected) return;
      if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) {
        throw Error("ArtCraft runtime not installed");
      }
      ready = true;
      status.textContent = config.product + " disponible";
      reload.disabled = false;
      openTab.disabled = false;
      mountFrame();
    })
    .catch(() => {
      if (!root.isConnected) return;
      status.textContent = "Installation nécessaire";
      message.textContent = "Le moteur " + config.product + " n'est pas présent sur cette instance privée. " +
        "Commande administrateur : " + config.install;
    });
}
