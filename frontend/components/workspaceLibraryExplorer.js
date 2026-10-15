import { renderWorkspaceObjectList } from "./workspacePanel.js";

const instances = new WeakMap();
const defaults = () => ({ favorites: [], folders: [], placements: {}, sort: "recent" });
function load(userId) {
  try {
    const result = JSON.parse(localStorage.getItem("hydria:library:" + userId) || "{}");
    return { ...defaults(), ...result, favorites: Array.isArray(result.favorites) ? result.favorites : [], folders: Array.isArray(result.folders) ? result.folders : [], placements: result.placements && typeof result.placements === "object" ? result.placements : {} };
  } catch { return defaults(); }
}
function save(userId, data) {
  localStorage.setItem("hydria:library:" + userId, JSON.stringify(data));
}
function mk(tag, cls = "", text = "") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
const id = (value) => String(value == null ? "" : value);
function stamp(obj) { return Date.parse(obj.updatedAt || obj.updated_at || obj.createdAt || obj.created_at || "") || 0; }
function objectSearch(obj) {
  const paths = [obj.primaryFile, obj.primaryEntry?.path, ...(Array.isArray(obj.files) ? obj.files.map((file) => typeof file === "string" ? file : file.path) : [])];
  return [obj.title, obj.name, obj.summary, obj.workspaceFamilyId, obj.objectKind, obj.kind, ...paths].filter(Boolean).join(" ").toLocaleLowerCase();
}
function belongsTo(obj, folder, metadata) {
  if (folder === "__all") return true;
  if (folder === "__favorites") return metadata.favorites.includes(id(obj.id));
  return metadata.placements[id(obj.id)] === folder;
}
function uniqueFolderName(name, current) {
  const clean = String(name || "").trim().replace(/[\x00-\x1f]/g, "").slice(0, 45);
  if (!clean || /^(__|all$|favorites$)/i.test(clean) || current.some(x => x.toLowerCase() === clean.toLowerCase())) return "";
  return clean;
}
export function renderHydriaLibraryExplorer(container, {
  workObjects = [], currentWorkObjectId = "", onSelect = () => {}, userId = "local"
} = {}) {
  if (!container) return;
  const key = id(userId || "local");
  let view = instances.get(container);
  if (!view || view.userId !== key) {
    container.replaceChildren();
    view = { userId: key, metadata: load(key), selected: "__all", query: "", total: 0 };
    const root = mk("section", "hydria-explorer");
    const tools = mk("div", "hydria-explorer-tools");
    const heading = mk("div", "hydria-explorer-heading");
    heading.append(mk("strong", "", "Project explorer"), mk("span", "hydria-explorer-count", "0 files"));
    const input = mk("input", "hydria-explorer-search");
    input.type = "search"; input.placeholder = "Filter files and objects…"; input.setAttribute("aria-label", "Filter project files");
    const filter = mk("div", "hydria-explorer-filters");
    const folders = mk("div", "hydria-explorer-folders");
    const items = mk("div", "hydria-explorer-items");
    const sort = mk("select", "hydria-explorer-sort");
    sort.setAttribute("aria-label", "Sort project files");
    [["recent","Recently updated"],["name","Name A–Z"],["type","Object type"]].forEach(([value,label]) => {
      const option = mk("option", "", label); option.value = value; sort.appendChild(option);
    });
    sort.value = view.metadata.sort;
    const newFolder = mk("button", "hydria-explorer-new-folder", "+ Folder");
    newFolder.type = "button";
    tools.append(heading, input, sort, newFolder);
    root.append(tools, filter, folders, items);
    container.appendChild(root);
    Object.assign(view, { root, tools, input, filter, folders, items, count: heading.querySelector(".hydria-explorer-count"), sort, newFolder });
    instances.set(container, view);
    input.addEventListener("input", () => { view.query = input.value.toLocaleLowerCase().trim(); drawItems(); });
    sort.addEventListener("change", () => { view.metadata.sort = sort.value; save(key, view.metadata); drawItems(); });
    newFolder.addEventListener("click", () => {
      const name = uniqueFolderName(window.prompt("New folder name") || "", view.metadata.folders);
      if (!name) return;
      view.metadata.folders.push(name); view.selected = name;
      save(key, view.metadata); drawFolders(); drawItems();
    });
  }
  view.workObjects = Array.isArray(workObjects) ? workObjects : [];
  view.currentWorkObjectId = currentWorkObjectId;
  view.onSelect = onSelect;
  function moveObject(objectId, folder) {
    if (!view.workObjects.some(obj => id(obj.id) === id(objectId))) return;
    if (folder !== "__all" && !view.metadata.folders.includes(folder)) return;
    if (folder === "__all") delete view.metadata.placements[id(objectId)];
    else view.metadata.placements[id(objectId)] = folder;
    save(key, view.metadata); drawFolders(); drawItems();
  }
  function folderButton(text, group, count) {
    const btn = mk("button", "hydria-explorer-folder" + (view.selected === group ? " is-active" : ""), text);
    btn.type = "button"; btn.dataset.folder = group;
    btn.appendChild(mk("small", "", String(count)));
    btn.addEventListener("click", () => { view.selected = group; drawFolders(); drawItems(); });
    if (group !== "__favorites") {
      btn.addEventListener("dragover", (event) => { event.preventDefault(); btn.classList.add("is-drop-target"); });
      btn.addEventListener("dragleave", () => btn.classList.remove("is-drop-target"));
      btn.addEventListener("drop", (event) => {
        event.preventDefault(); btn.classList.remove("is-drop-target");
        moveObject(event.dataTransfer?.getData("text/plain"), group);
      });
    }
    return btn;
  }
  function drawFolders() {
    view.folders.replaceChildren();
    const counts = (selected) => view.workObjects.filter(obj => belongsTo(obj, selected, view.metadata)).length;
    view.folders.append(folderButton("All files", "__all", counts("__all")), folderButton("★ Favorites", "__favorites", counts("__favorites")));
    for (const name of view.metadata.folders) {
      const wrapper = mk("div", "hydria-explorer-folder-row");
      const btn = folderButton("▸ " + name, name, counts(name));
      const remove = mk("button", "hydria-explorer-folder-remove", "×");
      remove.type = "button"; remove.title = "Remove virtual folder"; remove.setAttribute("aria-label", "Remove folder " + name);
      remove.addEventListener("click", () => {
        if (!window.confirm("Remove folder \"" + name + "\"? Files will remain in Hydria.")) return;
        view.metadata.folders = view.metadata.folders.filter(f => f !== name);
        Object.keys(view.metadata.placements).forEach(id => { if (view.metadata.placements[id] === name) delete view.metadata.placements[id]; });
        if (view.selected === name) view.selected = "__all";
        save(key, view.metadata); drawFolders(); drawItems();
      });
      wrapper.append(btn, remove); view.folders.appendChild(wrapper);
    }
  }
  function drawItems() {
    let objects = view.workObjects.filter(obj => belongsTo(obj, view.selected, view.metadata) && (!view.query || objectSearch(obj).includes(view.query)));
    if (view.metadata.sort === "name") objects.sort((a,b) => String(a.title || "").localeCompare(String(b.title || "")));
    else if (view.metadata.sort === "type") objects.sort((a,b) => String(a.objectKind || a.kind || "").localeCompare(String(b.objectKind || b.kind || "")) || String(a.title || "").localeCompare(String(b.title || "")));
    else objects.sort((a,b) => stamp(b) - stamp(a));
    view.count.textContent = objects.length + " / " + view.workObjects.length + " files";
    renderWorkspaceObjectList(view.items, objects, view.currentWorkObjectId, view.onSelect);
    const cardButtons = [...view.items.querySelectorAll(":scope > .workspace-nav-item")];
    objects.forEach((obj,i) => {
      const card = cardButtons[i];
      if (!card) return;
      const wrapper = mk("div", "hydria-explorer-entry");
      wrapper.draggable = true; wrapper.dataset.objectId = id(obj.id);
      wrapper.addEventListener("dragstart", event => { event.dataTransfer?.setData("text/plain", id(obj.id)); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; });
      const favorite = mk("button", "hydria-explorer-favorite" + (view.metadata.favorites.includes(id(obj.id)) ? " is-active" : ""), view.metadata.favorites.includes(id(obj.id)) ? "★" : "☆");
      favorite.type = "button"; favorite.title = "Toggle favorite"; favorite.setAttribute("aria-label", "Toggle favorite " + (obj.title || ""));
      favorite.addEventListener("click", () => {
        const key = id(obj.id);const list = view.metadata.favorites;
        view.metadata.favorites = list.includes(key) ? list.filter(x => x !== key) : [...list, key];
        save(view.userId, view.metadata); drawFolders(); drawItems();
      });
      const folder = mk("select", "hydria-explorer-move");
      folder.setAttribute("aria-label", "Organize " + (obj.title || "file"));
      [["__all", "No folder"], ...view.metadata.folders.map(name => [name, name])].forEach(([value, label]) => {
        const option = mk("option", "", label); option.value = value; folder.appendChild(option);
      });
      folder.value = view.metadata.placements[id(obj.id)] || "__all";
      folder.addEventListener("change", () => moveObject(obj.id, folder.value));
      const controls = mk("div", "hydria-explorer-entry-tools");
      controls.append(favorite, folder);
      card.replaceWith(wrapper);
      wrapper.append(card, controls);
    });
    if (view.workObjects.length && !objects.length) view.items.replaceChildren(mk("p", "hydria-explorer-empty", "No objects match the current filter."));
  }
  drawFolders();
  drawItems();
}
