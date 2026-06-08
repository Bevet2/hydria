export const WORKSPACE_FONT_FAMILY_OPTIONS = [
  { label: "Default font", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, \"Segoe UI\", Optima, Arial, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Candara", value: "Candara, Calibri, Segoe, \"Segoe UI\", sans-serif" },
  { label: "Century Gothic", value: "\"Century Gothic\", Futura, Arial, sans-serif" },
  { label: "Consolas", value: "Consolas, \"Courier New\", monospace" },
  { label: "Courier New", value: "\"Courier New\", Courier, monospace" },
  { label: "Franklin Gothic", value: "\"Franklin Gothic Medium\", \"Arial Narrow\", Arial, sans-serif" },
  { label: "Garamond", value: "Garamond, Baskerville, \"Times New Roman\", serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "IBM Plex Sans", value: "\"IBM Plex Sans\", sans-serif" },
  { label: "Impact", value: "Impact, Haettenschweiler, \"Arial Narrow Bold\", sans-serif" },
  { label: "Lucida Sans", value: "\"Lucida Sans Unicode\", \"Lucida Grande\", sans-serif" },
  { label: "Palatino", value: "\"Palatino Linotype\", Palatino, \"Book Antiqua\", serif" },
  { label: "Segoe UI", value: "\"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", Times, serif" },
  { label: "Trebuchet MS", value: "\"Trebuchet MS\", Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" }
];

export const WORKSPACE_FONT_SIZE_STEPS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 54, 60, 72, 84, 96
];

export const WORKSPACE_SHEET_FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36];

export const WORKSPACE_DOCUMENT_ALIGNMENT_OPTIONS = [
  { label: "Left align", value: "left", icon: "alignLeft", commandId: "alignLeft" },
  { label: "Center align", value: "center", icon: "alignCenter", commandId: "alignCenter" },
  { label: "Right align", value: "right", icon: "alignRight", commandId: "alignRight" },
  { label: "Justify", value: "justify", icon: "alignJustify", commandId: "alignJustify" }
];

export const WORKSPACE_HORIZONTAL_ALIGNMENT_OPTIONS = [
  { label: "Left", value: "left", icon: "alignLeft", commandId: "alignLeft" },
  { label: "Center", value: "center", icon: "alignCenter", commandId: "alignCenter" },
  { label: "Right", value: "right", icon: "alignRight", commandId: "alignRight" }
];

export const WORKSPACE_VERTICAL_ALIGNMENT_OPTIONS = [
  { label: "Top", value: "top", icon: "alignTop", commandId: "alignTop" },
  { label: "Middle", value: "middle", icon: "alignMiddle", commandId: "alignMiddle" },
  { label: "Bottom", value: "bottom", icon: "alignBottom", commandId: "alignBottom" }
];

export const WORKSPACE_COMMON_COMMANDS = {
  bold: { id: "bold", label: "Bold", frLabel: "Gras", shortLabel: "B", icon: "bold", shortcut: "Ctrl+B" },
  italic: { id: "italic", label: "Italic", frLabel: "Italique", shortLabel: "I", icon: "italic", shortcut: "Ctrl+I" },
  underline: { id: "underline", label: "Underline", frLabel: "Souligne", shortLabel: "U", icon: "underline", shortcut: "Ctrl+U" },
  strikethrough: { id: "strikethrough", label: "Strikethrough", frLabel: "Barre", icon: "strikethrough" },
  undo: { id: "undo", label: "Undo", frLabel: "Annuler", icon: "undo", shortcut: "Ctrl+Z" },
  redo: { id: "redo", label: "Redo", frLabel: "Retablir", icon: "redo", shortcut: "Ctrl+Y" },
  cut: { id: "cut", label: "Cut", frLabel: "Couper", icon: "cut", shortcut: "Ctrl+X" },
  copy: { id: "copy", label: "Copy", frLabel: "Copier", icon: "copy", shortcut: "Ctrl+C" },
  paste: { id: "paste", label: "Paste", frLabel: "Coller", icon: "paste", shortcut: "Ctrl+V" },
  clearFormatting: { id: "clearFormatting", label: "Clear formatting", frLabel: "Effacer la mise en forme", icon: "eraser" },
  alignLeft: { id: "alignLeft", label: "Left", frLabel: "Gauche", icon: "alignLeft" },
  alignCenter: { id: "alignCenter", label: "Center", frLabel: "Centre", icon: "alignCenter" },
  alignRight: { id: "alignRight", label: "Right", frLabel: "Droite", icon: "alignRight" },
  alignJustify: { id: "alignJustify", label: "Justify", frLabel: "Justifier", icon: "alignJustify" },
  alignTop: { id: "alignTop", label: "Top", frLabel: "Haut", icon: "alignTop" },
  alignMiddle: { id: "alignMiddle", label: "Middle", frLabel: "Milieu", icon: "alignMiddle" },
  alignBottom: { id: "alignBottom", label: "Bottom", frLabel: "Bas", icon: "alignBottom" },
  fontSize: { id: "fontSize", label: "Font size", frLabel: "Taille de police", icon: "text" },
  fontFamily: { id: "fontFamily", label: "Font", frLabel: "Police", icon: "text" },
  textColor: { id: "textColor", label: "Text color", frLabel: "Couleur du texte", icon: "textColor" },
  fillColor: { id: "fillColor", label: "Fill color", frLabel: "Remplissage", icon: "fill" },
  highlightColor: { id: "highlightColor", label: "Highlight", frLabel: "Surlignage", icon: "fill" },
  borders: { id: "borders", label: "Borders", frLabel: "Bordures", icon: "border" },
  number: { id: "number", label: "Number", frLabel: "Nombre", icon: "number" },
  numberFormat: { id: "numberFormat", label: "Formats", frLabel: "Formats", icon: "number" },
  currency: { id: "currency", label: "Currency", frLabel: "Devise", icon: "currency" },
  percent: { id: "percent", label: "Percent", frLabel: "Pourcentage", icon: "percent" },
  date: { id: "date", label: "Date", frLabel: "Date", icon: "calendar" },
  dashboardAddMetric: { id: "dashboardAddMetric", label: "Add KPI", frLabel: "Ajouter un KPI", icon: "number" },
  dashboardAddChart: { id: "dashboardAddChart", label: "Add visual", frLabel: "Ajouter un visuel", icon: "chart" },
  dashboardAddFilter: { id: "dashboardAddFilter", label: "Add slicer", frLabel: "Ajouter un segment", icon: "slicer" },
  dashboardAddTableRow: { id: "dashboardAddTableRow", label: "Add data row", frLabel: "Ajouter une ligne", icon: "rowInsert" },
  dashboardAddTableColumn: { id: "dashboardAddTableColumn", label: "Add data column", frLabel: "Ajouter une colonne", icon: "columnInsert" },
  dashboardRemoveMetric: { id: "dashboardRemoveMetric", label: "Remove KPI", frLabel: "Supprimer le KPI", icon: "delete" },
  dashboardRemoveChart: { id: "dashboardRemoveChart", label: "Remove visual", frLabel: "Supprimer le visuel", icon: "delete" },
  dashboardMoveWidgetLeft: { id: "dashboardMoveWidgetLeft", label: "Move widget left", frLabel: "Widget a gauche", icon: "chevronLeft" },
  dashboardMoveWidgetRight: { id: "dashboardMoveWidgetRight", label: "Move widget right", frLabel: "Widget a droite", icon: "chevronRight" },
  dashboardRefresh: { id: "dashboardRefresh", label: "Refresh dashboard", frLabel: "Actualiser", icon: "refresh" }
};

export const WORKSPACE_TEXT_STYLE_COMMAND_IDS = ["bold", "italic", "underline", "strikethrough"];

export function getWorkspaceCommand(commandId = "") {
  return WORKSPACE_COMMON_COMMANDS[commandId] || null;
}

export function isWorkspaceTextStyleCommand(commandId = "") {
  return WORKSPACE_TEXT_STYLE_COMMAND_IDS.includes(commandId);
}

export function createWorkspaceCommandDispatcher(adapters = {}) {
  return (commandId = "", { target = "", ...payload } = {}) => {
    const command = getWorkspaceCommand(commandId);
    const adapter = adapters[target];
    if (!command || !adapter) {
      return false;
    }

    const handler = adapter[command.id] || adapter.execute;
    if (typeof handler !== "function") {
      return false;
    }

    handler(command, payload);
    return true;
  };
}

export function getWorkspaceCommandLabel(commandId = "", locale = "en", fallback = "") {
  const command = getWorkspaceCommand(commandId);
  if (!command) {
    return fallback || commandId;
  }
  if (locale === "fr") {
    return command.frLabel || command.label || fallback || commandId;
  }
  return command.label || fallback || commandId;
}

export function getWorkspaceCommandShortcut(commandId = "") {
  return getWorkspaceCommand(commandId)?.shortcut || "";
}

export function createWorkspaceFontSizeOptions({
  includeAuto = false,
  autoLabel = "Auto size",
  unit = "",
  sizes = WORKSPACE_FONT_SIZE_STEPS
} = {}) {
  const options = sizes.map((size) => {
    const label = String(size);
    return {
      label,
      value: unit ? `${label}${unit}` : label
    };
  });
  return includeAuto ? [{ label: autoLabel, value: "" }, ...options] : options;
}

export function createWorkspaceSheetFontSizeOptions(activeFontSize = "11") {
  const fontSizes = WORKSPACE_SHEET_FONT_SIZE_STEPS.map(String);
  if (activeFontSize && !fontSizes.includes(String(activeFontSize))) {
    fontSizes.push(String(activeFontSize));
  }
  return fontSizes
    .sort((left, right) => Number(left) - Number(right))
    .map((fontSize) => ({ value: fontSize, label: fontSize }));
}

export function getWorkspaceCommandIcon(label = "") {
  const command = WORKSPACE_COMMON_COMMANDS[label];
  if (command?.icon) {
    return command.icon;
  }
  const text = String(label || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("more")) return "chevronDown";
  if (text.includes("axes") || text.includes("axis") || text.includes("axe")) return "axes";
  if (text.includes("validation") || text.includes("invalid")) return "checkbox";
  if (text.includes("conditional") || text.includes("conditionnel")) return "palette";
  if (text.includes("style") || text.includes("couleur") || text.includes("color")) return "palette";
  if (text === "undo" || text.includes("annuler")) return "undo";
  if (text === "redo" || text.includes("retablir")) return "redo";
  if (text.includes("refresh") || text.includes("actualiser")) return "refresh";
  if (text.includes("paste") || text.includes("coller")) return "paste";
  if (text.includes("cut") || text.includes("couper")) return "cut";
  if (text.includes("copy") || text.includes("copier")) return "copy";
  if (text.includes("fill") || text.includes("remplissage")) return "fill";
  if (text === "b" || text.includes("bold") || text.includes("gras")) return "bold";
  if (text === "i" || text.includes("italic") || text.includes("italique")) return "italic";
  if (text === "u" || text.includes("underline") || text.includes("souligne")) return "underline";
  if (text.includes("border") || text.includes("bordure")) return "border";
  if (text.includes("left") || text.includes("gauche")) return text.includes("move") ? "chevronLeft" : "alignLeft";
  if (text.includes("right") || text.includes("droite")) return text.includes("move") ? "chevronRight" : "alignRight";
  if (text.includes("center") || text.includes("centre")) return "alignCenter";
  if (text.includes("middle") || text.includes("milieu")) return "alignMiddle";
  if (text.includes("top") || text.includes("haut")) return "alignTop";
  if (text.includes("bottom") || text.includes("bas")) return "alignBottom";
  if (text.includes("merge") || text.includes("fusion")) return "merge";
  if (text.includes("croise") || text.includes("pivot")) return "pivot";
  if (text.includes("table") || text.includes("tableau")) return "table";
  if (text.includes("image")) return "image";
  if (text.includes("shape") || text.includes("forms") || text.includes("forme")) return "shape";
  if (text.includes("checkbox") || text.includes("case")) return "checkbox";
  if (text.includes("number") || text === "123" || text.includes("nombre")) return "number";
  if (text.includes("text")) return "textColor";
  if (text.includes("currency") || text === "eur" || text.includes("devise")) return "currency";
  if (text.includes("percent") || text === "%" || text.includes("pourcentage")) return "percent";
  if (text.includes("date") || text.includes("calendar")) return "calendar";
  if (text.includes("insert") || text.includes("new") || text.includes("inserer") || text === "+") return "insert";
  if (text.includes("clear filter")) return "filterClear";
  if (text.includes("duplicate") || text.includes("dedupe") || text.includes("dupliquer")) return "duplicate";
  if (text.includes("delete") || text.includes("remove") || text.includes("clear") || text.includes("effacer") || text.includes("supprimer")) return "eraser";
  if (text.includes("area")) return "areaChart";
  if (text.includes("pie") || text.includes("donut") || text.includes("secteur")) return "pieChart";
  if (text.includes("line") || text.includes("courbe") || text.includes("ligne")) return "lineChart";
  if (text.includes("bar")) return "barChart";
  if (text.includes("chart") || text.includes("graph")) return "chart";
  if (text.includes("slicer")) return "slicer";
  if (text.includes("filter") || text.includes("filtre")) return "filter";
  if (text.includes("z-a") || text.includes("desc") || text.includes("grand au plus petit")) return "sortDesc";
  if (text.includes("a-z") || text.includes("asc") || text.includes("petit au plus grand")) return "sortAsc";
  if (text.includes("sort") || text.includes("tri") || text.includes("trier")) return "sort";
  if (text.includes("sum") || text.includes("avg") || text.includes("min") || text.includes("max") || text.includes("count") || text.includes("function") || text.includes("subtotal") || text.includes("fonction")) return "function";
  if (text.includes("lookup") || text.includes("go to") || text.includes("find") || text.includes("search") || text.includes("recherche")) return "search";
  if (text.includes("protect")) return "lock";
  if (text.includes("print") || text.includes("imprimer")) return "print";
  if (text.includes("pdf")) return "pdf";
  if (text.includes("xlsx") || text.includes("csv") || text.includes("import") || text.includes("export") || text.includes("download")) return text.includes("csv") ? "csv" : "fileSpreadsheet";
  if (text.includes("zoom")) return "zoom";
  if (text.includes("grid") || text.includes("quadrillage")) return "grid";
  if (text.includes("freeze") || text.includes("figer")) return "freeze";
  if (text.includes("note")) return "note";
  if (text.includes("sparkline")) return "sparkline";
  if (text.includes("sheet") || text.includes("feuille")) return "sheet";
  if (text.includes("name") || text.includes("nom")) return "text";
  if (text.includes("trim") || text.includes("clean") || text.includes("nettoyer")) return "clean";
  if (text.includes("split") || text.includes("fractionner")) return "split";
  if (text.includes("transpose")) return "transpose";
  if (text.includes("rename") || text.includes("renommer")) return "rename";
  if (text.includes("hide") || text.includes("unhide") || text.includes("masquer")) return "eyeOff";
  if (text.includes("move")) return "move";
  return "sheet";
}
