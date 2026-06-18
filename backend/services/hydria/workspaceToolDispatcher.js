import { AppError } from "../../utils/errors.js";
import { CRM_WORKSPACE_TOOLS } from "../crm/crmIntegrationClient.js";
import { filterContentPreviewByRole } from "./dataAccessFilterService.js";
import { getUserDataRole } from "../memory/historyService.js";

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
  "sheet.unhide_sheet",
  "sheet.group_rows",
  "sheet.ungroup_rows",
  "sheet.group_columns",
  "sheet.ungroup_columns",
  "sheet.transpose_range",
  "sheet.split_column",
  "sheet.set_column_type",
  "sheet.fill_down",
  "sheet.fill_right",
  "sheet.remove_duplicates",
  "sheet.find_replace",
  "sheet.import_data",
  "sheet.auto_sum",
  "sheet.copy_range",
  "sheet.set_horizontal_alignment",
  "sheet.set_vertical_alignment",
  "sheet.set_text_wrapping",
  "sheet.set_border",
  "sheet.clear_borders",
  "sheet.set_number_format",
  "sheet.set_fill_color",
  "sheet.set_text_color",
  "sheet.set_font_size",
  "sheet.set_font_family",
  "sheet.set_bold",
  "sheet.set_italic",
  "sheet.set_underline",
  "sheet.set_strikethrough",
  "sheet.insert_hyperlink",
  "sheet.remove_hyperlink",
  "sheet.insert_image",
  "sheet.insert_checkbox",
  "sheet.insert_dropdown",
  "sheet.lock_cell",
  "sheet.unlock_cell",
  "sheet.set_sheet_color",
  "sheet.clear_all",
  "sheet.set_print_area",
  "sheet.set_page_orientation",
  "sheet.set_page_size",
  "sheet.set_print_margins",
  "sheet.set_print_scaling",
  "sheet.insert_page_break",
  "sheet.set_repeat_rows",
  "sheet.set_repeat_columns",
  "sheet.hide_row",
  "sheet.unhide_row",
  "sheet.hide_column",
  "sheet.unhide_column",
  "sheet.bulk_set_values",
  "sheet.create_named_formula"
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
  "doc.resolve_comment",
  "doc.insert_header",
  "doc.insert_footer",
  "doc.insert_footnote",
  "doc.highlight_text",
  "doc.create_bookmark",
  "doc.insert_divider",
  "doc.insert_callout",
  "doc.insert_video",
  "doc.move_section",
  "doc.duplicate_section",
  "doc.set_language",
  "doc.set_author",
  "doc.add_tag",
  "doc.number_headings",
  "doc.insert_mention",
  "doc.format_text",
  "doc.set_text_color",
  "doc.set_font_family",
  "doc.set_font_size",
  "doc.set_text_alignment",
  "doc.set_line_spacing",
  "doc.set_page_margin",
  "doc.set_page_size",
  "doc.set_page_orientation",
  "doc.insert_page_number",
  "doc.insert_date_field",
  "doc.insert_time_field",
  "doc.insert_watermark",
  "doc.insert_cover_image",
  "doc.insert_cross_reference",
  "doc.insert_signature_block",
  "doc.track_changes",
  "doc.accept_change",
  "doc.reject_change",
  "doc.set_columns",
  "doc.insert_text_box",
  "doc.insert_shape"
]);
const DOC_WORKSPACE_TOOL_ALIASES = Object.freeze(["doc.edit"]);
const SLIDE_WORKSPACE_TOOLS = Object.freeze([
  "slide.add",
  "slide.update",
  "slide.reorder",
  "slide.delete",
  "slide.duplicate",
  "slide.set_layout",
  "slide.insert_image",
  "slide.add_notes",
  "slide.set_background",
  "slide.add_table",
  "slide.add_shape",
  "slide.add_text_box",
  "slide.add_transition",
  "slide.set_theme",
  "slide.add_chart",
  "slide.add_video",
  "slide.set_footer",
  "slide.set_slide_number",
  "slide.add_logo",
  "slide.copy_style",
  "slide.set_aspect_ratio",
  "slide.set_custom_size",
  "slide.add_animation",
  "slide.remove_animation",
  "slide.add_hyperlink",
  "slide.remove_hyperlink",
  "slide.set_master_slide",
  "slide.create_section",
  "slide.rename_section",
  "slide.delete_section",
  "slide.align_objects",
  "slide.distribute_objects",
  "slide.set_z_order",
  "slide.group_objects",
  "slide.ungroup_objects",
  "slide.set_object_opacity",
  "slide.set_object_size",
  "slide.set_object_position",
  "slide.insert_icon",
  "slide.show_guides",
  "slide.show_grid",
  "slide.snap_to_grid",
  "slide.add_placeholder",
  "slide.insert_smart_art"
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
  "sheet.unhide_sheet",
  "sheet.group_rows",
  "sheet.ungroup_rows",
  "sheet.group_columns",
  "sheet.ungroup_columns",
  "sheet.transpose_range",
  "sheet.split_column",
  "sheet.set_column_type",
  "sheet.fill_down",
  "sheet.fill_right",
  "sheet.remove_duplicates",
  "sheet.find_replace",
  "sheet.import_data",
  "sheet.auto_sum",
  "sheet.copy_range",
  "sheet.set_horizontal_alignment",
  "sheet.set_vertical_alignment",
  "sheet.set_text_wrapping",
  "sheet.set_border",
  "sheet.clear_borders",
  "sheet.set_number_format",
  "sheet.set_fill_color",
  "sheet.set_text_color",
  "sheet.set_font_size",
  "sheet.set_font_family",
  "sheet.set_bold",
  "sheet.set_italic",
  "sheet.set_underline",
  "sheet.set_strikethrough",
  "sheet.insert_hyperlink",
  "sheet.remove_hyperlink",
  "sheet.insert_image",
  "sheet.insert_checkbox",
  "sheet.insert_dropdown",
  "sheet.lock_cell",
  "sheet.unlock_cell",
  "sheet.set_sheet_color",
  "sheet.clear_all",
  "sheet.set_print_area",
  "sheet.set_page_orientation",
  "sheet.set_page_size",
  "sheet.set_print_margins",
  "sheet.set_print_scaling",
  "sheet.insert_page_break",
  "sheet.set_repeat_rows",
  "sheet.set_repeat_columns",
  "sheet.hide_row",
  "sheet.unhide_row",
  "sheet.hide_column",
  "sheet.unhide_column",
  "sheet.bulk_set_values",
  "sheet.create_named_formula"
]);
const WORKSPACE_META_TOOLS = Object.freeze(["workspace.import_from", "workspace.read"]);
const SUPPORTED_DOC_OPERATIONS = new Set(DOC_WORKSPACE_TOOLS);
const SUPPORTED_SLIDE_OPERATIONS = new Set(SLIDE_WORKSPACE_TOOLS);
const SUPPORTED_CRM_OPERATIONS = new Set(CRM_WORKSPACE_TOOLS);
const CELL_FORMAT_OPS = new Set([
  "sheet.set_horizontal_alignment", "sheet.set_vertical_alignment", "sheet.set_text_wrapping",
  "sheet.set_border", "sheet.clear_borders", "sheet.set_number_format", "sheet.set_fill_color",
  "sheet.set_text_color", "sheet.set_font_size", "sheet.set_font_family",
  "sheet.set_bold", "sheet.set_italic", "sheet.set_underline", "sheet.set_strikethrough",
  "sheet.clear_all"
]);
const SUPPORTED_WORKSPACE_OPERATIONS = new Set([
  ...SUPPORTED_SHEET_OPERATIONS,
  ...SUPPORTED_DOC_OPERATIONS,
  ...SUPPORTED_SLIDE_OPERATIONS,
  ...SUPPORTED_CRM_OPERATIONS,
  ...WORKSPACE_META_TOOLS
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

function isCrmWorkObject(workObject = null) {
  const familyId = workObjectFamilyId(workObject).toLowerCase();
  const entryPath = workObjectEntryPath(workObject).toLowerCase();
  return familyId === "crm_sales" || entryPath.startsWith("crm://");
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
  if (toolName.startsWith("crm.") || operationType.startsWith("crm.")) {
    return "crm";
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
  if (isCrmWorkObject(workObject)) {
    return "crm";
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
  // Preserve rows:[] (sheet emptied of all rows) — only insert the default when rows is missing entirely
  const rows = (Array.isArray(sheet.rows) ? sheet.rows : [["", "", ""]]).map((row) =>
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
    filterColumnIndex: ((v) => (typeof v === "number" || (typeof v === "string" && v !== "")) && Number.isInteger(Number(v)) ? Number(v) : -1)(sheet.filterColumnIndex),
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
    // Start at rowIndex=1 to match the single-cell convention (cell.rowIndex+1 = 1-indexed format key)
    return Array.from({ length: sheet.rows.length }, (_, rowIndex) => [rowIndex + 1, columnIndex]);
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

  if (operation.type === "sheet.group_rows" || operation.type === "sheet.ungroup_rows") {
    const fromRow = Number(operation.raw?.fromRow ?? operation.target?.fromIndex ?? -1);
    const toRow = Number(operation.raw?.toRow ?? operation.target?.toIndex ?? fromRow);
    if (fromRow < 0) return { applied: "", issue: `${operation.type} requires fromRow.` };
    if (!sheet.metadata) sheet.metadata = {};
    if (!Array.isArray(sheet.metadata.rowGroups)) sheet.metadata.rowGroups = [];
    if (operation.type === "sheet.ungroup_rows") {
      sheet.metadata.rowGroups = sheet.metadata.rowGroups.filter((g) => !(g.from === fromRow && g.to === toRow));
    } else {
      sheet.metadata.rowGroups.push({ from: fromRow, to: toRow, collapsed: Boolean(operation.raw?.collapsed) });
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.group_columns" || operation.type === "sheet.ungroup_columns") {
    const fromCol = resolveSheetColumnIndex(sheet, operation);
    if (fromCol < 0) return { applied: "", issue: `${operation.type} requires a column target.` };
    const toCol = Number.isInteger(operation.raw?.toColumn) ? operation.raw.toColumn : fromCol;
    if (!sheet.metadata) sheet.metadata = {};
    if (!Array.isArray(sheet.metadata.colGroups)) sheet.metadata.colGroups = [];
    if (operation.type === "sheet.ungroup_columns") {
      sheet.metadata.colGroups = sheet.metadata.colGroups.filter((g) => g.from !== fromCol);
    } else {
      sheet.metadata.colGroups.push({ from: fromCol, to: toCol, collapsed: Boolean(operation.raw?.collapsed) });
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.transpose_range") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    if (!parsed) return { applied: "", issue: "sheet.transpose_range requires a valid range (e.g. A1:C5)." };
    const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = parsed;
    const block = [];
    for (let r = sr; r <= er; r++) {
      const rowData = [];
      for (let c = sc; c <= ec; c++) rowData.push(sheet.rows[r]?.[c] ?? "");
      block.push(rowData);
    }
    const transposed = block[0].map((_, colIdx) => block.map((row) => row[colIdx]));
    ensureSheetWidth(sheet, sc + transposed[0].length);
    ensureSheetRows(sheet, sr + transposed.length - 1);
    for (let r = 0; r < transposed.length; r++) {
      for (let c = 0; c < transposed[r].length; c++) {
        sheet.rows[sr + r][sc + c] = transposed[r][c];
      }
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_column_type") {
    const colIndex = resolveSheetColumnIndex(sheet, operation);
    if (colIndex < 0) return { applied: "", issue: "sheet.set_column_type requires a column target." };
    const colType = String(operation.raw?.type || operation.raw?.colType || operation.value || "text").trim();
    if (!sheet.columns[colIndex]) return { applied: "", issue: "Column not found." };
    // columns are plain strings after normalizeSheet — store type separately to avoid spreading a string
    if (!sheet.columnTypes) sheet.columnTypes = {};
    sheet.columnTypes[colIndex] = colType;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.fill_down") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    if (!parsed) return { applied: "", issue: "sheet.fill_down requires a valid range (e.g. A1:A10)." };
    const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = parsed;
    ensureSheetRows(sheet, er);
    ensureSheetWidth(sheet, ec + 1);
    for (let c = sc; c <= ec; c++) {
      const src = sheet.rows[sr]?.[c] ?? "";
      for (let r = sr + 1; r <= er; r++) sheet.rows[r][c] = src;
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.fill_right") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    if (!parsed) return { applied: "", issue: "sheet.fill_right requires a valid range (e.g. A1:E1)." };
    const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = parsed;
    ensureSheetRows(sheet, er);
    ensureSheetWidth(sheet, ec + 1);
    for (let r = sr; r <= er; r++) {
      const src = sheet.rows[r]?.[sc] ?? "";
      for (let c = sc + 1; c <= ec; c++) sheet.rows[r][c] = src;
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.remove_duplicates") {
    const checkColNames = Array.isArray(operation.raw?.columns) ? operation.raw.columns : null;
    const checkCols = checkColNames
      ? checkColNames.map((n) => resolveSheetColumnIndex(sheet, { target: { columnName: String(n) } })).filter((i) => i >= 0)
      : null;
    const seen = new Set();
    const nextRows = [];
    for (const row of sheet.rows) {
      const key = checkCols ? checkCols.map((c) => String(row[c] ?? "")).join("\x00") : row.map(String).join("\x00");
      if (!seen.has(key)) { seen.add(key); nextRows.push(row); }
    }
    const removed = sheet.rows.length - nextRows.length;
    sheet.rows = nextRows;
    return { applied: operation.type, issue: removed === 0 ? "No duplicate rows found." : "" };
  }

  if (operation.type === "sheet.find_replace") {
    const find = String(operation.raw?.find || operation.raw?.search || "").trim();
    const replace = String(operation.raw?.replace ?? operation.raw?.with ?? "");
    if (!find) return { applied: "", issue: "sheet.find_replace requires raw.find." };
    const flags = operation.raw?.caseSensitive ? "g" : "gi";
    const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    let count = 0;
    sheet.rows = sheet.rows.map((row) => row.map((cell) => {
      const next = String(cell).replace(pattern, replace);
      if (next !== String(cell)) count++;
      return next;
    }));
    return { applied: operation.type, issue: count === 0 ? `"${find}" not found in any cell.` : "" };
  }

  if (operation.type === "sheet.import_data") {
    const data = operation.raw?.data || operation.raw?.rows;
    if (!Array.isArray(data) || data.length === 0) return { applied: "", issue: "sheet.import_data requires raw.data (array of arrays or objects)." };
    const maxImport = Math.min(data.length, 500);
    for (let i = 0; i < maxImport; i++) {
      const row = data[i];
      if (Array.isArray(row)) {
        ensureSheetWidth(sheet, row.length);
        sheet.rows.push(row.map(String));
      } else if (row && typeof row === "object") {
        // columns are plain strings after normalizeSheet — use the string directly as the object key
        const rowArray = sheet.columns.map((col) => { const k = typeof col === "object" ? (col.name || col.id || "") : String(col ?? ""); return String(row[k] ?? row[k.toLowerCase()] ?? ""); });
        ensureSheetWidth(sheet, rowArray.length);
        sheet.rows.push(rowArray);
      }
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.auto_sum") {
    const parsed = parseA1Range(operation.range || operation.target?.cell || "");
    const colIndex = resolveSheetColumnIndex(sheet, operation);
    if (colIndex >= 0 && !parsed) {
      const colLetter = columnIndexToA1(colIndex);
      const dataEnd = sheet.rows.length;
      // dataEnd is the 0-based index of the new SUM row; spreadsheet row for data index i = i+2.
      // All data rows are 0..dataEnd-1 → spreadsheet rows 2..dataEnd+1.
      const formula = `=SUM(${colLetter}2:${colLetter}${Math.max(2, dataEnd + 1)})`;
      ensureSheetRows(sheet, dataEnd);
      ensureSheetWidth(sheet, colIndex + 1);
      sheet.rows[dataEnd][colIndex] = formula;
      return { applied: operation.type, issue: "" };
    }
    if (parsed) {
      const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = parsed;
      // sr/er are 0-based data-row indices (A2=0); spreadsheet row number = data-row index + 2
      const formula = `=SUM(${columnIndexToA1(sc)}${sr + 2}:${columnIndexToA1(ec)}${er + 2})`;
      const targetRow = er + 1;
      ensureSheetRows(sheet, targetRow);
      ensureSheetWidth(sheet, sc + 1);
      sheet.rows[targetRow][sc] = formula;
      return { applied: operation.type, issue: "" };
    }
    return { applied: "", issue: "sheet.auto_sum requires a column target or range." };
  }

  if (operation.type === "sheet.copy_range") {
    const src = parseA1Range(operation.raw?.sourceRange || operation.range || "");
    const destCell = String(operation.raw?.destCell || operation.raw?.destination || "").trim();
    if (!src || !destCell) return { applied: "", issue: "sheet.copy_range requires raw.sourceRange and raw.destCell." };
    const destParsed = parseA1Range(destCell);
    if (!destParsed) return { applied: "", issue: "sheet.copy_range: invalid destCell." };
    const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = src;
    const { startRowIndex: dr, startColumnIndex: dc } = destParsed;
    const height = er - sr;
    const width = ec - sc;
    ensureSheetRows(sheet, dr + height);
    ensureSheetWidth(sheet, dc + width + 1);
    for (let r = 0; r <= height; r++) {
      for (let c = 0; c <= width; c++) {
        sheet.rows[dr + r][dc + c] = sheet.rows[sr + r]?.[sc + c] ?? "";
      }
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.split_column") {
    const colIndex = resolveSheetColumnIndex(sheet, operation);
    if (colIndex < 0) return { applied: "", issue: "sheet.split_column requires a column target." };
    const delimiter = String(operation.raw?.delimiter || operation.value || ",").trim() || ",";
    const maxParts = Math.min(Math.max(Number(operation.raw?.maxParts || 2), 2), 10);
    // sheet.columns are plain strings after normalizeSheet — use the string directly as the new column name
    const srcColName = String(sheet.columns[colIndex] ?? `Column ${colIndex + 1}`);
    for (let i = 1; i < maxParts; i++) {
      sheet.columns.splice(colIndex + i, 0, `${srcColName} ${i + 1}`);
    }
    sheet.rows = sheet.rows.map((row) => {
      const parts = String(row[colIndex] ?? "").split(delimiter).map((p) => p.trim());
      const nextRow = [...row];
      for (let i = 0; i < maxParts; i++) nextRow[colIndex + i] = parts[i] ?? "";
      return nextRow;
    });
    return { applied: operation.type, issue: "" };
  }

  // --- Formatting ops (range / column / cell targeted) ---
  if (CELL_FORMAT_OPS.has(operation.type)) {
    const rangeStr = operation.range || operation.target?.range || "";
    let formatTargets = [];
    if (rangeStr) {
      const r = parseA1Range(rangeStr);
      if (r) {
        for (let row = r.startRowIndex; row <= r.endRowIndex; row++) {
          for (let col = r.startColumnIndex; col <= r.endColumnIndex; col++) {
            formatTargets.push([row + 1, col]);
          }
        }
      }
    }
    if (!formatTargets.length) formatTargets = targetCellsForFormat(sheet, operation);
    if (!formatTargets.length) return { applied: "", issue: `${operation.type} requires a cell, column, or range target.` };
    sheet.cellFormats = sheet.cellFormats || {};
    const enable = operation.raw?.enable !== false && operation.value !== "false";
    for (const [rowIndex, colIndex] of formatTargets) {
      const key = `${rowIndex}:${colIndex}`;
      const existing = sheet.cellFormats[key] || {};
      if (operation.type === "sheet.set_horizontal_alignment") {
        sheet.cellFormats[key] = { ...existing, horizontalAlignment: compact(operation.value || operation.raw?.alignment || "left", 20) };
      } else if (operation.type === "sheet.set_vertical_alignment") {
        sheet.cellFormats[key] = { ...existing, verticalAlignment: compact(operation.value || operation.raw?.alignment || "bottom", 20) };
      } else if (operation.type === "sheet.set_text_wrapping") {
        sheet.cellFormats[key] = { ...existing, textWrap: compact(operation.value || operation.raw?.mode || "overflow", 20) };
      } else if (operation.type === "sheet.set_border") {
        const side = compact(operation.raw?.side || "all", 20);
        const style = compact(operation.raw?.style || "thin", 20);
        const color = compact(operation.raw?.color || "#000000", 40);
        const prev = existing.border || {};
        const sides = side === "all" ? ["top", "bottom", "left", "right"] : [side];
        const next = { ...prev };
        for (const s of sides) next[s] = { style, color };
        sheet.cellFormats[key] = { ...existing, border: next };
      } else if (operation.type === "sheet.clear_borders") {
        const { border: _b, ...rest } = existing;
        sheet.cellFormats[key] = rest;
      } else if (operation.type === "sheet.set_number_format") {
        sheet.cellFormats[key] = { ...existing, numberFormat: compact(operation.value || operation.raw?.format || "", 80) };
      } else if (operation.type === "sheet.set_fill_color") {
        sheet.cellFormats[key] = { ...existing, fillColor: compact(operation.value || operation.raw?.color || "", 40) };
      } else if (operation.type === "sheet.set_text_color") {
        sheet.cellFormats[key] = { ...existing, textColor: compact(operation.value || operation.raw?.color || "", 40) };
      } else if (operation.type === "sheet.set_font_size") {
        const size = Number(operation.value || operation.raw?.size || 12);
        sheet.cellFormats[key] = { ...existing, fontSize: Number.isFinite(size) ? size : 12 };
      } else if (operation.type === "sheet.set_font_family") {
        sheet.cellFormats[key] = { ...existing, fontFamily: compact(operation.value || operation.raw?.family || "", 80) };
      } else if (operation.type === "sheet.set_bold") {
        sheet.cellFormats[key] = { ...existing, bold: enable };
      } else if (operation.type === "sheet.set_italic") {
        sheet.cellFormats[key] = { ...existing, italic: enable };
      } else if (operation.type === "sheet.set_underline") {
        sheet.cellFormats[key] = { ...existing, underline: enable };
      } else if (operation.type === "sheet.set_strikethrough") {
        sheet.cellFormats[key] = { ...existing, strikethrough: enable };
      } else if (operation.type === "sheet.clear_all") {
        delete sheet.cellFormats[key];
        if (rowIndex > 0 && sheet.rows[rowIndex - 1]) sheet.rows[rowIndex - 1][colIndex] = "";
      }
    }
    return { applied: operation.type, issue: "" };
  }

  // --- Hyperlink / image / interactive cell ops ---
  if (operation.type === "sheet.insert_hyperlink") {
    const url = compact(operation.raw?.url || operation.value || "", 2000);
    const label = compact(operation.raw?.label || operation.raw?.text || url, 200);
    const targetCell = operation.target?.cell || "";
    if (!url || !targetCell) return { applied: "", issue: "sheet.insert_hyperlink requires target.cell and raw.url." };
    const parsed = parseA1Cell(targetCell);
    if (!parsed) return { applied: "", issue: "sheet.insert_hyperlink: invalid target.cell." };
    ensureSheetRows(sheet, parsed.rowIndex);
    ensureSheetWidth(sheet, parsed.columnIndex + 1);
    sheet.rows[parsed.rowIndex][parsed.columnIndex] = `=HYPERLINK("${url}","${label}")`;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.remove_hyperlink") {
    const targetCell = operation.target?.cell || "";
    if (!targetCell) return { applied: "", issue: "sheet.remove_hyperlink requires target.cell." };
    const parsed = parseA1Cell(targetCell);
    if (!parsed) return { applied: "", issue: "sheet.remove_hyperlink: invalid target.cell." };
    const rowIndex = parsed.rowIndex;
    if (sheet.rows[rowIndex]) {
      const val = String(sheet.rows[rowIndex][parsed.columnIndex] || "");
      if (val.toUpperCase().startsWith("=HYPERLINK")) sheet.rows[rowIndex][parsed.columnIndex] = "";
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_image") {
    const url = compact(operation.raw?.url || operation.value || "", 2000);
    const targetCell = operation.target?.cell || "";
    if (!url || !targetCell) return { applied: "", issue: "sheet.insert_image requires target.cell and raw.url." };
    const parsed = parseA1Cell(targetCell);
    if (!parsed) return { applied: "", issue: "sheet.insert_image: invalid target.cell." };
    ensureSheetRows(sheet, parsed.rowIndex);
    ensureSheetWidth(sheet, parsed.columnIndex + 1);
    sheet.rows[parsed.rowIndex][parsed.columnIndex] = `=IMAGE("${url}")`;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_checkbox") {
    const targetCell = operation.target?.cell || "";
    if (!targetCell) return { applied: "", issue: "sheet.insert_checkbox requires target.cell." };
    const parsed = parseA1Cell(targetCell);
    if (!parsed) return { applied: "", issue: "sheet.insert_checkbox: invalid target.cell." };
    ensureSheetRows(sheet, parsed.rowIndex);
    ensureSheetWidth(sheet, parsed.columnIndex + 1);
    sheet.rows[parsed.rowIndex][parsed.columnIndex] = "FALSE";
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_dropdown") {
    const items = Array.isArray(operation.raw?.items) ? operation.raw.items : (operation.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return { applied: "", issue: "sheet.insert_dropdown requires raw.items (array) or value (comma-separated)." };
    const rangeStr = operation.range || operation.target?.range || operation.target?.cell || "";
    if (!rangeStr) return { applied: "", issue: "sheet.insert_dropdown requires a range or target.cell." };
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.dataValidation) sheet.metadata.dataValidation = {};
    sheet.metadata.dataValidation[rangeStr] = { type: "list", values: items.map((v) => compact(String(v), 200)) };
    return { applied: operation.type, issue: "" };
  }

  // --- Cell locking ---
  if (operation.type === "sheet.lock_cell" || operation.type === "sheet.unlock_cell") {
    const targetCell = operation.target?.cell || operation.range || "";
    if (!targetCell) return { applied: "", issue: `${operation.type} requires target.cell or range.` };
    if (!sheet.metadata) sheet.metadata = {};
    if (!Array.isArray(sheet.metadata.lockedCells)) sheet.metadata.lockedCells = [];
    if (operation.type === "sheet.lock_cell") {
      if (!sheet.metadata.lockedCells.includes(targetCell)) sheet.metadata.lockedCells.push(targetCell);
    } else {
      sheet.metadata.lockedCells = sheet.metadata.lockedCells.filter((c) => c !== targetCell);
    }
    return { applied: operation.type, issue: "" };
  }

  // --- Sheet color ---
  if (operation.type === "sheet.set_sheet_color") {
    sheet.color = compact(operation.value || operation.raw?.color || "", 40);
    return { applied: operation.type, issue: "" };
  }

  // --- Print settings ---
  if (operation.type === "sheet.set_print_area") {
    const area = compact(operation.value || operation.range || operation.raw?.area || "", 100);
    if (!area) return { applied: "", issue: "sheet.set_print_area requires a range value." };
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.area = area;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_page_orientation") {
    const orientation = compact(operation.value || operation.raw?.orientation || "portrait", 20);
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.orientation = orientation;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_page_size") {
    const size = compact(operation.value || operation.raw?.size || "A4", 20);
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.pageSize = size;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_print_margins") {
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.margins = {
      top: Number(operation.raw?.top ?? 1), bottom: Number(operation.raw?.bottom ?? 1),
      left: Number(operation.raw?.left ?? 1), right: Number(operation.raw?.right ?? 1)
    };
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_print_scaling") {
    const scaling = Math.min(400, Math.max(10, Number(operation.value || operation.raw?.percent || 100)));
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.scaling = scaling;
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.insert_page_break") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex) ? operation.target.rowIndex : Number(operation.value || -1);
    if (rowIndex < 0) return { applied: "", issue: "sheet.insert_page_break requires target.rowIndex." };
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    if (!Array.isArray(sheet.metadata.print.pageBreaks)) sheet.metadata.print.pageBreaks = [];
    if (!sheet.metadata.print.pageBreaks.includes(rowIndex)) sheet.metadata.print.pageBreaks.push(rowIndex);
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_repeat_rows") {
    const from = Number(operation.raw?.from ?? operation.raw?.startRow ?? 0);
    const to = Number(operation.raw?.to ?? operation.raw?.endRow ?? from);
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.repeatRows = { from, to };
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.set_repeat_columns") {
    const from = Number(operation.raw?.from ?? operation.raw?.startColumn ?? 0);
    const to = Number(operation.raw?.to ?? operation.raw?.endColumn ?? from);
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.print) sheet.metadata.print = {};
    sheet.metadata.print.repeatColumns = { from, to };
    return { applied: operation.type, issue: "" };
  }

  // --- Row/column visibility ---
  if (operation.type === "sheet.hide_row" || operation.type === "sheet.unhide_row") {
    const rowIndex = Number.isInteger(operation.target?.rowIndex) ? operation.target.rowIndex : Number(operation.value ?? -1);
    if (rowIndex < 0) return { applied: "", issue: `${operation.type} requires target.rowIndex.` };
    if (!sheet.metadata) sheet.metadata = {};
    if (!Array.isArray(sheet.metadata.hiddenRows)) sheet.metadata.hiddenRows = [];
    if (operation.type === "sheet.hide_row") {
      if (!sheet.metadata.hiddenRows.includes(rowIndex)) sheet.metadata.hiddenRows.push(rowIndex);
    } else {
      sheet.metadata.hiddenRows = sheet.metadata.hiddenRows.filter((r) => r !== rowIndex);
    }
    return { applied: operation.type, issue: "" };
  }

  if (operation.type === "sheet.hide_column" || operation.type === "sheet.unhide_column") {
    const colIndex = resolveSheetColumnIndex(sheet, operation);
    if (colIndex < 0) return { applied: "", issue: `${operation.type} requires a column target.` };
    if (!sheet.metadata) sheet.metadata = {};
    if (!Array.isArray(sheet.metadata.hiddenColumns)) sheet.metadata.hiddenColumns = [];
    if (operation.type === "sheet.hide_column") {
      if (!sheet.metadata.hiddenColumns.includes(colIndex)) sheet.metadata.hiddenColumns.push(colIndex);
    } else {
      sheet.metadata.hiddenColumns = sheet.metadata.hiddenColumns.filter((c) => c !== colIndex);
    }
    return { applied: operation.type, issue: "" };
  }

  // --- Bulk set values ---
  if (operation.type === "sheet.bulk_set_values") {
    const entries = Array.isArray(operation.raw?.entries) ? operation.raw.entries : [];
    if (!entries.length) return { applied: "", issue: "sheet.bulk_set_values requires raw.entries (array of {cell, value})." };
    let applied = 0;
    for (const entry of entries) {
      const parsed = parseA1Cell(String(entry?.cell || ""));
      if (!parsed) continue;
      ensureSheetRows(sheet, parsed.rowIndex);
      ensureSheetWidth(sheet, parsed.columnIndex + 1);
      sheet.rows[parsed.rowIndex][parsed.columnIndex] = entry.value ?? "";
      applied++;
    }
    return { applied: applied > 0 ? operation.type : "", issue: applied === 0 ? "No valid entries in raw.entries." : "" };
  }

  // --- Named formula ---
  if (operation.type === "sheet.create_named_formula") {
    const name = compact(operation.raw?.name || operation.title || "", 120);
    const formula = normalizeFormula(operation.raw?.formula || operation.formula || operation.value || "");
    if (!name || !formula) return { applied: "", issue: "sheet.create_named_formula requires raw.name and raw.formula." };
    if (!sheet.metadata) sheet.metadata = {};
    if (!sheet.metadata.namedFormulas) sheet.metadata.namedFormulas = {};
    sheet.metadata.namedFormulas[name] = formula;
    return { applied: operation.type, issue: "" };
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
    // Skip markdown separator rows like | --- | --- | or | :--- | ---: |
    .filter((row) => row.length && !row.every((cell) => /^[-: ]+$/.test(cell)));
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
  // Pad each body row to header.length so HTML/Markdown tables have consistent column counts
  const paddedBodyRows = safeBodyRows.map((row) =>
    Array.from({ length: header.length }, (_, i) => row[i] ?? "")
  );

  if (html) {
    return [
      "<table>",
      `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`,
      `<tbody>${paddedBodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`,
      "</table>"
    ].join("");
  }

  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...paddedBodyRows.map((row) => `| ${row.join(" | ")} |`)
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

  // $(?![\s\S]) = true end-of-string in multiline mode (plain $ matches end-of-line with m flag)
  const pattern = new RegExp(`\\n*^#{1,6}\\s+.*${escapedTitle}.*\\n[\\s\\S]*?(?=\\n#{1,6}\\s+|$(?![\\s\\S]))`, "im");
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
    // Strip existing metadata marker so repeated calls don't accumulate stale blocks
    const stripped = html
      ? content.replace(/<meta\s+name="hydria-metadata"[^>]*>/gi, "").trim()
      : content.replace(/<!--\s*hydria-metadata:[^>]*-->\n?/g, "").trim();
    return { content: appendWithSpacing(stripped, marker), applied: operation.type, issue: "" };
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

  if (operation.type === "doc.insert_header") {
    const text = paragraphText(operation);
    if (!text) return { content, applied: "", issue: "doc.insert_header requires text." };
    const header = html ? `<header><p>${escapeHtml(text)}</p></header>\n\n` : `---\n**${text}**\n\n---\n\n`;
    return { content: header + content, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_footer") {
    const text = paragraphText(operation);
    if (!text) return { content, applied: "", issue: "doc.insert_footer requires text." };
    const footer = html ? `\n\n<footer><p>${escapeHtml(text)}</p></footer>` : `\n\n---\n\n**${text}**`;
    return { content: content + footer, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_footnote") {
    const ref = String(operation.raw?.ref || operation.target?.ref || "").trim() || String(Date.now()).slice(-4);
    const text = paragraphText(operation);
    if (!text) return { content, applied: "", issue: "doc.insert_footnote requires text." };
    const footnote = html ? `<sup id="fn${ref}"><a href="#fnref${ref}">[${ref}]</a></sup> ${escapeHtml(text)}` : `[^${ref}]: ${text}`;
    return { content: appendWithSpacing(content, footnote), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.highlight_text") {
    const searchText = String(operation.raw?.searchText || operation.raw?.text || operation.value || "").trim();
    if (!searchText) return { content, applied: "", issue: "doc.highlight_text requires searchText." };
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Use replacer function to prevent $ sequences in searchText from being interpreted
    const htmlMark = `<mark>${escapeHtml(searchText)}</mark>`;
    const mdMark = `==${searchText}==`;
    const highlighted = html
      ? content.replace(new RegExp(escaped, "g"), () => htmlMark)
      : content.replace(new RegExp(escaped, "g"), () => mdMark);
    if (highlighted === content) return { content, applied: "", issue: `doc.highlight_text: text not found "${searchText}".` };
    return { content: highlighted, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.create_bookmark") {
    const name = String(operation.raw?.name || operation.value || operation.title || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!name) return { content, applied: "", issue: "doc.create_bookmark requires a name." };
    const bookmark = `<a id="${name}"></a>`;
    return { content: appendWithSpacing(content, bookmark), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_divider") {
    return { content: appendWithSpacing(content, html ? "<hr />" : "---"), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_callout") {
    const kind = String(operation.raw?.kind || operation.raw?.type || "info").trim();
    const text = paragraphText(operation);
    if (!text) return { content, applied: "", issue: "doc.insert_callout requires text." };
    const callout = html
      ? `<div class="callout callout-${escapeHtml(kind)}"><strong>${escapeHtml(kind.toUpperCase())}</strong>: ${escapeHtml(text)}</div>`
      : `> **${kind.toUpperCase()}**: ${text}`;
    return { content: appendWithSpacing(content, callout), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_video") {
    const url = String(operation.raw?.url || operation.value || "").trim();
    if (!url) return { content, applied: "", issue: "doc.insert_video requires raw.url." };
    const title = String(operation.raw?.title || operation.title || "Vidéo").trim();
    const video = html
      ? `<figure><video src="${escapeHtml(url)}" controls title="${escapeHtml(title)}"></video><figcaption>${escapeHtml(title)}</figcaption></figure>`
      : `[▶ ${title}](${url})`;
    return { content: appendWithSpacing(content, video), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.move_section") {
    const heading = sectionTitle(operation) || String(operation.raw?.heading || "").trim();
    const afterHeading = String(operation.raw?.afterHeading || "").trim();
    const beforeHeading = String(operation.raw?.beforeHeading || "").trim();
    if (!heading) return { content, applied: "", issue: "doc.move_section requires a heading (section to move)." };
    if (!afterHeading && !beforeHeading) return { content, applied: "", issue: "doc.move_section requires raw.afterHeading or raw.beforeHeading." };
    const parts = content.split(/\n(?=#{1,6} )/);
    const normH = normalizeLabel(heading);
    const normRef = normalizeLabel(afterHeading || beforeHeading);
    const srcIdx = parts.findIndex((p) => normalizeLabel(p.match(/^#{1,6} (.+)/m)?.[1] || "") === normH);
    if (srcIdx < 0) return { content, applied: "", issue: `doc.move_section: section "${heading}" not found.` };
    const [srcBlock] = parts.splice(srcIdx, 1);
    const refIdx = parts.findIndex((p) => normalizeLabel(p.match(/^#{1,6} (.+)/m)?.[1] || "") === normRef);
    if (refIdx < 0) { parts.splice(srcIdx, 0, srcBlock); return { content, applied: "", issue: `doc.move_section: reference section "${afterHeading || beforeHeading}" not found.` }; }
    parts.splice(afterHeading ? refIdx + 1 : refIdx, 0, srcBlock);
    return { content: parts.join("\n"), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.duplicate_section") {
    const heading = sectionTitle(operation) || String(operation.raw?.heading || "").trim();
    if (!heading) return { content, applied: "", issue: "doc.duplicate_section requires a heading (section to copy)." };
    const newTitle = String(operation.title || operation.raw?.newTitle || `${heading} (copie)`).trim();
    const parts = content.split(/\n(?=#{1,6} )/);
    const normH = normalizeLabel(heading);
    const srcIdx = parts.findIndex((p) => normalizeLabel(p.match(/^#{1,6} (.+)/m)?.[1] || "") === normH);
    if (srcIdx < 0) return { content, applied: "", issue: `doc.duplicate_section: section "${heading}" not found.` };
    const headingLevel = parts[srcIdx].match(/^(#{1,6}) /m)?.[1] ?? "##";
    const copy = parts[srcIdx].replace(/^#{1,6} .+/m, `${headingLevel} ${newTitle}`);
    parts.splice(srcIdx + 1, 0, copy);
    return { content: parts.join("\n"), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_language") {
    const lang = String(operation.value || operation.raw?.language || operation.raw?.lang || "").trim();
    if (!lang) return { content, applied: "", issue: "doc.set_language requires a language code (e.g. fr, en)." };
    const cleaned = content.replace(/<!--\s*lang:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- lang: ${lang} -->\n${cleaned}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_author") {
    const author = String(operation.value || operation.raw?.author || "").trim();
    if (!author) return { content, applied: "", issue: "doc.set_author requires an author name." };
    const cleaned = content.replace(/<!--\s*author:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- author: ${author} -->\n${cleaned}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.add_tag") {
    const tag = String(operation.value || operation.raw?.tag || "").trim();
    if (!tag) return { content, applied: "", issue: "doc.add_tag requires a tag value." };
    const tagMatch = content.match(/<!--\s*tags:\s*([^>]*)-->/i);
    if (tagMatch) {
      const existing = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      if (!existing.includes(tag)) existing.push(tag);
      return { content: content.replace(/<!--\s*tags:\s*[^>]*-->/i, `<!-- tags: ${existing.join(", ")} -->`), applied: operation.type, issue: "" };
    }
    const cleaned = content.replace(/<!--\s*tags:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- tags: ${tag} -->\n${cleaned}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.number_headings") {
    let counter = 0;
    const numbered = content.replace(/^(#{1,6} )(?:\d+\.\s*)?(.+)$/gm, (_m, hashes, title) => {
      counter++;
      return `${hashes}${counter}. ${title.trim()}`;
    });
    return { content: numbered, applied: operation.type, issue: counter === 0 ? "No headings found to number." : "" };
  }

  if (operation.type === "doc.insert_mention") {
    const name = String(operation.raw?.name || operation.value || "").trim();
    if (!name) return { content, applied: "", issue: "doc.insert_mention requires raw.name or value." };
    const mention = html ? `<span class="mention">@${escapeHtml(name)}</span>` : `[@${name}]`;
    return { content: appendWithSpacing(content, mention), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.format_text") {
    const searchText = String(operation.raw?.text || operation.value || "").trim();
    const format = String(operation.raw?.format || "bold").trim();
    if (!searchText) return { content, applied: "", issue: "doc.format_text requires raw.text and raw.format (bold/italic/underline/strikethrough)." };
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let formatted = searchText;
    if (format === "bold") formatted = html ? `<strong>${searchText}</strong>` : `**${searchText}**`;
    else if (format === "italic") formatted = html ? `<em>${searchText}</em>` : `*${searchText}*`;
    else if (format === "underline") formatted = `<u>${searchText}</u>`;
    else if (format === "strikethrough") formatted = html ? `<s>${searchText}</s>` : `~~${searchText}~~`;
    else if (format === "code") formatted = html ? `<code>${escapeHtml(searchText)}</code>` : `\`${searchText}\``;
    const next = content.replace(new RegExp(escaped, "g"), () => formatted);
    if (next === content) return { content, applied: "", issue: `doc.format_text: text not found "${searchText}".` };
    return { content: next, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_text_color") {
    const searchText = String(operation.raw?.text || "").trim();
    const color = String(operation.raw?.color || operation.value || "#000000").trim();
    if (!searchText) return { content, applied: "", issue: "doc.set_text_color requires raw.text and raw.color." };
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const colored = `<span style="color:${color}">${escapeHtml(searchText)}</span>`;
    const next = content.replace(new RegExp(escaped, "g"), () => colored);
    if (next === content) return { content, applied: "", issue: `doc.set_text_color: text not found "${searchText}".` };
    return { content: next, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_font_family") {
    const family = String(operation.value || operation.raw?.family || "Arial").trim();
    const stripped = content.replace(/<!--\s*fontFamily:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- fontFamily: ${family} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_font_size") {
    const size = String(operation.value || operation.raw?.size || "12").trim();
    const stripped = content.replace(/<!--\s*fontSize:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- fontSize: ${size}pt -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_text_alignment") {
    const alignment = String(operation.value || operation.raw?.alignment || "left").trim();
    const stripped = content.replace(/<!--\s*textAlign:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- textAlign: ${alignment} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_line_spacing") {
    const spacing = String(operation.value || operation.raw?.spacing || "1.5").trim();
    const stripped = content.replace(/<!--\s*lineSpacing:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- lineSpacing: ${spacing} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_page_margin") {
    const top = operation.raw?.top ?? operation.raw?.margin ?? 2.5;
    const bottom = operation.raw?.bottom ?? top;
    const left = operation.raw?.left ?? top;
    const right = operation.raw?.right ?? top;
    const stripped = content.replace(/<!--\s*pageMargin:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- pageMargin: ${top}cm ${right}cm ${bottom}cm ${left}cm -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_page_size") {
    const size = String(operation.value || operation.raw?.size || "A4").trim();
    const stripped = content.replace(/<!--\s*pageSize:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- pageSize: ${size} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_page_orientation") {
    const orientation = String(operation.value || operation.raw?.orientation || "portrait").trim();
    const stripped = content.replace(/<!--\s*pageOrientation:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- pageOrientation: ${orientation} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_page_number") {
    const position = String(operation.raw?.position || "bottom-center").trim();
    const stripped = content.replace(/<!--\s*pageNumbers:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- pageNumbers: ${position} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_date_field") {
    const fmt = String(operation.raw?.format || operation.value || "YYYY-MM-DD").trim();
    const field = html ? `<time class="date-field" data-format="${escapeHtml(fmt)}">{DATE}</time>` : `{{DATE:${fmt}}}`;
    return { content: appendWithSpacing(content, field), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_time_field") {
    const fmt = String(operation.raw?.format || operation.value || "HH:mm").trim();
    const field = html ? `<time class="time-field" data-format="${escapeHtml(fmt)}">{TIME}</time>` : `{{TIME:${fmt}}}`;
    return { content: appendWithSpacing(content, field), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_watermark") {
    const text = String(operation.value || operation.raw?.text || "DRAFT").trim();
    const stripped = content.replace(/<!--\s*watermark:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- watermark: ${text} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_cover_image") {
    const url = String(operation.raw?.url || operation.value || "").trim();
    if (!url) return { content, applied: "", issue: "doc.insert_cover_image requires raw.url." };
    const alt = String(operation.raw?.alt || operation.title || "Cover image").trim();
    const coverBlock = html ? `<figure class="cover-image"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"></figure>` : `![${alt}](${url})`;
    return { content: coverBlock + "\n\n" + content, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_cross_reference") {
    const ref = String(operation.raw?.ref || operation.raw?.bookmarkName || operation.value || "").trim();
    if (!ref) return { content, applied: "", issue: "doc.insert_cross_reference requires raw.ref or raw.bookmarkName." };
    const label = String(operation.raw?.label || operation.title || ref).trim();
    const crossRef = html ? `<a href="#${escapeHtml(ref)}">${escapeHtml(label)}</a>` : `[${label}](#${ref})`;
    return { content: appendWithSpacing(content, crossRef), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_signature_block") {
    const name = String(operation.raw?.name || operation.value || "").trim();
    const role = String(operation.raw?.role || operation.raw?.title || "").trim();
    const block = html
      ? `<div class="signature-block"><p>Signature: ___________________</p>${name ? `<p>${escapeHtml(name)}</p>` : ""}${role ? `<p>${escapeHtml(role)}</p>` : ""}</div>`
      : `\n---\n\nSignature: ___________________${name ? `\n${name}` : ""}${role ? `\n${role}` : ""}\n`;
    return { content: appendWithSpacing(content, block), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.track_changes") {
    const enable = operation.raw?.enable !== false && operation.value !== "false";
    const stripped = content.replace(/<!--\s*trackChanges:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- trackChanges: ${enable} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.accept_change" || operation.type === "doc.reject_change") {
    const id = String(operation.raw?.id || operation.value || "").trim();
    const pattern = id
      ? new RegExp(`<!--\\s*change:${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:[\\s\\S]*?-->`, "g")
      : /<!--\s*change:[\s\S]*?-->/g;
    if (operation.type === "doc.accept_change") {
      const next = content.replace(pattern, (m) => {
        const val = m.match(/value="([^"]*)"/)?.[1];
        return val !== undefined ? val : m;
      });
      return { content: next, applied: operation.type, issue: "" };
    }
    return { content: content.replace(pattern, ""), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.set_columns") {
    const count = Math.min(6, Math.max(1, Number(operation.value || operation.raw?.count || 1)));
    const stripped = content.replace(/<!--\s*columns:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- columns: ${count} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_text_box") {
    const text = paragraphText(operation);
    const x = operation.raw?.x ?? 0;
    const y = operation.raw?.y ?? 0;
    const w = operation.raw?.width ?? 200;
    const bh = operation.raw?.height ?? 50;
    const box = html
      ? `<div class="text-box" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${bh}px;">${escapeHtml(text)}</div>`
      : `<!-- text-box: x=${x}, y=${y}, width=${w}, height=${bh} -->\n${text}`;
    return { content: appendWithSpacing(content, box), applied: operation.type, issue: "" };
  }

  if (operation.type === "doc.insert_shape") {
    const kind = String(operation.raw?.shape || operation.raw?.kind || "rectangle").trim();
    const x = operation.raw?.x ?? 0;
    const y = operation.raw?.y ?? 0;
    const w = operation.raw?.width ?? 100;
    const bh = operation.raw?.height ?? 100;
    const color = String(operation.raw?.color || "#cccccc").trim();
    const shape = html
      ? `<div class="shape shape-${escapeHtml(kind)}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${bh}px;background:${escapeHtml(color)};"></div>`
      : `<!-- shape: ${kind}, x=${x}, y=${y}, width=${w}, height=${bh}, color=${color} -->`;
    return { content: appendWithSpacing(content, shape), applied: operation.type, issue: "" };
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

function updateSlideHydriaMeta(body, updates) {
  const META_OPEN = "<!-- hydria-slide:";
  const startIdx = body.indexOf(META_OPEN);
  let existing = {};
  let stripped = body;
  if (startIdx >= 0) {
    const endIdx = body.indexOf("-->", startIdx);
    if (endIdx >= 0) {
      const fragment = body.slice(startIdx + META_OPEN.length, endIdx).trim();
      try { existing = JSON.parse(fragment); } catch {}
      stripped = (body.slice(0, startIdx) + body.slice(endIdx + 3)).trim();
    }
  }
  const merged = { ...existing, ...updates };
  return `${stripped}\n<!-- hydria-slide: ${JSON.stringify(merged)} -->`.trim();
}

function resolveSlideIndex(slides = [], operation = {}) {
  const target = operation.target || {};
  if (Number.isInteger(target.slideIndex)) {
    if (target.slideIndex < 0 || target.slideIndex >= slides.length) return -1;
    return target.slideIndex;
  }
  if (Number.isInteger(target.slideNumber)) {
    const idx = target.slideNumber - 1;
    if (idx < 0 || idx >= slides.length) return -1;
    return idx;
  }
  const rawId = compact(target.blockId || operation.raw?.slideId || operation.raw?.id || "", 120);
  const idMatch = rawId.match(/slide-(\d+)/i);
  if (idMatch) {
    const idx = Number(idMatch[1]) - 1;
    if (idx < 0 || idx >= slides.length) return -1;
    return idx;
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
    const newSlide = { id: `slide-${deck.slides.length + 1}`, title, body };
    // Honour target.slideIndex when provided; default to appending
    const insertAt = Number.isInteger(operation.target?.slideIndex) && operation.target.slideIndex >= 0
      ? Math.min(operation.target.slideIndex, deck.slides.length)
      : deck.slides.length;
    const nextSlides = [...deck.slides.slice(0, insertAt), newSlide, ...deck.slides.slice(insertAt)];
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

  if (operation.type === "slide.delete") {
    if (deck.slides.length <= 1) {
      return { content, applied: "", issue: "Cannot delete the last remaining slide." };
    }
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.delete requires an existing slide target." };
    }
    const nextSlides = deck.slides.filter((_, idx) => idx !== slideIndex);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.duplicate") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.duplicate requires an existing slide target." };
    }
    const original = deck.slides[slideIndex];
    const copyTitle = operation.title || operation.raw?.title || `${original.title} (copy)`;
    const copy = { id: `slide-${deck.slides.length + 1}`, title: copyTitle, body: original.body };
    const nextSlides = [...deck.slides];
    nextSlides.splice(slideIndex + 1, 0, copy);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.set_layout") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.set_layout requires an existing slide target." };
    }
    const layout = String(operation.value || operation.raw?.layout || "").trim();
    if (!layout) {
      return { content, applied: "", issue: "slide.set_layout requires a layout value." };
    }
    const slide = deck.slides[slideIndex];
    // Store as hydria-slide JSON so the frontend can read it via parsePresentationSlideMeta
    const cleanBody = slide.body.replace(/<!--\s*layout:[^>]*-->/gi, "").trim();
    const updatedBody = updateSlideHydriaMeta(cleanBody, { layout });
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: updatedBody } : s);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.insert_image") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.insert_image requires an existing slide target." };
    }
    const imageUrl = String(operation.raw?.imageUrl || operation.raw?.url || operation.value || "").trim();
    if (!imageUrl) {
      return { content, applied: "", issue: "slide.insert_image requires an imageUrl." };
    }
    const altText = String(operation.raw?.altText || operation.raw?.alt || "image").trim();
    const slide = deck.slides[slideIndex];
    const updatedBody = `${slide.body}\n\n![${altText}](${imageUrl})`.trim();
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: updatedBody } : s);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.add_notes") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.add_notes requires an existing slide target." };
    }
    const notes = paragraphText(operation) || String(operation.raw?.notes || "").trim();
    if (!notes) {
      return { content, applied: "", issue: "slide.add_notes requires a notes value." };
    }
    const slide = deck.slides[slideIndex];
    const updatedBody = slide.body
      .replace(/<!--\s*notes:[^>]*-->/gi, "")
      .trim()
      .concat(`\n<!-- notes: ${notes.replace(/-->/g, "- >")} -->`);
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: updatedBody } : s);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.set_background") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) {
      return { content, applied: "", issue: "slide.set_background requires an existing slide target." };
    }
    const background = String(operation.value || operation.raw?.background || operation.raw?.color || "").trim();
    if (!background) {
      return { content, applied: "", issue: "slide.set_background requires a background value (color or image URL)." };
    }
    const slide = deck.slides[slideIndex];
    // Store as hydria-slide JSON so the frontend can read it via parsePresentationSlideMeta
    const cleanBody = slide.body.replace(/<!--\s*background:[^>]*-->/gi, "").trim();
    const updatedBody = updateSlideHydriaMeta(cleanBody, { background });
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: updatedBody } : s);
    return {
      content: buildPresentationContent({ title: deck.title, slides: nextSlides }),
      applied: operation.type,
      issue: ""
    };
  }

  if (operation.type === "slide.add_table") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_table requires an existing slide target." };
    const headers = Array.isArray(operation.raw?.headers) ? operation.raw.headers.map(String) : ["Colonne 1", "Colonne 2"];
    const rows = Array.isArray(operation.raw?.rows) ? operation.raw.rows : [];
    const tableLines = [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...rows.map((row) => `| ${(Array.isArray(row) ? row : [String(row)]).map(String).join(" | ")} |`)
    ];
    const slide = deck.slides[slideIndex];
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n\n${tableLines.join("\n")}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_shape") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_shape requires an existing slide target." };
    const shape = String(operation.raw?.shape || operation.raw?.type || operation.value || "rectangle").trim();
    const label = String(operation.raw?.label || operation.raw?.text || "").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- shape: ${shape}${label ? `, "${label}"` : ""} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_text_box") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_text_box requires an existing slide target." };
    const text = paragraphText(operation) || String(operation.raw?.text || "").trim();
    if (!text) return { content, applied: "", issue: "slide.add_text_box requires text content." };
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- textbox: ${text.replace(/-->/g, "- >")} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_transition") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_transition requires an existing slide target." };
    const transition = String(operation.value || operation.raw?.transition || "fade").trim();
    const slide = deck.slides[slideIndex];
    const updatedBody = slide.body.replace(/<!--\s*transition:[^>]*-->/gi, "").trim() + `\n<!-- transition: ${transition} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: updatedBody } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_theme") {
    const theme = String(operation.value || operation.raw?.theme || "").trim();
    if (!theme) return { content, applied: "", issue: "slide.set_theme requires a theme name." };
    const cleanContent = content.replace(/<!--\s*theme:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- theme: ${theme} -->\n${cleanContent}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_chart") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_chart requires an existing slide target." };
    const chartType = String(operation.raw?.chartType || operation.raw?.type || "bar").trim();
    const dataRef = String(operation.raw?.dataRef || operation.raw?.source || "").trim();
    const title = String(operation.raw?.title || operation.title || "").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- chart: ${chartType}${title ? `, "${title}"` : ""}${dataRef ? `, source="${dataRef}"` : ""} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_video") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_video requires an existing slide target." };
    const url = String(operation.raw?.url || operation.value || "").trim();
    if (!url) return { content, applied: "", issue: "slide.add_video requires raw.url." };
    const videoTitle = String(operation.raw?.title || operation.title || "Vidéo").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- video: "${videoTitle}", url="${url}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_footer") {
    const footerText = String(operation.value || operation.raw?.text || operation.raw?.footer || "").trim();
    if (!footerText) return { content, applied: "", issue: "slide.set_footer requires a footer text (value or raw.text)." };
    const cleanContent = content.replace(/<!--\s*footer:[^>]*-->\n?/gi, "").trim();
    return { content: `${cleanContent}\n<!-- footer: ${footerText} -->`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_slide_number") {
    const show = operation.value !== "false" && operation.raw?.show !== false;
    const cleanContent = content.replace(/<!--\s*slide-numbers:[^>]*-->\n?/gi, "").trim();
    return { content: `${cleanContent}\n<!-- slide-numbers: ${show ? "on" : "off"} -->`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_logo") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_logo requires an existing slide target." };
    const url = String(operation.raw?.url || operation.value || "").trim();
    if (!url) return { content, applied: "", issue: "slide.add_logo requires raw.url." };
    const alt = String(operation.raw?.alt || "logo").trim();
    const position = String(operation.raw?.position || "top-right").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- logo: url="${url}", alt="${alt}", position="${position}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.copy_style") {
    const srcIndex = Number.isInteger(operation.raw?.fromSlideIndex) ? operation.raw.fromSlideIndex : resolveSlideIndex(deck.slides, { target: { heading: String(operation.raw?.fromSlide || "") } });
    const destIndex = resolveSlideIndex(deck.slides, operation);
    if (srcIndex < 0 || srcIndex >= deck.slides.length) return { content, applied: "", issue: "slide.copy_style requires raw.fromSlideIndex (source slide)." };
    if (destIndex < 0) return { content, applied: "", issue: "slide.copy_style requires a destination slide target." };
    const srcSlide = deck.slides[srcIndex];
    const stylePattern = /<!--\s*(?:layout|background|theme|transition):[^>]*-->/gi;
    const srcStyles = (srcSlide.body.match(stylePattern) || []).join("\n");
    if (!srcStyles) return { content, applied: "", issue: "Source slide has no style annotations to copy." };
    const destSlide = deck.slides[destIndex];
    const cleanDest = destSlide.body.replace(stylePattern, "").trim();
    const nextSlides = deck.slides.map((s, i) => i === destIndex ? { ...s, body: `${cleanDest}\n${srcStyles}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_aspect_ratio") {
    const ratio = String(operation.value || operation.raw?.ratio || "16:9").trim();
    const stripped = content.replace(/<!--\s*aspectRatio:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- aspectRatio: ${ratio} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_custom_size") {
    const w = operation.raw?.width ?? 1920;
    const h = operation.raw?.height ?? 1080;
    const unit = String(operation.raw?.unit || "px").trim();
    const stripped = content.replace(/<!--\s*slideSize:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- slideSize: ${w}${unit}x${h}${unit} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_animation") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_animation requires an existing slide target." };
    const animType = String(operation.raw?.animation || operation.value || "fade").trim();
    const target = String(operation.raw?.target || "all").trim();
    const duration = Number(operation.raw?.duration || 0.5);
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- animation: type="${animType}", target="${target}", duration=${duration}s -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.remove_animation") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.remove_animation requires an existing slide target." };
    const slide = deck.slides[slideIndex];
    const cleaned = slide.body.replace(/<!--\s*animation:[^>]*-->\n?/gi, "").trim();
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: cleaned } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_hyperlink") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_hyperlink requires an existing slide target." };
    const url = String(operation.raw?.url || operation.value || "").trim();
    if (!url) return { content, applied: "", issue: "slide.add_hyperlink requires raw.url." };
    const label = String(operation.raw?.label || operation.title || url).trim();
    const slide = deck.slides[slideIndex];
    const link = `[${label}](${url})`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${link}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.remove_hyperlink") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.remove_hyperlink requires an existing slide target." };
    const url = String(operation.raw?.url || operation.value || "").trim();
    const slide = deck.slides[slideIndex];
    const cleaned = url
      ? slide.body.replace(new RegExp(`\\[([^\\]]+)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g"), "$1")
      : slide.body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: cleaned } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_master_slide") {
    const master = String(operation.value || operation.raw?.master || "").trim();
    if (!master) return { content, applied: "", issue: "slide.set_master_slide requires a master name (value or raw.master)." };
    const stripped = content.replace(/<!--\s*master:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- master: ${master} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.create_section") {
    const sectionName = String(operation.value || operation.title || operation.raw?.name || "").trim();
    if (!sectionName) return { content, applied: "", issue: "slide.create_section requires a section name (value or raw.name)." };
    const afterIndex = Number.isInteger(operation.raw?.afterSlideIndex) ? operation.raw.afterSlideIndex : deck.slides.length - 1;
    const annotation = `<!-- section-start: "${sectionName}" -->`;
    if (afterIndex >= 0 && afterIndex < deck.slides.length) {
      const slide = deck.slides[afterIndex];
      const nextSlides = deck.slides.map((s, i) => i === afterIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
      return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
    }
    return { content: `${content}\n${annotation}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.rename_section") {
    const oldName = String(operation.raw?.oldName || operation.raw?.name || "").trim();
    const newName = String(operation.raw?.newName || operation.value || operation.title || "").trim();
    if (!oldName || !newName) return { content, applied: "", issue: "slide.rename_section requires raw.oldName and raw.newName." };
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = content.replace(new RegExp(`(<!--\\s*section-start:\\s*")${escaped}("\\s*-->)`, "g"), `$1${newName}$2`);
    if (next === content) return { content, applied: "", issue: `slide.rename_section: section "${oldName}" not found.` };
    return { content: next, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.delete_section") {
    const name = String(operation.value || operation.raw?.name || "").trim();
    if (!name) return { content, applied: "", issue: "slide.delete_section requires a section name (value or raw.name)." };
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = content.replace(new RegExp(`\\n?<!--\\s*section-start:\\s*"${escaped}"\\s*-->`, "g"), "");
    return { content: next, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.align_objects") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.align_objects requires an existing slide target." };
    const alignment = String(operation.value || operation.raw?.alignment || "center").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- align-objects: ${alignment} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.distribute_objects") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.distribute_objects requires an existing slide target." };
    const direction = String(operation.value || operation.raw?.direction || "horizontal").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- distribute-objects: ${direction} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_z_order") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.set_z_order requires an existing slide target." };
    const target = String(operation.raw?.target || "selected").trim();
    const order = String(operation.value || operation.raw?.order || "front").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- z-order: target="${target}", order="${order}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.group_objects" || operation.type === "slide.ungroup_objects") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: `${operation.type} requires an existing slide target.` };
    const action = operation.type === "slide.group_objects" ? "group" : "ungroup";
    const ids = Array.isArray(operation.raw?.objectIds) ? operation.raw.objectIds.join(",") : String(operation.raw?.objectIds || "selected");
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- ${action}-objects: "${ids}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_object_opacity") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.set_object_opacity requires an existing slide target." };
    const target = String(operation.raw?.target || "selected").trim();
    const opacity = Math.min(1, Math.max(0, Number(operation.value ?? operation.raw?.opacity ?? 1)));
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- set-opacity: target="${target}", opacity=${opacity} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_object_size") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.set_object_size requires an existing slide target." };
    const target = String(operation.raw?.target || "selected").trim();
    const w = operation.raw?.width ?? 200;
    const h = operation.raw?.height ?? 100;
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- set-size: target="${target}", width=${w}, height=${h} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.set_object_position") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.set_object_position requires an existing slide target." };
    const target = String(operation.raw?.target || "selected").trim();
    const x = operation.raw?.x ?? 0;
    const y = operation.raw?.y ?? 0;
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- set-position: target="${target}", x=${x}, y=${y} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.insert_icon") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.insert_icon requires an existing slide target." };
    const icon = String(operation.value || operation.raw?.icon || operation.raw?.name || "").trim();
    if (!icon) return { content, applied: "", issue: "slide.insert_icon requires an icon name (value or raw.icon)." };
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- icon: "${icon}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.show_guides") {
    const show = operation.value !== "false" && operation.raw?.show !== false;
    const stripped = content.replace(/<!--\s*guides:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- guides: ${show ? "on" : "off"} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.show_grid") {
    const show = operation.value !== "false" && operation.raw?.show !== false;
    const stripped = content.replace(/<!--\s*grid:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- grid: ${show ? "on" : "off"} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.snap_to_grid") {
    const enable = operation.value !== "false" && operation.raw?.enable !== false;
    const stripped = content.replace(/<!--\s*snapToGrid:[^>]*-->\n?/gi, "").trim();
    return { content: `<!-- snapToGrid: ${enable ? "on" : "off"} -->\n${stripped}`, applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.add_placeholder") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.add_placeholder requires an existing slide target." };
    const kind = String(operation.value || operation.raw?.kind || "text").trim();
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- placeholder: type="${kind}" -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
  }

  if (operation.type === "slide.insert_smart_art") {
    const slideIndex = resolveSlideIndex(deck.slides, operation);
    if (slideIndex < 0) return { content, applied: "", issue: "slide.insert_smart_art requires an existing slide target." };
    const kind = String(operation.value || operation.raw?.kind || "process").trim();
    const items = Array.isArray(operation.raw?.items) ? operation.raw.items.map((v) => String(v)).join(", ") : "";
    const slide = deck.slides[slideIndex];
    const annotation = `<!-- smart-art: type="${kind}"${items ? `, items="${items}"` : ""} -->`;
    const nextSlides = deck.slides.map((s, i) => i === slideIndex ? { ...s, body: `${slide.body}\n${annotation}`.trim() } : s);
    return { content: buildPresentationContent({ title: deck.title, slides: nextSlides }), applied: operation.type, issue: "" };
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
    ...SLIDE_WORKSPACE_TOOLS,
    ...CRM_WORKSPACE_TOOLS,
    ...WORKSPACE_META_TOOLS
  ];
}

export function listWorkspaceToolsForWorkObject(workObject = null) {
  if (isCrmWorkObject(workObject)) {
    return [...CRM_WORKSPACE_TOOLS];
  }
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
  if (String(toolName).startsWith("crm.")) {
    return "crm";
  }
  if (String(toolName).startsWith("workspace.")) {
    return "meta";
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
  if (SUPPORTED_CRM_OPERATIONS.has(toolName)) {
    return [toolName];
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
  if (toolName === "slide.add") return "Add a new slide at the end of the presentation.";
  if (toolName === "slide.update") return "Update the title or body of an existing slide.";
  if (toolName === "slide.reorder") return "Move a slide from one position to another.";
  if (toolName === "slide.delete") return "Remove a slide from the presentation.";
  if (toolName === "slide.duplicate") return "Duplicate an existing slide, optionally renaming the copy.";
  if (toolName === "slide.set_layout") return "Set the layout variant for a slide (e.g. 'title', 'two-column', 'blank').";
  if (toolName === "slide.insert_image") return "Insert an image into a slide using a URL and optional alt text.";
  if (toolName === "slide.add_notes") return "Add speaker notes to a slide (stored as a markdown comment).";
  if (toolName === "slide.set_background") return "Set the background color or image URL for a slide.";
  if (toolName.startsWith("slide.")) {
    return "Manipulate a Hydria presentation.";
  }
  if (toolName.startsWith("crm.")) {
    return "Create or update a record in the live Hydria CRM through the signed OS adapter.";
  }
  if (toolName === "workspace.import_from") {
    return "Read a compact preview of another workspace object to cross-reference data. Specify target.workObjectId and optional target.maxChars (max 4000).";
  }
  if (toolName === "workspace.read") {
    return "Read the FULL content of any workspace object (up to 20 000 chars). Use when the default preview isn't enough to answer. Specify target.workObjectId and optional target.maxChars.";
  }
  // Doc descriptions
  if (toolName === "doc.insert_header") return "Insert a header line at the top of the document.";
  if (toolName === "doc.insert_footer") return "Append a footer line at the bottom of the document.";
  if (toolName === "doc.insert_footnote") return "Add a footnote reference and text. Use raw.ref for the footnote id and value/body for the text.";
  if (toolName === "doc.highlight_text") return "Highlight all occurrences of searchText using ==text== syntax. Use raw.searchText.";
  if (toolName === "doc.create_bookmark") return "Insert an HTML anchor bookmark. Use raw.name or value for the anchor id.";
  // Slide descriptions
  if (toolName === "slide.add_table") return "Add a markdown table to a slide. Use raw.headers (array) and raw.rows (array of arrays).";
  if (toolName === "slide.add_shape") return "Add a shape annotation to a slide. Use raw.shape (e.g. rectangle, circle) and raw.label.";
  if (toolName === "slide.add_text_box") return "Add a floating text box annotation to a slide using value or body.";
  if (toolName === "slide.add_transition") return "Set a slide transition (e.g. fade, slide, zoom). Use value or raw.transition.";
  if (toolName === "slide.set_theme") return "Set the presentation-wide theme. Use value or raw.theme. Applies to all slides.";
  // Sheet descriptions
  if (toolName === "sheet.group_rows") return "Group rows for collapsible outline. Use raw.fromRow and raw.toRow.";
  if (toolName === "sheet.ungroup_rows") return "Remove a row group. Use raw.fromRow and raw.toRow.";
  if (toolName === "sheet.group_columns") return "Group columns for collapsible outline. Specify the column target.";
  if (toolName === "sheet.ungroup_columns") return "Remove a column group. Specify the column target.";
  if (toolName === "sheet.transpose_range") return "Transpose (flip rows/columns) in a range. Use range or target.cell with A1 notation.";
  if (toolName === "sheet.split_column") return "Split a column on a delimiter into multiple columns. Use raw.delimiter and raw.maxParts.";
  if (toolName === "sheet.set_column_type") return "Set the data type of a column (text, number, date, boolean, currency). Use raw.type.";
  if (toolName === "sheet.fill_down") return "Copy the top cell value down to fill the range. Use range in A1 notation.";
  if (toolName === "sheet.fill_right") return "Copy the leftmost cell value right to fill the range. Use range in A1 notation.";
  if (toolName === "sheet.remove_duplicates") return "Remove duplicate rows. Optionally specify raw.columns (array of column names) to compare only those.";
  if (toolName === "sheet.find_replace") return "Find and replace values across all cells. Use raw.find, raw.replace, and optional raw.caseSensitive.";
  if (toolName === "sheet.import_data") return "Append rows from JSON. Use raw.data (array of arrays or array of objects matching column names).";
  if (toolName === "sheet.auto_sum") return "Insert a SUM formula at the bottom of a column or after a range. Use a column target or range.";
  if (toolName === "sheet.copy_range") return "Copy a range to another location. Use raw.sourceRange and raw.destCell (A1 notation).";
  // New doc ops
  if (toolName === "doc.insert_divider") return "Insert a horizontal rule (---) to separate content.";
  if (toolName === "doc.insert_callout") return "Insert a callout block. Use raw.kind (info/warning/tip/error) and value/body for text.";
  if (toolName === "doc.insert_video") return "Embed a video reference. Use raw.url and optional raw.title.";
  if (toolName === "doc.move_section") return "Move a ## section to another position. Use heading for the section to move and raw.afterHeading or raw.beforeHeading for placement.";
  if (toolName === "doc.duplicate_section") return "Duplicate a ## section. Use heading for the source and optional raw.newTitle for the copy.";
  if (toolName === "doc.set_language") return "Set the document language code (e.g. fr, en). Stored as a metadata comment. Use value or raw.language.";
  if (toolName === "doc.set_author") return "Set the document author. Stored as a metadata comment. Use value or raw.author.";
  if (toolName === "doc.add_tag") return "Add a tag/label to the document (comma-separated list in metadata comment). Use value or raw.tag.";
  if (toolName === "doc.number_headings") return "Auto-number all ## headings (1. Title, 2. Title, ...). No parameters needed.";
  if (toolName === "doc.insert_mention") return "Insert an @mention inline. Use raw.name or value for the person's name.";
  // New slide ops
  if (toolName === "slide.add_chart") return "Add a chart annotation to a slide. Use raw.chartType (bar/line/pie/scatter), optional raw.title and raw.dataRef.";
  if (toolName === "slide.add_video") return "Embed a video reference on a slide. Use raw.url and optional raw.title.";
  if (toolName === "slide.set_footer") return "Set a footer text visible on all slides. Use value or raw.text.";
  if (toolName === "slide.set_slide_number") return "Show or hide slide numbers. Use value='true' or raw.show=true/false.";
  if (toolName === "slide.add_logo") return "Add a logo image to a slide. Use raw.url, optional raw.alt and raw.position (top-right/top-left/bottom-right/bottom-left).";
  if (toolName === "slide.copy_style") return "Copy layout/background/transition annotations from one slide to another. Use raw.fromSlideIndex and a destination slide target.";
  // New sheet formatting ops
  if (toolName === "sheet.set_horizontal_alignment") return "Set horizontal alignment (left/center/right/fill/justify) for a cell, column, or range. Use value or raw.alignment.";
  if (toolName === "sheet.set_vertical_alignment") return "Set vertical alignment (top/middle/bottom) for a cell, column, or range. Use value or raw.alignment.";
  if (toolName === "sheet.set_text_wrapping") return "Set text wrapping mode (wrap/overflow/clip) for a cell, column, or range. Use value or raw.mode.";
  if (toolName === "sheet.set_border") return "Add a border to cells. Use raw.side (all/top/bottom/left/right), raw.style (thin/thick/dashed/dotted), raw.color.";
  if (toolName === "sheet.clear_borders") return "Remove all borders from the target cell, column, or range.";
  if (toolName === "sheet.set_number_format") return "Set a number format string (e.g. '0.00', '#,##0', 'DD/MM/YYYY') for a cell, column, or range. Use value or raw.format.";
  if (toolName === "sheet.set_fill_color") return "Set the background fill color of a cell, column, or range. Use value or raw.color (hex or named color).";
  if (toolName === "sheet.set_text_color") return "Set the text/font color of a cell, column, or range. Use value or raw.color.";
  if (toolName === "sheet.set_font_size") return "Set the font size (in points) for a cell, column, or range. Use value or raw.size.";
  if (toolName === "sheet.set_font_family") return "Set the font family for a cell, column, or range. Use value or raw.family.";
  if (toolName === "sheet.set_bold") return "Enable or disable bold for a cell, column, or range. Use raw.enable (true/false, default true).";
  if (toolName === "sheet.set_italic") return "Enable or disable italic for a cell, column, or range. Use raw.enable (true/false, default true).";
  if (toolName === "sheet.set_underline") return "Enable or disable underline for a cell, column, or range. Use raw.enable (true/false, default true).";
  if (toolName === "sheet.set_strikethrough") return "Enable or disable strikethrough for a cell, column, or range. Use raw.enable (true/false, default true).";
  if (toolName === "sheet.insert_hyperlink") return "Insert a HYPERLINK formula in a cell. Use target.cell, raw.url, and optional raw.label.";
  if (toolName === "sheet.remove_hyperlink") return "Remove a HYPERLINK formula from a cell. Use target.cell.";
  if (toolName === "sheet.insert_image") return "Insert an IMAGE formula in a cell. Use target.cell and raw.url.";
  if (toolName === "sheet.insert_checkbox") return "Insert a checkbox (FALSE) in a cell. Use target.cell.";
  if (toolName === "sheet.insert_dropdown") return "Insert a dropdown data validation in a cell or range. Use raw.items (array) or value (comma-separated).";
  if (toolName === "sheet.lock_cell") return "Lock a cell or range (protect from editing). Use target.cell or range.";
  if (toolName === "sheet.unlock_cell") return "Unlock a previously locked cell or range. Use target.cell or range.";
  if (toolName === "sheet.set_sheet_color") return "Set the tab color of the sheet. Use value or raw.color.";
  if (toolName === "sheet.clear_all") return "Clear both cell content and formatting in a cell, column, or range.";
  if (toolName === "sheet.set_print_area") return "Set the print area for the sheet. Use value or range (A1:Z100 notation).";
  if (toolName === "sheet.set_page_orientation") return "Set the print page orientation (portrait/landscape). Use value or raw.orientation.";
  if (toolName === "sheet.set_page_size") return "Set the print page size (A4/A3/Letter/Legal...). Use value or raw.size.";
  if (toolName === "sheet.set_print_margins") return "Set print margins in cm. Use raw.top, raw.bottom, raw.left, raw.right.";
  if (toolName === "sheet.set_print_scaling") return "Set print scaling as a percentage (10-400). Use value or raw.percent.";
  if (toolName === "sheet.insert_page_break") return "Insert a manual page break before a row. Use target.rowIndex.";
  if (toolName === "sheet.set_repeat_rows") return "Set rows to repeat on each printed page. Use raw.from and raw.to (row indices).";
  if (toolName === "sheet.set_repeat_columns") return "Set columns to repeat on each printed page. Use raw.from and raw.to (column indices).";
  if (toolName === "sheet.hide_row") return "Hide a row by index. Use target.rowIndex.";
  if (toolName === "sheet.unhide_row") return "Unhide a previously hidden row. Use target.rowIndex.";
  if (toolName === "sheet.hide_column") return "Hide a column by name or index. Use a column target.";
  if (toolName === "sheet.unhide_column") return "Unhide a previously hidden column. Use a column target.";
  if (toolName === "sheet.bulk_set_values") return "Set multiple cell values in one call. Use raw.entries (array of {cell: 'A1', value: ...}).";
  if (toolName === "sheet.create_named_formula") return "Create a named formula. Use raw.name and raw.formula.";
  // New doc formatting ops
  if (toolName === "doc.format_text") return "Apply bold/italic/underline/strikethrough/code to an exact text string. Use raw.text and raw.format.";
  if (toolName === "doc.set_text_color") return "Color a specific text span. Use raw.text and raw.color (hex or named color).";
  if (toolName === "doc.set_font_family") return "Set the document-wide font family metadata. Use value or raw.family.";
  if (toolName === "doc.set_font_size") return "Set the document-wide font size metadata. Use value or raw.size (in points).";
  if (toolName === "doc.set_text_alignment") return "Set the document-wide text alignment metadata (left/center/right/justify). Use value or raw.alignment.";
  if (toolName === "doc.set_line_spacing") return "Set the document-wide line spacing metadata. Use value or raw.spacing (e.g. 1.5).";
  if (toolName === "doc.set_page_margin") return "Set page margins in cm. Use raw.top, raw.bottom, raw.left, raw.right.";
  if (toolName === "doc.set_page_size") return "Set the page size (A4/Letter/A3...). Use value or raw.size.";
  if (toolName === "doc.set_page_orientation") return "Set the page orientation (portrait/landscape). Use value or raw.orientation.";
  if (toolName === "doc.insert_page_number") return "Add a page number field. Use raw.position (bottom-center/top-right...).";
  if (toolName === "doc.insert_date_field") return "Insert a dynamic date placeholder. Use raw.format (e.g. YYYY-MM-DD).";
  if (toolName === "doc.insert_time_field") return "Insert a dynamic time placeholder. Use raw.format (e.g. HH:mm).";
  if (toolName === "doc.insert_watermark") return "Add a watermark text to the document. Use value or raw.text (e.g. DRAFT, CONFIDENTIAL).";
  if (toolName === "doc.insert_cover_image") return "Add a cover image at the top of the document. Use raw.url and optional raw.alt.";
  if (toolName === "doc.insert_cross_reference") return "Insert a cross-reference link to a bookmark. Use raw.ref (bookmark name) and optional raw.label.";
  if (toolName === "doc.insert_signature_block") return "Insert a signature block. Use raw.name and optional raw.role.";
  if (toolName === "doc.track_changes") return "Enable or disable change tracking. Use raw.enable (true/false) or value.";
  if (toolName === "doc.accept_change") return "Accept a tracked change by id. Use raw.id or leave empty to accept all.";
  if (toolName === "doc.reject_change") return "Reject a tracked change by id. Use raw.id or leave empty to reject all.";
  if (toolName === "doc.set_columns") return "Set the number of text columns in the document layout (1-6). Use value or raw.count.";
  if (toolName === "doc.insert_text_box") return "Insert a floating text box. Use value for text, raw.x/y for position, raw.width/height for size.";
  if (toolName === "doc.insert_shape") return "Insert a shape annotation. Use raw.shape (rectangle/circle/arrow...), raw.x/y, raw.width/height, raw.color.";
  // New slide ops 2
  if (toolName === "slide.set_aspect_ratio") return "Set the slide aspect ratio (e.g. 16:9, 4:3). Use value or raw.ratio.";
  if (toolName === "slide.set_custom_size") return "Set a custom slide size. Use raw.width, raw.height, and optional raw.unit (px/cm/in).";
  if (toolName === "slide.add_animation") return "Add an animation to slide elements. Use raw.animation (fade/fly/zoom...), raw.target, raw.duration.";
  if (toolName === "slide.remove_animation") return "Remove all animation annotations from a slide.";
  if (toolName === "slide.add_hyperlink") return "Add a hyperlink to a slide. Use raw.url, optional raw.label. Targets the slide by index or heading.";
  if (toolName === "slide.remove_hyperlink") return "Remove a hyperlink from a slide. Use raw.url to remove a specific link, or leave empty for all.";
  if (toolName === "slide.set_master_slide") return "Set the master slide template. Use value or raw.master (master name).";
  if (toolName === "slide.create_section") return "Create a section marker in the presentation. Use value or raw.name, optional raw.afterSlideIndex.";
  if (toolName === "slide.rename_section") return "Rename a section. Use raw.oldName and raw.newName.";
  if (toolName === "slide.delete_section") return "Remove a section marker. Use value or raw.name.";
  if (toolName === "slide.align_objects") return "Align objects on a slide (left/center/right/top/middle/bottom). Use value or raw.alignment.";
  if (toolName === "slide.distribute_objects") return "Distribute objects evenly on a slide. Use value or raw.direction (horizontal/vertical).";
  if (toolName === "slide.set_z_order") return "Set the stacking order of an object. Use raw.target and value or raw.order (front/back/forward/backward).";
  if (toolName === "slide.group_objects") return "Group objects together on a slide. Use raw.objectIds (array of ids).";
  if (toolName === "slide.ungroup_objects") return "Ungroup previously grouped objects on a slide. Use raw.objectIds.";
  if (toolName === "slide.set_object_opacity") return "Set the opacity of an object (0-1). Use raw.target and value or raw.opacity.";
  if (toolName === "slide.set_object_size") return "Resize an object on a slide. Use raw.target, raw.width, and raw.height.";
  if (toolName === "slide.set_object_position") return "Move an object on a slide. Use raw.target, raw.x, and raw.y.";
  if (toolName === "slide.insert_icon") return "Insert an icon on a slide. Use value or raw.icon (icon name/id).";
  if (toolName === "slide.show_guides") return "Show or hide alignment guides. Use value='true'/'false' or raw.show.";
  if (toolName === "slide.show_grid") return "Show or hide the grid. Use value='true'/'false' or raw.show.";
  if (toolName === "slide.snap_to_grid") return "Enable or disable snap-to-grid. Use value='true'/'false' or raw.enable.";
  if (toolName === "slide.add_placeholder") return "Add a content placeholder to a slide. Use value or raw.kind (text/image/chart/table/video/icon).";
  if (toolName === "slide.insert_smart_art") return "Insert a SmartArt/diagram on a slide. Use value or raw.kind (process/cycle/hierarchy...) and optional raw.items.";
  // CRM ops
  if (toolName === "crm.list_at_risk_accounts") return "List accounts flagged as at-risk based on health score. Use optional raw.threshold.";
  if (toolName === "crm.bulk_delete") return "Delete multiple CRM records in one operation. Use raw.ids (array) and raw.entity.";
  if (toolName === "crm.export_records") return "Export CRM records to a file. Use raw.entity and optional raw.format (csv/xlsx/json).";
  if (toolName === "crm.import_contacts") return "Import contacts from a data array. Use raw.contacts (array of objects).";
  if (toolName === "crm.create_segment") return "Create a new CRM segment or list. Use raw.name, raw.criteria.";
  if (toolName === "crm.update_segment") return "Update an existing segment's criteria. Use raw.id and raw.criteria.";
  if (toolName === "crm.delete_segment") return "Delete a CRM segment. Use raw.id.";
  if (toolName === "crm.set_deal_priority") return "Set the priority level of a deal. Use raw.dealId and raw.priority (low/medium/high/critical).";
  if (toolName === "crm.add_deal_probability") return "Set the close probability (0-100) of a deal. Use raw.dealId and raw.probability.";
  if (toolName === "crm.set_deal_amount") return "Update the monetary amount of a deal. Use raw.dealId and raw.amount.";
  if (toolName === "crm.add_attachment") return "Attach a file or document to a CRM record. Use raw.recordId, raw.entity, raw.url, optional raw.name.";
  if (toolName === "crm.remove_attachment") return "Remove an attachment from a CRM record. Use raw.attachmentId.";
  if (toolName === "crm.subscribe_marketing_list") return "Subscribe a contact to a marketing list. Use raw.contactId and raw.listId.";
  if (toolName === "crm.unsubscribe_marketing_list") return "Unsubscribe a contact from a marketing list. Use raw.contactId and raw.listId.";
  if (toolName === "crm.create_marketing_list") return "Create a new marketing list. Use raw.name and optional raw.type.";
  if (toolName === "crm.create_invoice") return "Create an invoice for a deal or account. Use raw.dealId or raw.companyId and raw.items.";
  if (toolName === "crm.update_invoice") return "Update an existing invoice. Use raw.invoiceId and the fields to update.";
  if (toolName === "crm.delete_invoice") return "Delete an invoice. Use raw.invoiceId.";
  if (toolName === "crm.process_payment") return "Record a payment for an invoice. Use raw.invoiceId, raw.amount, and raw.method.";
  if (toolName === "crm.record_refund") return "Record a refund for a payment. Use raw.paymentId and raw.amount.";
  if (toolName === "crm.create_contract") return "Create a contract. Use raw.name, raw.parties, and optional raw.dealId.";
  if (toolName === "crm.update_contract") return "Update a contract's fields. Use raw.contractId and the updated fields.";
  if (toolName === "crm.close_contract") return "Mark a contract as signed/closed. Use raw.contractId.";
  if (toolName === "crm.create_opportunity") return "Create a new sales opportunity. Use raw.name, raw.companyId, and optional raw.amount.";
  if (toolName === "crm.update_opportunity") return "Update an opportunity's details. Use raw.opportunityId and the fields to update.";
  if (toolName === "crm.close_opportunity") return "Mark an opportunity as won or lost. Use raw.opportunityId and raw.outcome (won/lost).";
  if (toolName === "crm.trigger_workflow") return "Trigger a CRM automation workflow. Use raw.workflowId and optional raw.recordId.";
  if (toolName === "crm.update_pipeline_stage") return "Update a pipeline stage's properties. Use raw.stageId and the fields to update.";
  if (toolName === "crm.create_custom_field") return "Create a custom field on a CRM entity. Use raw.entity, raw.name, raw.type (text/number/date/bool).";
  if (toolName === "crm.delete_custom_field") return "Delete a custom field. Use raw.fieldId.";
  if (toolName === "crm.add_document") return "Attach a document to a CRM record. Use raw.recordId, raw.entity, raw.url, raw.title.";
  if (toolName === "crm.send_sms") return "Send an SMS to a contact. Use raw.contactId and raw.message.";
  if (toolName === "crm.create_reminder") return "Create a reminder for a CRM record. Use raw.recordId, raw.entity, raw.message, and raw.dueAt (ISO datetime).";
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
  const crmLike = isCrmWorkObject(activeWorkObject);
  const workspaceTools = crmLike
    ? [...CRM_WORKSPACE_TOOLS]
    : sheetLike
    ? [...SHEET_WORKSPACE_TOOLS]
    : listWorkspaceToolsForWorkObject(activeWorkObject);
  return {
    workspaceFamilyId: crmLike
      ? "crm_sales"
      : sheetLike
      ? "data_spreadsheet"
      : workObjectFamilyId(activeWorkObject),
    contentPreview: crmLike
      ? compact(contentPreview, 10000)
      : sheetLike
      ? buildSheetWorkspaceContentPreview(contentPreview)
      : compact(contentPreview, 8000),
    contentFormat: crmLike
      ? "hydria-crm-json-preview"
      : sheetLike
        ? "hydria-sheet-json-preview"
        : "text-preview",
    workspaceTools
  };
}

function buildSheetWorkspaceContentPreview(content = "") {
  const model = parseHydriaSheetModel(content);
  const activeSheet = activeSheetForOperations(model, []) || model.sheets[0];
  const maxColumns = 40;
  const maxRows = 60;

  const buildSheetPreview = (sheet) => {
    const columns = (sheet?.columns || []).slice(0, maxColumns);
    const rows = (sheet?.rows || [])
      .slice(0, maxRows)
      .map((row) => columns.map((_, columnIndex) => String(row?.[columnIndex] ?? "")));
    return {
      id: sheet?.id || "sheet-1",
      name: sheet?.name || "Sheet 1",
      columnCount: sheet?.columns?.length || columns.length,
      rowCount: sheet?.rows?.length || rows.length,
      columns,
      rows
    };
  };

  // Include all sheets (active first), up to 4 total
  const orderedSheets = [
    activeSheet,
    ...model.sheets.filter((s) => s?.id !== activeSheet?.id)
  ].filter(Boolean).slice(0, 4);

  const sheetsPreview = orderedSheets.map(buildSheetPreview);
  const active = sheetsPreview[0];

  return JSON.stringify({
    kind: "hydria-sheet",
    version: model.version || 1,
    activeSheetId: activeSheet?.id || model.activeSheetId || "sheet-1",
    columnCount: active?.columnCount || 0,
    rowCount: active?.rowCount || 0,
    columns: active?.columns || [],
    rows: active?.rows || [],
    sheets: sheetsPreview
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

function crmContextPreview(content = "") {
  try {
    return JSON.parse(String(content || "{}"));
  } catch {
    return {};
  }
}

function extractCrmPersonName(prompt = "") {
  const match = String(prompt).match(
    /\b(?:contact|client|lead|prospect)\s+(?:nomme|appele|named|called)?\s*["']?([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,})\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,})/i
  );
  return {
    firstName: compact(match?.[1] || "", 80),
    lastName: compact(match?.[2] || "", 80)
  };
}

function extractCrmCompanyName(prompt = "") {
  const value =
    String(prompt).match(
      /\b(?:entreprise|societe|company)\s+(?:nommee|appelee|named|called)?\s*["']?([^"',.;]+?)(?=\s+(?:avec|with|email|tel|phone|dans|in|pour|for)\b|$)/i
    )?.[1] ||
    String(prompt).match(
      /\b(?:pour|chez|for|at)\s+["']?([^"',.;]+?)(?=\s+(?:avec|with|email|tel|phone|de|worth)\b|$)/i
    )?.[1] ||
    "";
  return compact(value, 160);
}

function extractCrmEmail(prompt = "") {
  return String(prompt).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
}

function crmCreationVerb(prompt = "") {
  return /\b(cree|creer|ajoute|add|create|planifie|schedule)\b/.test(normalizeLabel(prompt));
}

function synthesizeCrmToolCallsFromPrompt({
  prompt = "",
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  if (!isCrmWorkObject(activeWorkObject)) {
    return [];
  }

  const normalized = normalizeLabel(prompt);
  const person = extractCrmPersonName(prompt);
  const email = extractCrmEmail(prompt);
  const companyName = extractCrmCompanyName(prompt);
  const operation = (() => {
    if (crmCreationVerb(prompt) && /\b(contact|client)\b/.test(normalized) && person.firstName && person.lastName) {
      return {
        type: "crm.create_contact",
        firstName: person.firstName,
        lastName: person.lastName,
        email,
        companyName
      };
    }
    if (crmCreationVerb(prompt) && /\b(lead|prospect)\b/.test(normalized) && person.firstName && person.lastName) {
      return {
        type: "crm.create_lead",
        firstName: person.firstName,
        lastName: person.lastName,
        email,
        companyName
      };
    }
    if (crmCreationVerb(prompt) && /\b(entreprise|societe|company)\b/.test(normalized) && companyName) {
      return {
        type: "crm.create_company",
        name: companyName
      };
    }
    if (crmCreationVerb(prompt) && /\b(tache|task|relance|follow-up)\b/.test(normalized)) {
      const title = compact(
        String(prompt)
          .replace(/^.*?\b(?:tache|task|relance|follow-up)\b\s*/i, "")
          .replace(/\s+\b(?:pour|avant|due|le|on)\b.*$/i, ""),
        180
      );
      return title ? { type: "crm.create_task", title } : null;
    }

    const context = crmContextPreview(activeWorkObjectContent);
    const stages = Array.isArray(context.pipelineStages) ? context.pipelineStages : [];
    const deals = Array.isArray(context.recentDeals) ? context.recentDeals : [];
    const leads = Array.isArray(context.recentLeads) ? context.recentLeads : [];
    const companies = Array.isArray(context.recentCompanies) ? context.recentCompanies : [];
    const products = Array.isArray(context.products) ? context.products : [];
    const stage = stages.find((item) => normalizeLabel(item?.name || "") && normalized.includes(normalizeLabel(item.name)));
    const deal = deals.find((item) => normalizeLabel(item?.name || "") && normalized.includes(normalizeLabel(item.name)));
    const lead = leads.find((item) => {
      const fullName = `${item?.firstName || ""} ${item?.lastName || ""}`.trim();
      return (item?.email && normalized.includes(normalizeLabel(item.email))) ||
        (fullName && normalized.includes(normalizeLabel(fullName)));
    });
    if (/\b(convertis|convertir|transforme|convert)\b/.test(normalized) && /\b(lead|prospect)\b/.test(normalized) && lead) {
      return {
        type: "crm.convert_lead",
        email: lead.email,
        createDeal: !/\b(sans deal|sans opportunite|without deal)\b/.test(normalized),
        target: { recordId: lead.id }
      };
    }
    const product = products.find((item) =>
      normalizeLabel(item?.name || "") && normalized.includes(normalizeLabel(item.name)) ||
      normalizeLabel(item?.sku || "") && normalized.includes(normalizeLabel(item.sku))
    );
    if (/\b(ajoute|add)\b/.test(normalized) && /\b(produit|product|article)\b/.test(normalized) && deal && product) {
      return {
        type: "crm.add_product_to_deal",
        dealName: deal.name,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        target: { recordId: deal.id }
      };
    }
    if (/\b(cree|creer|genere|create|generate)\b/.test(normalized) && /\b(devis|quote|proposal|proposition)\b/.test(normalized) && deal) {
      return {
        type: "crm.create_quote",
        dealName: deal.name,
        name: `Proposition ${deal.name}`,
        target: { recordId: deal.id }
      };
    }
    const company = companies.find((item) => normalizeLabel(item?.name || "") && normalized.includes(normalizeLabel(item.name)));
    if (/\b(resume|resumer|summary|synthese|recap)\b/.test(normalized) && /\b(client|entreprise|societe|company)\b/.test(normalized) && company) {
      return {
        type: "crm.summarize_customer",
        companyName: company.name,
        target: { recordId: company.id }
      };
    }
    if (
      /\b(passe|deplace|move|mets|set)\b/.test(normalized) &&
      /\b(deal|opportunite|opportunity)\b/.test(normalized) &&
      stage &&
      deal
    ) {
      return {
        type: "crm.update_deal_stage",
        dealName: deal.name,
        stageName: stage.name,
        target: {
          recordId: deal.id
        }
      };
    }
    return null;
  })();

  if (!operation) {
    return [];
  }

  return [
    normalizeWorkspaceToolCall({
      id: `hydria-os-local-${operation.type}`,
      type: "workspace_tool_call",
      title: "Apply CRM operation",
      target: {
        workObjectId: activeWorkObject?.id || "crm-live",
        entryPath: "crm://live"
      },
      payload: {
        instruction: prompt,
        workspaceFamilyId: "crm_sales",
        currentKind: "app",
        toolName: operation.type,
        operations: [operation]
      }
    })
  ].filter(Boolean);
}

export function synthesizeWorkspaceToolCallsFromPrompt({
  prompt = "",
  activeWorkObject = null,
  activeWorkObjectContent = ""
} = {}) {
  const crmCalls = synthesizeCrmToolCallsFromPrompt({
    prompt,
    activeWorkObject,
    activeWorkObjectContent
  });
  if (crmCalls.length) {
    return crmCalls;
  }

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
    // Cross-workspace import — read-only, returns content as importedContent
    if (call.payload.toolName === "workspace.import_from") {
      const importOp = (call.payload.operations || []).find((op) => op.type === "workspace.import_from") || {};
      const sourceId = String(importOp.target?.workObjectId || call.target?.workObjectId || "").trim();
      const maxChars = Math.min(Math.max(Number(importOp.target?.maxChars || 3000), 500), 4000);

      if (!sourceId) {
        results.push({
          type: "workspace_tool_call",
          status: "failed",
          toolName: call.payload.toolName,
          issues: ["workspace.import_from requires target.workObjectId (the source workspace object id)."]
        });
        continue;
      }

      try {
        const source = await workObjectService.readContent({ workObjectId: sourceId, entryPath: "" });
        results.push({
          type: "workspace_tool_call",
          status: "completed",
          toolName: call.payload.toolName,
          workObjectId: sourceId,
          importedTitle: source.workObject?.title || sourceId,
          importedKind: source.workObject?.objectKind || source.workObject?.kind || "document",
          importedContent: (source.content || "").slice(0, maxChars),
          issues: []
        });
      } catch {
        results.push({
          type: "workspace_tool_call",
          status: "failed",
          toolName: call.payload.toolName,
          issues: [`Could not read workspace object ${sourceId}.`]
        });
      }
      continue;
    }

    // workspace.read — full content read for Core "vision" on a workspace object
    if (call.payload.toolName === "workspace.read") {
      const readOp = (call.payload.operations || []).find((op) => op.type === "workspace.read") || {};
      const targetId = String(readOp.target?.workObjectId || call.target?.workObjectId || activeWorkObject?.id || "").trim();
      const maxChars = Math.min(Math.max(Number(readOp.target?.maxChars || 12000), 1000), 20000);

      if (!targetId) {
        results.push({
          type: "workspace_tool_call",
          status: "failed",
          toolName: call.payload.toolName,
          issues: ["workspace.read requires target.workObjectId."]
        });
        continue;
      }

      try {
        const src = await workObjectService.readContent({ workObjectId: targetId, entryPath: readOp.target?.entryPath || "" });
        assertWorkObjectAccess(src.workObject, userId);
        const dataRole = getUserDataRole(userId);
        const srcFields = buildWorkspaceContextFields({ activeWorkObject: src.workObject, contentPreview: src.content || "" });
        const filteredContent = filterContentPreviewByRole(src.content || "", dataRole, srcFields.workspaceFamilyId);
        results.push({
          type: "workspace_tool_call",
          status: "completed",
          toolName: call.payload.toolName,
          workObjectId: targetId,
          importedTitle: src.workObject?.title || targetId,
          importedKind: src.workObject?.objectKind || src.workObject?.kind || "document",
          importedContent: filteredContent.slice(0, maxChars),
          issues: []
        });
      } catch {
        results.push({
          type: "workspace_tool_call",
          status: "failed",
          toolName: call.payload.toolName,
          issues: [`Could not read workspace object ${targetId}.`]
        });
      }
      continue;
    }

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

    const current = await workObjectService.readContent({
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
