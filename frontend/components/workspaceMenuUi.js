import { getWorkspaceCommandIcon } from "./workspaceCommandRegistry.js";
import { getWorkspaceMenuSubItems, normalizeWorkspaceMenuItems } from "./workspaceMenuDefinitions.js";

export const WORKSPACE_ICON_SVG = {
  alignBottom: '<path d="M5 19h14"/><path d="M8 5h8v10H8z"/>',
  alignCenter: '<path d="M4 7h16"/><path d="M7 12h10"/><path d="M4 17h16"/>',
  alignJustify: '<path d="M4 6h16"/><path d="M4 11h16"/><path d="M4 16h16"/><path d="M4 21h16"/>',
  alignLeft: '<path d="M4 6h16"/><path d="M4 11h10"/><path d="M4 16h16"/><path d="M4 21h10"/>',
  alignMiddle: '<path d="M4 12h16"/><path d="M8 5h8v14H8z"/>',
  alignRight: '<path d="M4 6h16"/><path d="M10 11h10"/><path d="M4 16h16"/><path d="M10 21h10"/>',
  alignTop: '<path d="M5 5h14"/><path d="M8 9h8v10H8z"/>',
  areaChart: '<path d="M4 18l5-7 4 3 4-8 3 12H4z"/><path d="M4 20h16"/>',
  axes: '<path d="M5 4v15h15"/><path d="M5 14h15"/><path d="M10 19v-3"/><path d="M15 19v-6"/><path d="M20 19v-10"/>',
  barChart: '<path d="M4 19h16"/><path d="M6 16h3"/><path d="M6 11h8"/><path d="M6 6h12"/>',
  bold: '<path d="M7 5h6a3 3 0 0 1 0 6H7z"/><path d="M7 11h7a4 4 0 0 1 0 8H7z"/>',
  border: '<rect x="5" y="5" width="14" height="14"/><path d="M5 12h14"/><path d="M12 5v14"/>',
  calendar: '<path d="M7 3v4"/><path d="M17 3v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/>',
  chart: '<path d="M4 19h16"/><rect x="6" y="10" width="3" height="7"/><rect x="11" y="5" width="3" height="12"/><rect x="16" y="8" width="3" height="9"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 6-7"/>',
  chevronDown: '<path d="M7 10l5 5 5-5"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronUp: '<path d="M7 14l5-5 5 5"/>',
  clean: '<path d="M4 20h16"/><path d="M8 17l8-8"/><path d="M10 5l9 9"/><path d="M5 16l3 3"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  columnInsert: '<path d="M7 4v16"/><path d="M17 4v16"/><path d="M10 12h4"/><path d="M12 10v4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/>',
  csv: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 15h8"/><path d="M8 18h5"/>',
  currency: '<path d="M17 5.5A6.5 6.5 0 1 0 17 18.5"/><path d="M5 10h9"/><path d="M5 14h9"/>',
  cut: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 8l12 12"/><path d="M8 16L20 4"/>',
  delete: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M8 7l1 13h6l1-13"/>',
  divider: '<path d="M4 12h16"/>',
  docx: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 12h8"/><path d="M8 16h8"/><path d="M8 19h5"/>',
  duplicate: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
  eraser: '<path d="M4 16l8-8 6 6-5 5H7z"/><path d="M12 19h8"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.5 5.3A9.8 9.8 0 0 1 12 5c5 0 8 4 9 7a12 12 0 0 1-2.4 3.7"/><path d="M6.1 6.8A12 12 0 0 0 3 12c1 3 4 7 9 7a9.8 9.8 0 0 0 3.5-.6"/>',
  fileSpreadsheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 12h9"/><path d="M8 16h9"/><path d="M11 9v10"/>',
  fill: '<path d="M4 14l7-7 7 7-5 5H9z"/><path d="M14 19h6"/><path d="M16 14l3 3 2-2"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  filterClear: '<path d="M4 5h13l-5 6v5l-3 2v-7z"/><path d="M16 14l5 5"/><path d="M21 14l-5 5"/>',
  freeze: '<path d="M5 5h14v14H5z"/><path d="M5 10h14"/><path d="M10 5v14"/>',
  function: '<path d="M8 19c2-6 3-10 4-14"/><path d="M5 9h8"/><path d="M14 13l5 5"/><path d="M19 13l-5 5"/>',
  grid: '<rect x="4" y="4" width="16" height="16"/><path d="M4 10h16"/><path d="M4 16h16"/><path d="M10 4v16"/><path d="M16 4v16"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 18l5-5 3 3 2-2 4 4"/>',
  insert: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  italic: '<path d="M10 5h8"/><path d="M6 19h8"/><path d="M14 5l-4 14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 1 0 7.1 7.1l1.1-1.1"/>',
  lineChart: '<path d="M4 18l5-6 4 3 6-8"/><path d="M4 20h16"/>',
  list: '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  merge: '<rect x="4" y="7" width="16" height="10" rx="1"/><path d="M9 7v10"/><path d="M15 7v10"/><path d="M8 12h8"/><path d="M13 9l3 3-3 3"/><path d="M11 9l-3 3 3 3"/>',
  move: '<path d="M12 3v18"/><path d="M3 12h18"/><path d="M8 7l4-4 4 4"/><path d="M8 17l4 4 4-4"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/>',
  note: '<path d="M5 4h14v12l-5 5H5z"/><path d="M14 16v5"/><path d="M14 16h5"/>',
  number: '<path d="M8 4L6 20"/><path d="M16 4l-2 16"/><path d="M4 9h16"/><path d="M3 15h16"/>',
  page: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/>',
  palette: '<path d="M12 4a8 8 0 0 0 0 16h1.5a1.8 1.8 0 0 0 .5-3.5 1.7 1.7 0 0 1 .5-3.3H16a4 4 0 0 0 0-8.1A9.8 9.8 0 0 0 12 4z"/><circle cx="8.5" cy="10" r=".8"/><circle cx="11" cy="7.8" r=".8"/><circle cx="14" cy="8.5" r=".8"/>',
  paste: '<path d="M8 4h8v4H8z"/><path d="M6 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 16h3"/><path d="M8 13h8"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
  pieChart: '<path d="M11 3v9h9a9 9 0 1 1-9-9z"/><path d="M13 3.2A9 9 0 0 1 20.8 10H13z"/>',
  pivot: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/><path d="M10 5v14"/><path d="M14 14h4"/><path d="M16 12v4"/><path d="M6 7.5h2"/><path d="M12 7.5h6"/>',
  print: '<path d="M7 8V4h10v4"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>',
  quote: '<path d="M9 7H5v6h4v4H3v-4a6 6 0 0 1 6-6z"/><path d="M21 7h-4v6h4v4h-6v-4a6 6 0 0 1 6-6z"/>',
  redo: '<path d="M15 7h5v5"/><path d="M20 7c-2.8-2.8-7.2-3-10.2-.4-3.1 2.7-3.2 7.4-.3 10.2 2.1 2.1 5.2 2.7 7.8 1.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/>',
  rename: '<path d="M4 20h16"/><path d="M13 5l6 6-8 8H5v-6z"/><path d="M16 8l-8 8"/>',
  rowInsert: '<path d="M4 7h16"/><path d="M4 17h16"/><path d="M12 10v4"/><path d="M10 12h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l4 4"/>',
  shape: '<rect x="4" y="9" width="8" height="8" rx="1"/><circle cx="16" cy="9" r="4"/><path d="M15 14l5 6h-10z"/>',
  sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/><path d="M8 12h8"/><path d="M8 16h8"/>',
  slicer: '<path d="M4 5h16"/><path d="M7 10h10"/><path d="M9 15h6"/><path d="M11 20h2"/>',
  sort: '<path d="M8 5v14"/><path d="M5 8l3-3 3 3"/><path d="M16 19V5"/><path d="M13 16l3 3 3-3"/>',
  sortAsc: '<path d="M8 5v14"/><path d="M5 8l3-3 3 3"/><path d="M14 7h6"/><path d="M14 12h4"/><path d="M14 17h2"/>',
  sortDesc: '<path d="M8 19V5"/><path d="M5 16l3 3 3-3"/><path d="M14 7h2"/><path d="M14 12h4"/><path d="M14 17h6"/>',
  sparkline: '<path d="M4 17l4-5 3 3 5-8 4 6"/><path d="M4 20h16"/>',
  split: '<path d="M4 6h16"/><path d="M4 12h7"/><path d="M4 18h16"/><path d="M15 9l3 3-3 3"/>',
  strikethrough: '<path d="M5 12h14"/><path d="M8 6h8"/><path d="M9 18h6"/><path d="M10 6c4 0 6 2 6 4"/><path d="M14 12c2 .5 3 1.5 3 3 0 2-2 3-5 3-2 0-4-.5-5-1.5"/>',
  table: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/><path d="M9 5v14"/><path d="M15 5v14"/>',
  text: '<path d="M4 6h16"/><path d="M12 6v14"/><path d="M8 20h8"/>',
  textColor: '<path d="M6 19h12"/><path d="M9 15l3-10 3 10"/><path d="M10 12h4"/>',
  transpose: '<path d="M5 5h7v7H5z"/><path d="M12 12h7v7h-7z"/><path d="M15 5h4v4"/><path d="M19 5l-6 6"/><path d="M9 19H5v-4"/><path d="M5 19l6-6"/>',
  underline: '<path d="M7 5v6a5 5 0 0 0 10 0V5"/><path d="M5 21h14"/>',
  undo: '<path d="M9 7H4v5"/><path d="M4 7c2.8-2.8 7.2-3 10.2-.4 3.1 2.7 3.2 7.4.3 10.2-2.1 2.1-5.2 2.7-7.8 1.5"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l4 4"/><path d="M10.5 7v7"/><path d="M7 10.5h7"/>'
};

export function createWorkspaceIconNode(iconName = "", { className = "workspace-command-icon", label = "" } = {}) {
  const key = WORKSPACE_ICON_SVG[iconName] ? iconName : getWorkspaceCommandIcon(iconName || label);
  const icon = document.createElement("span");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  if (!WORKSPACE_ICON_SVG[key]) {
    icon.textContent = String(label || iconName || "").slice(0, 2).toUpperCase();
    icon.classList.add("is-text-icon");
    return icon;
  }
  icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${WORKSPACE_ICON_SVG[key]}</svg>`;
  return icon;
}

export function placeWorkspaceFloatingPanel(
  panel,
  {
    anchorElement = null,
    clientX = null,
    clientY = null,
    minWidth = 190,
    fallbackWidth = 220,
    minHeight = 120,
    fallbackHeight = 240,
    margin = 8,
    offsetY = 4,
    minMaxHeight = 120
  } = {}
) {
  if (!panel) {
    return { left: margin, top: margin, maxHeight: minMaxHeight, width: minWidth, height: minHeight };
  }
  const panelWidth = Math.max(minWidth, panel.offsetWidth || fallbackWidth);
  const panelHeight = Math.max(minHeight, panel.offsetHeight || fallbackHeight);
  const hasCursorPosition = Number.isFinite(clientX) && Number.isFinite(clientY);
  const anchorRect = anchorElement?.getBoundingClientRect?.() || null;
  const preferredLeft = hasCursorPosition ? clientX : anchorRect?.left ?? margin;
  const preferredTop = hasCursorPosition ? clientY : (anchorRect?.bottom ?? margin) + offsetY;
  const left = Math.max(margin, Math.min(preferredLeft, window.innerWidth - panelWidth - margin));
  const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - panelHeight - margin));
  const maxHeight = Math.max(minMaxHeight, window.innerHeight - top - margin);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.maxHeight = `${maxHeight}px`;
  return { left, top, maxHeight, width: panelWidth, height: panelHeight };
}

export function installWorkspaceMenuEventBlockers(
  element,
  { events = ["mousedown", "pointerdown", "click", "contextmenu"], preventContextMenu = true } = {}
) {
  if (!element) {
    return;
  }
  events.forEach((eventName) => {
    element.addEventListener(eventName, (event) => {
      event.stopPropagation();
      if (preventContextMenu && eventName === "contextmenu") {
        event.preventDefault();
      }
    });
  });
}

export function createWorkspaceMenuOutsideController({
  isOpen = () => false,
  onClose = null,
  shouldKeepOpen = null,
  pointerEvents = ["pointerdown", "mousedown"],
  closeOnContextMenu = true,
  closeOnEscape = true,
  closeOnViewportChange = false
} = {}) {
  let pointerHandler = null;
  let keydownHandler = null;
  let viewportHandler = null;

  const remove = () => {
    if (pointerHandler) {
      pointerEvents.forEach((eventName) => {
        document.removeEventListener(eventName, pointerHandler, true);
      });
      if (closeOnContextMenu) {
        document.removeEventListener("contextmenu", pointerHandler, true);
      }
      pointerHandler = null;
    }
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    if (viewportHandler) {
      window.removeEventListener("scroll", viewportHandler, true);
      window.removeEventListener("resize", viewportHandler);
      viewportHandler = null;
    }
  };

  const install = () => {
    remove();
    pointerHandler = (event) => {
      if (!isOpen()) {
        return;
      }
      if (typeof shouldKeepOpen === "function" && shouldKeepOpen(event)) {
        return;
      }
      onClose?.(event);
    };
    pointerEvents.forEach((eventName) => {
      document.addEventListener(eventName, pointerHandler, true);
    });
    if (closeOnContextMenu) {
      document.addEventListener("contextmenu", pointerHandler, true);
    }
    if (closeOnEscape) {
      keydownHandler = (event) => {
        if (event.key === "Escape" && isOpen()) {
          onClose?.(event);
        }
      };
      document.addEventListener("keydown", keydownHandler);
    }
    if (closeOnViewportChange) {
      viewportHandler = (event) => {
        if (!isOpen()) {
          return;
        }
        if (typeof shouldKeepOpen === "function" && shouldKeepOpen(event)) {
          return;
        }
        onClose?.(event);
      };
      window.addEventListener("scroll", viewportHandler, true);
      window.addEventListener("resize", viewportHandler);
    }
  };

  return { install, remove };
}

export function renderWorkspaceFlatMenuItems(
  items = [],
  host = null,
  {
    headingClassName = "workspace-menu-heading",
    separatorClassName = "workspace-menu-separator",
    actionOptions = {},
    renderCustomItem = null,
    onActionSelect = null
  } = {}
) {
  if (!host) {
    return;
  }
  normalizeWorkspaceMenuItems(items).forEach((item) => {
    if (typeof renderCustomItem === "function" && renderCustomItem(item, host)) {
      return;
    }
    if (item.heading) {
      const heading = document.createElement("div");
      heading.className = headingClassName;
      heading.textContent = item.label || "";
      host.appendChild(heading);
      return;
    }
    if (item.separator) {
      const separator = document.createElement("div");
      separator.className = separatorClassName;
      separator.setAttribute("role", "separator");
      host.appendChild(separator);
      return;
    }
    const submenuItems = getWorkspaceMenuSubItems(item);
    const itemActionOptions = typeof actionOptions === "function" ? actionOptions(item) : actionOptions;
    const button = createWorkspaceMenuActionButton(item, {
      ...itemActionOptions,
      hasSubmenu: submenuItems.length > 0,
      onClick: (event, menuItem, buttonNode) => {
        if (buttonNode.disabled) {
          return;
        }
        if (typeof itemActionOptions.onClick === "function") {
          itemActionOptions.onClick(event, menuItem, buttonNode);
          return;
        }
        if (typeof onActionSelect === "function") {
          onActionSelect(menuItem, event, buttonNode);
          return;
        }
        menuItem.onSelect?.();
      }
    });
    host.appendChild(button);
  });
}

function getDirectChildByClassName(host, className) {
  return Array.from(host?.children || []).find((child) => child.classList?.contains(className)) || null;
}

export function createWorkspaceNestedMenuController({
  root = null,
  rootOpenLeftClassName = "opens-left",
  submenuClassName = "workspace-context-submenu",
  itemOpenClassName = "is-open",
  removeRootOnClose = false,
  margin = 8,
  submenuGap = 6,
  minSubmenuWidth = 268,
  minSubmenuHeight = 120,
  rootFallbackWidth = 280,
  rootFallbackHeight = 360,
  submenuZIndexBase = 1900,
  leftLookaheadWidth = 540,
  onClose = null
} = {}) {
  const isOpen = () => Boolean(root && !root.hidden && root.isConnected);
  const outsideController = createWorkspaceMenuOutsideController({
    isOpen,
    closeOnViewportChange: true,
    shouldKeepOpen: (event) => Boolean(root?.contains?.(event.target)),
    onClose: () => {
      close();
    }
  });

  const close = () => {
    outsideController.remove();
    if (!root) {
      return;
    }
    root.hidden = true;
    root.innerHTML = "";
    root.classList.remove(rootOpenLeftClassName);
    root.style.left = "";
    root.style.top = "";
    root.style.maxHeight = "";
    if (removeRootOnClose && root.isConnected) {
      root.remove();
    }
    onClose?.();
  };

  const placeRoot = (clientX = 0, clientY = 0) => {
    if (!root) {
      return { left: margin, top: margin };
    }
    let left = Math.max(margin, clientX);
    let top = Math.max(margin, clientY);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.classList.remove(rootOpenLeftClassName);

    const width = root.offsetWidth || rootFallbackWidth;
    const height = root.offsetHeight || rootFallbackHeight;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (top + height > window.innerHeight - margin) {
      top = window.innerHeight - height - margin;
    }
    left = Math.max(margin, left);
    top = Math.max(margin, top);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.maxHeight = `${Math.max(minSubmenuHeight, Math.floor(window.innerHeight - top - margin))}px`;

    const rect = root.getBoundingClientRect();
    root.classList.toggle(
      rootOpenLeftClassName,
      rect.right + leftLookaheadWidth > window.innerWidth - margin && rect.left > leftLookaheadWidth
    );
    return { left, top };
  };

  const closeSiblingSubmenus = (host = root, activeRow = null) => {
    Array.from(host?.children || []).forEach((child) => {
      if (child !== activeRow) {
        child.classList?.remove(itemOpenClassName);
      }
    });
  };

  const placeSubmenu = (row = null) => {
    if (!row?.classList?.contains(itemOpenClassName)) {
      return;
    }
    const submenu = getDirectChildByClassName(row, submenuClassName);
    if (!submenu) {
      return;
    }

    submenu.style.left = "";
    submenu.style.right = "auto";
    submenu.style.top = "";
    submenu.style.maxHeight = `${Math.max(minSubmenuHeight, window.innerHeight - (margin * 2))}px`;

    const rowRect = row.getBoundingClientRect();
    const hostRect = (row.parentElement || root).getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const availableHeight = Math.max(minSubmenuHeight, window.innerHeight - margin * 2);
    const submenuHeight = Math.min(submenu.scrollHeight || submenuRect.height || availableHeight, availableHeight);
    const submenuWidth = Math.min(
      Math.max(submenu.scrollWidth || 0, submenu.offsetWidth || 0, submenuRect.width || 0, minSubmenuWidth),
      window.innerWidth - margin * 2
    );

    const rootPrefersLeft = Boolean(root?.classList?.contains(rootOpenLeftClassName));
    const canOpenRight = hostRect.right + submenuWidth + submenuGap <= window.innerWidth - margin;
    const canOpenLeft = hostRect.left - submenuWidth - submenuGap >= margin;
    const opensLeft = rootPrefersLeft ? canOpenLeft || !canOpenRight : !canOpenRight && canOpenLeft;
    const preferredLeft = opensLeft
      ? hostRect.left - submenuWidth - submenuGap
      : hostRect.right + submenuGap;
    const viewportLeft = Math.max(margin, Math.min(preferredLeft, window.innerWidth - submenuWidth - margin));
    const viewportTop = Math.max(
      margin,
      Math.min(rowRect.top - 7, window.innerHeight - submenuHeight - margin)
    );
    let depth = 1;
    for (let parent = row.parentElement; parent && parent !== root; parent = parent.parentElement) {
      if (parent.classList?.contains(submenuClassName)) {
        depth += 1;
      }
    }

    submenu.style.left = `${Math.round(viewportLeft)}px`;
    submenu.style.top = `${Math.round(viewportTop)}px`;
    submenu.style.maxHeight = `${Math.max(minSubmenuHeight, Math.floor(window.innerHeight - viewportTop - margin))}px`;
    submenu.style.zIndex = String(submenuZIndexBase + depth);
  };

  const openSubmenu = (row = null, host = root) => {
    closeSiblingSubmenus(host, row);
    row?.classList.add(itemOpenClassName);
    window.requestAnimationFrame(() => placeSubmenu(row));
  };

  const open = ({ clientX = 0, clientY = 0, appendTo = document.body } = {}) => {
    if (!root) {
      return false;
    }
    if (!root.isConnected) {
      appendTo.appendChild(root);
    }
    root.hidden = false;
    placeRoot(clientX, clientY);
    window.setTimeout(outsideController.install, 0);
    return true;
  };

  return {
    close,
    closeSiblingSubmenus,
    installOutsideListeners: outsideController.install,
    isOpen,
    open,
    openSubmenu,
    placeRoot,
    placeSubmenu,
    removeOutsideListeners: outsideController.remove
  };
}

export function renderWorkspaceNestedMenuItems(
  items = [],
  host = null,
  {
    itemClassName = "workspace-context-item",
    itemDisabledClassName = "is-disabled",
    itemOpenClassName = "is-open",
    separatorClassName = "workspace-context-separator",
    headingClassName = "workspace-context-heading",
    submenuClassName = "workspace-context-submenu",
    actionOptions = {},
    renderCustomItem = null,
    closeMenu = null,
    openSubmenu = null,
    closeSiblingSubmenus = null,
    onActionSelect = null
  } = {}
) {
  if (!host) {
    return;
  }
  normalizeWorkspaceMenuItems(items).forEach((item) => {
    if (typeof renderCustomItem === "function" && renderCustomItem(item, host)) {
      return;
    }
    if (item.heading) {
      const heading = document.createElement("div");
      heading.className = headingClassName;
      heading.textContent = item.label || "";
      host.appendChild(heading);
      return;
    }
    if (item.separator) {
      const separator = document.createElement("div");
      separator.className = separatorClassName;
      separator.setAttribute("role", "separator");
      host.appendChild(separator);
      return;
    }

    const submenuItems = getWorkspaceMenuSubItems(item);
    const hasSubmenu = submenuItems.length > 0;
    const row = document.createElement("div");
    row.className = itemClassName;
    row.classList.toggle(itemDisabledClassName, Boolean(item.disabled));
    row.addEventListener("mouseenter", () => {
      if (hasSubmenu && !item.disabled) {
        openSubmenu?.(row, host);
      } else {
        closeSiblingSubmenus?.(host, row);
      }
    });

    const itemActionOptions =
      typeof actionOptions === "function" ? actionOptions(item, row, host) : actionOptions;
    const button = createWorkspaceMenuActionButton(item, {
      ...itemActionOptions,
      hasSubmenu,
      onClick: (event, menuItem, buttonNode) => {
        event.preventDefault();
        event.stopPropagation();
        if (buttonNode.disabled) {
          return;
        }
        if (hasSubmenu) {
          if (row.classList.contains(itemOpenClassName)) {
            row.classList.remove(itemOpenClassName);
          } else {
            openSubmenu?.(row, host);
          }
          return;
        }
        closeMenu?.();
        if (typeof onActionSelect === "function") {
          onActionSelect(menuItem, event, buttonNode);
          return;
        }
        menuItem.onSelect?.();
      }
    });

    row.appendChild(button);
    if (hasSubmenu) {
      const submenu = document.createElement("div");
      submenu.className = submenuClassName;
      submenu.setAttribute("role", "menu");
      renderWorkspaceNestedMenuItems(submenuItems, submenu, {
        itemClassName,
        itemDisabledClassName,
        itemOpenClassName,
        separatorClassName,
        headingClassName,
        submenuClassName,
        actionOptions,
        renderCustomItem,
        closeMenu,
        openSubmenu,
        closeSiblingSubmenus,
        onActionSelect
      });
      row.appendChild(submenu);
    }
    host.appendChild(row);
  });
}

export function createWorkspaceContextMenu({
  root = null,
  controllerOptions = {},
  renderOptions = {},
  appendTo = null,
  beforeRender = null,
  afterRender = null
} = {}) {
  const controller = createWorkspaceNestedMenuController({
    root,
    ...controllerOptions
  });

  const render = (items = [], host = root) => {
    renderWorkspaceNestedMenuItems(items, host, {
      ...renderOptions,
      closeMenu: controller.close,
      openSubmenu: controller.openSubmenu,
      closeSiblingSubmenus: controller.closeSiblingSubmenus
    });
  };

  const open = (items = [], { clientX = 0, clientY = 0, appendTo: targetHost = appendTo } = {}) => {
    if (!root) {
      return false;
    }
    root.innerHTML = "";
    beforeRender?.(items, root);
    render(items, root);
    afterRender?.(root);
    return controller.open({ clientX, clientY, appendTo: targetHost || document.body });
  };

  return {
    close: controller.close,
    controller,
    isOpen: controller.isOpen,
    open,
    render
  };
}

export function closeWorkspaceDropdown(dropdown = null, toggle = null, { hiddenClassName = "hidden" } = {}) {
  dropdown?.classList?.add(hiddenClassName);
  toggle?.setAttribute?.("aria-expanded", "false");
}

export function closeWorkspaceDropdownRegistry(registry = [], activeDropdown = null) {
  registry.forEach((entry) => {
    if (entry?.dropdown !== activeDropdown) {
      entry?.close?.();
    }
  });
}

export function toggleWorkspaceDropdown(
  dropdown = null,
  toggle = null,
  registry = [],
  { hiddenClassName = "hidden", onBeforeOpen = null } = {}
) {
  if (!dropdown) {
    return false;
  }
  const willOpen = dropdown.classList.contains(hiddenClassName);
  closeWorkspaceDropdownRegistry(registry, dropdown);
  if (willOpen && typeof onBeforeOpen === "function") {
    onBeforeOpen(dropdown, toggle);
  }
  dropdown.classList.toggle(hiddenClassName, !willOpen);
  toggle?.setAttribute?.("aria-expanded", willOpen ? "true" : "false");
  return willOpen;
}

export function createWorkspaceMenuActionButton(
  item = {},
  {
    actionClassName = "workspace-menu-action",
    iconClassName = "",
    labelClassName = "",
    metaClassName = "",
    emptyIconClassName = "is-empty",
    role = "",
    hasSubmenu = false,
    createIconNode = null,
    resolveIconName = null,
    chevronIconName = "chevronRight",
    chevronClassName = "",
    chevronLabel = "Open submenu",
    onClick = null
  } = {}
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = actionClassName;
  button.disabled = Boolean(item.disabled);
  if (role) {
    button.setAttribute("role", role);
  }
  if (hasSubmenu) {
    button.setAttribute("aria-haspopup", "menu");
  }

  if (iconClassName) {
    const resolvedIconName = item.checked
      ? "check"
      : item.icon === null
        ? ""
        : item.icon || resolveIconName?.(item.commandId || item.label) || "";
    const iconNode = resolvedIconName && typeof createIconNode === "function"
      ? createIconNode(resolvedIconName, { className: iconClassName, label: item.label })
      : document.createElement("span");
    if (!resolvedIconName) {
      iconNode.className = `${iconClassName} ${emptyIconClassName}`.trim();
      iconNode.setAttribute("aria-hidden", "true");
    }
    button.appendChild(iconNode);
  }

  const label = document.createElement("span");
  label.className = labelClassName;
  label.textContent = item.label || "";
  button.appendChild(label);

  if (metaClassName) {
    const meta = document.createElement("span");
    meta.className = metaClassName;
    if (hasSubmenu && typeof createIconNode === "function") {
      meta.appendChild(
        createIconNode(chevronIconName, {
          className: chevronClassName,
          label: chevronLabel
        })
      );
    } else if (item.shortcut) {
      meta.textContent = item.shortcut;
    }
    button.appendChild(meta);
  }

  if (typeof onClick === "function") {
    button.addEventListener("click", (event) => onClick(event, item, button));
  }
  return button;
}

export function createWorkspaceColorSwatchButton(
  colorItem = "",
  {
    className = "workspace-color-swatch",
    title = "",
    ariaLabel = "",
    emptyClassName = "is-clear",
    onPointerDown = null,
    onSelect = null
  } = {}
) {
  const item = typeof colorItem === "string"
    ? { label: colorItem, value: colorItem, sample: colorItem }
    : { ...(colorItem || {}) };
  const colorValue = String(item.value || "");
  const sample = item.sample || colorValue;
  const buttonLabel = title || item.label || colorValue || "No color";
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = buttonLabel;
  button.setAttribute("aria-label", ariaLabel || buttonLabel);
  if (sample) {
    button.style.background = sample;
  }
  if (item.outline) {
    button.style.borderColor = item.outline;
  }
  if (!colorValue && emptyClassName) {
    button.classList.add(emptyClassName);
  }
  if (typeof onPointerDown === "function") {
    button.addEventListener("pointerdown", (event) => onPointerDown(event, item, button));
  }
  if (typeof onSelect === "function") {
    button.addEventListener("click", (event) => onSelect(item, button, event));
  }
  return button;
}

export function createWorkspacePaletteActionButton(
  {
    label = "",
    icon = "",
    className = "workspace-palette-action",
    iconClassName = "",
    labelClassName = "",
    onPointerDown = null,
    onSelect = null
  } = {}
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const iconNode = document.createElement("span");
  iconNode.className = iconClassName;
  iconNode.textContent = icon;
  const labelNode = document.createElement("span");
  if (labelClassName) {
    labelNode.className = labelClassName;
  }
  labelNode.textContent = label;
  button.append(iconNode, labelNode);
  if (typeof onPointerDown === "function") {
    button.addEventListener("pointerdown", (event) => onPointerDown(event, button));
  }
  if (typeof onSelect === "function") {
    button.addEventListener("click", (event) => onSelect(event, button));
  }
  return button;
}

export function createWorkspaceSelectElement(
  {
    className = "",
    title = "",
    options = [],
    value = "",
    dataset = {},
    onChange = null
  } = {}
) {
  const select = document.createElement("select");
  if (className) {
    select.className = className;
  }
  if (title) {
    select.title = title;
  }
  Object.entries(dataset || {}).forEach(([key, entryValue]) => {
    if (entryValue !== undefined && entryValue !== null && entryValue !== "") {
      select.dataset[key] = String(entryValue);
    }
  });
  options.forEach((option) => {
    const entry = document.createElement("option");
    entry.value = option.value;
    entry.textContent = option.label;
    select.appendChild(entry);
  });
  if (value && !Array.from(select.options).some((option) => option.value === value)) {
    const entry = document.createElement("option");
    entry.value = value;
    entry.textContent = value;
    select.appendChild(entry);
  }
  select.value = value;
  if (typeof onChange === "function") {
    select.addEventListener("change", () => onChange(select.value, select));
  }
  return select;
}
