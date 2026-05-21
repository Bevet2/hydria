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
