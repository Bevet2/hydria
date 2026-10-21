/* Hydria ArtCraft Web host shim.
 * Loaded before the official pinned WASM bootstrap in private Hydria deployments.
 * Neither PhotoCraft nor FigCraft currently exposes a stable public host protocol.
 * This adapter observes their documented browser file pickers and Blob downloads.
 * It never patches, decodes, or rewrites project bytes.
 */
(() => {
  "use strict";
  const script = document.currentScript;
  const editor = script?.dataset.hydriaEditor;
  if (!["photo","fig"].includes(editor) || window.parent === window ||
      new URLSearchParams(location.search).get("hydriaHost") !== "1") return;
  const projectExts = editor === "photo" ? [".pcraft",".psd",".psb"] : [".figcraft"];
  const MAX_BINARY = 30 * 1024 * 1024;
  const origin = location.origin;
  let session = null;
  let pendingOpen = null;
  let lastFile = null;
  let sequence = 0;
  const urls = new Map(), requests = new Map();
  const createUrl = URL.createObjectURL.bind(URL);
  const revokeUrl = URL.revokeObjectURL.bind(URL);
  const realAnchorClick = HTMLAnchorElement.prototype.click;
  const realInputClick = HTMLInputElement.prototype.click;
  const allowedExts = editor === "photo" ? [".pcraft",".psd",".psb",".png",".jpg",".jpeg",".webp"] : [".figcraft"];

  function inform(type, extra = {}, transfer = []) {
    if (!session) return;
    window.parent.postMessage({ type: "hydria-artcraft:" + type, session, editor, ...extra }, origin, transfer);
  }
  URL.createObjectURL = function(blob) {
    const href = createUrl(blob);
    if (blob instanceof Blob && blob.size <= MAX_BINARY) urls.set(href, blob);
    return href;
  };
  URL.revokeObjectURL = function(href) {
    urls.delete(href);
    return revokeUrl(href);
  };
  function emergencyDownload(blob, name) {
    const href = createUrl(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.hidden = true;
    document.body.append(a);
    realAnchorClick.call(a);
    a.remove();
    setTimeout(() => revokeUrl(href), 40000);
  }
  function requestSave(blob, name, kind) {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      const entry = requests.get(id);
      if (!entry) return;
      requests.delete(id);
      emergencyDownload(entry.blob, entry.name);
      inform("save-fallback", { id, reason: "Délai de sauvegarde dépassé" });
    }, 20000);
    requests.set(id, { blob, name, timeout });
    blob.arrayBuffer().then(buffer => {
      if (!requests.has(id)) return;
      inform("save", { id, name, kind, bytes: buffer }, [buffer]);
    }).catch(() => {
      const entry = requests.get(id);
      if (!entry) return;
      clearTimeout(entry.timeout);
      requests.delete(id);
      emergencyDownload(blob, name);
      inform("save-fallback", { id, reason: "Fichier illisible" });
    });
  }
  HTMLAnchorElement.prototype.click = function(...args) {
    const name = String(this.download || "");
    const ext = name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    const kind = projectExts.includes(ext) ? "project" :
      (editor === "photo" && [".png",".jpg",".jpeg",".webp"].includes(ext) ? "image" : null);
    const blob = kind && urls.get(this.href);
    if (!session || !kind || !blob || !blob.size ||
        blob.size > (kind === "image" ? 15 * 1024 * 1024 : MAX_BINARY)) {
      return realAnchorClick.apply(this, args);
    }
    // Browser downloads are normally fire-and-forget. The host first verifies
    // durable persistence and replies; only then do we suppress the download.
    requestSave(blob, name, kind);
  };
  HTMLInputElement.prototype.click = function(...args) {
    if (!session || this.type !== "file" || !lastFile) return realInputClick.apply(this, args);
    const accept = String(this.accept || "").toLowerCase();
    const ext = "." + lastFile.name.split(".").at(-1).toLowerCase();
    if (!allowedExts.includes(ext) || (accept && !accept.includes(ext))) {
      return realInputClick.apply(this, args);
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(lastFile);
      this.files = dt.files;
      queueMicrotask(() => {
        this.dispatchEvent(new Event("change", { bubbles: true }));
        inform("open-picker", { name: lastFile.name });
        lastFile = null;
      });
      return;
    } catch { return realInputClick.apply(this, args); }
  };

  async function pushToNative(file) {
    const canvas = document.getElementById(editor === "photo" ? "photocraft_canvas" : "figcraft_canvas");
    if (!canvas) return false;
    // The Hydria-patched FigCraft WASM build reads this bounded queue in its
    // own UI loop and invokes FigCraft engine.file.open with native bytes.
    // Unlike a synthetic DragEvent, the result is a genuine engine operation.
    if (editor === "fig" && document.documentElement.dataset.hydriaFigNative === "1") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BINARY) return false;
      (window.__hydriaFigOpenQueue ||= []).push({name:file.name,bytes});
      canvas.dispatchEvent(new MouseEvent("mousemove",{bubbles:true,cancelable:true}));
      return true;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    try {
      canvas.dispatchEvent(new DragEvent("dragenter", { bubbles:true, cancelable:true, dataTransfer:transfer }));
      canvas.dispatchEvent(new DragEvent("dragover", { bubbles:true, cancelable:true, dataTransfer:transfer }));
      canvas.dispatchEvent(new DragEvent("drop", { bubbles:true, cancelable:true, dataTransfer:transfer }));
      return true;
    } catch { return false; }
  }
  function dispatchWhenReady(file, id) {
    const start = Date.now();
    async function attempt() {
      if (!pendingOpen || pendingOpen.id !== id) return;
      const loading = document.getElementById(editor === "photo" ? "photocraft_loading" : "figcraft_loading");
      const success = !loading && await pushToNative(file).catch(() => false);
      if (!pendingOpen || pendingOpen.id !== id) return;
      if (success) {
        pendingOpen = null;
        // Modified FigCraft processes its queue in the next UI frame.
        // Upstream engines decide whether the document is valid/opened.
        inform("open-dispatched", { id, name:file.name });
      } else if (Date.now() - start < 25000) {
        setTimeout(attempt, 150);
      } else {
        pendingOpen = null;
        inform("open-picker-needed", { id, name:file.name });
      }
    }
    void attempt();
  }
  window.addEventListener("message", event => {
    if (event.origin !== origin || event.source !== window.parent ||
        !event.data || typeof event.data !== "object") return;
    const data = event.data;
    if (data.type === "hydria-artcraft:connect") {
      if (session !== null || data.editor !== editor ||
          typeof data.session !== "string" || !/^[0-9a-f-]{36}$/i.test(data.session)) return;
      session = data.session;
      inform("connected", { version: 1 });
      return;
    }
    if (!session || data.session !== session || data.editor !== editor) return;
    if (data.type === "hydria-artcraft:open") {
      if (!(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength > MAX_BINARY ||
          !data.bytes.byteLength || typeof data.name !== "string" || data.name.length > 180) return;
      const ext = "." + data.name.split(".").at(-1).toLowerCase();
      if (!allowedExts.includes(ext) || !Number.isSafeInteger(data.id) || data.id < 1) return;
      const file = new File([data.bytes], data.name, {type:"application/octet-stream"});
      lastFile = file;
      pendingOpen = { id: data.id };
      dispatchWhenReady(file, data.id);
    } else if (data.type === "hydria-artcraft:save-result") {
      const request = requests.get(data.id);
      if (!request) return;
      clearTimeout(request.timeout);
      requests.delete(data.id);
      if (data.ok !== true) {
        emergencyDownload(request.blob, request.name);
        inform("save-fallback", { id:data.id, reason: "Drive a refusé le document" });
      }
    }
  });
  window.parent.postMessage({ type:"hydria-artcraft:ready", editor, version:1 }, origin);
})();
