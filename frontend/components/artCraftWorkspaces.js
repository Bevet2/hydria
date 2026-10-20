import { imageAssetUrl, listDriveImages, saveImageToDrive } from "../services/driveImageClient.js";

// Upstream distributions are pinned and installed separately. In the browser
// their native renderers operate in an iframe; no fictitious postMessage API.
export const ARTCRAFT_EDITORS = Object.freeze({
  photo: Object.freeze({
    slug: "photo", title: "Hydria Photo", product: "PhotoCraft",
    version: "0.10.0", path: "/vendor/photocraft/index.html",
    sandbox: "allow-scripts allow-same-origin allow-downloads allow-popups",
    install: "node backend/scripts/installArtCraftWeb.mjs photo"
  }),
  fig: Object.freeze({
    slug: "fig", title: "Hydria Design", product: "FigCraft",
    version: "0.7.0", path: "/vendor/figcraft/index.html",
    sandbox: "allow-scripts allow-same-origin allow-popups",
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
      ? "Retouchez vos images avec PhotoCraft, puis conservez vos exports dans Hydria Drive."
      : "Concevez vos interfaces avec FigCraft Web, dans l'espace de travail Hydria.")
  );
  const status = node("span", "hydria-artcraft-status", "Vérification du moteur…");
  status.setAttribute("role", "status");
  top.append(names, status);

  const instructions = node("div", "hydria-artcraft-instructions");
  instructions.append(
    node("strong", "", editor === "photo" ? "Comment travailler avec Drive ?" : "Éditeur web en accès anticipé"),
    node("p", "", editor === "photo"
      ? "Pour retoucher une image de Drive, téléchargez-la ci-dessous puis ouvrez-la avec le menu Fichier de PhotoCraft. Après export dans PhotoCraft, importez le fichier résultant dans Drive avec le sélecteur ci-dessous. Il n'y a pas de synchronisation automatique."
      : "FigCraft Web démarre sur un document vierge. La version actuelle ne raccorde pas encore les dialogues natifs de fichiers : ni import d'un document Hydria ni sauvegarde vers Drive. Exportez ou conservez vos travaux localement seulement si votre version de FigCraft le permet.")
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
  function mountFrame() {
    if (!ready || !root.isConnected) return;
    const iframe = node("iframe", "hydria-artcraft-frame");
    iframe.setAttribute("title", config.product + " — éditeur créatif");
    iframe.setAttribute("sandbox", config.sandbox);
    iframe.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
    iframe.setAttribute("loading", "eager");
    iframe.src = config.path;
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
    ? "PhotoCraft fonctionne dans votre navigateur. Les projets en cours ne sont pas sauvegardés par Hydria tant que vous n'avez pas exporté puis importé le résultat."
    : "Attention : une actualisation peut perdre les modifications non enregistrées. La parité avec Figma n'est pas atteinte.");
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
          details.append(node("small", "", Math.round(Number(image.size || 0) / 1024) + " Ko"));
          const link = node("a", "hydria-artcraft-button", "Télécharger");
          link.href = imageAssetUrl(image.id);
          link.setAttribute("download", image.filename || "image.png");
          link.title = "Télécharger l'image, puis l'ouvrir dans PhotoCraft avec Fichier > Ouvrir";
          item.append(thumb, details, link);
          result.append(item);
        }
      } catch (error) {
        if (!root.isConnected) return;
        result.replaceChildren(node("p", "hydria-artcraft-empty", String(error?.message || error)));
      }
    }
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
  root.append(top, buttonRow, instructions, library || node("div", "hydria-artcraft-no-library"), viewport, caution);
  container.append(root);

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
