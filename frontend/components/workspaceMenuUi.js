import { getWorkspaceMenuSubItems, normalizeWorkspaceMenuItems } from "./workspaceMenuDefinitions.js";

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

    const button = createWorkspaceMenuActionButton(item, {
      ...actionOptions,
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
        : item.icon || resolveIconName?.(item.label) || "";
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
