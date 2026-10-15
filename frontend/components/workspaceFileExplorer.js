// Hydria OS work-object file explorer: folders, search, sort, favorites and keyboard access.
// All file renames/moves go through permission-checked backend APIs.
const viewStates = new Map();
function el(tag, cls = "", label = "") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (label) node.textContent = label;
  return node;
}
function storageKey(userId, objectId) {
  return "hydria:explorer:" + String(userId || "local") + ":" + String(objectId || "");
}
function readFavorites(key) {
  try {
    const items = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(items) ? items.filter((x) => typeof x === "string") : []);
  } catch { return new Set(); }
}
function writeFavorites(key, favorites) {
  try { localStorage.setItem(key, JSON.stringify([...favorites])); } catch { /* storage can be disabled */ }
}
function norm(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}
export function buildExplorerTree(paths = []) {
  const root = { folders: new Map(), files: [], name: "", path: "" };
  for (const raw of [...new Set(paths.map(norm).filter(Boolean))]) {
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === ".." || part === ".")) continue;
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      if (!folder.folders.has(part)) {
        folder.folders.set(part, {
          name: part,
          path: (folder.path ? folder.path + "/" : "") + part,
          folders: new Map(), files: []
        });
      }
      folder = folder.folders.get(part);
    }
    folder.files.push({ name: parts.at(-1), path: raw });
  }
  return root;
}
function sortFiles(items, mode = "name", favorites = new Set()) {
  const ordered = [...items];
  if (mode === "type") return ordered.sort((a, b) => (a.name.split(".").at(-1) || "").localeCompare(b.name.split(".").at(-1) || "") || a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (mode === "favorite") return ordered.sort((a, b) => Number(favorites.has(b.path)) - Number(favorites.has(a.path)) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (mode === "name-desc") return ordered.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  return ordered.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
function fileType(name) {
  const ext = name.split(".").at(-1)?.toLowerCase() || "";
  if (["md","txt","docx","pdf","html"].includes(ext)) return "▤";
  if (["csv","tsv","xlsx","xls"].includes(ext)) return "▦";
  if (["js","ts","tsx","jsx","py","json","css"].includes(ext)) return "⌘";
  if (["png","jpg","jpeg","svg","webp"].includes(ext)) return "▧";
  return "▢";
}
export function renderWorkspaceFileExplorer(container, {
  workObjectId = "",
  userId = "",
  files = [],
  activePath = "",
  onOpen = () => {},
  onMove = null
} = {}) {
  if (!container) return;
  const id = String(workObjectId || "");
  container.replaceChildren();
  if (!id) {
    container.append(el("p", "hydria-files-empty", "Open an object to browse its files."));
    return;
  }
  if (!viewStates.has(id)) viewStates.set(id, { query: "", sort: "name", collapsed: new Set() });
  const state = viewStates.get(id);
  const favKey = storageKey(userId, id);
  const favorites = readFavorites(favKey);
  const tree = buildExplorerTree(files);
  const header = el("div", "hydria-files-head");
  const title = el("strong", "", "Files");
  const count = el("small", "hydria-files-count", String(files.length));
  header.append(title, count);
  const controls = el("div", "hydria-files-controls");
  const search = el("input", "hydria-files-search");
  search.type = "search"; search.placeholder = "Find a file…"; search.value = state.query;
  search.setAttribute("aria-label", "Search files in current work object");
  const sorting = el("select", "hydria-files-sort");
  sorting.setAttribute("aria-label", "Sort work object files");
  [["name","Name A–Z"],["name-desc","Name Z–A"],["type","File type"],["favorite","Favorites first"]].forEach(([value,label]) => {
    const option = el("option", "", label); option.value = value; sorting.append(option);
  });
  sorting.value = state.sort;
  controls.append(search, sorting);
  const list = el("div", "hydria-files-tree");
  list.setAttribute("role", "tree");
  container.append(header, controls, list);
  function render() {
    list.replaceChildren();
    const query = state.query.trim().toLowerCase();
    let visible = 0;
    function draw(folder, target, level = 0) {
      const nested = [...folder.folders.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
      for (const item of nested) {
        const allPaths = [];
        const visit = (node) => {
          node.files.forEach(f => allPaths.push(f.path));
          node.folders.forEach(visit);
        };
        visit(item);
        if (query && !allPaths.some(path => path.toLowerCase().includes(query))) continue;
        const wrapper = el("div", "hydria-files-folder-group");
        const heading = el("button", "hydria-files-folder", "");
        heading.type = "button";
        heading.setAttribute("aria-expanded", query || !state.collapsed.has(item.path) ? "true" : "false");
        const closed = !query && state.collapsed.has(item.path);
        heading.textContent = (closed ? "▸ " : "▾ ") + item.name;
        heading.title = item.path;
        heading.style.paddingLeft = (8 + level * 12) + "px";
        const contents = el("div", "hydria-files-folder-children");
        contents.hidden = closed;
        heading.addEventListener("click", () => {
          if (state.collapsed.has(item.path)) state.collapsed.delete(item.path);
          else state.collapsed.add(item.path);
          render();
        });
        wrapper.append(heading, contents);
        target.append(wrapper);
        if (!closed || query) draw(item, contents, level + 1);
      }
      for (const file of sortFiles(folder.files, state.sort, favorites)) {
        if (query && !file.path.toLowerCase().includes(query)) continue;
        visible++;
        const row = el("div", "hydria-files-row" + (file.path === norm(activePath) ? " is-active" : ""));
        row.style.paddingLeft = (8 + level * 12) + "px";
        const open = el("button", "hydria-files-open");
        open.type = "button";
        open.title = file.path; open.setAttribute("role", "treeitem");
        open.setAttribute("aria-current", file.path === norm(activePath) ? "true" : "false");
        open.append(el("span", "hydria-files-icon", fileType(file.name)), el("span", "hydria-files-name", file.name));
        open.addEventListener("click", () => onOpen(file.path));
        const star = el("button", "hydria-files-star" + (favorites.has(file.path) ? " is-favorite" : ""), favorites.has(file.path) ? "★" : "☆");
        star.type = "button";
        star.title = favorites.has(file.path) ? "Remove favorite" : "Add to favorites";
        star.setAttribute("aria-label", star.title + ": " + file.name);
        star.addEventListener("click", () => {
          if (favorites.has(file.path)) favorites.delete(file.path); else favorites.add(file.path);
          writeFavorites(favKey, favorites); render();
        });
        row.append(open, star);
        if (typeof onMove === "function") {
          const move = el("button", "hydria-files-move", "↗");
          move.type = "button";
          move.title = "Rename or move " + file.path;
          move.setAttribute("aria-label", "Rename or move " + file.path);
          move.addEventListener("click", async () => {
            const nextPath = window.prompt("New file path inside this workspace:", file.path);
            if (nextPath == null || nextPath.trim() === file.path) return;
            move.disabled = true;
            try {
              const success = await onMove(file.path, nextPath.trim());
              if (success && favorites.delete(file.path)) {
                favorites.add(nextPath.trim());
                writeFavorites(favKey, favorites);
              }
            } catch {
              // The application-level handler reports failures in the OS status.
            } finally {
              move.disabled = false;
            }
          });
          row.append(move);
        }
        target.append(row);
      }
    }
    draw(tree, list);
    if (visible === 0 && (query || !files.length)) list.append(el("p", "hydria-files-empty", query ? "No matching files." : "No editable files."));
    count.textContent = query ? visible + "/" + files.length : String(files.length);
  }
  search.addEventListener("input", () => { state.query = search.value; render(); });
  sorting.addEventListener("change", () => { state.sort = sorting.value; render(); });
  render();
}
