import {
  WORKSPACE_HORIZONTAL_ALIGNMENT_OPTIONS,
  getWorkspaceCommandIcon,
  getWorkspaceCommandLabel,
  getWorkspaceCommand
} from "./workspaceCommandRegistry.js";
import { WORKSPACE_BORDER_COLOR_OPTIONS } from "./workspaceColorPalette.js";

export const WORKSPACE_BORDER_BASE_MENU_ITEMS = [
  { label: "Aucune bordure", icon: "eraser", commandId: "border", value: "clear" },
  { label: "Toutes les bordures", icon: "border", commandId: "border", value: "all" },
  { label: "Bordures exterieures", icon: "border", commandId: "border", value: "outer" },
  { label: "Bordures interieures", icon: "border", commandId: "border", value: "inside" },
  { separator: true },
  { label: "Bordure superieure", icon: "border", commandId: "border", value: "top" },
  { label: "Bordure inferieure", icon: "border", commandId: "border", value: "bottom" },
  { label: "Bordure gauche", icon: "border", commandId: "border", value: "left" },
  { label: "Bordure droite", icon: "border", commandId: "border", value: "right" },
  { label: "Bordures horizontales interieures", icon: "border", commandId: "border", value: "insideHorizontal" },
  { label: "Bordures verticales interieures", icon: "border", commandId: "border", value: "insideVertical" },
  { separator: true },
  { label: "Bordure exterieure epaisse", icon: "border", commandId: "border", value: "outer", options: { style: "thick" } },
  { label: "Bordure inferieure double", icon: "border", commandId: "border", value: "bottom", options: { style: "double" } }
];

export function getWorkspaceMenuSubItems(item = {}) {
  return Array.isArray(item.items) ? item.items : Array.isArray(item.submenu) ? item.submenu : [];
}

export function normalizeWorkspaceMenuItems(items = []) {
  const normalized = [];
  items.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.separator) {
      if (normalized.length && !normalized[normalized.length - 1].separator) {
        normalized.push({ separator: true });
      }
      return;
    }
    const submenuItems = normalizeWorkspaceMenuItems(getWorkspaceMenuSubItems(item));
    normalized.push(submenuItems.length ? { ...item, items: submenuItems } : { ...item });
  });
  while (normalized.length && normalized[normalized.length - 1].separator) {
    normalized.pop();
  }
  return normalized;
}

export function bindWorkspaceMenuActions(items = [], actionMap = {}) {
  return normalizeWorkspaceMenuItems(items).map((item) => {
    if (item.separator || item.heading || item.palette) {
      return { ...item };
    }
    const submenuItems = getWorkspaceMenuSubItems(item);
    const action = item.commandId ? actionMap[item.commandId] : null;
    const boundItem = {
      ...item,
      ...(typeof action === "function" ? { onSelect: () => action(item) } : {})
    };
    if (submenuItems.length) {
      boundItem.items = bindWorkspaceMenuActions(submenuItems, actionMap);
    }
    return boundItem;
  });
}

export function createWorkspaceCommandMenuItems(commandIds = [], { locale = "en" } = {}) {
  return commandIds.map((commandId) => {
    const command = getWorkspaceCommand(commandId);
    return {
      label: getWorkspaceCommandLabel(commandId, locale),
      icon: command?.icon || getWorkspaceCommandIcon(commandId),
      shortcut: command?.shortcut || "",
      commandId
    };
  });
}

export function createWorkspaceClipboardMenuItems({ locale = "en" } = {}) {
  return createWorkspaceCommandMenuItems(["cut", "copy", "paste"], { locale });
}

export function createWorkspaceAlignmentMenuItems(options = WORKSPACE_HORIZONTAL_ALIGNMENT_OPTIONS) {
  return options.map((option) => ({
    label: option.label,
    icon: option.icon,
    commandId: option.commandId
  }));
}

export function createWorkspaceNumberFormatMenuItems({ locale = "en", clearLabel = "Clear number format" } = {}) {
  return [
    ...createWorkspaceCommandMenuItems(["number", "currency", "percent", "date"], { locale }),
    { separator: true },
    { label: clearLabel, icon: "eraser", commandId: "clearNumberFormat" }
  ];
}

export function createWorkspaceBorderColorMenuItems(colors = WORKSPACE_BORDER_COLOR_OPTIONS) {
  return colors.map((color) => ({
    label: color.label,
    icon: "border",
    commandId: "borderColor",
    value: color.value
  }));
}

export function createWorkspaceBorderStyleMenuItems(styleLabels = {}) {
  return Object.entries(styleLabels).map(([value, label]) => ({
    label,
    icon: "border",
    commandId: "borderStyle",
    value
  }));
}

export function createWorkspaceBorderMenuItems({
  includeColorItems = false,
  includeColorSubmenu = false,
  includeStyleItems = false,
  includeStyleSubmenu = false,
  styleLabels = {},
  colorLabel = "Couleur de bordure",
  styleLabel = "Style de bordure"
} = {}) {
  const items = WORKSPACE_BORDER_BASE_MENU_ITEMS.map((item) => ({
    ...item,
    ...(item.options ? { options: { ...item.options } } : {})
  }));
  const styleItems = createWorkspaceBorderStyleMenuItems(styleLabels);

  if (includeColorItems) {
    items.push({ separator: true }, ...createWorkspaceBorderColorMenuItems());
  }
  if (includeStyleItems && styleItems.length) {
    items.push({ separator: true }, ...styleItems);
  }
  if (includeColorSubmenu || includeStyleSubmenu) {
    items.push({ separator: true });
    if (includeColorSubmenu) {
      items.push({ label: colorLabel, icon: "palette", items: [{ palette: "border" }] });
    }
    if (includeStyleSubmenu && styleItems.length) {
      items.push({ label: styleLabel, icon: "border", items: styleItems });
    }
  }

  return normalizeWorkspaceMenuItems(items);
}

export function createWorkspaceConditionalFormatMenuItems() {
  return [
    { label: "Nouvelle regle...", icon: "palette", commandId: "conditionalNew" },
    { separator: true },
    { label: "Superieur a...", icon: "sortAsc", commandId: "conditionalPreset", value: "greaterThan", options: { preset: "red" } },
    { label: "Inferieur a...", icon: "sortDesc", commandId: "conditionalPreset", value: "lessThan", options: { preset: "red" } },
    { label: "Entre...", icon: "number", commandId: "conditionalPreset", value: "between", options: { preset: "yellow" } },
    { label: "Egal a...", icon: "checkbox", commandId: "conditionalPreset", value: "equal", options: { preset: "green" } },
    { label: "Texte qui contient...", icon: "text", commandId: "conditionalPreset", value: "textContains", options: { preset: "yellow" } },
    { label: "Valeurs en double", icon: "duplicate", commandId: "conditionalPreset", value: "duplicate", options: { preset: "red" } },
    { separator: true },
    { label: "Effacer les regles de la selection", icon: "eraser", commandId: "conditionalClearSelection" },
    { label: "Gerer les regles", icon: "palette", commandId: "conditionalManage" }
  ];
}

export function createWorkspaceHomeCellsMenuItems({ clearContentsLabel = "Clear contents", clearFormatLabel = "" } = {}) {
  return [
    { label: "Row above", icon: "rowInsert", commandId: "insertRowAbove" },
    { label: "Row below", icon: "rowInsert", commandId: "insertRowBelow" },
    { label: "Column left", icon: "columnInsert", commandId: "insertColumnLeft" },
    { label: "Column right", icon: "columnInsert", commandId: "insertColumnRight" },
    { separator: true },
    { label: "Delete row", icon: "delete", commandId: "deleteRow" },
    { label: "Delete column", icon: "delete", commandId: "deleteColumn" },
    { separator: true },
    { label: clearContentsLabel, icon: "eraser", commandId: "clearContents" },
    { label: clearFormatLabel || getWorkspaceCommandLabel("clearFormatting"), icon: "eraser", commandId: "clearFormatting" }
  ];
}

export function createWorkspaceInsertMenuItems({ context = false } = {}) {
  return [
    { label: context ? "1 ligne au-dessus" : "Row above", icon: "insert", commandId: "insertRowAbove" },
    { label: context ? "1 ligne en dessous" : "Row below", icon: "insert", commandId: "insertRowBelow" },
    { separator: true },
    { label: context ? "1 colonne a gauche" : "Column left", icon: "insert", commandId: "insertColumnLeft" },
    { label: context ? "1 colonne a droite" : "Column right", icon: "insert", commandId: "insertColumnRight" }
  ];
}

export function createWorkspaceDeleteMenuItems({ context = false } = {}) {
  return [
    { label: context ? "Ligne entiere" : "Delete row", icon: "delete", commandId: "deleteRow" },
    { label: context ? "Colonne entiere" : "Delete column", icon: "delete", commandId: "deleteColumn" }
  ];
}

export function createWorkspaceSortMenuItems({ context = false } = {}) {
  return [
    { label: context ? "Trier de A a Z" : "Trier A-Z", icon: "sortAsc", commandId: "sortAscending" },
    { label: context ? "Trier de Z a A" : "Trier Z-A", icon: "sortDesc", commandId: "sortDescending" }
  ];
}

export function createWorkspaceFilterMenuItems() {
  return [
    { label: "Creer un filtre", icon: "filter", commandId: "filterCreate" },
    { label: "Filtrer par valeur selectionnee", icon: "filter", commandId: "filterBySelection" },
    { label: "Effacer le filtre", icon: "filterClear", commandId: "filterClear" }
  ];
}

export function createWorkspaceSortFilterMenuItems() {
  return [
    ...createWorkspaceSortMenuItems(),
    { separator: true },
    ...createWorkspaceFilterMenuItems()
  ];
}

export function createWorkspaceValidationMenuItems() {
  return [
    { label: "Validation des donnees", icon: "checkbox", commandId: "dataValidation" },
    { label: "Effacer la validation", icon: "eraser", commandId: "dataValidationClear" },
    { label: "Entourer les donnees invalides", icon: "checkbox", commandId: "dataValidationInvalidSummary" }
  ];
}

export function createWorkspaceDataCleanupMenuItems({ toolbar = false } = {}) {
  const items = [
    { label: "Fractionner le texte en colonnes", icon: "split", commandId: "splitTextToColumns" },
    { label: "Supprimer les doublons", icon: "duplicate", commandId: "removeDuplicates" }
  ];
  if (toolbar) {
    items.push({ separator: true });
  }
  items.push(
    { label: "Supprimer les espaces", icon: "clean", commandId: "trimWhitespace" },
    { label: "Nettoyer le texte", icon: "clean", commandId: "cleanText" },
    { label: "Transposer la plage", icon: "transpose", commandId: "transposeRange" }
  );
  return items;
}

export function createWorkspaceDataRefreshMenuItems({ hasPivotTables = true } = {}) {
  return [
    { label: "Actualiser les tableaux croises", icon: "pivot", commandId: "refreshPivotTables", disabled: !hasPivotTables },
    { label: "Recalculer les formules", icon: "function", commandId: "recalculate" }
  ];
}

export function createWorkspaceActiveTableMenuItems({ hasTable = true } = {}) {
  return [
    { label: "Selectionner le tableau", icon: "table", commandId: "selectTable", disabled: !hasTable },
    { label: "Selectionner les donnees", icon: "table", commandId: "selectTableData", disabled: !hasTable },
    { separator: true },
    { label: "Renommer le tableau", icon: "rename", commandId: "renameTable", disabled: !hasTable },
    { label: "Redimensionner le tableau", icon: "move", commandId: "resizeTable", disabled: !hasTable },
    { label: "Convertir en plage", icon: "table", commandId: "convertTableToRange", disabled: !hasTable },
    { separator: true },
    { label: "Ligne des totaux", icon: "function", commandId: "toggleTableTotalRow", disabled: !hasTable },
    { label: "Total: somme", icon: "function", commandId: "tableTotalSum", disabled: !hasTable },
    { label: "Total: moyenne", icon: "function", commandId: "tableTotalAverage", disabled: !hasTable },
    { label: "Total: nombre", icon: "function", commandId: "tableTotalCount", disabled: !hasTable },
    { separator: true },
    { label: "Ligne d'en-tete", icon: "table", commandId: "toggleTableHeaderRow", disabled: !hasTable },
    { label: "Boutons de filtre", icon: "filter", commandId: "toggleTableFilterButtons", disabled: !hasTable },
    { label: "Lignes a bandes", icon: "table", commandId: "toggleTableBandedRows", disabled: !hasTable },
    { label: "Colonnes a bandes", icon: "table", commandId: "toggleTableBandedColumns", disabled: !hasTable }
  ];
}

export function createWorkspaceTableContextMenuItems({ hasTable = false } = {}) {
  return [
    {
      label: hasTable ? "Convertir en plage" : "Mettre sous forme de tableau",
      icon: "table",
      commandId: "toggleTableRange"
    },
    { label: "Renommer le tableau", icon: "rename", commandId: "renameTable", disabled: !hasTable },
    { label: "Redimensionner le tableau", icon: "move", commandId: "resizeTable", disabled: !hasTable },
    { separator: true },
    { label: "Ligne des totaux", icon: "function", commandId: "toggleTableTotalRow", disabled: !hasTable },
    {
      label: "Fonction de total",
      icon: "function",
      disabled: !hasTable,
      items: [
        { label: "Somme", icon: "function", commandId: "tableTotalSum" },
        { label: "Moyenne", icon: "function", commandId: "tableTotalAverage" },
        { label: "Nombre", icon: "function", commandId: "tableTotalCount" },
        { label: "Aucun", icon: "eraser", commandId: "tableTotalNone" }
      ]
    },
    {
      label: "Options du tableau",
      icon: "table",
      disabled: !hasTable,
      items: [
        { label: "Ligne d'en-tete", icon: "table", commandId: "toggleTableHeaderRow" },
        { label: "Boutons de filtre", icon: "filter", commandId: "toggleTableFilterButtons" },
        { label: "Lignes a bandes", icon: "table", commandId: "toggleTableBandedRows" },
        { label: "Colonnes a bandes", icon: "table", commandId: "toggleTableBandedColumns" },
        { label: "Premiere colonne", icon: "table", commandId: "toggleTableFirstColumn" },
        { label: "Derniere colonne", icon: "table", commandId: "toggleTableLastColumn" }
      ]
    },
    { separator: true },
    { label: "Tableau croise dynamique", icon: "pivot", commandId: "createPivotTable" }
  ];
}

export function createWorkspaceHomeEditingMenuItems() {
  return [
    { label: "Find", icon: "search", commandId: "find" },
    { label: "Replace", icon: "replace", commandId: "replace" },
    { separator: true },
    { label: "Go to A1", icon: "search", commandId: "goToA1" },
    { label: "Go to last cell", icon: "search", commandId: "goToLastCell" },
    { separator: true },
    { label: "Note", icon: "note", commandId: "note" }
  ];
}
