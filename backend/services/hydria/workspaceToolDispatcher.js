import { AppError } from "../../utils/errors.js";

const SHEET_WORKSPACE_TOOLS = Object.freeze([
  "sheet.apply_formula",
  "sheet.set_cell",
  "sheet.add_column",
  "sheet.add_row",
  "sheet.insert_rows",
  "sheet.insert_columns",
  "sheet.rename_column",
  "sheet.delete_column",
  "sheet.delete_row",
  "sheet.delete_rows",
  "sheet.delete_columns",
  "sheet.resize_row",
  "sheet.resize_column",
  "sheet.set_range",
  "sheet.clear_cells",
  "sheet.sort_range",
  "sheet.filter_rows",
  "sheet.clear_filter",
  "sheet.format_cells",
  "sheet.clear_format",
  "sheet.merge_cells",
  "sheet.unmerge_cells",
  "sheet.set_note",
  "sheet.clear_note",
  "sheet.set_data_validation",
  "sheet.clear_data_validation",
  "sheet.add_conditional_format",
  "sheet.remove_conditional_format",
  "sheet.add_table",
  "sheet.remove_table",
  "sheet.add_pivot_table",
  "sheet.remove_pivot_table",
  "sheet.add_chart",
  "sheet.update_chart",
  "sheet.remove_chart",
  "sheet.add_sparkline",
  "sheet.remove_sparkline",
  "sheet.add_slicer",
  "sheet.remove_slicer",
  "sheet.add_named_range",
  "sheet.remove_named_range",
  "sheet.protect_sheet",
  "sheet.unprotect_sheet",
  "sheet.protect_range",
  "sheet.unprotect_range",
  "sheet.freeze_panes",
  "sheet.set_zoom",
  "sheet.show_gridlines",
  "sheet.add_sheet",
  "sheet.rename_sheet",
  "sheet.delete_sheet",
  "sheet.duplicate_sheet",
  "sheet.move_sheet",
  "sheet.set_active_sheet",
  "sheet.hide_sheet",
  "sheet.unhide_sheet"
]);
const DOC_WORKSPACE_TOOLS = Object.freeze([
  "doc.insert_section",
  "doc.insert_heading",
  "doc.insert_paragraph",
  "doc.replace_block",
  "doc.replace_text",
  "doc.delete_text",
  "doc.append_paragraph",
  "doc.insert_table",
  "doc.delete_section",
  "doc.insert_list",
  "doc.insert_image",
  "doc.insert_link",
  "doc.insert_page_break",
  "doc.insert_toc",
  "doc.insert_quote",
  "doc.insert_code_block",
  "doc.format_block",
  "doc.set_title",
  "doc.set_metadata",
  "doc.add_comment",
  "doc.resolve_comment"
]);
const DOC_WORKSPACE_TOOL_ALIASES = Object.freeze(["doc.edit"]);
const SLIDE_WORKSPACE_TOOLS = Object.freeze([
  "slide.add",
  "slide.update",
  "slide.reorder"
]);
const SLIDE_WORKSPACE_TOOL_ALIASES = Object.freeze(["slide.edit"]);

const SUPPORTED_SHEET_OPERATIONS = new Set([
  "sheet.add_column",
  "sheet.add_row",
  "sheet.insert_rows",
  "sheet.insert_columns",
  "sheet.rename_column",
  "sheet.delete_column",
  "sheet.delete_row",
  "sheet.delete_rows",
  "sheet.delete_columns",
  "sheet.resize_row",
  "sheet.resize_column",
  "sheet.set_formula",
  "sheet.set_cell",
  "sheet.set_range",
  "sheet.clear_cells",
  "sheet.sort_range",
  "sheet.filter_rows",
  "sheet.clear_filter",
  "sheet.format_cells",
  "sheet.clear_format",
  "sheet.merge_cells",
  "sheet.unmerge_cells",
  "sheet.set_note",
  "sheet.clear_note",
  "sheet.set_data_validation",
  "sheet.clear_data_validation",
  "sheet.add_conditional_format",
  "sheet.remove_conditional_format",
  "sheet.add_table",
  "sheet.remove_table",
  "sheet.add_pivot_table",
  "sheet.remove_pivot_table",
  "sheet.add_chart",
  "sheet.update_chart",
  "sheet.remove_chart",
  "sheet.add_sparkline",
  "sheet.remove_sparkline",
  "sheet.add_slicer",
  "sheet.remove_slicer",
  "sheet.add_named_range",
  "sheet.remove_named_range",
  "sheet.protect_sheet",
  "sheet.unprotect_sheet",
  "sheet.protect_range",
  "sheet.unprotect_range",
  "sheet.freeze_panes",
  "sheet.set_zoom",
  "sheet.show_gridlines",
  "sheet.add_sheet",
  "sheet.rename_sheet",
  "sheet.delete_sheet",
  "sheet.duplicate_sheet",
  "sheet.move_sheet",
  "sheet.set_active_sheet",
  "sheet.hide_sheet",
  "sheet.unhide_sheet"
]);
const SUPPORTED_DOC_OPERATIONS = new Set(DOC_WORKSPACE_TOOLS);
const SUPPORTED_SLIDE_OPERATIONS = new Set(SLIDE_WORKSPACE_TOOLS);
const SUPPORTED_WORKSPACE_OPERATIONS = new Set([
  ...SUPPORTED_SHEET_OPERATIONS,
  ...SUPPORTED_DOC_OPERATIONS,
  ...SUPPORTED_SLIDE_OPERATIONS
]);
const SHEET_OPERATION_ALIASES = new Map([
  ["add_column", "sheet.add_column"],
  ["sheet.addcolumn", "sheet.add_column"],
  ["add_row", "sheet.add_row"],
  ["insert_row", "sheet.insert_rows"],
  ["insert_rows", "sheet.insert_rows"],
  ["insert_column", "sheet.insert_columns"],
  ["insert_columns", "sheet.insert_columns"],
  ["rename_column", "sheet.rename_column"],
  ["delete_column", "sheet.delete_column"],
  ["remove_column", "sheet.delete_column"],
  ["delete_row", "sheet.delete_row"],
  ["delete_rows", "sheet.delete_rows"],
  ["delete_columns", "sheet.delete_columns"],
  ["remove_row", "sheet.delete_row"],
  ["remove_rows", "sheet.delete_rows"],
  ["remove_columns", "sheet.delete_columns"],
  ["resize_row", "sheet.resize_row"],
  ["resize_column", "sheet.resize_column"],
  ["set_formula", "sheet.set_formula"],
  ["apply_formula", "sheet.set_formula"],
  ["set_cell", "sheet.set_cell"],
  ["set_range", "sheet.set_range"],
  ["clear_cells", "sheet.clear_cells"],
  ["sort_range", "sheet.sort_range"],
  ["filter_rows", "sheet.filter_rows"],
  ["clear_filter", "sheet.clear_filter"],
  ["format_cells", "sheet.format_cells"],
  ["clear_format", "sheet.clear_format"],
  ["merge_cells", "sheet.merge_cells"],
  ["unmerge_cells", "sheet.unmerge_cells"],
  ["set_note", "sheet.set_note"],
  ["clear_note", "sheet.clear_note"],
  ["set_data_validation", "sheet.set_data_validation"],
  ["clear_data_validation", "sheet.clear_data_validation"],
  ["add_conditional_format", "sheet.add_conditional_format"],
  ["remove_conditional_format", "sheet.remove_conditional_format"],
  ["add_table", "sheet.add_table"],
  ["remove_table", "sheet.remove_table"],
  ["add_pivot_table", "sheet.add_pivot_table"],
  ["remove_pivot_table", "sheet.remove_pivot_table"],
  ["add_chart", "sheet.add_chart"],
  ["update_chart", "sheet.update_chart"],
  ["remove_chart", "sheet.remove_chart"],
  ["add_sparkline", "sheet.add_sparkline"],
  ["remove_sparkline", "sheet.remove_sparkline"],
  ["add_slicer", "sheet.add_slicer"],
  ["remove_slicer", "sheet.remove_slicer"],
  ["add_named_range", "sheet.add_named_range"],
  ["remove_named_range", "sheet.remove_named_range"],
  ["protect_sheet", "sheet.protect_sheet"],
  ["unprotect_sheet", "sheet.unprotect_sheet"],
  ["protect_range", "sheet.protect_range"],
  ["unprotect_range", "sheet.unprotect_range"],
  ["freeze_panes", "sheet.freeze_panes"],
  ["set_zoom", "sheet.set_zoom"],
  ["show_gridlines", "sheet.show_gridlines"],
  ["add_sheet", "sheet.add_sheet"],
  ["rename_sheet", "sheet.rename_sheet"],
  ["delete_sheet", "sheet.delete_sheet"],
  ["duplicate_sheet", "sheet.duplicate_sheet"],
  ["move_sheet", "sheet.move_sheet"],
  ["set_active_sheet", "sheet.set_active_sheet"],
  ["hide_sheet", "sheet.hide_sheet"],
  ["unhide_sheet", "sheet.unhide_sheet"],
  ["insert_section", "doc.insert_section"],
  ["insert_heading", "doc.insert_heading"],
  ["insert_paragraph", "doc.insert_paragraph"],
  ["replace_block", "doc.replace_block"],
  ["replace_text", "doc.replace_text"],
  ["delete_text", "doc.delete_text"],
  ["append_paragraph", "doc.append_paragraph"],
  ["insert_table", "doc.insert_table"],
  ["delete_section", "doc.delete_section"],
  ["insert_list", "doc.insert_list"],
  ["insert_image", "doc.insert_image"],
  ["insert_link", "doc.insert_link"],
  ["insert_page_break", "doc.insert_page_break"],
  ["insert_toc", "doc.insert_toc"],
  ["insert_quote", "doc.insert_quote"],
  ["insert_code_block", "doc.insert_code_block"],
  ["format_block", "doc.format_block"],
  ["set_title", "doc.set_title"],
  ["set_metadata", "doc.set_metadata"],
  ["add_comment", "doc.add_comment"],
  ["resolve_comment", "doc.resolve_comment"],
  ["add_slide", "slide.add"],
  ["update_slide", "slide.update"],
  ["reorder_slide", "slide.reorder"]
]);

function compact(value = "", maxChars = 1200) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trim()}...`;
}

function normalizeLabel(value = "") {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractRequestedColumnName(text = "") {
  const value = String(text || "").trim();
  const match =
    value.match(/(?:colonne|column|champ|field)[ \t]+["'`]?[ \t]*([^"',.;:\n\r]+)/i) ||
    value.match(/(?:ajoute|add)\s+["'`]?\s*([^"',.;:\n\r]+?)\s+(?:au|to|dans|in)\s+(?:tableur|spreadsheet|csv|table)/i);

  if (!match?.[1]) {
    return "";
  }

  return compact(match[1], 120)
    .replace(/^(de|du|des|la|le|les|une|un|the|a|an)\s+/i, "")
    .replace(/\s+(au|dans|to|in|et|and)\s+.*$/i, "")
    .trim();
}

function wantsColumnCreation(text = "") {
  const normalized = normalizeLabel(text);
  return /\b(ajoute|add)\b/.test(normalized) && /\b(colonne|column|champ|field)\b/.test(normalized);
}

function firstText(...values) {
  for (const value of values) {
    const text = compact(value, 400);
    if (text) {
      return text;
    }
  }
  return "";
}

function normalizePath(value = "") {
  return String(value || "").replace(/\\/g, "/").trim();
}

function normalizeOperationType(value = "") {
  const rawType = compact(value, 80);
  const normalized = rawType.toLowerCase();
  return SHEET_OPERATION_ALIASES.get(normalized) || rawType;
}

function normalizeHumanRowIndex(value = null) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Math.max(0, Number(value) - 1);
}

function columnIndexToA1(columnIndex = 0) {
  let value = Math.max(0, Number(columnIndex) || 0) + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters || "A";
}

function a1ColumnToIndex(column = "") {
  const letters = String(column || "").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) {
    return -1;
  }
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function workObjectEntryPath(workObject = null) {
  return normalizePath(
    workObject?.file?.path ||
      workObject?.primaryFile ||
      workObject?.activeEntryPath ||
      workObject?.entryPath ||
      ""
  );
}

function workObjectFamilyId(workObject = null) {
  return compact(
    workObject?.workspaceFamilyId ||
      workObject?.metadata?.workspaceFamilyId ||
      workObject?.environmentPlan?.workspaceFamilyId ||
      "",
    120
  );
}

function isSheetWorkObject(workObject = null) {
  const kind = String(workObject?.objectKind || workObject?.kind || "").toLowerCase();
  const familyId = workObjectFamilyId(workObject).toLowerCase();
  const entryPath = workObjectEntryPath(workObject).toLowerCase();
  return (
    kind === "dataset" ||
    familyId === "data_spreadsheet" ||
    /\.(csv|tsv|xlsx|xls)$/i.test(entryPath)
  );
}

function isHydriaSheetContent(content = "") {
  const text = String(content || "").trim();
  if (!text) {
    return false;
  }
  if (/\"kind\"\s*:\s*\"hydria-sheet\"/i.test(text)) {
    return true;
  }
  try {
    const parsed = JSON.parse(text);
    return parsed?.kind === "hydria-sheet" || Array.isArray(parsed?.sheets);
  } catch {
    return false;
  }
}

function isDocumentWorkObject(workObject = null) {
  const kind = String(workObject?.objectKind || workObject?.kind || "").toLowerCase();
  const familyId = workObjectFamilyId(workObject).toLowerCase();
  const entryPath = workObjectEntryPath(workObject).toLowerCase();
  return (
    kind === "document" ||
    familyId === "document_knowledge" ||
    /\.(html|md|markdown|txt)$/i.test(entryPath)
  );
}

function isPresentationWorkObject(workObject = null) {
  const kind = String(workObject?.objectKind || workObject?.kind || "").toLowerCase();
  const familyId = workObjectFamilyId(workObject).toLowerCase();
  const entryPath = workObjectEntryPath(workObject).toLowerCase();
  return (
    kind === "presentation" ||
    familyId === "presentation" ||
    /(^|\/)slides\.md$/i.test(entryPath) ||
    /\.(pptx|slides\.md)$/i.test(entryPath)
  );
}

function workspaceEngineForWorkObject(workObject = null, call = null) {
  const toolName = String(call?.payload?.toolName || "").toLowerCase();
  const operationType = String(call?.payload?.operations?.[0]?.type || "").toLowerCase();
  if (toolName.startsWith("sheet.") || operationType.startsWith("sheet.")) {
    return "sheet";
  }
  if (toolName.startsWith("doc.") || operationType.startsWith("doc.")) {
    return "doc";
  }
  if (toolName.startsWith("slide.") || operationType.startsWith("slide.")) {
    return "slide";
  }
  if (isSheetWorkObject(workObject)) {
    return "sheet";
  }
  if (isPresentationWorkObject(workObject)) {
    return "slide";
  }
  if (isDocumentWorkObject(workObject)) {
    return "doc";
  }
  return "";
}

function assertWorkObjectAccess(workObject = null, userId = null) {
  if (!workObject) {
    throw new AppError("Work object not found", 404);
  }

  if (Number(workObject.userId || 0) && Number(workObject.userId) !== Number(userId)) {
    throw new AppError("Work object does not belong to this user", 403);
  }
}

function splitCsvLine(line = "") {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvRows(content = "") {
  return String(content || "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map(splitCsvLine);
}

function normalizeSheet(sheet = {}, index = 0) {
  const columns = Array.isArray(sheet.columns) && sheet.columns.length
    ? sheet.columns.map((value) => String(value ?? ""))
    : ["Column 1", "Column 2", "Column 3"];
  const width = Math.max(columns.length, 1);
  const rows = (Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]]).map((row) =>
    Array.from({ length: width }, (_, columnIndex) => String(row?.[columnIndex] ?? ""))
  );

  return {
    id: String(sheet.id || `sheet-${index + 1}`),
    name: String(sheet.name || `Sheet ${index + 1}`),
    columns,
    rows,
    columnWidths: sheet.columnWidths && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
      ? { ...sheet.columnWidths }
      : {},
    rowHeights: sheet.rowHeights && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
      ? { ...sheet.rowHeights }
      : {},
    merges: Array.isArray(sheet.merges) ? sheet.merges : [],
    cellFormats: sheet.cellFormats && typeof sheet.cellFormats === "object" && !Array.isArray(sheet.cellFormats)
      ? { ...sheet.cellFormats }
      : {},
    cellNotes: sheet.cellNotes && typeof sheet.cellNotes === "object" && !Array.isArray(sheet.cellNotes)
      ? { ...sheet.cellNotes }
      : {},
    dataValidations: Array.isArray(sheet.dataValidations) ? sheet.dataValidations : [],
    conditionalFormats: Array.isArray(sheet.conditionalFormats) ? sheet.conditionalFormats : [],
    tables: Array.isArray(sheet.tables) ? sheet.tables : [],
    pivotTables: Array.isArray(sheet.pivotTables) ? sheet.pivotTables : [],
    charts: Array.isArray(sheet.charts) ? sheet.charts : [],
    sparklines: sheet.sparklines && typeof sheet.sparklines === "object" && !Array.isArray(sheet.sparklines)
      ? { ...sheet.sparklines }
      : {},
    slicers: Array.isArray(sheet.slicers) ? sheet.slicers : [],
    filterQuery: String(sheet.filterQuery || ""),
    filterColumnIndex: Number.isInteger(sheet.filterColumnIndex) ? Number(sheet.filterColumnIndex) : -1,
    tableFilters: sheet.tableFilters && typeof sheet.tableFilters === "object" && !Array.isArray(sheet.tableFilters)
      ? { ...sheet.tableFilters }
      : {},
    sort: sheet.sort && typeof sheet.sort === "object" && !Array.isArray(sheet.sort) ? { ...sheet.sort } : null,
    hidden: Boolean(sheet.hidden),
    protected: Boolean(sheet.protected),
    protectedRanges: Array.isArray(sheet.protectedRanges) ? sheet.protectedRanges : [],
    zoomLevel: Math.max(0.5, Math.min(2, Number(sheet.zoomLevel || 1) || 1)),
    showGridlines: sheet.showGridlines !== false,
    frozenRows: Math.max(0, Number(sheet.frozenRows || 0)),
    frozenColumns: Math.max(0, Number(sheet.frozenColumns || 0))
  };
}

function normalizeSheetModel(model = {}) {
  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeSheet(sheet, index))
    : [normalizeSheet(model, 0)];
  const activeSheetId = sheets.some((sheet) => sheet.id === model.activeSheetId)
    ? String(model.activeSheetId)
    : sheets[0].id;

  return {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId,
    namedRanges: Array.isArray(model.namedRanges || model.names) ? [...(model.namedRanges || model.names)] : [],
    sheets
  };
}

function parseHydriaSheetModel(content = "") {
  const raw = String(content || "").trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed.kind === "hydria-sheet" || Array.isArray(parsed.sheets))) {
        return normalizeSheetModel(parsed);
      }
    } catch {
      // Fall back to CSV below.
    }
  }

  const rows = parseCsvRows(content);
  if (!rows.length) {
    return normalizeSheetModel({
      sheets: [
        {
          id: "sheet-1",
          name: "Sheet 1",
          columns: ["Column 1", "Column 2", "Column 3"],
          rows: [["", "", ""]]
        }
      ]
    });
  }

  const [header = [], ...body] = rows;
  const width = Math.max(header.length || 0, ...body.map((row) => row.length), 1);
  return normalizeSheetModel({
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: Array.from({ length: width }, (_, index) => header[index] || `Column ${index + 1}`),
        rows: (body.length ? body : [[""]]).map((row) =>
          Array.from({ length: width }, (_, index) => String(row[index] ?? ""))
        )
      }
    ]
  });
}

function serializeHydriaSheetModel(model = {}) {
  return JSON.stringify(normalizeSheetModel(model), null, 2);
}

function activeSheetForOperations(model = {}, operations = []) {
  const preferredSheetId = firstText(...operations.map((operation) => operation.sheetId));
  return (
    model.sheets.find((sheet) => preferredSheetId && sheet.id === preferredSheetId) ||
    model.sheets.find((sheet) => sheet.id === model.activeSheetId) ||
    model.sheets[0]
  );
}

function ensureSheetWidth(sheet, width) {
  const targetWidth = Math.max(1, Number(width) || 1);
  while (sheet.columns.length < targetWidth) {
    sheet.columns.push(`Column ${sheet.columns.length + 1}`);
  }
  sheet.rows = (sheet.rows.length ? sheet.rows : [[""]]).map((row) =>
    Array.from({ length: sheet.columns.length }, (_, index) => String(row?.[index] ?? ""))
  );
}

function ensureSheetRows(sheet, rowIndex) {
  const targetRowIndex = Math.max(0, Number(rowIndex) || 0);
  ensureSheetWidth(sheet, sheet.columns.length);
  while (sheet.rows.length <= targetRowIndex) {
    sheet.rows.push(Array.from({ length: sheet.columns.length }, () => ""));
  }
}

function findColumnIndex(sheet, columnName = "") {
  const normalizedName = normalizeLabel(columnName);
  if (!normalizedName) {
    return -1;
  }

  return sheet.columns.findIndex((column) => normalizeLabel(column) === normalizedName);
}

function ensureColumn(sheet, columnName = "") {
  const requestedName = compact(columnName, 120) || `Column ${sheet.columns.length + 1}`;
  const existingIndex = findColumnIndex(sheet, requestedName);
  if (existingIndex >= 0) {
    return existingIndex;
  }

  sheet.columns.push(requestedName);
  sheet.rows = (sheet.rows.length ? sheet.rows : [[""]]).map((row) => [
    ...Array.from({ length: sheet.columns.length - 1 }, (_, index) => String(row?.[index] ?? "")),
    ""
  ]);
  return sheet.columns.length - 1;
}

function normalizeFormula(value = "") {
  const formula = compact(value, 1000);
  if (!formula) {
    return "";
  }
  return formula.startsWith("=") ? formula : `=${formula}`;
}

function parseA1Cell(cell = "") {
  const match = String(cell || "").trim().match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return null;
  }

  const letters = match[1].toUpperCase();
  const columnIndex = letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  const spreadsheetRowIndex = Number(match[2]) - 1;
  return {
    columnIndex,
    rowIndex: Math.max(0, spreadsheetRowIndex - 1),
    header: spreadsheetRowIndex === 0
  };
}

function parseA1Range(range = "") {
  const [startRaw = "", endRaw = ""] = String(range || "").toUpperCase().replace(/\$/g, "").split(":");
  const start = parseA1Cell(startRaw.trim());
  const end = parseA1Cell((endRaw || startRaw).trim());
  if (!start || !end) {
    return null;
  }
  return {
    startRowIndex: Math.min(start.rowIndex, end.rowIndex),
    endRowIndex: Math.max(start.rowIndex, end.rowIndex),
    startColumnIndex: Math.min(start.columnIndex, end.columnIndex),
    endColumnIndex: Math.max(start.columnIndex, end.columnIndex)
  };
}

function clampIndex(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function operationCount(operation = {}, fallback = 1) {
  const raw = operation.count ?? operation.raw?.count ?? operation.raw?.quantity ?? operation.raw?.rows ?? operation.raw?.columns;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, Math.min(500, Math.floor(value))) : fallback;
}

function operationRecord(operation = {}, fallback = {}) {
  const rawPayload =
    operation.payload ||
    operation.options ||
    operation.metadata ||
    operation.raw?.payload ||
    operation.raw?.options ||
    operation.raw?.metadata ||
    operation.raw?.data ||
    operation.raw?.spec ||
    fallback;
  return rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? { ...rawPayload }
    : { value: rawPayload };
}

function objectId(value = {}) {
  return compact(value.id || value.name || value.title || value.range || "", 160);
}

function upsertArrayItem(items = [], item = {}) {
  const key = objectId(item);
  if (!key) {
    return [...items, item];
  }
  const index = items.findIndex((candidate) => objectId(candidate) === key);
  if (index < 0) {
    return [...items, item];
  }
  return items.map((candidate, candidateIndex) =>
    candidateIndex === index ? { ...candidate, ...item } : candidate
  );
}

function removeArrayItem(items = [], operation = {}) {
  const raw = operationRecord(operation);
  const key = firstText(operation.raw?.id, operation.raw?.name, operation.raw?.title, operation.value, operation.title, raw.id, raw.name, raw.title, raw.range, operation.range);
  if (!key) {
    return items.slice(0, -1);
  }
  return items.filter((candidate) => objectId(candidate) !== key);
}

function rangeOrTargetKey(operation = {}) {
  if (operation.range) {
    return operation.range;
  }
  if (operation.target?.cell) {
    const cell = parseA1Cell(operation.target.cell);
    return cell ? `${cell.rowIndex + 1}:${cell.columnIndex}` : operation.target.cell;
  }
  const columnIndex = Number.isInteger(operation.target?.columnIndex) ? operation.target.columnIndex : -1;
  if (columnIndex >= 0) {
    return `column:${columnIndex}`;
  }
  if (operation.target?.columnName) {
    return `column:${operation.target.columnName}`;
  }
  return "";
}

function createSheetFromOperation(model = {}, operation = {}) {
  const nextIndex = (model.sheets || []).length;
  const title = firstText(operation.title, operation.value, operation.raw?.name, operation.raw?.title, `Sheet ${nextIndex + 1}`);
  return normalizeSheet(
    {
      id: compact(operation.raw?.id || `sheet-${Date.now()}-${nextIndex + 1}`, 120),
      name: title,
      columns: Array.isArray(operation.raw?.columns) ? operation.raw.columns : ["Column 1", "Column 2", "Column 3"],
      rows: Array.isArray(operation.values) ? operation.values : [["", "", ""]]
    },
    nextIndex
  );
}

function inferWorkspaceOperationType(rawOperation = {}, { toolName = "" } = {}) {
  const rawTarget = rawOperation.target && typeof rawOperation.target === "object" ? rawOperation.target : {};
  const hasFormula = rawOperation.formula !== undefined || rawOperation.expression !== undefined;
  const hasValue =
    rawOperation.value !== undefined ||
    rawOperation.content !== undefined ||
    rawOperation.text !== undefined;
  const hasColumnTarget =
    rawTarget.columnName ||
    rawOperation.targetColumnName ||
    rawOperation.columnName ||
    rawOperation.column;
  const hasCellTarget = rawTarget.cell || rawOperation.cell;
  const normalizedToolName = String(toolName || "").toLowerCase();

  if (hasFormula && hasColumnTarget && normalizedToolName.includes("apply_formula")) {
    return "sheet.add_column";
  }
  if (hasFormula && hasCellTarget) {
    return "sheet.set_formula";
  }
  if (hasValue && (hasCellTarget || hasColumnTarget)) {
    return "sheet.set_cell";
  }
  return "";
}

function normalizeTupleWorkspaceOperation(rawOperation = [], context = {}) {
  const [formulaOrValue, target = {}] = rawOperation;
  if (
    rawOperation.length >= 2 &&
    typeof formulaOrValue === "string" &&
    typeof target === "string" &&
    target.trim().startsWith("=")
  ) {
    return normalizeWorkspaceOperation(
      {
        type: "sheet.set_formula",
        target: {
          cell: formulaOrValue
        },
        formula: target
      },
      context
    );
  }

  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return {
      type: "",
      unsupported: true
    };
  }

  const rowIndex = target.rowIndex ?? normalizeHumanRowIndex(target.row);
  return normalizeWorkspaceOperation(
    {
      type:
        target.type ||
        target.operation ||
        (formulaOrValue !== undefined && String(formulaOrValue).trim().startsWith("=")
          ? target.cell
            ? "sheet.set_formula"
            : "sheet.add_column"
          : "sheet.set_cell"),
      formula: String(formulaOrValue ?? "").trim().startsWith("=") ? formulaOrValue : undefined,
      value: String(formulaOrValue ?? "").trim().startsWith("=") ? undefined : formulaOrValue,
      columnName: target.columnName || (typeof target.column === "string" ? target.column : ""),
      columnIndex:
        target.columnIndex ??
        (Number.isFinite(Number(target.column)) && typeof target.column !== "string"
          ? Number(target.column)
          : undefined),
      rowIndex,
      target: {
        cell: target.cell || "",
        columnName: target.columnName || (typeof target.column === "string" ? target.column : ""),
        columnIndex:
          target.columnIndex ??
          (Number.isFinite(Number(target.column)) && typeof target.column !== "string"
            ? Number(target.column)
            : undefined),
        rowIndex
      }
    },
    context
  );
}

function normalizeWorkspaceOperation(rawOperation = {}, context = {}) {
  if (Array.isArray(rawOperation)) {
    return normalizeTupleWorkspaceOperation(rawOperation, context);
  }

  if (!rawOperation || typeof rawOperation !== "object") {
    return null;
  }

  const type = normalizeOperationType(
    rawOperation.type ||
      rawOperation.action ||
      rawOperation.operation ||
      inferWorkspaceOperationType(rawOperation, context)
  );
  if (!SUPPORTED_WORKSPACE_OPERATIONS.has(type)) {
    return {
      type,
      unsupported: true
    };
  }

  const rawTarget = rawOperation.target && typeof rawOperation.target === "object" ? rawOperation.target : {};
  return {
    type,
    sheetId: compact(rawOperation.sheetId || rawTarget.sheetId || "", 120),
    target: {
      cell: compact(rawTarget.cell || rawOperation.cell || "", 40).toUpperCase(),
      columnName: compact(rawTarget.columnName || rawOperation.targetColumnName || rawOperation.column || "", 120),
      blockId: compact(rawTarget.blockId || rawTarget.id || rawOperation.blockId || "", 120),
      heading: compact(rawTarget.heading || rawTarget.sectionTitle || rawOperation.heading || "", 180),
      oldText: String(rawTarget.oldText ?? rawOperation.oldText ?? ""),
      columnIndex: Number.isFinite(Number(rawTarget.columnIndex ?? rawOperation.columnIndex))
        ? Number(rawTarget.columnIndex ?? rawOperation.columnIndex)
        : null,
      rowIndex: Number.isFinite(Number(rawTarget.rowIndex ?? rawOperation.rowIndex ?? normalizeHumanRowIndex(rawTarget.row ?? rawOperation.row)))
        ? Number(rawTarget.rowIndex ?? rawOperation.rowIndex ?? normalizeHumanRowIndex(rawTarget.row ?? rawOperation.row))
        : null,
      header: Boolean(rawTarget.header || rawOperation.header),
      slideIndex: Number.isFinite(Number(rawTarget.slideIndex ?? rawOperation.slideIndex ?? rawTarget.index ?? rawOperation.index))
        ? Number(rawTarget.slideIndex ?? rawOperation.slideIndex ?? rawTarget.index ?? rawOperation.index)
        : null,
      slideNumber: Number.isFinite(Number(rawTarget.slideNumber ?? rawOperation.slideNumber))
        ? Number(rawTarget.slideNumber ?? rawOperation.slideNumber)
        : null,
      fromIndex: Number.isFinite(Number(rawTarget.fromIndex ?? rawOperation.fromIndex))
        ? Number(rawTarget.fromIndex ?? rawOperation.fromIndex)
        : null,
      toIndex: Number.isFinite(Number(rawTarget.toIndex ?? rawOperation.toIndex))
        ? Number(rawTarget.toIndex ?? rawOperation.toIndex)
        : null,
      count: Number.isFinite(Number(rawTarget.count ?? rawOperation.count))
        ? Number(rawTarget.count ?? rawOperation.count)
        : null,
      wholeFile: Boolean(rawTarget.wholeFile || rawOperation.wholeFile)
    },
    columnName: compact(rawOperation.columnName || rawOperation.name || rawTarget.columnName || rawOperation.column || "", 120),
    title: compact(rawOperation.title || rawOperation.heading || rawTarget.title || rawTarget.heading || "", 180),
    body: String(rawOperation.body ?? rawOperation.markdown ?? rawOperation.html ?? rawOperation.paragraph ?? ""),
    count: Number.isFinite(Number(rawOperation.count)) ? Number(rawOperation.count) : undefined,
    width: Number.isFinite(Number(rawOperation.width)) ? Number(rawOperation.width) : undefined,
    height: Number.isFinite(Number(rawOperation.height)) ? Number(rawOperation.height) : undefined,
    payload: rawOperation.payload && typeof rawOperation.payload === "object" && !Array.isArray(rawOperation.payload)
      ? { ...rawOperation.payload }
      : undefined,
    options: rawOperation.options && typeof rawOperation.options === "object" && !Array.isArray(rawOperation.options)
      ? { ...rawOperation.options }
      : undefined,
    metadata: rawOperation.metadata && typeof rawOperation.metadata === "object" && !Array.isArray(rawOperation.metadata)
      ? { ...rawOperation.metadata }
      : undefined,
    range: compact(rawOperation.range || rawTarget.range || "", 80).toUpperCase(),
    direction: compact(rawOperation.direction || rawOperation.order || rawTarget.direction || "", 20).toLowerCase(),
    format: rawOperation.format && typeof rawOperation.format === "object" && !Array.isArray(rawOperation.format)
      ? { ...rawOperation.format }
      : {},
    values: normalizeWorkspaceOperationValues(rawOperation.values),
    formula: rawOperation.formula ?? rawOperation.expression ?? "",
    value: rawOperation.value ?? rawOperation.content ?? rawOperation.text ?? "",
    raw: rawOperation
  };
}

function normalizeWorkspaceOperationValues(values = undefined) {
  if (Array.isArray(values)) {
    return values.slice(0, 200).map((row) =>
      Array.isArray(row)
        ? row.map((cell) => String(cell ?? "")).slice(0, 200)
        : String(row ?? "")
    );
  }

  if (values && typeof values === "object") {
    return { ...values };
  }

  return undefined;
}

function resolveOperationCell(sheet, operation = {}) {
  const target = operation.target || {};
  const fromCell = target.cell ? parseA1Cell(target.cell) : null;
  if (fromCell) {
    ensureSheetWidth(sheet, fromCell.columnIndex + 1);
    return fromCell;
  }

  let columnIndex = Number.isInteger(target.columnIndex) ? target.columnIndex : -1;
  if (columnIndex < 0 && target.columnName) {
    columnIndex = ensureColumn(sheet, target.columnName);
  }
  if (columnIndex < 0 && operation.columnName) {
    columnIndex = ensureColumn(sheet, operation.columnName);
  }

  if (columnIndex < 0) {
    return null;
  }

  ensureSheetWidth(sheet, columnIndex + 1);
  return {
    columnIndex,
    rowIndex: Number.isInteger(target.rowIndex) ? Math.max(0, target.rowIndex) : 0,
    header: target.header || Number(target.rowIndex) < 0
  };
}

function setSheetCell(sheet, cell = {}, value = "") {
  ensureSheetWidth(sheet, cell.columnIndex + 1);
  if (cell.header) {
    sheet.columns[cell.columnIndex] = String(value ?? "");
    return;
  }

  ensureSheetRows(sheet, cell.rowIndex);
  sheet.rows[cell.rowIndex][cell.columnIndex] = String(value ?? "");
}

function resolveSheetColumnIndex(sheet, operation = {}) {
  if (Number.isInteger(operation.target?.columnIndex) && operation.target.columnIndex >= 0) {
    ensureSheetWidth(sheet, operation.target.columnIndex + 1);
    return operation.target.columnIndex;
  }
  const columnName = firstText(
    operation.target?.columnName,
    operation.raw?.oldColumnName,
    operation.raw?.fromColumnName,
    operation.raw?.from,
    operation.columnName
  );
  if (columnName) {
    const existing = findColumnIndex(sheet, columnName);
    return existing >= 0 ? existing : -1;
  }
  const cell = operation.target?.cell ? parseA1Cell(operation.target.cell) : null;
  return cell ? cell.columnIndex : -1;
}

function normalizeSortValue(value = "") {
  const text = String(value ?? "").trim();
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) && text !== "" ? number : text.toLowerCase();
}

function normalizeCellFormat(format = {}) {
  const next = {};
  if (format.bold !== undefined) {
    next.bold = Boolean(format.bold);
  }
  if (format.italic !== undefined) {
    next.italic = Boolean(format.italic);
  }
  if (format.underline !== undefined) {
    next.underline = Boolean(format.underline);
  }
  if (format.numberFormat) {
    next.numberFormat = compact(format.numberFormat, 40);
  }
  if (format.fillColor) {
    next.fillColor = compact(format.fillColor, 40);
  }
  if (format.textColor) {
    next.textColor = compact(format.textColor, 40);
  }
  return next;
}

function targetCellsForFormat(sheet, operation = {}) {
  const cell = operation.target?.cell ? parseA1Cell(operation.target.cell) : null;
  if (cell) {
    ensureSheetWidth(sheet, cell.columnIndex + 1);
    ensureSheetRows(sheet, cell.rowIndex);
    return [[cell.rowIndex + 1, cell.columnIndex]];
  }

  const columnIndex = resolveSheetColumnIndex(sheet, operation);
  if (columnIndex >= 0) {
    ensureSheetWidth(sheet, columnIndex + 1);
    return Array.from({ length: sheet.rows.length + 1 }, (_, rowIndex) => [rowIndex, columnIndex]);
  }

  return [];
}

function applySheetOperation(sheet, operation = {}, model = null) {
  if (operation.unsupported) {
    return {
      applied: "",
      issue: operation.type ? `Unsupported workspace operation: ${operation.type}` : "Workspace operation is missing a type."
    };
  }

  if (operation.type === "sheet.add_sheet" && model) {
    const nextSheet = createSheetFromOperation(model, operation);
    model.sheets.push(nextSheet);
    model.activeSheetId = nextSheet.id;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.duplicate_sheet" && model) {
    const clone = normalizeSheet(JSON.parse(JSON.stringify(sheet)), model.sheets.length);
    clone.id = compact(operation.raw?.id || `sheet-${Date.now()}-${model.sheets.length + 1}`, 120);
    clone.name = firstText(operation.title, operation.value, `${sheet.name} copy`);
    model.sheets.push(clone);
    model.activeSheetId = clone.id;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.rename_sheet") {
    const nextName = firstText(operation.value, operation.title, operation.raw?.name, operation.raw?.newName);
    if (!nextName) {
      return { applied: "", issue: "sheet.rename_sheet requires a new name." };
    }
    sheet.name = nextName;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.delete_sheet" && model) {
    if (model.sheets.length <= 1) {
      return { applied: "", issue: "sheet.delete_sheet requires at least two sheets." };
    }
    model.sheets = model.sheets.filter((candidate) => candidate.id !== sheet.id);
    model.activeSheetId = model.sheets[0]?.id || "";
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.move_sheet" && model) {
    const fromIndex = model.sheets.findIndex((candidate) => candidate.id === sheet.id);
    const toIndex = Number.isInteger(operation.target?.toIndex)
      ? clampIndex(operation.target.toIndex, 0, model.sheets.length - 1)
      : model.sheets.length - 1;
    if (fromIndex < 0) {
      return { applied: "", issue: "sheet.move_sheet requires an existing sheet." };
    }
    const [moved] = model.sheets.splice(fromIndex, 1);
    model.sheets.splice(toIndex, 0, moved);
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_active_sheet" && model) {
    model.activeSheetId = sheet.id;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.hide_sheet" || operation.type === "sheet.unhide_sheet") {
    sheet.hidden = operation.type === "sheet.hide_sheet";
    if (model && sheet.hidden && model.activeSheetId === sheet.id) {
      model.activeSheetId = model.sheets.find((candidate) => !candidate.hidden && candidate.id !== sheet.id)?.id || sheet.id;
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_rows") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex)
      ? Math.max(0, Math.min(operation.target.rowIndex, sheet.rows.length))
      : sheet.rows.length;
    const count = operationCount(operation);
    const newRows = Array.from({ length: count }, () => Array.from({ length: sheet.columns.length }, () => ""));
    sheet.rows.splice(rowIndex, 0, ...newRows);
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_columns") {
    const columnIndex = Number.isInteger(operation.target?.columnIndex)
      ? Math.max(0, Math.min(operation.target.columnIndex, sheet.columns.length))
      : sheet.columns.length;
    const count = operationCount(operation);
    const names = Array.isArray(operation.values) ? operation.values : [];
    const newColumns = Array.from({ length: count }, (_, index) => compact(names[index], 120) || `Column ${sheet.columns.length + index + 1}`);
    sheet.columns.splice(columnIndex, 0, ...newColumns);
    sheet.rows = sheet.rows.map((row) => {
      const next = [...row];
      next.splice(columnIndex, 0, ...Array.from({ length: count }, () => ""));
      return next;
    });
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.add_column") {
    const columnName = compact(operation.columnName || operation.target?.columnName || "", 120);
    const requestedColumnIndex = Number.isInteger(operation.target?.columnIndex)
      ? Math.max(0, operation.target.columnIndex)
      : -1;
    if (!columnName && requestedColumnIndex < 0) {
      return {
        applied: "",
        issue: "sheet.add_column requires columnName."
      };
    }

    let columnIndex = -1;
    if (columnName && requestedColumnIndex >= 0) {
      const existingIndex = findColumnIndex(sheet, columnName);
      if (existingIndex >= 0) {
        columnIndex = existingIndex;
      } else {
        ensureSheetWidth(sheet, requestedColumnIndex + 1);
        sheet.columns[requestedColumnIndex] = columnName;
        sheet.rows = (sheet.rows.length ? sheet.rows : [[""]]).map((row) =>
          Array.from({ length: sheet.columns.length }, (_, index) => String(row?.[index] ?? ""))
        );
        columnIndex = requestedColumnIndex;
      }
    } else if (columnName) {
      columnIndex = ensureColumn(sheet, columnName);
    } else {
      ensureSheetWidth(sheet, requestedColumnIndex + 1);
      columnIndex = requestedColumnIndex;
    }

    if (operation.formula !== undefined && compact(operation.formula, 1000)) {
      const rowIndex = Number.isInteger(operation.target?.rowIndex) ? Math.max(0, operation.target.rowIndex) : 0;
      ensureSheetRows(sheet, rowIndex);
      sheet.rows[rowIndex][columnIndex] = normalizeFormula(operation.formula);
    } else if (operation.value !== undefined && compact(operation.value, 1000)) {
      const rowIndex = Number.isInteger(operation.target?.rowIndex) ? Math.max(0, operation.target.rowIndex) : 0;
      ensureSheetRows(sheet, rowIndex);
      sheet.rows[rowIndex][columnIndex] = String(operation.value ?? "");
    }

    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.add_row") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex)
      ? Math.max(0, Math.min(operation.target.rowIndex, sheet.rows.length))
      : sheet.rows.length;
    const values = Array.isArray(operation.values)
      ? operation.values
      : operation.values && typeof operation.values === "object"
        ? sheet.columns.map((column) => operation.values[column] ?? "")
        : [];
    const nextRow = Array.from({ length: sheet.columns.length }, (_, index) => String(values[index] ?? ""));
    sheet.rows.splice(rowIndex, 0, nextRow);
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.rename_column") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    const nextName = firstText(operation.value, operation.raw?.newColumnName, operation.raw?.toColumnName, operation.raw?.to, operation.raw?.name);
    if (columnIndex < 0 || !nextName) {
      return {
        applied: "",
        issue: "sheet.rename_column requires an existing target column and a new name."
      };
    }
    sheet.columns[columnIndex] = nextName;
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.delete_column") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    if (columnIndex < 0 || columnIndex >= sheet.columns.length) {
      return {
        applied: "",
        issue: "sheet.delete_column requires an existing target column."
      };
    }
    sheet.columns.splice(columnIndex, 1);
    sheet.rows = sheet.rows.map((row) => {
      const next = [...row];
      next.splice(columnIndex, 1);
      return next;
    });
    if (sheet.columns.length === 0) {
      sheet.columns.push("Column 1");
      sheet.rows = sheet.rows.map(() => [""]);
    }
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.delete_row") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex) ? operation.target.rowIndex : -1;
    if (rowIndex < 0 || rowIndex >= sheet.rows.length) {
      return {
        applied: "",
        issue: "sheet.delete_row requires an existing rowIndex."
      };
    }
    sheet.rows.splice(rowIndex, 1);
    if (!sheet.rows.length) {
      sheet.rows.push(Array.from({ length: sheet.columns.length }, () => ""));
    }
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.delete_rows") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex) ? operation.target.rowIndex : -1;
    if (rowIndex < 0 || rowIndex >= sheet.rows.length) {
      return { applied: "", issue: "sheet.delete_rows requires an existing rowIndex." };
    }
    sheet.rows.splice(rowIndex, operationCount(operation));
    if (!sheet.rows.length) {
      sheet.rows.push(Array.from({ length: sheet.columns.length }, () => ""));
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.delete_columns") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    if (columnIndex < 0 || columnIndex >= sheet.columns.length) {
      return { applied: "", issue: "sheet.delete_columns requires an existing target column." };
    }
    const count = Math.min(operationCount(operation), sheet.columns.length - columnIndex);
    sheet.columns.splice(columnIndex, count);
    sheet.rows = sheet.rows.map((row) => {
      const next = [...row];
      next.splice(columnIndex, count);
      return next;
    });
    if (!sheet.columns.length) {
      sheet.columns.push("Column 1");
      sheet.rows = sheet.rows.map(() => [""]);
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.resize_row") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex) ? Math.max(0, operation.target.rowIndex) : -1;
    const height = Number(operation.height ?? operation.value ?? operation.raw?.height);
    if (rowIndex < 0 || !Number.isFinite(height)) {
      return { applied: "", issue: "sheet.resize_row requires rowIndex and height." };
    }
    sheet.rowHeights[String(rowIndex)] = Math.max(8, Math.min(400, height));
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.resize_column") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    const width = Number(operation.width ?? operation.value ?? operation.raw?.width);
    if (columnIndex < 0 || !Number.isFinite(width)) {
      return { applied: "", issue: "sheet.resize_column requires target column and width." };
    }
    sheet.columnWidths[String(columnIndex)] = Math.max(20, Math.min(800, width));
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.sort_range") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    if (columnIndex < 0) {
      return {
        applied: "",
        issue: "sheet.sort_range requires a target column."
      };
    }
    const direction = operation.direction === "desc" || operation.direction === "descending" ? "desc" : "asc";
    sheet.rows = [...sheet.rows].sort((left, right) => {
      const leftValue = normalizeSortValue(left[columnIndex]);
      const rightValue = normalizeSortValue(right[columnIndex]);
      const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      return direction === "desc" ? -comparison : comparison;
    });
    sheet.sort = {
      columnIndex,
      direction
    };
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.filter_rows") {
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    const query = compact(operation.value || operation.raw?.query || operation.raw?.filterValue || "", 200);
    sheet.filterColumnIndex = columnIndex >= 0 ? columnIndex : -1;
    sheet.filterQuery = query;
    if (columnIndex >= 0) {
      sheet.tableFilters = {
        ...(sheet.tableFilters || {}),
        [String(columnIndex)]: query
      };
    }
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.clear_filter") {
    sheet.filterColumnIndex = -1;
    sheet.filterQuery = "";
    sheet.tableFilters = {};
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.format_cells") {
    const format = normalizeCellFormat(operation.format || operation.raw?.format || {});
    const targets = targetCellsForFormat(sheet, operation);
    if (!Object.keys(format).length || !targets.length) {
      return {
        applied: "",
        issue: "sheet.format_cells requires a target and a non-empty format."
      };
    }
    sheet.cellFormats = sheet.cellFormats || {};
    for (const [rowIndex, columnIndex] of targets) {
      const key = `${rowIndex}:${columnIndex}`;
      sheet.cellFormats[key] = {
        ...(sheet.cellFormats[key] || {}),
        ...format
      };
    }
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.clear_format") {
    const targets = targetCellsForFormat(sheet, operation);
    if (!targets.length) {
      sheet.cellFormats = {};
    } else {
      for (const [rowIndex, columnIndex] of targets) {
        delete sheet.cellFormats[`${rowIndex}:${columnIndex}`];
      }
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.merge_cells") {
    const range = operation.range || operation.raw?.range || "";
    if (!parseA1Range(range)) {
      return { applied: "", issue: "sheet.merge_cells requires an A1 range." };
    }
    sheet.merges = upsertArrayItem(sheet.merges || [], { id: range, range });
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.unmerge_cells") {
    const range = operation.range || operation.raw?.range || "";
    sheet.merges = range ? removeArrayItem(sheet.merges || [], { ...operation, value: range }) : [];
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_note" || operation.type === "sheet.clear_note") {
    const key = rangeOrTargetKey(operation);
    if (!key) {
      return { applied: "", issue: `${operation.type} requires a cell or range target.` };
    }
    sheet.cellNotes = sheet.cellNotes || {};
    if (operation.type === "sheet.clear_note") {
      delete sheet.cellNotes[key];
    } else {
      sheet.cellNotes[key] = operation.value || operation.raw?.note || operation.raw?.comment || "";
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_data_validation" || operation.type === "sheet.clear_data_validation") {
    const key = rangeOrTargetKey(operation);
    if (!key) {
      return { applied: "", issue: `${operation.type} requires a cell/range target.` };
    }
    sheet.dataValidations = sheet.dataValidations || {};
    if (operation.type === "sheet.clear_data_validation") {
      if (Array.isArray(sheet.dataValidations)) {
        sheet.dataValidations = sheet.dataValidations.filter((item) => objectId(item) !== key && item.range !== key);
      } else {
        delete sheet.dataValidations[key];
      }
    } else if (Array.isArray(sheet.dataValidations)) {
      sheet.dataValidations = upsertArrayItem(sheet.dataValidations, { id: key, range: key, ...operationRecord(operation) });
    } else {
      sheet.dataValidations[key] = operationRecord(operation);
    }
    return { applied: operation.type, issue: "" };
  }

  const arrayOperationMap = {
    "sheet.add_conditional_format": ["conditionalFormats", "upsert"],
    "sheet.remove_conditional_format": ["conditionalFormats", "remove"],
    "sheet.add_table": ["tables", "upsert"],
    "sheet.remove_table": ["tables", "remove"],
    "sheet.add_pivot_table": ["pivotTables", "upsert"],
    "sheet.remove_pivot_table": ["pivotTables", "remove"],
    "sheet.add_chart": ["charts", "upsert"],
    "sheet.update_chart": ["charts", "upsert"],
    "sheet.remove_chart": ["charts", "remove"],
    "sheet.add_slicer": ["slicers", "upsert"],
    "sheet.remove_slicer": ["slicers", "remove"],
    "sheet.protect_range": ["protectedRanges", "upsert"],
    "sheet.unprotect_range": ["protectedRanges", "remove"]
  };
  if (arrayOperationMap[operation.type]) {
    const [property, mode] = arrayOperationMap[operation.type];
    const record = {
      id: firstText(operation.raw?.id, operation.title, operation.value, operation.range, `${property}-${Date.now()}`),
      title: firstText(operation.title, operation.raw?.title),
      range: operation.range || operation.raw?.range || "",
      ...operationRecord(operation)
    };
    sheet[property] = mode === "remove"
      ? removeArrayItem(sheet[property] || [], operation)
      : upsertArrayItem(sheet[property] || [], record);
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.add_sparkline" || operation.type === "sheet.remove_sparkline") {
    const key = rangeOrTargetKey(operation) || firstText(operation.title, operation.raw?.id);
    if (!key) {
      return { applied: "", issue: `${operation.type} requires a target.` };
    }
    sheet.sparklines = sheet.sparklines || {};
    if (operation.type === "sheet.remove_sparkline") {
      delete sheet.sparklines[key];
    } else {
      sheet.sparklines[key] = { range: operation.range || "", ...operationRecord(operation) };
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.add_named_range" || operation.type === "sheet.remove_named_range") {
    if (!model) {
      return { applied: "", issue: `${operation.type} requires workbook context.` };
    }
    const name = firstText(operation.title, operation.value, operation.raw?.name);
    if (!name) {
      return { applied: "", issue: `${operation.type} requires a name.` };
    }
    if (operation.type === "sheet.remove_named_range") {
      model.namedRanges = (model.namedRanges || []).filter((item) => objectId(item) !== name);
    } else {
      model.namedRanges = upsertArrayItem(model.namedRanges || [], {
        id: name,
        name,
        sheetId: sheet.id,
        range: operation.range || operation.raw?.range || ""
      });
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.protect_sheet" || operation.type === "sheet.unprotect_sheet") {
    sheet.protected = operation.type === "sheet.protect_sheet";
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.freeze_panes") {
    sheet.frozenRows = Math.max(0, Math.min(100, Number(operation.payload?.rows ?? operation.payload?.frozenRows ?? operation.raw?.rows ?? operation.raw?.frozenRows ?? operation.target?.rowIndex ?? 0) || 0));
    sheet.frozenColumns = Math.max(0, Math.min(100, Number(operation.payload?.columns ?? operation.payload?.frozenColumns ?? operation.raw?.columns ?? operation.raw?.frozenColumns ?? operation.target?.columnIndex ?? 0) || 0));
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_zoom") {
    const zoom = Number(operation.value || operation.raw?.zoom || operation.raw?.zoomLevel);
    if (!Number.isFinite(zoom)) {
      return { applied: "", issue: "sheet.set_zoom requires zoom value." };
    }
    sheet.zoomLevel = Math.max(0.5, Math.min(3, zoom > 10 ? zoom / 100 : zoom));
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.show_gridlines") {
    sheet.showGridlines = operation.value === undefined ? true : Boolean(operation.value);
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_range") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    if (!parsed || !Array.isArray(operation.values)) {
      return { applied: "", issue: "sheet.set_range requires an A1 range and values." };
    }
    ensureSheetWidth(sheet, parsed.endColumnIndex + 1);
    ensureSheetRows(sheet, parsed.endRowIndex);
    operation.values.forEach((row, rowOffset) => {
      const values = Array.isArray(row) ? row : [row];
      values.forEach((value, columnOffset) => {
        const rowIndex = parsed.startRowIndex + rowOffset;
        const columnIndex = parsed.startColumnIndex + columnOffset;
        if (rowIndex <= parsed.endRowIndex && columnIndex <= parsed.endColumnIndex) {
          sheet.rows[rowIndex][columnIndex] = String(value ?? "");
        }
      });
    });
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.clear_cells") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    if (parsed) {
      ensureSheetWidth(sheet, parsed.endColumnIndex + 1);
      ensureSheetRows(sheet, parsed.endRowIndex);
      for (let rowIndex = parsed.startRowIndex; rowIndex <= parsed.endRowIndex; rowIndex += 1) {
        for (let columnIndex = parsed.startColumnIndex; columnIndex <= parsed.endColumnIndex; columnIndex += 1) {
          sheet.rows[rowIndex][columnIndex] = "";
        }
      }
      return { applied: operation.type, issue: "" };
    }
    const columnIndex = resolveSheetColumnIndex(sheet, operation);
    if (columnIndex >= 0) {
      sheet.rows = sheet.rows.map((row) => {
        const next = [...row];
        next[columnIndex] = "";
        return next;
      });
      return { applied: operation.type, issue: "" };
    }
    return { applied: "", issue: "sheet.clear_cells requires a cell, range, or column target." };
  }

  const cell = resolveOperationCell(sheet, operation);
  if (!cell) {
    return {
      applied: "",
      issue: `${operation.type} requires a cell, columnIndex, or columnName target.`
    };
  }

  if (operation.type === "sheet.set_formula") {
    const formula = normalizeFormula(operation.formula || operation.value);
    if (!formula) {
      return {
        applied: "",
        issue: "sheet.set_formula requires formula."
      };
    }

    setSheetCell(sheet, cell, formula);
    return {
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "sheet.set_cell") {
    setSheetCell(sheet, cell, operation.value ?? "");
    return {
      applied: operation.type,
      issue: ""
    };
  }

  return {
    applied: "",
    issue: `Unsupported workspace operation: ${operation.type}`
  };
}

function isHtmlContent(content = "") {
  const text = String(content || "").trim();
  return /^</.test(text) || /<\/(?:p|h1|h2|h3|section|div|ul|ol|table)>/i.test(text);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphText(operation = {}) {
  return String(
    operation.value ||
      operation.body ||
      operation.raw?.paragraph ||
      operation.raw?.content ||
      operation.raw?.text ||
      ""
  ).trim();
}

function sectionTitle(operation = {}) {
  return compact(
    operation.title ||
      operation.target?.heading ||
      operation.raw?.sectionTitle ||
      operation.raw?.heading ||
      operation.raw?.title ||
      "New section",
    180
  );
}

function bodyToHtml(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return "<p></p>";
  }
  if (/^<[\s\S]*>$/.test(text)) {
    return text;
  }
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function tableRowsFromOperation(operation = {}) {
  const rawRows = operation.values;
  if (Array.isArray(rawRows) && rawRows.length) {
    const rows = rawRows
      .map((row) => {
        if (Array.isArray(row)) {
          return row.map((cell) => compact(cell, 240));
        }
        if (row && typeof row === "object") {
          return Object.values(row).map((cell) => compact(cell, 240));
        }
        return [compact(row, 240)];
      })
      .filter((row) => row.some(Boolean));
    if (rows.length) {
      return rows;
    }
  }

  const text = paragraphText(operation);
  const pipeRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length);
  if (pipeRows.length) {
    return pipeRows;
  }

  const csvRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(","))
    .map((line) => line.split(",").map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length > 1);
  if (csvRows.length) {
    return csvRows;
  }

  return [
    ["Element", "Details"],
    [sectionTitle(operation), text || "Add content here."]
  ];
}

function renderDocumentTable(operation = {}, html = false) {
  const rows = tableRowsFromOperation(operation);
  const [header = ["Element", "Details"], ...bodyRows] = rows.length ? rows : [["Element", "Details"], ["", ""]];
  const safeBodyRows = bodyRows.length ? bodyRows : [["", ""]];

  if (html) {
    return [
      "<table>",
      `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`,
      `<tbody>${safeBodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`,
      "</table>"
    ].join("");
  }

  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...safeBodyRows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function documentListItems(operation = {}) {
  const values = Array.isArray(operation.values)
    ? operation.values
    : Array.isArray(operation.raw?.items)
      ? operation.raw.items
      : [];
  if (values.length) {
    return values.map((item) => compact(item, 500)).filter(Boolean);
  }
  return paragraphText(operation)
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function documentCommentMarker(operation = {}) {
  const id = firstText(operation.raw?.id, operation.title, `comment-${Date.now()}`);
  const text = paragraphText(operation) || firstText(operation.value, operation.raw?.comment, operation.raw?.note);
  return `<!-- hydria-comment:${id}:${text} -->`;
}

function deleteDocumentSection(content = "", heading = "") {
  const title = compact(heading, 180);
  if (!title) {
    return content;
  }
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (isHtmlContent(content)) {
    const pattern = new RegExp(
      `\\s*<h[1-6][^>]*>\\s*${escapedTitle}\\s*</h[1-6]>[\\s\\S]*?(?=<h[1-6][^>]*>|$)`,
      "i"
    );
    return String(content).replace(pattern, "").trimEnd();
  }

  const pattern = new RegExp(`\\n*^#{1,6}\\s+.*${escapedTitle}.*\\n[\\s\\S]*?(?=\\n#{1,6}\\s+|$)`, "im");
  return String(content).replace(pattern, "").trimEnd();
}

function stripDocumentMarkup(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDocumentSections(content = "") {
  const text = String(content || "");
  const sections = [];

  if (isHtmlContent(text)) {
    const matches = [...text.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const title = stripDocumentMarkup(match[2]);
      if (!title) {
        continue;
      }
      const start = Number(match.index || 0);
      const bodyStart = start + match[0].length;
      const bodyEnd = matches[index + 1]?.index ?? text.length;
      sections.push({
        title,
        normalizedTitle: normalizeLabel(title),
        level: Number(match[1]) || 2,
        body: stripDocumentMarkup(text.slice(bodyStart, bodyEnd)),
        index
      });
    }
    return sections;
  }

  const matches = [...text.matchAll(/^(\#{1,6})\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = stripDocumentMarkup(match[2]);
    if (!title) {
      continue;
    }
    const start = Number(match.index || 0);
    const bodyStart = start + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.length;
    sections.push({
      title,
      normalizedTitle: normalizeLabel(title),
      level: match[1].length,
      body: stripDocumentMarkup(text.slice(bodyStart, bodyEnd)),
      index
    });
  }

  if (!sections.length && text.trim()) {
    sections.push({
      title: "Document",
      normalizedTitle: "document",
      level: 1,
      body: stripDocumentMarkup(text),
      index: 0
    });
  }

  return sections;
}

function extractQuotedDocumentText(prompt = "") {
  const quoted = String(prompt || "").match(/["'`](.+?)["'`]/);
  return quoted?.[1]?.trim() || "";
}

function extractDocumentTargetName(prompt = "") {
  const text = String(prompt || "");
  const match =
    text.match(/\b(?:section|partie|bloc|block|paragraphe|paragraph|titre|heading)\s+["'`]?\s*([^"',.;:\n\r]+)/i) ||
    text.match(/\b(?:intro|introduction|conclusion|resume|synthese|risques?|objectifs?|decision|decisions)\b/i);
  const raw = match?.[1] || match?.[0] || "";
  return compact(raw, 180)
    .replace(/^(la|le|les|du|de|des|une|un|the|a|an)\s+/i, "")
    .replace(/\s+(au|aux|du|de|des|dans|sur|to|in|on|with|avec|qui|that|document|actif|active)(?:\s+.*)?$/i, "")
    .trim();
}

function resolveDocumentHeadingFromPrompt(prompt = "", sections = []) {
  const normalizedPrompt = normalizeLabel(prompt);
  const explicit = extractDocumentTargetName(prompt);
  if (explicit) {
    const normalizedExplicit = normalizeLabel(explicit);
    const match = sections.find((section) =>
      section.normalizedTitle === normalizedExplicit ||
      section.normalizedTitle.includes(normalizedExplicit) ||
      normalizedExplicit.includes(section.normalizedTitle)
    );
    if (match) {
      return match.title;
    }
    return explicit.replace(/^\w/, (letter) => letter.toUpperCase());
  }

  const aliases = [
    { pattern: /\b(intro|introduction)\b/, candidates: ["introduction", "intro"] },
    { pattern: /\b(conclusion|fin)\b/, candidates: ["conclusion"] },
    { pattern: /\b(resume|synthese|summary)\b/, candidates: ["resume", "synthese", "summary"] },
    { pattern: /\b(risque|risques|risk|risks)\b/, candidates: ["risque", "risques", "risk", "risks"] },
    { pattern: /\b(objectif|objectifs|goal|goals)\b/, candidates: ["objectif", "objectifs", "goal", "goals"] },
    { pattern: /\b(decision|decisions)\b/, candidates: ["decision", "decisions"] }
  ];

  for (const alias of aliases) {
    if (!alias.pattern.test(normalizedPrompt)) {
      continue;
    }
    const match = sections.find((section) =>
      alias.candidates.some((candidate) => section.normalizedTitle.includes(candidate))
    );
    if (match) {
      return match.title;
    }
    return alias.candidates[0].replace(/^\w/, (letter) => letter.toUpperCase());
  }

  const mentioned = [...sections]
    .sort((left, right) => right.normalizedTitle.length - left.normalizedTitle.length)
    .find((section) => section.normalizedTitle.length >= 3 && normalizedPrompt.includes(section.normalizedTitle));
  return mentioned?.title || "";
}

function summarizeDocumentText(text = "", maxChars = 420) {
  const clean = stripDocumentMarkup(text);
  if (!clean) {
    return "";
  }
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const summary = (sentences.length ? sentences.slice(0, 2).join(" ") : clean).slice(0, maxChars).trim();
  return summary.length < clean.length ? `${summary.replace(/[.,;:]$/, "")}.` : summary;
}

function documentSectionBody(sections = [], heading = "") {
  const normalizedHeading = normalizeLabel(heading);
  return sections.find((section) =>
    section.normalizedTitle === normalizedHeading ||
    section.normalizedTitle.includes(normalizedHeading) ||
    normalizedHeading.includes(section.normalizedTitle)
  )?.body || "";
}

function looksLikeDocumentToolPrompt(prompt = "") {
  const normalized = normalizeLabel(prompt);
  return (
    /\b(document|doc|texte|rapport|brief|note|sop|wiki|section|partie|bloc|paragraphe|paragraph|intro|introduction|conclusion)\b/.test(normalized) ||
    /\b(ajoute|add|insert|insere|append|complete|continue|modifie|modify|remplace|replace|rewrite|reformule|corrige|fix|resume|summarize|raccourcis|shorten|supprime|delete|remove)\b/.test(normalized)
  );
}

function planDocumentOperationsFromPrompt({ prompt = "", content = "" } = {}) {
  const normalized = normalizeLabel(prompt);
  if (!looksLikeDocumentToolPrompt(prompt)) {
    return [];
  }

  const sections = extractDocumentSections(content);
  const heading = resolveDocumentHeadingFromPrompt(prompt, sections);
  const quoted = extractQuotedDocumentText(prompt);

  if (/\b(titre|title)\b/.test(normalized) && /\b(change|set|mets|met|renomme|rename)\b/.test(normalized)) {
    const title = quoted || extractDocumentTargetName(prompt);
    return title ? [{ type: "doc.set_title", title }] : [];
  }

  if (/\b(toc|sommaire|table des matieres|table of contents)\b/.test(normalized)) {
    return [{ type: "doc.insert_toc" }];
  }

  if (/\b(supprime|delete|remove)\b/.test(normalized) && heading) {
    return [
      {
        type: "doc.delete_section",
        title: heading,
        target: { heading }
      }
    ];
  }

  if (/\b(table|tableau)\b/.test(normalized) && /\b(ajoute|add|insert|insere|cree|create)\b/.test(normalized)) {
    const title = extractDocumentTargetName(prompt) || "Tableau";
    return [
      {
        type: "doc.insert_table",
        title,
        content: quoted,
        target: { position: "end" }
      }
    ];
  }

  if (/\b(liste|checklist|points?|bullets?)\b/.test(normalized) && /\b(ajoute|add|insert|insere|cree|create)\b/.test(normalized)) {
    const items = quoted
      ? quoted.split(/;|\n/).map((item) => item.trim()).filter(Boolean)
      : [];
    return [
      {
        type: "doc.insert_list",
        values: items.length ? items : ["A completer"],
        target: heading ? { heading } : { position: "end" }
      }
    ];
  }

  if (/\b(ajoute|add|insert|insere|cree|create)\b/.test(normalized) && /\b(section|partie|heading)\b/.test(normalized)) {
    return [
      {
        type: "doc.insert_section",
        title: heading || extractDocumentTargetName(prompt) || "Nouvelle section",
        content: quoted || "A completer.",
        target: { position: "end" }
      }
    ];
  }

  if (/\b(remplace|replace|rewrite|reformule|modifie|modify|corrige|fix|resume|summarize|raccourcis|shorten)\b/.test(normalized) && heading) {
    const currentBody = documentSectionBody(sections, heading);
    const replacement =
      quoted ||
      (/\b(resume|summarize|raccourcis|shorten)\b/.test(normalized) ? summarizeDocumentText(currentBody) : "");
    if (!replacement) {
      return [];
    }
    return [
      {
        type: "doc.replace_block",
        title: heading,
        content: replacement,
        target: { heading }
      }
    ];
  }

  if (/\b(ajoute|append|add|complete|continue)\b/.test(normalized)) {
    const contentToAppend = quoted || extractDocumentTargetName(prompt);
    if (!contentToAppend) {
      return [];
    }
    return [
      {
        type: "doc.append_paragraph",
        content: contentToAppend,
        target: heading ? { heading } : { position: "end" }
      }
    ];
  }

  return [];
}

function synthesizeDocumentToolCallsFromPrompt({
  prompt = "",
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  if (!isDocumentWorkObject(activeWorkObject) || isHydriaSheetContent(activeWorkObjectContent)) {
    return [];
  }

  const operations = planDocumentOperationsFromPrompt({
    prompt,
    content: activeWorkObjectContent
  });
  if (!operations.length) {
    return [];
  }

  return [
    normalizeWorkspaceToolCall({
      id: "hydria-os-local-doc-edit",
      type: "workspace_tool_call",
      title: "Apply document edit",
      target: {
        workObjectId: activeWorkObject?.id || "",
        entryPath: workObjectEntryPath(activeWorkObject) || "content.md"
      },
      payload: {
        instruction: prompt,
        workspaceFamilyId: workObjectFamilyId(activeWorkObject),
        currentKind: activeWorkObject?.objectKind || activeWorkObject?.kind || "document",
        toolName: "doc.edit",
        operations
      },
      riskLevel: operations.some((operation) => operation.type === "doc.delete_section") ? "medium" : "low",
      rationale: "Hydria OS local document guardrail synthesized this call from the active document structure."
    })
  ].filter(Boolean);
}

function appendWithSpacing(content = "", addition = "") {
  const current = String(content || "").trimEnd();
  const next = String(addition || "").trim();
  if (!current) {
    return next;
  }
  return `${current}\n\n${next}`;
}

function applyDocumentOperation(content = "", operation = {}) {
  if (operation.unsupported || !SUPPORTED_DOC_OPERATIONS.has(operation.type)) {
    return {
      content,
      applied: "",
      issue: operation.type ? `Unsupported document operation: ${operation.type}` : "Document operation is missing a type."
    };
  }

  const html = isHtmlContent(content);
  if (operation.type === "doc.append_paragraph") {
    const text = paragraphText(operation);
    if (!text) {
      return {
        content,
        applied: "",
        issue: "doc.append_paragraph requires text/content."
      };
    }

    return {
      content: appendWithSpacing(content, html ? bodyToHtml(text) : text),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_section") {
    const title = sectionTitle(operation);
    const body = paragraphText(operation) || "Add content here.";
    const section = html
      ? `<h2>${escapeHtml(title)}</h2>\n${bodyToHtml(body)}`
      : `## ${title}\n\n${body}`;
    return {
      content: appendWithSpacing(content, section),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_heading") {
    const title = sectionTitle(operation);
    const level = Math.max(1, Math.min(6, Number(operation.raw?.level || operation.target?.level || 2) || 2));
    return {
      content: appendWithSpacing(content, html ? `<h${level}>${escapeHtml(title)}</h${level}>` : `${"#".repeat(level)} ${title}`),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_paragraph") {
    const text = paragraphText(operation);
    if (!text) {
      return { content, applied: "", issue: "doc.insert_paragraph requires text/content." };
    }
    return {
      content: appendWithSpacing(content, html ? bodyToHtml(text) : text),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_table") {
    const title = sectionTitle(operation);
    const table = renderDocumentTable(operation, html);
    const section = html
      ? `<h2>${escapeHtml(title)}</h2>\n${table}`
      : `## ${title}\n\n${table}`;
    return {
      content: appendWithSpacing(content, section),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_list") {
    const items = documentListItems(operation);
    if (!items.length) {
      return { content, applied: "", issue: "doc.insert_list requires list items." };
    }
    const ordered = Boolean(operation.raw?.ordered);
    const block = html
      ? `<${ordered ? "ol" : "ul"}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`
      : items.map((item, index) => (ordered ? `${index + 1}. ${item}` : `- ${item}`)).join("\n");
    return { content: appendWithSpacing(content, block), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_image") {
    const src = firstText(operation.raw?.src, operation.raw?.url, operation.value);
    const alt = firstText(operation.title, operation.raw?.alt, "Image");
    if (!src) {
      return { content, applied: "", issue: "doc.insert_image requires src/url." };
    }
    return {
      content: appendWithSpacing(content, html ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : `![${alt}](${src})`),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_link") {
    const href = firstText(operation.raw?.href, operation.raw?.url, operation.value);
    const label = firstText(operation.title, operation.raw?.label, href);
    if (!href) {
      return { content, applied: "", issue: "doc.insert_link requires href/url." };
    }
    return {
      content: appendWithSpacing(content, html ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : `[${label}](${href})`),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_page_break") {
    return {
      content: appendWithSpacing(content, html ? '<hr class="page-break">' : "---"),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_toc") {
    return {
      content: appendWithSpacing(content, html ? "<nav data-hydria-toc=\"true\">Table of contents</nav>" : "## Table of contents\n\n<!-- hydria-toc -->"),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_quote") {
    const text = paragraphText(operation);
    if (!text) {
      return { content, applied: "", issue: "doc.insert_quote requires text/content." };
    }
    return {
      content: appendWithSpacing(content, html ? `<blockquote>${bodyToHtml(text)}</blockquote>` : text.split(/\r?\n/).map((line) => `> ${line}`).join("\n")),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.insert_code_block") {
    const code = paragraphText(operation);
    const language = firstText(operation.raw?.language, operation.raw?.lang);
    if (!code) {
      return { content, applied: "", issue: "doc.insert_code_block requires code content." };
    }
    return {
      content: appendWithSpacing(content, html ? `<pre><code>${escapeHtml(code)}</code></pre>` : `\`\`\`${language}\n${code}\n\`\`\``),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.delete_section") {
    const title = sectionTitle(operation);
    const nextContent = deleteDocumentSection(content, title);
    if (nextContent === String(content || "")) {
      return {
        content,
        applied: "",
        issue: `doc.delete_section could not find section: ${title}`
      };
    }
    return {
      content: nextContent,
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.replace_text" || operation.type === "doc.delete_text") {
    const oldText = String(operation.target?.oldText || operation.raw?.oldText || operation.raw?.find || operation.title || "").trim();
    if (!oldText || !String(content).includes(oldText)) {
      return { content, applied: "", issue: `${operation.type} requires existing oldText/find target.` };
    }
    const replacement = operation.type === "doc.delete_text" ? "" : paragraphText(operation);
    return {
      content: String(content).replaceAll(oldText, replacement),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.format_block") {
    const heading = sectionTitle(operation);
    const marker = html
      ? `<div data-hydria-format="${escapeHtml(JSON.stringify(operation.format || operationRecord(operation)))}"></div>`
      : `\n<!-- hydria-format:${heading}:${JSON.stringify(operation.format || operationRecord(operation))} -->`;
    return {
      content: appendWithSpacing(content, marker),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.set_title") {
    const title = firstText(operation.title, operation.value, paragraphText(operation));
    if (!title) {
      return { content, applied: "", issue: "doc.set_title requires a title." };
    }
    if (html) {
      const next = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(content)
        ? String(content).replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>${escapeHtml(title)}</h1>`)
        : `<h1>${escapeHtml(title)}</h1>\n${content}`;
      return { content: next, applied: operation.type, issue: "" };
    }
    const next = /^#\s+.*$/m.test(content)
      ? String(content).replace(/^#\s+.*$/m, `# ${title}`)
      : `# ${title}\n\n${content}`;
    return { content: next, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_metadata") {
    const metadata = JSON.stringify(operationRecord(operation));
    const marker = html ? `<meta name="hydria-metadata" content="${escapeHtml(metadata)}">` : `<!-- hydria-metadata:${metadata} -->`;
    return { content: appendWithSpacing(content, marker), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.add_comment") {
    return {
      content: appendWithSpacing(content, documentCommentMarker(operation)),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.resolve_comment") {
    const id = firstText(operation.raw?.id, operation.title, operation.value);
    if (!id) {
      return { content, applied: "", issue: "doc.resolve_comment requires a comment id/title." };
    }
    const pattern = new RegExp(`\\s*<!-- hydria-comment:${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:[\\s\\S]*?-->`, "g");
    return {
      content: String(content).replace(pattern, ""),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "doc.replace_block") {
    const replacement = paragraphText(operation);
    if (!replacement) {
      return {
        content,
        applied: "",
        issue: "doc.replace_block requires replacement content."
      };
    }

    const oldText = String(operation.target?.oldText || operation.raw?.oldText || "").trim();
    if (oldText && String(content).includes(oldText)) {
      return {
        content: String(content).replace(oldText, replacement),
        applied: operation.type,
        issue: ""
      };
    }

    if (operation.target?.wholeFile || operation.target?.blockId === "whole-file") {
      return {
        content: replacement,
        applied: operation.type,
        issue: ""
      };
    }

    const heading = operation.target?.heading || operation.title || "";
    if (heading) {
      if (html) {
        const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
          `(<h[1-6][^>]*>\\s*${escapedHeading}\\s*</h[1-6]>)[\\s\\S]*?(?=<h[1-6][^>]*>|$)`,
          "i"
        );
        if (pattern.test(content)) {
          return {
            content: String(content).replace(pattern, `$1\n${bodyToHtml(replacement)}\n`),
            applied: operation.type,
            issue: ""
          };
        }
      } else {
        const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
          `(^#{1,6}\\s+.*${escapedHeading}.*\\n)[\\s\\S]*?(?=\\n#{1,6}\\s+|$)`,
          "im"
        );
        if (pattern.test(content)) {
          return {
            content: String(content).replace(pattern, `$1\n${replacement}\n`),
            applied: operation.type,
            issue: ""
          };
        }
      }
    }

    return {
      content,
      applied: "",
      issue: "doc.replace_block requires oldText, heading, or wholeFile target."
    };
  }

  return {
    content,
    applied: "",
    issue: `Unsupported document operation: ${operation.type}`
  };
}

function derivePresentationDeck(content = "", fallbackTitle = "Untitled presentation") {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const title = titleLine ? titleLine.trim().replace(/^#\s+/, "") : fallbackTitle;
  const slides = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line.trim())) {
      if (current) {
        slides.push(current);
      }
      const rawTitle = line.trim().replace(/^##\s+/, "");
      current = {
        title: rawTitle.replace(/^slide\s+\d+\s*-\s*/i, "").trim() || rawTitle,
        bodyLines: []
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(rawLine);
    }
  }

  if (current) {
    slides.push(current);
  }

  return {
    title,
    slides: slides.length
      ? slides.map((slide, index) => ({
          id: `slide-${index + 1}`,
          title: slide.title || `Slide ${index + 1}`,
          body: slide.bodyLines.join("\n").trim()
        }))
      : [
          {
            id: "slide-1",
            title: "Slide 1",
            body: "Add the main message here."
          }
        ]
  };
}

function buildPresentationContent({ title = "Untitled presentation", slides = [] } = {}) {
  const safeSlides = slides.length
    ? slides
    : [
        {
          title: "Slide 1",
          body: "Add the first key message here."
        }
      ];

  return [
    `# ${String(title || "Untitled presentation").trim()}`,
    "",
    ...safeSlides.flatMap((slide, index) => [
      `## Slide ${index + 1} - ${String(slide.title || "Untitled slide").trim()}`,
      String(slide.body || "").trim() || "Add the main point here.",
      ""
    ])
  ]
    .join("\n")
    .trim();
}

function resolveSlideIndex(slides = [], operation = {}) {
  const target = operation.target || {};
  if (Number.isInteger(target.slideIndex)) {
    return Math.max(0, Math.min(slides.length - 1, target.slideIndex));
  }
  if (Number.isInteger(target.slideNumber)) {
    return Math.max(0, Math.min(slides.length - 1, target.slideNumber - 1));
  }
  const rawId = compact(target.blockId || operation.raw?.slideId || operation.raw?.id || "", 120);
  const idMatch = rawId.match(/slide-(\d+)/i);
  if (idMatch) {
    return Math.max(0, Math.min(slides.length - 1, Number(idMatch[1]) - 1));
  }
  const title = normalizeLabel(target.heading || operation.title || operation.raw?.title || "");
  if (title) {
    const foundIndex = slides.findIndex((slide) => normalizeLabel(slide.title) === title);
    if (foundIndex >= 0) {
      return foundIndex;
    }
  }
  return slides.length ? 0 : -1;
}

function applySlideOperation(content = "", operation = {}) {
  if (operation.unsupported || !SUPPORTED_SLIDE_OPERATIONS.has(operation.type)) {
    return {
      content,
      applied: "",
      issue: operation.type ? `Unsupported slide operation: ${operation.type}` : "Slide operation is missing a type."
    };
  }

  const deck = derivePresentationDeck(content);
  if (operation.type === "slide.add") {
    const title = operation.title || operation.raw?.title || `Slide ${deck.slides.length + 1}`;
    const body = paragraphText(operation) || "Add the main message here.";
    const nextSlides = [...deck.slides, { id: `slide-${deck.slides.length + 1}`, title, body }];
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.update") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return {
        content,
        applied: "",
        issue: "slide.update requires an existing slide target."
      };
    }
    const body = paragraphText(operation);
    const title = operation.title || operation.raw?.title || "";
    const nextSlides = deck.slides.map((slide, index) =>
      index === slideIndex
        ? {
            ...slide,
            title: title || slide.title,
            body: body || slide.body
          }
        : slide
    );
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.reorder") {
    const fromIndex = Number.isInteger(operation.target?.fromIndex)
      ? operation.target.fromIndex
      : resolveSlideIndex(deck.slides, operation);
    const toIndex = Number.isInteger(operation.target?.toIndex)
      ? operation.target.toIndex
      : Number.isInteger(operation.raw?.toSlideIndex)
        ? Number(operation.raw.toSlideIndex)
        : -1;
    if (fromIndex < 0 || fromIndex >= deck.slides.length || toIndex < 0 || toIndex >= deck.slides.length) {
      return {
        content,
        applied: "",
        issue: "slide.reorder requires valid fromIndex and toIndex."
      };
    }
    const nextSlides = [...deck.slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  return {
    content,
    applied: "",
    issue: `Unsupported slide operation: ${operation.type}`
  };
}

function collectWorkspaceCandidates(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input !== "object") {
    return [];
  }

  const candidates = [];
  if (input.type === "workspace_tool_call" || input.payload?.toolName || input.toolName) {
    candidates.push(input);
  }

  [
    input.proposedActions,
    input.actions,
    input.workspaceToolCalls,
    input.workspace_tool_calls,
    input.workspace_tool_call,
    input.workspaceToolCall,
    input.toolCalls
  ].forEach((value) => {
    if (Array.isArray(value)) {
      candidates.push(...value);
    } else if (value && typeof value === "object") {
      candidates.push(value);
    }
  });

  return candidates;
}

function normalizeWorkspaceToolCall(rawCall = {}) {
  if (!rawCall || typeof rawCall !== "object") {
    return null;
  }

  const payload = rawCall.payload && typeof rawCall.payload === "object" ? rawCall.payload : rawCall;
  const toolName = compact(payload.toolName || rawCall.toolName || payload.name || rawCall.name || "", 120);
  const rawOperations = Array.isArray(payload.operations)
    ? payload.operations
    : Array.isArray(rawCall.operations)
      ? rawCall.operations
      : payload.operation
        ? [payload.operation]
        : rawCall.operation
          ? [rawCall.operation]
          : [];
  const type = compact(rawCall.type || rawCall.action || payload.type || "", 80);

  if (type !== "workspace_tool_call" && !toolName && !rawOperations.length) {
    return null;
  }

  const target = rawCall.target && typeof rawCall.target === "object" ? rawCall.target : {};
  const payloadTarget = payload.target && typeof payload.target === "object" ? payload.target : {};
  const operations = rawOperations
    .map((operation) => normalizeWorkspaceOperation(operation, { toolName }))
    .filter(Boolean);

  return {
    id: compact(rawCall.id || payload.id || "", 160),
    type: "workspace_tool_call",
    title: compact(rawCall.title || payload.title || "", 180),
    target: {
      workObjectId: compact(target.workObjectId || payloadTarget.workObjectId || payload.workObjectId || rawCall.workObjectId || "", 160),
      entryPath: normalizePath(target.entryPath || payloadTarget.entryPath || payload.entryPath || rawCall.entryPath || "")
    },
    payload: {
      instruction: compact(payload.instruction || payload.prompt || rawCall.prompt || "", 2400),
      workspaceFamilyId: compact(payload.workspaceFamilyId || rawCall.workspaceFamilyId || "", 120),
      currentKind: compact(payload.currentKind || rawCall.currentKind || "", 80),
      currentPreview: compact(payload.currentPreview || rawCall.currentPreview || "", 1600),
      toolName: toolName || "workspace_tool_call",
      operations
    },
    riskLevel: compact(rawCall.riskLevel || payload.riskLevel || "", 60),
    requiresConfirmation: Boolean(rawCall.requiresConfirmation || payload.requiresConfirmation),
    dryRun: Boolean(rawCall.dryRun || payload.dryRun),
    rationale: compact(rawCall.rationale || payload.rationale || payload.reason || "", 1200),
    raw: rawCall
  };
}

function enrichWorkspaceOperations(operations = [], { prompt = "", call = null } = {}) {
  const inferenceText = [
    call?.payload?.instruction || "",
    call?.title || "",
    call?.rationale || "",
    prompt
  ].filter(Boolean).join("\n");
  const inferredColumnName = extractRequestedColumnName(inferenceText);
  const shouldAddColumn = wantsColumnCreation(inferenceText);

  if (!inferredColumnName) {
    return operations;
  }

  return operations.map((operation) => {
    if (
      operation?.type !== "sheet.add_column" ||
      operation.columnName ||
      operation.target?.columnName
    ) {
      if (operation?.type === "sheet.set_formula" && shouldAddColumn && operation.formula) {
        const parsedCell = parseA1Cell(operation.target?.cell || "");
        return {
          ...operation,
          type: "sheet.add_column",
          columnName: inferredColumnName,
          target: {
            ...(operation.target || {}),
            cell: "",
            columnName: inferredColumnName,
            rowIndex: operation.target?.rowIndex ?? parsedCell?.rowIndex ?? 0
          }
        };
      }
      return operation;
    }

    return {
      ...operation,
      columnName: inferredColumnName,
      target: {
        ...(operation.target || {}),
        columnName: inferredColumnName
      }
    };
  });
}

export function listHydriaWorkspaceTools() {
  return [
    ...SHEET_WORKSPACE_TOOLS,
    ...DOC_WORKSPACE_TOOL_ALIASES,
    ...DOC_WORKSPACE_TOOLS,
    ...SLIDE_WORKSPACE_TOOL_ALIASES,
    ...SLIDE_WORKSPACE_TOOLS
  ];
}

export function listWorkspaceToolsForWorkObject(workObject = null) {
  if (isSheetWorkObject(workObject)) {
    return [...SHEET_WORKSPACE_TOOLS];
  }
  if (isPresentationWorkObject(workObject)) {
    return [...SLIDE_WORKSPACE_TOOL_ALIASES, ...SLIDE_WORKSPACE_TOOLS];
  }
  if (isDocumentWorkObject(workObject)) {
    return [...DOC_WORKSPACE_TOOL_ALIASES, ...DOC_WORKSPACE_TOOLS];
  }
  return [];
}

function workspaceToolEngine(toolName = "") {
  if (String(toolName).startsWith("sheet.")) {
    return "sheet";
  }
  if (String(toolName).startsWith("doc.")) {
    return "doc";
  }
  if (String(toolName).startsWith("slide.")) {
    return "slide";
  }
  return "";
}

function workspaceToolOperationTypes(toolName = "") {
  if (toolName === "sheet.apply_formula") {
    return ["sheet.set_formula", "sheet.add_column", "sheet.set_range"];
  }
  if (toolName === "doc.edit") {
    return [...DOC_WORKSPACE_TOOLS];
  }
  if (toolName === "slide.edit") {
    return [...SLIDE_WORKSPACE_TOOLS];
  }
  if (SUPPORTED_WORKSPACE_OPERATIONS.has(toolName)) {
    return [toolName];
  }
  return [];
}

function workspaceToolDescription(toolName = "") {
  if (toolName === "sheet.apply_formula") {
    return "Compute spreadsheet values by writing formulas into cells, ranges, or a result column.";
  }
  if (toolName.startsWith("sheet.")) {
    return "Manipulate a Hydria Sheet model while preserving its JSON structure.";
  }
  if (toolName === "doc.edit") {
    return "Route a document editing request to one or more concrete doc.* operations.";
  }
  if (toolName.startsWith("doc.")) {
    return "Manipulate a Hydria document block or section.";
  }
  if (toolName === "slide.edit") {
    return "Route a presentation editing request to concrete slide.* operations.";
  }
  if (toolName.startsWith("slide.")) {
    return "Manipulate a Hydria presentation.";
  }
  return "Hydria workspace tool.";
}

export function listHydriaWorkspaceToolCatalog(workspaceTools = null) {
  const selectedTools = Array.isArray(workspaceTools) && workspaceTools.length
    ? workspaceTools
    : listHydriaWorkspaceTools();
  return [...new Set(selectedTools)]
    .filter(Boolean)
    .map((toolName) => ({
      name: toolName,
      engine: workspaceToolEngine(toolName),
      acceptedOperationTypes: workspaceToolOperationTypes(toolName),
      description: workspaceToolDescription(toolName)
    }));
}

export function buildHydriaWorkspaceToolContract({ workspaceTools = null } = {}) {
  return {
    responseShape: {
      type: "workspace_tool_call",
      target: {
        workObjectId: "existing Hydria OS workObject id",
        entryPath: "active editable entry path, for example table.csv"
      },
      payload: {
        toolName: "one workspace tool name from workspaceTools",
        operations: [
          {
            type: "one acceptedOperationTypes value for that tool",
            target: {
              cell: "A1 cell when relevant",
              range: "A1 range when relevant",
              columnName: "column header when relevant",
              columnIndex: "zero-based column index when relevant",
              rowIndex: "zero-based data-row index; spreadsheet row 2 is rowIndex 0",
              blockId: "document block id when relevant",
              heading: "document heading when relevant",
              slideIndex: "zero-based slide index when relevant"
            },
            formula: "spreadsheet formula when relevant",
            value: "cell or text value when relevant",
            values: "row or table values when relevant"
          }
        ]
      }
    },
    sheetModel: {
      format: "hydria-sheet-json",
      headers: "columns contains spreadsheet row 1 headers",
      rows: "rows contains data rows only; rows[0] maps to spreadsheet row 2",
      formulas: "formula values should be strings such as =A2*B2 or =SOMME(A2:B2)*C2",
      intentRule:
        "Use the active data and column semantics to choose the formula; do not assume a generic sum when quantity and price columns imply a product."
    },
    tools: listHydriaWorkspaceToolCatalog(workspaceTools)
  };
}

export function buildWorkspaceContextFields({ activeWorkObject = null, contentPreview = "" } = {}) {
  const sheetLike = isHydriaSheetContent(contentPreview) || isSheetWorkObject(activeWorkObject);
  const workspaceTools = sheetLike
    ? [...SHEET_WORKSPACE_TOOLS]
    : listWorkspaceToolsForWorkObject(activeWorkObject);
  return {
    workspaceFamilyId: sheetLike
      ? "data_spreadsheet"
      : workObjectFamilyId(activeWorkObject),
    contentPreview: sheetLike
      ? buildSheetWorkspaceContentPreview(contentPreview)
      : compact(contentPreview, 2500),
    contentFormat: sheetLike ? "hydria-sheet-json-preview" : "text-preview",
    workspaceTools
  };
}

function buildSheetWorkspaceContentPreview(content = "") {
  const model = parseHydriaSheetModel(content);
  const sheet = activeSheetForOperations(model, []) || model.sheets[0];
  const maxColumns = 40;
  const maxRows = 25;
  const columns = (sheet?.columns || []).slice(0, maxColumns);
  const rows = (sheet?.rows || [])
    .slice(0, maxRows)
    .map((row) => columns.map((_, columnIndex) => String(row?.[columnIndex] ?? "")));

  return JSON.stringify({
    kind: "hydria-sheet",
    version: model.version || 1,
    activeSheetId: sheet?.id || model.activeSheetId || "sheet-1",
    columnCount: sheet?.columns?.length || columns.length,
    rowCount: sheet?.rows?.length || rows.length,
    columns,
    rows,
    sheets: [
      {
        id: sheet?.id || model.activeSheetId || "sheet-1",
        name: sheet?.name || "Sheet 1",
        columns,
        rows
      }
    ]
  });
}

export function normalizeWorkspaceToolCallsFromCore(input = null) {
  return collectWorkspaceCandidates(input)
    .map(normalizeWorkspaceToolCall)
    .filter(Boolean);
}

function looksLikeSheetFormulaPrompt(prompt = "") {
  const normalized = normalizeLabel(prompt);
  return (
    /\b(somme|sum|addition|total|totaux|montant|amount|resultat|result|formula|formule|calcul|calcule|calculate|calc|complete|remplis|renseigne)\b/.test(normalized) ||
    /=\s*[a-z]+\d+/i.test(String(prompt || ""))
  );
}

function extractTargetCellFromPrompt(prompt = "") {
  const match = String(prompt || "").match(
    /\b(?:cellule|cell|case|en|dans|in|sur|to)\s+([A-Z]{1,3}\d+)\b/i
  );
  return match?.[1]?.toUpperCase() || "";
}

function extractTargetColumnFromPrompt(prompt = "") {
  const text = String(prompt || "");
  const match =
    text.match(/\b(?:colonne|column|col)\s+([A-Z]{1,3})\b/i) ||
    text.match(/\b(?:en|dans|in|sur|to)\s+([A-Z]{1,3})\b/i);
  const candidate = match?.[1]?.toUpperCase() || "";
  if (!candidate || ["ET", "AND", "THE", "LES", "DES", "UNE", "UN"].includes(candidate)) {
    return "";
  }
  return a1ColumnToIndex(candidate) >= 0 ? candidate : "";
}

function extractSourceColumnsFromPrompt(prompt = "", targetColumn = "") {
  const text = String(prompt || "");
  const directMatch = extractSourceColumnPairFromPrompt(text);
  if (directMatch) {
    return directMatch
      .filter((column) => a1ColumnToIndex(column) >= 0)
      .slice(0, 2);
  }

  const targetIndex = a1ColumnToIndex(targetColumn);
  if (targetIndex >= 2) {
    return [columnIndexToA1(targetIndex - 2), columnIndexToA1(targetIndex - 1)];
  }
  return ["A", "B"];
}

function extractSourceColumnPairFromPrompt(prompt = "") {
  const text = String(prompt || "");
  const columnToken = "\\$?[A-Z]{1,3}\\$?";
  const separator = "(?:\\+|,|\\bet\\b|\\band\\b|\\bplus\\b)";
  const match =
    text.match(new RegExp(`\\b(?:de|des|entre|avec|from|of)\\s+(${columnToken})\\s*${separator}\\s*(${columnToken})(?=$|[^A-Za-z])`, "i")) ||
    text.match(new RegExp(`(?:^|[^A-Za-z])(${columnToken})\\s*${separator}\\s*(${columnToken})(?=$|[^A-Za-z])`, "i"));
  if (!match?.[1] || !match?.[2]) {
    return [];
  }
  return [match[1], match[2]]
    .map((column) => column.toUpperCase().replace(/\$/g, ""))
    .filter((column) => a1ColumnToIndex(column) >= 0)
    .slice(0, 2);
}

function extractExplicitSourceColumnsFromPrompt(prompt = "") {
  return extractSourceColumnPairFromPrompt(prompt);
}

function isExplicitAdditionPrompt(prompt = "") {
  return /\b(somme|sum|addition|additionne|ajoute|add|plus)\b/.test(normalizeLabel(prompt));
}

function isExplicitMultiplicationPrompt(prompt = "") {
  return /\b(produit|multiplication|multiplie|multiply|times|fois|x)\b/.test(normalizeLabel(prompt));
}

function isTotalPrompt(prompt = "") {
  return /\b(total|totaux|totalise|totaliser|amount|montant|revenue|revenu|ventes|sales|chiffre d affaires|prix total|valeur totale)\b/.test(normalizeLabel(prompt));
}

function isResultPrompt(prompt = "") {
  return /\b(resultat|resultats|result|value|valeur|calcul|calcule|complete|remplis|renseigne)\b/.test(normalizeLabel(prompt));
}

function isGenericColumnName(columnName = "", columnIndex = 0) {
  const normalized = normalizeLabel(columnName);
  return (
    !normalized ||
    normalized === `column ${columnIndex + 1}` ||
    normalized === `colonne ${columnIndex + 1}` ||
    normalized === `col ${columnIndex + 1}`
  );
}

function shouldSetTargetHeader(currentHeader = "", desiredHeader = "", targetColumn = "") {
  const normalized = normalizeLabel(currentHeader);
  if (!normalized) {
    return true;
  }
  if (normalized === normalizeLabel(desiredHeader)) {
    return false;
  }
  const targetIndex = a1ColumnToIndex(targetColumn);
  return (
    normalized === normalizeLabel(targetColumn) ||
    (targetIndex >= 0 && isGenericColumnName(currentHeader, targetIndex))
  );
}

function sheetColumnSemantic(columnName = "") {
  const normalized = normalizeLabel(columnName);
  if (/\b(total|totaux|montant|amount|subtotal|sous total|revenue|revenu|ventes|sales|chiffre d affaires|valeur totale)\b/.test(normalized)) {
    return "total";
  }
  if (/\b(prix|price|tarif|cout|cost|pu|prix unitaire|unit price|unitaire|taux|rate|taux horaire|hourly rate)\b/.test(normalized)) {
    return "price";
  }
  if (/\b(nb|nombre|quantite|qte|qty|quantity|count|volume|unites|units|heures|hours|duree|duration)\b/.test(normalized)) {
    return "quantity";
  }
  return "";
}

function parseSheetNumber(value = "") {
  const text = String(value ?? "").trim();
  if (!text || text.startsWith("=")) {
    return null;
  }
  const normalized = text
    .replace(/\s+/g, "")
    .replace(/[€$£%]/g, "")
    .replace(/,/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function columnValueProfile(sheet = {}, columnIndex = 0) {
  const values = (sheet?.rows || [])
    .map((row) => String(row?.[columnIndex] ?? "").trim())
    .filter(Boolean);
  const numericCount = values.filter((value) => parseSheetNumber(value) !== null).length;
  const formulaCount = values.filter((value) => value.startsWith("=")).length;
  const nonEmptyCount = values.length;
  return {
    nonEmptyCount,
    numericCount,
    numericRatio: nonEmptyCount ? numericCount / nonEmptyCount : 0,
    formulaOnly: nonEmptyCount > 0 && formulaCount === nonEmptyCount
  };
}

function profileSheetColumns(sheet = {}) {
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
  return columns.map((columnName, columnIndex) => ({
    columnName,
    columnIndex,
    letter: columnIndexToA1(columnIndex),
    semantic: sheetColumnSemantic(columnName),
    values: columnValueProfile(sheet, columnIndex)
  }));
}

function semanticQuantityPricePlanFromSheet(sheet = {}, targetColumn = "") {
  const targetIndex = a1ColumnToIndex(targetColumn);
  const candidates = profileSheetColumns(sheet)
    .filter((column) => targetIndex < 0 || column.columnIndex < targetIndex);

  const quantityColumns = candidates
    .filter((column) => column.semantic === "quantity")
    .map((column) => column.columnIndex);
  const priceColumn = candidates.find((column) => column.semantic === "price")?.columnIndex ?? -1;

  if (quantityColumns.length && priceColumn >= 0 && !quantityColumns.includes(priceColumn)) {
    return {
      quantityColumns,
      priceColumn,
      sourceColumns: [...quantityColumns, priceColumn].sort((left, right) => left - right)
    };
  }

  return null;
}

function semanticFormulaColumnsFromSheet(sheet = {}, targetColumn = "") {
  return semanticQuantityPricePlanFromSheet(sheet, targetColumn)?.sourceColumns || [];
}

function numericFormulaColumnsFromSheet(sheet = {}, targetColumn = "") {
  const targetIndex = a1ColumnToIndex(targetColumn);
  return profileSheetColumns(sheet)
    .filter((column) => targetIndex < 0 || column.columnIndex < targetIndex)
    .filter((column) => column.semantic !== "total")
    .filter((column) => column.values.numericRatio >= 0.6 || (column.values.nonEmptyCount === 0 && !isGenericColumnName(column.columnName, column.columnIndex)))
    .map((column) => column.columnIndex);
}

function inferSheetFormulaIntent({ prompt = "", sheet = {}, targetColumn = "" } = {}) {
  const explicitSources = extractExplicitSourceColumnsFromPrompt(prompt);
  const semanticPlan = semanticQuantityPricePlanFromSheet(sheet, targetColumn);
  const semanticSourceIndexes = semanticPlan?.sourceColumns || [];
  const numericSourceIndexes = numericFormulaColumnsFromSheet(sheet, targetColumn);
  const semanticSourceColumns = semanticSourceIndexes.map(columnIndexToA1);
  const numericSourceColumns = numericSourceIndexes.map(columnIndexToA1);
  const wantsComputedTotal = isTotalPrompt(prompt) || isResultPrompt(prompt);

  if (
    semanticPlan &&
    (wantsComputedTotal || isExplicitMultiplicationPrompt(prompt))
  ) {
    return {
      kind: semanticPlan.quantityColumns.length > 1 ? "quantity_sum_times_price" : "row_product",
      sourceColumns: semanticSourceColumns,
      quantityColumns: semanticPlan.quantityColumns.map(columnIndexToA1),
      priceColumn: columnIndexToA1(semanticPlan.priceColumn),
      confidence: 0.94,
      reason: "quantity_price_total"
    };
  }

  if (isExplicitMultiplicationPrompt(prompt)) {
    return {
      kind: "row_product",
      sourceColumns: explicitSources.length >= 2 ? explicitSources.slice(0, 2) : numericSourceColumns.slice(0, 2),
      confidence: 0.84,
      reason: "explicit_multiplication"
    };
  }

  if (explicitSources.length >= 2) {
    return {
      kind: explicitSources.length > 2 ? "row_sum_range" : "row_add",
      sourceColumns: explicitSources,
      confidence: 0.82,
      reason: "explicit_source_columns"
    };
  }

  if ((isExplicitAdditionPrompt(prompt) || wantsComputedTotal) && numericSourceColumns.length >= 3) {
    return {
      kind: "row_sum_range",
      sourceColumns: numericSourceColumns,
      confidence: 0.78,
      reason: "numeric_columns_before_result"
    };
  }

  if ((isExplicitAdditionPrompt(prompt) || wantsComputedTotal) && numericSourceColumns.length >= 2) {
    return {
      kind: "row_add",
      sourceColumns: numericSourceColumns.slice(0, 2),
      confidence: 0.74,
      reason: "two_numeric_columns_before_result"
    };
  }

  return {
    kind: "row_add",
    sourceColumns: extractSourceColumnsFromPrompt(prompt, targetColumn),
    confidence: 0.55,
    reason: "fallback_adjacent_columns"
  };
}

function inferTargetColumnFromSheet({ sheet = {}, prompt = "" } = {}) {
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
  if (!columns.length || !looksLikeSheetFormulaPrompt(prompt)) {
    return "";
  }

  const semanticSources = semanticFormulaColumnsFromSheet(sheet, "");
  const numericSources = numericFormulaColumnsFromSheet(sheet, "");
  const totalPrompt = isTotalPrompt(prompt);
  const minimumResultIndex = semanticSources.length
    ? Math.max(...semanticSources) + 1
    : numericSources.length
      ? Math.max(...numericSources) + 1
    : Math.max(1, columns.length);
  const totalIndex = columns.findIndex(
    (columnName, columnIndex) =>
      columnIndex >= minimumResultIndex && sheetColumnSemantic(columnName) === "total"
  );
  if (totalIndex >= 0) {
    return columnIndexToA1(totalIndex);
  }

  const reusableGenericIndex = columns.findIndex((columnName, columnIndex) => {
    if (columnIndex < minimumResultIndex || !isGenericColumnName(columnName, columnIndex)) {
      return false;
    }

    const values = (sheet.rows || [])
      .map((row) => String(row?.[columnIndex] ?? "").trim())
      .filter(Boolean);
    if (!values.length) {
      return true;
    }

    const looksFormulaOnly = values.every((value) => value.startsWith("="));
    return looksFormulaOnly || (totalPrompt && semanticSources.length >= 2);
  });
  if (reusableGenericIndex >= 0) {
    return columnIndexToA1(reusableGenericIndex);
  }

  return columnIndexToA1(Math.max(columns.length, minimumResultIndex));
}

function inferredResultColumnName(prompt = "") {
  const normalized = normalizeLabel(prompt);
  if (/\b(montant|amount|revenue|revenu|ventes|sales|chiffre d affaires|valeur totale)\b/.test(normalized)) {
    return "Montant";
  }
  if (/\b(total|totaux|totalise|totaliser|prix total)\b/.test(normalized)) {
    return "Total";
  }
  if (isExplicitAdditionPrompt(prompt)) {
    return "Somme";
  }
  if (isResultPrompt(prompt)) {
    return "Resultat";
  }
  return "Resultat";
}

function explicitFormulaFromPrompt(prompt = "") {
  const match = String(prompt || "").match(/=\s*[A-Z0-9_.$:+\-*/(),\s]+/i);
  return match?.[0]?.replace(/\s+/g, "") || "";
}

function rowSumExpression(sourceColumns = [], rowNumber = 2) {
  const columns = sourceColumns.filter((column) => a1ColumnToIndex(column) >= 0);
  if (!columns.length) {
    return "";
  }
  if (columns.length === 1) {
    return `${columns[0]}${rowNumber}`;
  }

  const indexes = columns.map(a1ColumnToIndex);
  const contiguous = indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1);
  if (contiguous) {
    return `SOMME(${columns[0]}${rowNumber}:${columns[columns.length - 1]}${rowNumber})`;
  }

  return `(${columns.map((column) => `${column}${rowNumber}`).join("+")})`;
}

function formulaForRow({ prompt = "", rowNumber = 2, targetColumn = "", sheet = null } = {}) {
  const explicitFormula = explicitFormulaFromPrompt(prompt);
  if (explicitFormula) {
    return explicitFormula;
  }

  const intent = inferSheetFormulaIntent({ prompt, sheet, targetColumn });
  const sourceColumns = intent.sourceColumns.filter((column) => a1ColumnToIndex(column) >= 0);
  const [leftColumn = "A", rightColumn = "B"] = sourceColumns;

  if (intent.kind === "quantity_sum_times_price" && intent.priceColumn) {
    const quantityExpression = rowSumExpression(intent.quantityColumns || [], rowNumber);
    if (quantityExpression) {
      return `=${quantityExpression}*${intent.priceColumn}${rowNumber}`;
    }
  }

  if (intent.kind === "row_product" && sourceColumns.length >= 2) {
    return `=${leftColumn}${rowNumber}*${rightColumn}${rowNumber}`;
  }

  if (intent.kind === "row_sum_range" && sourceColumns.length >= 2) {
    return `=${rowSumExpression(sourceColumns, rowNumber)}`;
  }

  if (sourceColumns.length >= 2) {
    return `=${leftColumn}${rowNumber}+${rightColumn}${rowNumber}`;
  }

  return `=${leftColumn}${rowNumber}`;
}

export function synthesizeWorkspaceToolCallsFromPrompt({
  prompt = "",
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  const documentCalls = synthesizeDocumentToolCallsFromPrompt({
    prompt,
    activeWorkObject,
    activeWorkObjectContent
  });
  if (documentCalls.length) {
    return documentCalls;
  }

  if ((!isSheetWorkObject(activeWorkObject) && !isHydriaSheetContent(activeWorkObjectContent)) || !looksLikeSheetFormulaPrompt(prompt)) {
    return [];
  }

  const model = parseHydriaSheetModel(activeWorkObjectContent);
  const sheet = activeSheetForOperations(model, []) || model.sheets[0];
  const targetCell = extractTargetCellFromPrompt(prompt);
  const targetColumnFromPrompt = extractTargetColumnFromPrompt(prompt);
  let targetColumn = targetCell.replace(/\d+$/, "") || targetColumnFromPrompt;
  if (!targetColumn) {
    targetColumn = inferTargetColumnFromSheet({ sheet, prompt });
  }
  if (!targetCell && !targetColumn) {
    return [];
  }

  const rowCount = Math.max(1, sheet?.rows?.length || 1);
  const targetColumnIndex = a1ColumnToIndex(targetColumn);
  const desiredHeader = inferredResultColumnName(prompt);
  const operations = [];

  if (
    targetColumnIndex >= 0 &&
    shouldSetTargetHeader(sheet?.columns?.[targetColumnIndex] || "", desiredHeader, targetColumn)
  ) {
    operations.push({
      type: "sheet.add_column",
      columnName: desiredHeader,
      target: {
        columnIndex: targetColumnIndex
      }
    });
  }

  if (targetCell) {
    operations.push({
      type: "sheet.set_formula",
      target: {
        cell: targetCell
      },
      formula: formulaForRow({
        prompt,
        rowNumber: Number(targetCell.match(/\d+$/)?.[0] || 2),
        targetColumn,
        sheet
      })
    });
  } else {
    operations.push(...Array.from({ length: rowCount }, (_, rowIndex) => {
        const rowNumber = rowIndex + 2;
        const formula = formulaForRow({
          prompt,
          rowNumber,
          targetColumn,
          sheet
        });

        return {
          type: "sheet.set_formula",
          target: {
            cell: `${targetColumn}${rowNumber}`
          },
          formula
        };
      }));
  }

  return [
    normalizeWorkspaceToolCall({
      id: "hydria-os-local-sheet-formula",
      type: "workspace_tool_call",
      title: "Apply Sheet formula",
      target: {
        workObjectId: activeWorkObject?.id || "",
        entryPath: workObjectEntryPath(activeWorkObject) || "table.csv"
      },
      payload: {
        instruction: prompt,
        workspaceFamilyId: workObjectFamilyId(activeWorkObject),
        currentKind: activeWorkObject?.objectKind || activeWorkObject?.kind || "dataset",
        toolName: "sheet.apply_formula",
        operations
      },
      riskLevel: "low",
      rationale: "Hydria OS local Sheet guardrail synthesized this call from a clear spreadsheet formula request."
    })
  ].filter(Boolean);
}

export function applyHydriaWorkspaceToolOperationsToContent(content = "", rawOperations = []) {
  const operations = (Array.isArray(rawOperations) ? rawOperations : [rawOperations])
    .map(normalizeWorkspaceOperation)
    .filter(Boolean);
  const model = parseHydriaSheetModel(content);
  const sheet = activeSheetForOperations(model, operations);
  const applied = [];
  const issues = [];

  if (!sheet) {
    return {
      content,
      applied,
      issues: ["No sheet is available in the target work object."]
    };
  }

  for (const operation of operations) {
    const result = applySheetOperation(sheet, operation, model);
    if (result.applied) {
      applied.push(result.applied);
    }
    if (result.issue) {
      issues.push(result.issue);
    }
  }

  if (!operations.length) {
    issues.push("No workspace tool operations were provided.");
  }

  return {
    content: serializeHydriaSheetModel(model),
    applied,
    issues
  };
}

export function applyHydriaDocumentToolOperationsToContent(content = "", rawOperations = []) {
  const operations = (Array.isArray(rawOperations) ? rawOperations : [rawOperations])
    .map(normalizeWorkspaceOperation)
    .filter(Boolean);
  const applied = [];
  const issues = [];
  let nextContent = String(content || "");

  for (const operation of operations) {
    const result = applyDocumentOperation(nextContent, operation);
    nextContent = result.content;
    if (result.applied) {
      applied.push(result.applied);
    }
    if (result.issue) {
      issues.push(result.issue);
    }
  }

  if (!operations.length) {
    issues.push("No workspace tool operations were provided.");
  }

  return {
    content: nextContent,
    applied,
    issues
  };
}

export function applyHydriaSlideToolOperationsToContent(content = "", rawOperations = []) {
  const operations = (Array.isArray(rawOperations) ? rawOperations : [rawOperations])
    .map(normalizeWorkspaceOperation)
    .filter(Boolean);
  const applied = [];
  const issues = [];
  let nextContent = String(content || "");

  for (const operation of operations) {
    const result = applySlideOperation(nextContent, operation);
    nextContent = result.content;
    if (result.applied) {
      applied.push(result.applied);
    }
    if (result.issue) {
      issues.push(result.issue);
    }
  }

  if (!operations.length) {
    issues.push("No workspace tool operations were provided.");
  }

  return {
    content: nextContent,
    applied,
    issues
  };
}

function applyWorkspaceToolOperationsToContent({ engine = "", content = "", operations = [] } = {}) {
  if (engine === "sheet") {
    return applyHydriaWorkspaceToolOperationsToContent(content, operations);
  }
  if (engine === "doc") {
    return applyHydriaDocumentToolOperationsToContent(content, operations);
  }
  if (engine === "slide") {
    return applyHydriaSlideToolOperationsToContent(content, operations);
  }
  return {
    content,
    applied: [],
    issues: ["No supported workspace engine matched this work object."]
  };
}

function isRiskyWorkspaceToolCall(call = null, operations = [], engine = "") {
  const riskLevel = String(call?.riskLevel || "").toLowerCase();
  if (call?.requiresConfirmation || ["high", "critical"].includes(riskLevel)) {
    return true;
  }
  return operations.some((operation) => {
    if (engine === "doc" && operation.type === "doc.replace_block") {
      return operation.target?.wholeFile || operation.target?.blockId === "whole-file" || !operation.target?.oldText;
    }
    if (engine === "slide" && operation.type === "slide.reorder") {
      return true;
    }
    return false;
  });
}

function buildWorkspaceToolTrace({ call = null, prompt = "", applied = null, engine = "" } = {}) {
  return {
    provider: "hydria_core",
    type: "workspace_tool_call",
    toolName: call?.payload?.toolName || "",
    engine,
    request: compact(prompt || call?.payload?.instruction || "", 500),
    action: {
      id: call?.id || "",
      title: call?.title || "",
      target: call?.target || {},
      operations: call?.payload?.operations || [],
      riskLevel: call?.riskLevel || "",
      requiresConfirmation: Boolean(call?.requiresConfirmation)
    },
    result: {
      applied: applied?.applied || [],
      issues: applied?.issues || []
    }
  };
}

function buildWorkspaceToolHistoryNote(trace = {}) {
  const operations = (trace.action?.operations || []).map((operation) => operation.type).filter(Boolean);
  return [
    `Hydria Core workspace_tool_call ${trace.toolName || ""}`.trim(),
    trace.engine ? `engine=${trace.engine}` : "",
    operations.length ? `operations=${operations.join(",")}` : "",
    trace.request ? `request=${trace.request}` : "",
    trace.result?.applied?.length ? `applied=${trace.result.applied.join(",")}` : "",
    trace.result?.issues?.length ? `issues=${trace.result.issues.join(",")}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

export async function executeWorkspaceToolCalls({
  calls = [],
  proposedActions = [],
  userId,
  prompt = "",
  confirmed = false,
  activeWorkObject = null,
  workObjectService = null
} = {}) {
  if (!workObjectService) {
    throw new AppError("Work object service is required for workspace tool calls.", 500);
  }

  const normalizedCalls = (calls.length ? calls : normalizeWorkspaceToolCallsFromCore({ proposedActions }))
    .map(normalizeWorkspaceToolCall)
    .filter(Boolean);
  const results = [];

  for (const call of normalizedCalls) {
    const workObjectId = call.target.workObjectId || activeWorkObject?.id || "";
    const entryPath = call.target.entryPath || workObjectEntryPath(activeWorkObject) || "table.csv";
    if (!workObjectId) {
      results.push({
        type: "workspace_tool_call",
        status: "failed",
        toolName: call.payload.toolName,
        issues: ["workspace_tool_call is missing target.workObjectId."]
      });
      continue;
    }

    const current = workObjectService.readContent({
      workObjectId,
      entryPath
    });
    assertWorkObjectAccess(current.workObject, userId);

    const currentWorkObject = {
      ...current.workObject,
      primaryFile: current.entryPath,
      workspaceFamilyId: current.workObject?.metadata?.workspaceFamilyId || ""
    };
    const engine = workspaceEngineForWorkObject(currentWorkObject, call);
    const operations = enrichWorkspaceOperations(call.payload.operations, { prompt, call });
    if (!engine) {
      results.push({
        type: "workspace_tool_call",
        status: "skipped",
        toolName: call.payload.toolName,
        workObjectId,
        entryPath: current.entryPath,
        issues: ["This work object does not expose a supported workspace tool engine."]
      });
      continue;
    }

    if (call.dryRun) {
      const dryRunApplied = applyWorkspaceToolOperationsToContent({
        engine,
        content: current.content,
        operations
      });
      results.push({
        type: "workspace_tool_call",
        status: "dry_run",
        toolName: call.payload.toolName,
        engine,
        workObjectId,
        entryPath: current.entryPath,
        operationsApplied: dryRunApplied.applied,
        issues: dryRunApplied.issues,
        trace: buildWorkspaceToolTrace({ call, prompt, applied: dryRunApplied, engine })
      });
      continue;
    }

    if (isRiskyWorkspaceToolCall(call, operations, engine) && !confirmed) {
      results.push({
        type: "workspace_tool_call",
        status: "needs_confirmation",
        toolName: call.payload.toolName,
        engine,
        workObjectId,
        entryPath: current.entryPath,
        operationsApplied: [],
        issues: ["Workspace tool call requires confirmation before execution."],
        trace: buildWorkspaceToolTrace({
          call,
          prompt,
          applied: {
            applied: [],
            issues: ["Workspace tool call requires confirmation before execution."]
          },
          engine
        })
      });
      continue;
    }

    const applied = applyWorkspaceToolOperationsToContent({
      engine,
      content: current.content,
      operations
    });

    if (!applied.applied.length) {
      results.push({
        type: "workspace_tool_call",
        status: "skipped",
        toolName: call.payload.toolName,
        engine,
        workObjectId,
        entryPath: current.entryPath,
        operationsApplied: [],
        issues: applied.issues,
        trace: buildWorkspaceToolTrace({ call, prompt, applied, engine })
      });
      continue;
    }
    const trace = buildWorkspaceToolTrace({ call, prompt, applied, engine });

    const updated = await workObjectService.updateContent({
      workObjectId,
      entryPath: current.entryPath,
      content: applied.content,
      note: buildWorkspaceToolHistoryNote(trace),
      actor: "hydria_core_api"
    });

    results.push({
      type: "workspace_tool_call",
      status: "completed",
      toolName: call.payload.toolName,
      engine,
      workObjectId,
      entryPath: current.entryPath,
      operationsApplied: applied.applied,
      issues: applied.issues,
      workObject: updated,
      trace,
      finalAnswer: `J'ai applique ${applied.applied.length} operation(s) workspace sur ${updated.title || "l'objet"}.`
    });
  }

  return {
    executed: results.filter((result) => result.status === "completed").length,
    results
  };
}

export default {
  applyHydriaDocumentToolOperationsToContent,
  applyHydriaSlideToolOperationsToContent,
  applyHydriaWorkspaceToolOperationsToContent,
  buildHydriaWorkspaceToolContract,
  buildWorkspaceContextFields,
  executeWorkspaceToolCalls,
  listHydriaWorkspaceToolCatalog,
  listHydriaWorkspaceTools,
  listWorkspaceToolsForWorkObject,
  normalizeWorkspaceToolCallsFromCore,
  synthesizeWorkspaceToolCallsFromPrompt
};
