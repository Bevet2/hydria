/**
 * Hydria <-> self-hosted PhotoCraft/FigCraft bridge.
 * No project format conversion: the original WASM app processes the input,
 * its Blob downloads are uploaded to the existing immutable Drive API.
 *
 * The upstream apps have no supported host API. This bridge is an explicitly
 * version-pinned adapter, verified with browser fixtures and real-WASM smoke.
 * It must not be treated as a general third-party iframe trust boundary.
 */
import { storePhotoProject, photoProjectFileUrl } from "../services/drivePhotoProjectClient.js";
import { storeDesign, designFileUrl } from "../services/driveDesignClient.js";
import { imageAssetUrl, saveImageToDrive, saveImageVersion } from "../services/driveImageClient.js";

const MAX_NATIVE = 30 * 1024 * 1024;
const MAX_IMAGE = 15 * 1024 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const fileType = (editor, name) => {
  const ext = String(name || "").split(".").at(-1)?.toLowerCase();
  if (editor === "photo" && ext === "pcraft") return "project";
  if (editor === "fig" && ext === "figcraft") return "project";
  if (editor === "photo" && MIME[ext]) return "image";
  return null;
};
const safeName = (name, editor, kind) => {
  const extension = kind === "project" ? (editor === "photo" ? ".pcraft" : ".figcraft") : ".png";
  const cleaned = String(name || "").replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, "_").slice(0, 128);
  return cleaned || ("document" + extension);
};
const downloadApi = (editor, kind, id) => {
  if (!ID.test(id)) throw Error("Identifiant Drive incorrect.");
  if (kind === "image") return imageAssetUrl(id);
  return editor === "photo" ? photoProjectFileUrl(id) : designFileUrl(id);
};

export function createArtCraftHostBridge({
  editor, onNotice = () => {}, onSaved = () => {}
}) {
  if (!["photo","fig"].includes(editor)) throw Error("Invalid creative editor");
  const session = crypto.randomUUID();
  let frame = null, ready = false, disposed = false, queued = null, bound = null;
  let nextOpenId = 0, saving = false;
  const origin = location.origin;
  const notify = (message, level = "info") => { if (!disposed) onNotice(message, level); };
  function send(type, extra = {}, transfer = []) {
    if (!ready || !frame?.isConnected || disposed) return false;
    frame.contentWindow?.postMessage({
      type: "hydria-artcraft:" + type, editor, session, ...extra
    }, origin, transfer);
    return true;
  }
  async function saveFromEditor(data) {
    const kind = data.kind, filename = safeName(data.name, editor, kind);
    if (kind !== fileType(editor, filename) || !(data.bytes instanceof ArrayBuffer) ||
        !data.bytes.byteLength || data.bytes.byteLength > (kind === "image" ? MAX_IMAGE : MAX_NATIVE)) {
      send("save-result", { id: data.id, ok: false });
      notify("Format ou taille incompatible : téléchargement de secours déclenché.", "error");
      return;
    }
    if (saving) {
      send("save-result", { id: data.id, ok: false });
      notify("Une sauvegarde est déjà en cours. Copie locale conservée.", "error");
      return;
    }
    saving = true;
    notify("Sauvegarde dans Hydria Drive…");
    try {
      const blob = new File([data.bytes], filename, {
        type: kind === "image" ? MIME[filename.split(".").at(-1).toLowerCase()] : "application/octet-stream"
      });
      let result;
      const sameFile = bound && bound.kind === kind &&
        bound.filename?.toLowerCase() === filename.toLowerCase();
      if (kind === "image") {
        result = sameFile
          ? await saveImageVersion(blob, bound.id, bound.revision)
          : await saveImageToDrive(blob);
      } else if (editor === "photo") {
        result = await storePhotoProject(blob, sameFile
          ? { id: bound.id, expectedRevision: bound.revision } : {});
      } else {
        result = await storeDesign(blob, sameFile
          ? { id: bound.id, expectedRevision: bound.revision } : {});
      }
      bound = {
        kind, id: result.id, revision: Number(result.revision || 1),
        filename: result.filename || filename
      };
      send("save-result", { id: data.id, ok: true });
      notify("Document enregistré dans Drive · version " + bound.revision, "success");
      onSaved({ ...bound });
    } catch (error) {
      send("save-result", { id: data.id, ok: false });
      notify("Drive a refusé la sauvegarde : " + String(error?.message || error) +
        ". Une copie locale est téléchargée.", "error");
    } finally { saving = false; }
  }
  function dispatchQueued() {
    if (!queued || !ready) return;
    const item = queued;
    queued = null;
    // Transfer this ArrayBuffer only after the bridge handshake.
    send("open", { id: ++nextOpenId, name: item.filename, bytes: item.bytes }, [item.bytes]);
    bound = { kind:item.kind, id:item.id, revision:item.revision, filename:item.filename };
    notify("Projet transmis à " + (editor === "photo" ? "PhotoCraft" : "FigCraft") +
      ". L'ouverture dépend du moteur ; si nécessaire, utilisez Fichier > Ouvrir.", "info");
  }
  function onMessage(event) {
    if (disposed || !frame?.isConnected || event.origin !== origin ||
        event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.editor !== editor) return;
    if (data.type === "hydria-artcraft:ready" && data.version === 1) {
      frame.contentWindow.postMessage({
        type: "hydria-artcraft:connect", editor, session
      }, origin);
      return;
    }
    if (data.session !== session) return;
    if (data.type === "hydria-artcraft:connected" && data.version === 1) {
      ready = true;
      frame.dataset.driveBridgeReady = "true";
      notify("Hydria Drive connecté : ouverture et enregistrement directs disponibles.", "success");
      dispatchQueued();
    } else if (data.type === "hydria-artcraft:save" &&
      Number.isSafeInteger(data.id) && data.id > 0 &&
      ["project","image"].includes(data.kind)) {
      void saveFromEditor(data);
    } else if (data.type === "hydria-artcraft:save-fallback") {
      notify("Copie de secours téléchargée : " + String(data.reason || "Enregistrement indisponible"), "error");
    } else if (data.type === "hydria-artcraft:open-picker-needed") {
      notify("Utilisez Fichier > Ouvrir dans l'éditeur : Hydria fournira le fichier automatiquement.", "info");
    } else if (data.type === "hydria-artcraft:open-dispatched") {
      notify("Fichier déposé dans l'éditeur. Vérifiez que le projet s'affiche avant toute modification.", "info");
    } else if (data.type === "hydria-artcraft:open-picker") {
      notify("Fichier transmis au sélecteur natif.", "success");
    }
  }
  window.addEventListener("message", onMessage);
  function setFrame(iframe) {
    frame = iframe;
    ready = false;
    queued = null;
    bound = null;
    if (frame) delete frame.dataset.driveBridgeReady;
  }
  async function openAsset(item) {
    if (disposed || !item || !ID.test(String(item.id || "")) ||
        !["project","image"].includes(item.kind) || (editor === "fig" && item.kind !== "project")) {
      notify("Ce fichier n'est pas compatible avec l'éditeur.", "error");
      return false;
    }
    const id = String(item.id);
    const expectedRevision = Number(item.revision || 1);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision > 50) {
      notify("Version Drive invalide.", "error");
      return false;
    }
    notify("Chargement du fichier Drive…");
    try {
      const url = downloadApi(editor, item.kind, id);
      const response = await fetch(url, { credentials:"same-origin", cache:"no-store" });
      if (!response.ok) throw Error("HTTP " + response.status);
      const blob = await response.blob();
      if (!blob.size || blob.size > MAX_NATIVE) throw Error("Fichier Drive trop volumineux");
      const filename = safeName(item.filename, editor, item.kind);
      if (fileType(editor, filename) !== item.kind) throw Error("Extension du document incorrecte");
      queued = { id, kind:item.kind, filename, revision:expectedRevision, bytes:await blob.arrayBuffer() };
      if (ready) dispatchQueued();
      else notify("Chargement du moteur créatif pour ouvrir le document…");
      return true;
    } catch (error) {
      notify("Ouverture Drive impossible : " + String(error?.message || error), "error");
      return false;
    }
  }
  function dispose() {
    disposed = true;
    window.removeEventListener("message", onMessage);
    queued = null; bound = null; frame = null;
  }
  return { setFrame, openAsset, dispose, get ready() { return ready; } };
}
