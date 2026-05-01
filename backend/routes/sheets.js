import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import PDFDocument from "pdfkit";
import { AppError } from "../utils/errors.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const DEFAULT_COLUMNS = ["Column 1", "Column 2", "Column 3"];
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NUMBER_FORMATS = new Set(["number", "currency", "percent", "date"]);
const HORIZONTAL_ALIGNMENTS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const BORDER_EDGES = ["top", "right", "bottom", "left"];
const TABLE_STYLES = new Set(["blue", "green", "orange", "purple", "gray"]);
const TABLE_TOTAL_FUNCTIONS = new Set(["sum", "average", "count", "min", "max", "none"]);
const PIVOT_AGGREGATES = new Set(["sum", "count", "average", "min", "max"]);
const DATA_VALIDATION_TYPES = new Set(["list", "whole", "decimal", "date", "textLength"]);
const DATA_VALIDATION_OPERATORS = new Set([
  "between",
  "notBetween",
  "equal",
  "notEqual",
  "greaterThan",
  "lessThan",
  "greaterOrEqual",
  "lessOrEqual"
]);
const CONDITIONAL_FORMAT_TYPES = new Set(["greaterThan", "lessThan", "between", "equal", "textContains", "duplicate"]);
const BUILTIN_FORMULA_NAMES = new Set([
  "ABS",
  "AND",
  "AVERAGE",
  "AVERAGEIF",
  "AVERAGEIFS",
  "AVG",
  "CONCAT",
  "COUNT",
  "COUNTA",
  "COUNTBLANK",
  "COUNTIF",
  "COUNTIFS",
  "DATE",
  "FILTER",
  "FALSE",
  "IF",
  "IFERROR",
  "INDEX",
  "LEFT",
  "LEN",
  "LOWER",
  "MATCH",
  "MAX",
  "MID",
  "MIN",
  "MEDIAN",
  "NOT",
  "NOW",
  "OR",
  "PRODUCT",
  "RIGHT",
  "ROUND",
  "ROUNDDOWN",
  "ROUNDUP",
  "SORT",
  "SUBTOTAL",
  "SUM",
  "SUMIF",
  "SUMIFS",
  "TEXT",
  "TODAY",
  "TRIM",
  "TRUE",
  "UNIQUE",
  "UPPER",
  "VALUE",
  "VLOOKUP",
  "XLOOKUP"
]);

function normalizeCellText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function isSimpleXlsxNumberText(value = "") {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) {
    return false;
  }
  const normalized = text.replace(",", ".");
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?$/i.test(normalized)) {
    return false;
  }
  if (/^[-+]?0\d/.test(normalized)) {
    return false;
  }
  return Number.isFinite(Number(normalized));
}

function readWorksheetCellText(cell) {
  if (!cell) {
    return "";
  }
  if (cell.f) {
    return `=${cell.f}`;
  }
  if (cell.v === null || cell.v === undefined) {
    return "";
  }
  return normalizeCellText(cell.w ?? cell.v);
}

function normalizeHexColor(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }
  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function xlsxColorToHex(color = {}) {
  const rgb = String(color?.rgb || "").replace(/^ff/i, "");
  return normalizeHexColor(rgb);
}

function hexToXlsxRgb(color = "") {
  const normalized = normalizeHexColor(color);
  return normalized ? `FF${normalized.slice(1).toUpperCase()}` : "";
}

function normalizeHydriaBorder(border = {}) {
  if (!border || typeof border !== "object" || Array.isArray(border)) {
    return null;
  }
  const normalized = {};
  BORDER_EDGES.forEach((edge) => {
    if (border[edge]) {
      normalized[edge] = true;
    }
  });
  if (!BORDER_EDGES.some((edge) => normalized[edge])) {
    return null;
  }
  normalized.color = normalizeHexColor(border.color) || "#202124";
  return normalized;
}

function normalizeHydriaCellFormat(format = {}) {
  if (typeof format === "string") {
    return NUMBER_FORMATS.has(format) ? { numberFormat: format } : {};
  }
  if (!format || typeof format !== "object" || Array.isArray(format)) {
    return {};
  }
  const normalized = {};
  const numberFormat = String(format.numberFormat || format.format || "");
  if (NUMBER_FORMATS.has(numberFormat)) {
    normalized.numberFormat = numberFormat;
  }
  ["bold", "italic", "underline"].forEach((flag) => {
    if (format[flag]) {
      normalized[flag] = true;
    }
  });
  const horizontalAlign = String(format.horizontalAlign || format.align || "");
  if (HORIZONTAL_ALIGNMENTS.has(horizontalAlign)) {
    normalized.horizontalAlign = horizontalAlign;
  }
  const verticalAlign = String(format.verticalAlign || "");
  if (VERTICAL_ALIGNMENTS.has(verticalAlign)) {
    normalized.verticalAlign = verticalAlign;
  }
  const fontSize = Number(format.fontSize);
  if (Number.isFinite(fontSize)) {
    normalized.fontSize = Math.max(8, Math.min(36, Math.round(fontSize)));
  }
  const textColor = normalizeHexColor(format.textColor);
  if (textColor) {
    normalized.textColor = textColor;
  }
  const fillColor = normalizeHexColor(format.fillColor);
  if (fillColor) {
    normalized.fillColor = fillColor;
  }
  const border = normalizeHydriaBorder(format.border);
  if (border) {
    normalized.border = border;
  }
  return normalized;
}

function isHydriaCellFormatEmpty(format = {}) {
  return Object.keys(normalizeHydriaCellFormat(format)).length === 0;
}

function normalizeHydriaCellFormats(cellFormats = {}) {
  if (!cellFormats || typeof cellFormats !== "object" || Array.isArray(cellFormats)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(cellFormats)
      .map(([key, value]) => [key, normalizeHydriaCellFormat(value)])
      .filter(([, value]) => !isHydriaCellFormatEmpty(value))
  );
}

function normalizeHydriaStructureBounds(source = {}) {
  const startRowIndex = Math.max(0, Math.floor(Number(source.startRowIndex ?? source.minRow ?? 0)) || 0);
  const endRowIndex = Math.max(startRowIndex, Math.floor(Number(source.endRowIndex ?? source.maxRow ?? startRowIndex)) || startRowIndex);
  const startColumnIndex = Math.max(0, Math.floor(Number(source.startColumnIndex ?? source.minColumn ?? 0)) || 0);
  const endColumnIndex = Math.max(
    startColumnIndex,
    Math.floor(Number(source.endColumnIndex ?? source.maxColumn ?? startColumnIndex)) || startColumnIndex
  );
  return { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex };
}

function normalizeHydriaTables(tables = []) {
  if (!Array.isArray(tables)) {
    return [];
  }
  return tables
    .filter((table) => table && typeof table === "object" && !Array.isArray(table))
    .map((table, index) => ({
      id: String(table.id || `sheet-table-${index + 1}`),
      name: String(table.name || table.title || `Table${index + 1}`).trim() || `Table${index + 1}`,
      ...normalizeHydriaStructureBounds(table),
      style: TABLE_STYLES.has(String(table.style || "").toLowerCase()) ? String(table.style).toLowerCase() : "blue",
      showHeaderRow: table.showHeaderRow !== false,
      showBandedRows: table.showBandedRows !== false,
      showBandedColumns: Boolean(table.showBandedColumns),
      showFirstColumn: Boolean(table.showFirstColumn),
      showLastColumn: Boolean(table.showLastColumn),
      showFilterButtons: table.showFilterButtons !== false,
      showTotalRow: Boolean(table.showTotalRow),
      totalFunctions:
        table.totalFunctions && typeof table.totalFunctions === "object" && !Array.isArray(table.totalFunctions)
          ? Object.fromEntries(
              Object.entries(table.totalFunctions).map(([key, value]) => [
                String(key),
                TABLE_TOTAL_FUNCTIONS.has(String(value || "").toLowerCase()) ? String(value || "").toLowerCase() : "sum"
              ])
            )
          : {}
    }));
}

function normalizeHydriaPivotTables(pivotTables = []) {
  if (!Array.isArray(pivotTables)) {
    return [];
  }
  return pivotTables
    .filter((pivotTable) => pivotTable && typeof pivotTable === "object" && !Array.isArray(pivotTable))
    .map((pivotTable, index) => {
      const aggregate = String(pivotTable.aggregate || pivotTable.summary || "sum").toLowerCase();
      return {
        id: String(pivotTable.id || `sheet-pivot-${index + 1}`),
        name: String(pivotTable.name || pivotTable.title || `PivotTable${index + 1}`).trim() || `PivotTable${index + 1}`,
        sourceSheetId: String(pivotTable.sourceSheetId || pivotTable.sheetId || ""),
        sourceTableId: String(pivotTable.sourceTableId || pivotTable.tableId || ""),
        sourceRange: String(pivotTable.sourceRange || pivotTable.range || ""),
        renderedRange: String(pivotTable.renderedRange || ""),
        rowField: String(pivotTable.rowField || ""),
        columnField: String(pivotTable.columnField || ""),
        valueField: String(pivotTable.valueField || ""),
        aggregate: PIVOT_AGGREGATES.has(aggregate) ? aggregate : "sum",
        anchorRowIndex: Math.max(0, Math.floor(Number(pivotTable.anchorRowIndex ?? pivotTable.rowIndex ?? 0)) || 0),
        anchorColumnIndex: Math.max(0, Math.floor(Number(pivotTable.anchorColumnIndex ?? pivotTable.columnIndex ?? 0)) || 0),
        lastRefreshedAt: String(pivotTable.lastRefreshedAt || "")
      };
    });
}

function normalizeHydriaTableFilters(tableFilters = {}) {
  if (!tableFilters || typeof tableFilters !== "object" || Array.isArray(tableFilters)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(tableFilters)
      .filter(([, filter]) => filter && typeof filter === "object" && !Array.isArray(filter))
      .map(([key, filter]) => [
        String(key),
        {
          query: String(filter.query || ""),
          active: Boolean(filter.active),
          selectedValues: Array.isArray(filter.selectedValues)
            ? Array.from(new Set(filter.selectedValues.map((value) => String(value ?? ""))))
            : []
        }
      ])
  );
}

function normalizeHydriaDataValidationRule(rule = {}) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const rawType = String(rule.type || rule.kind || "list").trim();
  const type = rawType.toLowerCase() === "textlength" ? "textLength" : rawType.toLowerCase();
  if (!DATA_VALIDATION_TYPES.has(type)) {
    return null;
  }
  const operator = String(rule.operator || "between");
  return {
    type,
    operator: DATA_VALIDATION_OPERATORS.has(operator) ? operator : "between",
    allowBlank: rule.allowBlank !== false,
    showDropdown: rule.showDropdown !== false,
    source: String(rule.source || rule.values || ""),
    minimum: String(rule.minimum ?? rule.min ?? ""),
    maximum: String(rule.maximum ?? rule.max ?? ""),
    message: String(rule.message || rule.error || "")
  };
}

function normalizeHydriaDataValidations(dataValidations = {}) {
  if (!dataValidations || typeof dataValidations !== "object" || Array.isArray(dataValidations)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(dataValidations)
      .map(([key, value]) => [String(key), normalizeHydriaDataValidationRule(value)])
      .filter(([, value]) => Boolean(value))
  );
}

function isHydriaDefinedNameValid(name = "") {
  const text = String(name || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) {
    return false;
  }
  if (/^\$?[A-Z]+\$?\d+$/i.test(text) || /^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(text)) {
    return false;
  }
  return !BUILTIN_FORMULA_NAMES.has(text.toUpperCase());
}

function normalizeHydriaNamedRange(namedRange = {}, index = 0) {
  if (!namedRange || typeof namedRange !== "object" || Array.isArray(namedRange)) {
    return null;
  }
  const name = String(namedRange.name || namedRange.label || "").trim();
  const range = String(namedRange.range || namedRange.ref || namedRange.address || "")
    .trim()
    .replace(/^=/, "");
  if (!isHydriaDefinedNameValid(name) || !range) {
    return null;
  }
  const sheetId = String(namedRange.sheetId || namedRange.sheet || "").trim();
  return {
    id: String(namedRange.id || `named-range-${index + 1}`),
    name,
    range,
    sheetId,
    scope: String(namedRange.scope || (sheetId ? "sheet" : "workbook")),
    comment: String(namedRange.comment || namedRange.description || "")
  };
}

function normalizeHydriaNamedRanges(namedRanges = []) {
  if (!Array.isArray(namedRanges)) {
    return [];
  }
  const seen = new Set();
  return namedRanges
    .map((namedRange, index) => normalizeHydriaNamedRange(namedRange, index))
    .filter((namedRange) => {
      if (!namedRange) {
        return false;
      }
      const key = `${namedRange.sheetId || "workbook"}:${namedRange.name.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeHydriaConditionalFormatRule(rule = {}, index = 0) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const type = String(rule.type || rule.kind || "greaterThan").trim();
  if (!CONDITIONAL_FORMAT_TYPES.has(type)) {
    return null;
  }
  const range = String(rule.range || rule.ref || "").trim();
  if (!range) {
    return null;
  }
  return {
    id: String(rule.id || `conditional-format-${index + 1}`),
    type,
    range,
    value1: String(rule.value1 ?? rule.value ?? ""),
    value2: String(rule.value2 ?? ""),
    fillColor: normalizeHexColor(rule.fillColor || rule.color || "") || "#fff2cc",
    textColor: normalizeHexColor(rule.textColor || "") || "#202124",
    bold: Boolean(rule.bold),
    label: String(rule.label || "")
  };
}

function normalizeHydriaConditionalFormats(rules = []) {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules
    .map((rule, index) => normalizeHydriaConditionalFormatRule(rule, index))
    .filter(Boolean);
}

function rangeToHydriaStructureBounds(ref = "", originRange = null) {
  if (!ref || !originRange) {
    return null;
  }
  try {
    const decoded = XLSX.utils.decode_range(ref);
    return normalizeHydriaStructureBounds({
      startRowIndex: decoded.s.r - originRange.s.r,
      endRowIndex: decoded.e.r - originRange.s.r,
      startColumnIndex: decoded.s.c - originRange.s.c,
      endColumnIndex: decoded.e.c - originRange.s.c
    });
  } catch {
    return null;
  }
}

function inferHydriaTablesFromWorksheet(worksheet, originRange, width = 1, height = 1) {
  const autoFilterRef = worksheet?.["!autofilter"]?.ref;
  const bounds = rangeToHydriaStructureBounds(autoFilterRef, originRange);
  if (!bounds) {
    return [];
  }
  const clampedBounds = normalizeHydriaStructureBounds({
    startRowIndex: Math.min(bounds.startRowIndex, Math.max(0, height - 1)),
    endRowIndex: Math.min(bounds.endRowIndex, Math.max(0, height - 1)),
    startColumnIndex: Math.min(bounds.startColumnIndex, Math.max(0, width - 1)),
    endColumnIndex: Math.min(bounds.endColumnIndex, Math.max(0, width - 1))
  });
  if (clampedBounds.endRowIndex <= clampedBounds.startRowIndex) {
    return [];
  }
  return [
    {
      id: "sheet-table-1",
      name: "Table1",
      ...clampedBounds,
      style: "blue",
      showHeaderRow: true,
      showBandedRows: true,
      showFilterButtons: true,
      showTotalRow: false
    }
  ];
}

function inferHydriaNumberFormat(cell) {
  const format = String(cell?.z || "");
  if (!format) {
    return "";
  }
  if (/%/.test(format)) {
    return "percent";
  }
  if (/[$]|eur|usd|gbp|jpy|currency/i.test(format)) {
    return "currency";
  }
  if (/[€$£¥]/.test(format)) {
    return "currency";
  }
  if (/[ymdhs]/i.test(format) && !/[#0]/.test(format.replace(/[ymdhs]/gi, ""))) {
    return "date";
  }
  if (/[#0]/.test(format)) {
    return "number";
  }
  return "";
}

function inferHydriaCellFormat(cell) {
  const normalized = {};
  const numberFormat = inferHydriaNumberFormat(cell);
  if (numberFormat) {
    normalized.numberFormat = numberFormat;
  }

  const style = cell?.s || {};
  if (style.font) {
    if (style.font.bold) {
      normalized.bold = true;
    }
    if (style.font.italic) {
      normalized.italic = true;
    }
    if (style.font.underline) {
      normalized.underline = true;
    }
    if (style.font.sz) {
      normalized.fontSize = Math.max(8, Math.min(36, Math.round(Number(style.font.sz))));
    }
    const textColor = xlsxColorToHex(style.font.color);
    if (textColor) {
      normalized.textColor = textColor;
    }
  }
  const fillColor = xlsxColorToHex(style.fill?.fgColor || style.fill?.bgColor);
  if (fillColor) {
    normalized.fillColor = fillColor;
  }
  if (style.alignment) {
    const horizontal = String(style.alignment.horizontal || "");
    if (HORIZONTAL_ALIGNMENTS.has(horizontal)) {
      normalized.horizontalAlign = horizontal;
    }
    const vertical = String(style.alignment.vertical || "");
    if (vertical === "center") {
      normalized.verticalAlign = "middle";
    } else if (VERTICAL_ALIGNMENTS.has(vertical)) {
      normalized.verticalAlign = vertical;
    }
  }
  const border = {};
  BORDER_EDGES.forEach((edge) => {
    if (style.border?.[edge]?.style) {
      border[edge] = true;
      border.color = xlsxColorToHex(style.border[edge].color) || border.color;
    }
  });
  const normalizedBorder = normalizeHydriaBorder(border);
  if (normalizedBorder) {
    normalized.border = normalizedBorder;
  }

  return normalizeHydriaCellFormat(normalized);
}

function columnWidthFromXlsx(column = {}) {
  const width = Number(column.wpx || (column.wch ? column.wch * 8 + 24 : 0));
  return Number.isFinite(width) && width > 0 ? Math.round(Math.min(Math.max(width, 72), 420)) : null;
}

function rowHeightFromXlsx(row = {}) {
  const height = Number(row.hpx || (row.hpt ? row.hpt * 1.333 : 0));
  return Number.isFinite(height) && height > 0 ? Math.round(Math.min(Math.max(height, 28), 240)) : null;
}

function worksheetToHydriaSheet(worksheet, sheetName = "Sheet", index = 0, { hidden = false } = {}) {
  const range = worksheet?.["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    return {
      id: `sheet-${index + 1}`,
      name: sheetName || `Sheet ${index + 1}`,
      hidden: Boolean(hidden),
      columns: [...DEFAULT_COLUMNS],
      rows: [["", "", ""]],
      columnWidths: {},
      rowHeights: {},
      merges: [],
      cellFormats: {},
      tables: [],
      pivotTables: [],
      tableFilters: {},
      dataValidations: {},
      conditionalFormats: []
    };
  }

  const width = Math.max(1, range.e.c - range.s.c + 1);
  const height = Math.max(1, range.e.r - range.s.r + 1);
  const matrix = Array.from({ length: height }, (_, rowOffset) =>
    Array.from({ length: width }, (_, columnOffset) => {
      const address = XLSX.utils.encode_cell({
        r: range.s.r + rowOffset,
        c: range.s.c + columnOffset
      });
      return readWorksheetCellText(worksheet[address]);
    })
  );

  const [header = [], ...bodyRows] = matrix;
  const columns = Array.from({ length: width }, (_, columnIndex) => {
    const value = String(header[columnIndex] || "").trim();
    return value || `Column ${columnIndex + 1}`;
  });

  const rows = (bodyRows.length ? bodyRows : [Array.from({ length: width }, () => "")]).map((row) =>
    Array.from({ length: width }, (_, columnIndex) => normalizeCellText(row[columnIndex]))
  );

  const columnWidths = {};
  (worksheet["!cols"] || []).forEach((column, columnIndex) => {
    const widthValue = columnWidthFromXlsx(column);
    if (widthValue) {
      columnWidths[String(columnIndex)] = widthValue;
    }
  });

  const rowHeights = {};
  (worksheet["!rows"] || []).forEach((row, rowIndex) => {
    const heightValue = rowHeightFromXlsx(row);
    if (heightValue) {
      rowHeights[String(rowIndex)] = heightValue;
    }
  });

  const merges = (worksheet["!merges"] || [])
    .map((merge) => ({
      startRowIndex: Math.max(0, merge.s.r - range.s.r),
      startColumnIndex: Math.max(0, merge.s.c - range.s.c),
      rowSpan: Math.max(1, merge.e.r - merge.s.r + 1),
      columnSpan: Math.max(1, merge.e.c - merge.s.c + 1)
    }))
    .filter((merge) => merge.startRowIndex < height && merge.startColumnIndex < width);

  const cellFormats = {};
  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
      const address = XLSX.utils.encode_cell({
        r: range.s.r + rowOffset,
        c: range.s.c + columnOffset
      });
      const format = inferHydriaCellFormat(worksheet[address]);
      if (!isHydriaCellFormatEmpty(format)) {
        cellFormats[`${rowOffset}:${columnOffset}`] = format;
      }
    }
  }
  const tables = inferHydriaTablesFromWorksheet(worksheet, range, width, height);

  return {
    id: `sheet-${index + 1}`,
    name: sheetName || `Sheet ${index + 1}`,
    hidden: Boolean(hidden),
    columns,
    rows,
    columnWidths,
    rowHeights,
    merges,
    cellFormats,
    tables,
    pivotTables: [],
    tableFilters: {},
    dataValidations: {},
    conditionalFormats: []
  };
}

function normalizeXlsxDefinedNameRange(ref = "") {
  const text = String(ref || "")
    .trim()
    .replace(/^=/, "");
  const bangIndex = text.lastIndexOf("!");
  const rangeText = bangIndex >= 0 ? text.slice(bangIndex + 1) : text;
  const normalized = rangeText.replace(/\$/g, "");
  return /^\w+\d+(?::\w+\d+)?$/i.test(normalized) ? normalized : "";
}

function extractXlsxDefinedNameSheet(ref = "") {
  const text = String(ref || "")
    .trim()
    .replace(/^=/, "");
  const bangIndex = text.lastIndexOf("!");
  if (bangIndex < 0) {
    return "";
  }
  const rawSheetName = text.slice(0, bangIndex);
  if (rawSheetName.startsWith("'") && rawSheetName.endsWith("'")) {
    return rawSheetName.slice(1, -1).replace(/''/g, "'");
  }
  return rawSheetName;
}

function workbookDefinedNamesToHydria(workbook = {}) {
  const definedNames = Array.isArray(workbook?.Workbook?.Names) ? workbook.Workbook.Names : [];
  const sheetNames = workbook.SheetNames || [];
  return normalizeHydriaNamedRanges(
    definedNames
      .filter((definedName) => definedName && typeof definedName === "object")
      .filter((definedName) => !String(definedName.Name || "").startsWith("_xlnm."))
      .map((definedName, index) => {
        const sheetName = extractXlsxDefinedNameSheet(definedName.Ref || "");
        const sheetIndex = sheetName ? sheetNames.findIndex((name) => name === sheetName) : Number(definedName.Sheet);
        return {
          id: `named-range-${index + 1}`,
          name: String(definedName.Name || ""),
          range: normalizeXlsxDefinedNameRange(definedName.Ref || ""),
          sheetId: Number.isInteger(sheetIndex) && sheetIndex >= 0 ? `sheet-${sheetIndex + 1}` : "",
          scope: definedName.Sheet !== undefined ? "sheet" : "workbook",
          comment: String(definedName.Comment || "")
        };
      })
  );
}

function workbookToHydriaModel(workbook) {
  const workbookSheetMeta = Array.isArray(workbook?.Workbook?.Sheets) ? workbook.Workbook.Sheets : [];
  const sheets = (workbook.SheetNames || []).map((sheetName, index) =>
    worksheetToHydriaSheet(workbook.Sheets[sheetName], sheetName, index, {
      hidden: Number(workbookSheetMeta[index]?.Hidden || 0) > 0
    })
  );
  const safeSheets = sheets.length
    ? sheets
    : [
        {
          id: "sheet-1",
          name: "Sheet 1",
          hidden: false,
          columns: [...DEFAULT_COLUMNS],
          rows: [["", "", ""]],
          columnWidths: {},
          rowHeights: {},
          merges: [],
          cellFormats: {},
          tables: [],
          pivotTables: [],
          tableFilters: {},
          dataValidations: {},
          conditionalFormats: []
        }
      ];

  return {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: safeSheets[0].id,
    namedRanges: workbookDefinedNamesToHydria(workbook),
    sheets: safeSheets,
    columns: safeSheets[0].columns,
    rows: safeSheets[0].rows
  };
}

function normalizeHydriaSheet(sheet = {}, index = 0) {
  const columns = Array.isArray(sheet.columns) && sheet.columns.length
    ? sheet.columns.map((value) => normalizeCellText(value))
    : [...DEFAULT_COLUMNS];
  const width = columns.length;
  const rows = (Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]]).map((row) =>
    Array.from({ length: width }, (_, columnIndex) => normalizeCellText(row?.[columnIndex]))
  );

  return {
    id: String(sheet.id || `sheet-${index + 1}`),
    name: String(sheet.name || `Sheet ${index + 1}`),
    hidden: Boolean(sheet.hidden),
    columns,
    rows,
    columnWidths:
      sheet.columnWidths && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
        ? { ...sheet.columnWidths }
        : {},
    rowHeights:
      sheet.rowHeights && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
        ? { ...sheet.rowHeights }
        : {},
    merges: Array.isArray(sheet.merges) ? sheet.merges : [],
    cellFormats: normalizeHydriaCellFormats(sheet.cellFormats),
    tables: normalizeHydriaTables(sheet.tables),
    pivotTables: normalizeHydriaPivotTables(sheet.pivotTables),
    tableFilters: normalizeHydriaTableFilters(sheet.tableFilters),
    dataValidations: normalizeHydriaDataValidations(sheet.dataValidations || sheet.validations),
    conditionalFormats: normalizeHydriaConditionalFormats(sheet.conditionalFormats || sheet.conditionalFormatting)
  };
}

function normalizeHydriaWorkbook(model = {}) {
  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeHydriaSheet(sheet, index))
    : [normalizeHydriaSheet(model, 0)];
  const validSheetIds = new Set(sheets.map((sheet) => sheet.id));
  const namedRanges = normalizeHydriaNamedRanges(model.namedRanges || model.names).filter(
    (namedRange) => !namedRange.sheetId || validSheetIds.has(namedRange.sheetId)
  );
  return {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: sheets.some((sheet) => sheet.id === model.activeSheetId) ? String(model.activeSheetId) : sheets[0].id,
    namedRanges,
    sheets
  };
}

function uniqueSheetName(name = "Sheet", usedNames = new Set()) {
  const base = String(name || "Sheet")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffixText = ` ${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function xlsxNumberFormat(format = "") {
  switch (format) {
    case "currency":
      return '#,##0.00 "€"';
    case "percent":
      return "0.00%";
    case "date":
      return "yyyy-mm-dd";
    case "number":
      return "0.00";
    default:
      return "";
  }
}

function xlsxRichNumberFormat(format = "") {
  switch (format) {
    case "currency":
      return '#,##0.00 "EUR"';
    case "percent":
      return "0.00%";
    case "date":
      return "yyyy-mm-dd";
    case "number":
      return "0.00";
    default:
      return "";
  }
}

function hydriaFormatToXlsxStyle(format = {}) {
  const normalized = normalizeHydriaCellFormat(format);
  const style = {};
  const font = {};
  if (normalized.bold) {
    font.bold = true;
  }
  if (normalized.italic) {
    font.italic = true;
  }
  if (normalized.underline) {
    font.underline = true;
  }
  if (normalized.fontSize) {
    font.sz = normalized.fontSize;
  }
  const textRgb = hexToXlsxRgb(normalized.textColor);
  if (textRgb) {
    font.color = { rgb: textRgb };
  }
  if (Object.keys(font).length) {
    style.font = font;
  }

  const fillRgb = hexToXlsxRgb(normalized.fillColor);
  if (fillRgb) {
    style.fill = {
      patternType: "solid",
      fgColor: { rgb: fillRgb }
    };
  }

  if (normalized.horizontalAlign || normalized.verticalAlign) {
    style.alignment = {};
    if (normalized.horizontalAlign) {
      style.alignment.horizontal = normalized.horizontalAlign;
    }
    if (normalized.verticalAlign) {
      style.alignment.vertical = normalized.verticalAlign === "middle" ? "center" : normalized.verticalAlign;
    }
  }

  const border = normalizeHydriaBorder(normalized.border);
  if (border) {
    const borderRgb = hexToXlsxRgb(border.color) || "FF202124";
    style.border = {};
    BORDER_EDGES.forEach((edge) => {
      if (border[edge]) {
        style.border[edge] = {
          style: "thin",
          color: { rgb: borderRgb }
        };
      }
    });
  }

  return style;
}

function writeHydriaCellValue(worksheet, address, value = "", format = {}, { sheet = {}, tables = [] } = {}) {
  const normalizedFormat = normalizeHydriaCellFormat(format);
  const numberFormat = normalizedFormat.numberFormat || "";
  const text = normalizeCellText(value);
  if (text.startsWith("=") && text.length > 1) {
    worksheet[address] = {
      t: "n",
      f: normalizeHydriaFormulaForXlsx(text.slice(1), sheet, tables),
      v: 0
    };
  } else if (isSimpleXlsxNumberText(text)) {
    worksheet[address] = {
      t: "n",
      v: Number(text.replace(",", "."))
    };
  } else {
    worksheet[address] = {
      t: "s",
      v: text
    };
  }

  const xlsxFormat = xlsxRichNumberFormat(numberFormat);
  if (xlsxFormat) {
    worksheet[address].z = xlsxFormat;
  }
  const style = hydriaFormatToXlsxStyle(normalizedFormat);
  if (Object.keys(style).length) {
    worksheet[address].s = style;
  }
}

function getHydriaGridCellText(sheet = {}, rowIndex = 0, columnIndex = 0) {
  return rowIndex === 0
    ? normalizeCellText(sheet.columns?.[columnIndex])
    : normalizeCellText(sheet.rows?.[rowIndex - 1]?.[columnIndex]);
}

function getHydriaTableHeaderNames(sheet = {}, table = {}) {
  const bounds = normalizeHydriaStructureBounds(table);
  return Array.from({ length: bounds.endColumnIndex - bounds.startColumnIndex + 1 }, (_, offset) => {
    const columnIndex = bounds.startColumnIndex + offset;
    const header = table.showHeaderRow === false ? "" : getHydriaGridCellText(sheet, bounds.startRowIndex, columnIndex);
    return String(header || `Column ${offset + 1}`).trim() || `Column ${offset + 1}`;
  });
}

function hydriaStructuredReferenceToXlsxRange(sheet = {}, tables = [], tableName = "", selector = "") {
  const table = tables.find((entry) => entry.name.toLowerCase() === String(tableName || "").toLowerCase());
  if (!table) {
    return "";
  }
  const bounds = normalizeHydriaStructureBounds(table);
  const selectorParts = String(selector || "")
    .split(/\]\s*,\s*\[/)
    .map((part) => part.replace(/^\[/, "").replace(/\]$/, "").trim())
    .filter(Boolean);
  const lastSelector = selectorParts[selectorParts.length - 1] || String(selector || "").trim();
  const columnSelector = selectorParts.find((part) => !part.startsWith("#")) || (!lastSelector.startsWith("#") ? lastSelector : "");
  let startRowIndex = selectorParts.some((part) => part.toLowerCase() === "#all") || lastSelector.toLowerCase() === "#all"
    ? bounds.startRowIndex
    : bounds.startRowIndex + (table.showHeaderRow === false ? 0 : 1);
  let endRowIndex = selectorParts.some((part) => part.toLowerCase() === "#all") || lastSelector.toLowerCase() === "#all"
    ? bounds.endRowIndex
    : table.showTotalRow
      ? Math.max(startRowIndex - 1, bounds.endRowIndex - 1)
      : bounds.endRowIndex;

  if (lastSelector.toLowerCase() === "#headers") {
    startRowIndex = bounds.startRowIndex;
    endRowIndex = bounds.startRowIndex;
  } else if (lastSelector.toLowerCase() === "#totals") {
    startRowIndex = table.showTotalRow ? bounds.endRowIndex : bounds.endRowIndex + 1;
    endRowIndex = startRowIndex;
  }

  let startColumnIndex = bounds.startColumnIndex;
  let endColumnIndex = bounds.endColumnIndex;
  if (columnSelector) {
    const headers = getHydriaTableHeaderNames(sheet, table);
    const columnOffset = headers.findIndex((header) => header.toLowerCase() === columnSelector.toLowerCase());
    if (columnOffset < 0) {
      return "";
    }
    startColumnIndex = bounds.startColumnIndex + columnOffset;
    endColumnIndex = startColumnIndex;
  }

  if (endRowIndex < startRowIndex || endColumnIndex < startColumnIndex) {
    return "";
  }
  return XLSX.utils.encode_range({
    s: { r: startRowIndex, c: startColumnIndex },
    e: { r: endRowIndex, c: endColumnIndex }
  });
}

function replaceFormulaOutsideQuotes(value = "", replacer = (segment) => segment) {
  const source = String(value || "");
  let output = "";
  let current = "";
  let inQuotes = false;
  const flush = () => {
    output += inQuotes ? current : replacer(current);
    current = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += `${char}${next}`;
        index += 1;
        continue;
      }
      flush();
      output += char;
      inQuotes = !inQuotes;
      continue;
    }
    current += char;
  }
  flush();
  return output;
}

function normalizeHydriaFormulaForXlsx(formula = "", sheet = {}, tables = []) {
  return replaceFormulaOutsideQuotes(String(formula || ""), (segment) =>
    segment
      .replace(/;/g, ",")
      .replace(
        /([A-Za-z_][A-Za-z0-9_.]*)\[([^\]]+)\]/g,
        (match, tableName, selector) =>
          hydriaStructuredReferenceToXlsxRange(sheet, tables, tableName, selector) || match
      )
  );
}

function hydriaBoundsToXlsxRef(bounds = {}) {
  const normalized = normalizeHydriaStructureBounds(bounds);
  return XLSX.utils.encode_range({
    s: { r: normalized.startRowIndex, c: normalized.startColumnIndex },
    e: { r: normalized.endRowIndex, c: normalized.endColumnIndex }
  });
}

function hydriaAddressToAbsoluteXlsxAddress(address = "") {
  try {
    const decoded = XLSX.utils.decode_cell(String(address || "").replace(/\$/g, ""));
    return `$${XLSX.utils.encode_col(decoded.c)}$${decoded.r + 1}`;
  } catch {
    return "";
  }
}

function hydriaRangeToAbsoluteXlsxRef(range = "") {
  const [start, end = start] = String(range || "").trim().split(":");
  const startAddress = hydriaAddressToAbsoluteXlsxAddress(start);
  const endAddress = hydriaAddressToAbsoluteXlsxAddress(end);
  if (!startAddress || !endAddress) {
    return "";
  }
  return startAddress === endAddress ? startAddress : `${startAddress}:${endAddress}`;
}

function quoteXlsxSheetName(sheetName = "Sheet") {
  const text = String(sheetName || "Sheet");
  return `'${text.replace(/'/g, "''")}'`;
}

function getHydriaTableCellFormat(tables = [], rowIndex = 0, columnIndex = 0) {
  const normalizedTables = Array.isArray(tables) ? tables : normalizeHydriaTables(tables);
  const table = normalizedTables.find(
    (candidate) =>
      rowIndex >= candidate.startRowIndex &&
      rowIndex <= candidate.endRowIndex &&
      columnIndex >= candidate.startColumnIndex &&
      columnIndex <= candidate.endColumnIndex
  );
  if (!table) {
    return {};
  }

  const palettes = {
    blue: { header: "#1a73e8", banded: "#eef5ff", total: "#d8e9ff" },
    green: { header: "#188038", banded: "#e6f4ea", total: "#ceead6" },
    orange: { header: "#c26401", banded: "#fff4e5", total: "#fce8b2" },
    purple: { header: "#6f42c1", banded: "#f1eafe", total: "#e4d7fb" },
    gray: { header: "#5f6368", banded: "#f1f3f4", total: "#e8eaed" }
  };
  const palette = palettes[table.style] || palettes.blue;
  if (table.showHeaderRow && rowIndex === table.startRowIndex) {
    return { bold: true, fillColor: palette.header, textColor: "#ffffff" };
  }
  if (table.showTotalRow && rowIndex === table.endRowIndex) {
    return { bold: true, fillColor: palette.total };
  }
  const dataStartRow = table.startRowIndex + (table.showHeaderRow === false ? 0 : 1);
  const isBandedRow = table.showBandedRows && rowIndex >= dataStartRow && (rowIndex - dataStartRow) % 2 === 1;
  const isBandedColumn = table.showBandedColumns && (columnIndex - table.startColumnIndex) % 2 === 1;
  const isEmphasisColumn =
    (table.showFirstColumn && columnIndex === table.startColumnIndex) ||
    (table.showLastColumn && columnIndex === table.endColumnIndex);
  if (isBandedRow || isBandedColumn || isEmphasisColumn) {
    return {
      ...(isBandedRow || isBandedColumn ? { fillColor: palette.banded } : {}),
      ...(isEmphasisColumn ? { bold: true } : {})
    };
  }
  return {};
}

function getHydriaTableForCell(tables = [], rowIndex = 0, columnIndex = 0) {
  const normalizedTables = Array.isArray(tables) ? tables : normalizeHydriaTables(tables);
  return normalizedTables.find(
    (table) =>
      rowIndex >= table.startRowIndex &&
      rowIndex <= table.endRowIndex &&
      columnIndex >= table.startColumnIndex &&
      columnIndex <= table.endColumnIndex
  );
}

function hydriaCellFormatForXlsxExport(sheet = {}, tables = [], rowIndex = 0, columnIndex = 0) {
  const format = normalizeHydriaCellFormat(sheet.cellFormats?.[`${rowIndex}:${columnIndex}`] || "");
  if (!getHydriaTableForCell(tables, rowIndex, columnIndex)) {
    return format;
  }

  // Native Excel table styles own fonts, fills, borders and header/total emphasis.
  const { fillColor, textColor, border, bold, italic, underline, fontSize, ...tableSafeFormat } = format;
  return tableSafeFormat;
}

function estimateHydriaColumnWidth(rows = [], columnIndex = 0) {
  const maxLength = rows.reduce((largest, row) => {
    const text = normalizeCellText(row?.[columnIndex]);
    if (!text.trim()) {
      return largest;
    }
    return Math.max(largest, text.length);
  }, 0);
  return maxLength ? Math.max(10, Math.min(32, maxLength + 4)) : null;
}

function hydriaSheetToWorksheet(sheet = {}) {
  const rows = [sheet.columns, ...sheet.rows];
  const rowCount = Math.max(1, rows.length);
  const columnCount = Math.max(1, sheet.columns.length);
  const worksheet = {};
  const normalizedTables = normalizeHydriaTables(sheet.tables);

  rows.forEach((row, rowIndex) => {
    Array.from({ length: columnCount }, (_, columnIndex) => normalizeCellText(row?.[columnIndex])).forEach(
      (value, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        writeHydriaCellValue(
          worksheet,
          address,
          value,
          hydriaCellFormatForXlsxExport(sheet, normalizedTables, rowIndex, columnIndex),
          { sheet, tables: normalizedTables }
        );
      }
    );
  });

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowCount - 1, c: columnCount - 1 }
  });

  const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const pixelWidth = Number(sheet.columnWidths?.[String(columnIndex)]);
    if (Number.isFinite(pixelWidth) && pixelWidth > 0) {
      return { wch: Math.max(1, Math.round((pixelWidth - 24) / 8)) };
    }
    const estimatedWidth = estimateHydriaColumnWidth(rows, columnIndex);
    return estimatedWidth ? { wch: estimatedWidth } : null;
  });
  if (columnWidths.some(Boolean)) {
    worksheet["!cols"] = columnWidths.map((column) => column || undefined);
  }

  const rowHeights = Array.from({ length: rowCount }, (_, rowIndex) => {
    const pixelHeight = Number(sheet.rowHeights?.[String(rowIndex)]);
    return Number.isFinite(pixelHeight) && pixelHeight > 0 ? { hpx: pixelHeight } : null;
  });
  if (rowHeights.some(Boolean)) {
    worksheet["!rows"] = rowHeights.map((row) => row || undefined);
  }

  worksheet["!merges"] = (sheet.merges || [])
    .filter(
      (merge) =>
        merge &&
        Number.isInteger(merge.startRowIndex) &&
        Number.isInteger(merge.startColumnIndex) &&
        Number.isInteger(merge.rowSpan) &&
        Number.isInteger(merge.columnSpan) &&
        merge.rowSpan > 0 &&
        merge.columnSpan > 0
    )
    .map((merge) => ({
      s: { r: merge.startRowIndex, c: merge.startColumnIndex },
      e: {
        r: merge.startRowIndex + merge.rowSpan - 1,
        c: merge.startColumnIndex + merge.columnSpan - 1
      }
    }));

  return worksheet;
}

function escapeXmlAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlText(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getXmlCollectionCount(xml = "", tagName = "") {
  const match = new RegExp(`<${tagName}\\b([^>]*)>`, "i").exec(xml);
  if (!match) {
    return 0;
  }
  const countMatch = /count="(\d+)"/i.exec(match[1]);
  return countMatch ? Number(countMatch[1]) : 0;
}

function appendXmlCollectionEntries(xml = "", tagName = "", entries = []) {
  if (!entries.length) {
    return xml;
  }
  const pattern = new RegExp(`(<${tagName}\\b[^>]*count=")(\\d+)("[^>]*>)([\\s\\S]*?)(</${tagName}>)`, "i");
  if (pattern.test(xml)) {
    return xml.replace(pattern, (match, start, count, endOpen, body, close) =>
      `${start}${Number(count) + entries.length}${endOpen}${body}${entries.join("")}${close}`
    );
  }
  const selfClosingPattern = new RegExp(`(<${tagName}\\b[^>]*count=")(\\d+)("[^>]*)/>`, "i");
  if (selfClosingPattern.test(xml)) {
    return xml.replace(selfClosingPattern, (match, start, count, endOpen) =>
      `${start}${Number(count) + entries.length}${endOpen}>${entries.join("")}</${tagName}>`
    );
  }
  return xml;
}

function appendXmlNumFormats(xml = "", entries = []) {
  if (!entries.length) {
    return xml;
  }
  if (/<numFmts\b/i.test(xml)) {
    return appendXmlCollectionEntries(xml, "numFmts", entries);
  }
  return xml.replace(/<fonts\b/i, `<numFmts count="${entries.length}">${entries.join("")}</numFmts><fonts`);
}

function maxExistingNumFmtId(xml = "") {
  const ids = Array.from(xml.matchAll(/numFmtId="(\d+)"/gi), (match) => Number(match[1]));
  return ids.length ? Math.max(...ids) : 163;
}

function xlsxStyleNumberFormatId(format = "", numFmtState) {
  if (format === "number") {
    return 2;
  }
  if (format === "percent") {
    return 10;
  }
  if (!format) {
    return 0;
  }
  const formatCode = xlsxRichNumberFormat(format);
  if (!formatCode) {
    return 0;
  }
  if (!numFmtState.ids.has(formatCode)) {
    numFmtState.nextId += 1;
    numFmtState.ids.set(formatCode, numFmtState.nextId);
    numFmtState.entries.push(
      `<numFmt numFmtId="${numFmtState.nextId}" formatCode="${escapeXmlAttribute(formatCode)}"/>`
    );
  }
  return numFmtState.ids.get(formatCode);
}

function xlsxStyleFontXml(format = {}) {
  const parts = [];
  if (format.bold) {
    parts.push("<b/>");
  }
  if (format.italic) {
    parts.push("<i/>");
  }
  if (format.underline) {
    parts.push("<u/>");
  }
  if (format.fontSize) {
    parts.push(`<sz val="${format.fontSize}"/>`);
  }
  const textRgb = hexToXlsxRgb(format.textColor);
  if (textRgb) {
    parts.push(`<color rgb="${textRgb}"/>`);
  }
  if (!parts.length) {
    return "";
  }
  parts.push('<name val="Calibri"/>');
  parts.push('<family val="2"/>');
  return `<font>${parts.join("")}</font>`;
}

function xlsxStyleFillXml(format = {}) {
  const fillRgb = hexToXlsxRgb(format.fillColor);
  if (!fillRgb) {
    return "";
  }
  return `<fill><patternFill patternType="solid"><fgColor rgb="${fillRgb}"/><bgColor indexed="64"/></patternFill></fill>`;
}

function xlsxStyleBorderXml(format = {}) {
  const border = normalizeHydriaBorder(format.border);
  if (!border) {
    return "";
  }
  const color = hexToXlsxRgb(border.color) || "FF202124";
  const edgeXml = (edge) =>
    border[edge] ? `<${edge} style="thin"><color rgb="${color}"/></${edge}>` : `<${edge}/>`;
  return `<border>${["left", "right", "top", "bottom"].map(edgeXml).join("")}<diagonal/></border>`;
}

function xlsxStyleXfXml(format = {}, ids = {}, numFmtId = 0) {
  const attributes = [
    `numFmtId="${numFmtId}"`,
    `fontId="${ids.fontId || 0}"`,
    `fillId="${ids.fillId || 0}"`,
    `borderId="${ids.borderId || 0}"`,
    'xfId="0"'
  ];
  if (numFmtId) {
    attributes.push('applyNumberFormat="1"');
  }
  if (ids.fontId) {
    attributes.push('applyFont="1"');
  }
  if (ids.fillId) {
    attributes.push('applyFill="1"');
  }
  if (ids.borderId) {
    attributes.push('applyBorder="1"');
  }
  const alignment = [];
  if (format.horizontalAlign) {
    alignment.push(`horizontal="${format.horizontalAlign}"`);
  }
  if (format.verticalAlign) {
    alignment.push(`vertical="${format.verticalAlign === "middle" ? "center" : format.verticalAlign}"`);
  }
  if (alignment.length) {
    attributes.push('applyAlignment="1"');
    return `<xf ${attributes.join(" ")}><alignment ${alignment.join(" ")}/></xf>`;
  }
  return `<xf ${attributes.join(" ")}/>`;
}

function collectHydriaStyleFormats(model = {}) {
  const formats = new Map();
  model.sheets.forEach((sheet) => {
    const tables = normalizeHydriaTables(sheet.tables);
    Object.entries(sheet.cellFormats || {}).forEach(([key]) => {
      const [rowIndexText, columnIndexText] = key.split(":");
      const rowIndex = Number(rowIndexText);
      const columnIndex = Number(columnIndexText);
      if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
        return;
      }
      const normalized = hydriaCellFormatForXlsxExport(sheet, tables, rowIndex, columnIndex);
      if (!isHydriaCellFormatEmpty(normalized)) {
        formats.set(JSON.stringify(normalized), normalized);
      }
    });
  });
  return formats;
}

function buildHydriaStyleSheetXml(stylesXml = "", model = {}) {
  const formats = collectHydriaStyleFormats(model);
  if (!formats.size) {
    return { stylesXml, styleIds: new Map() };
  }

  let nextFontId = getXmlCollectionCount(stylesXml, "fonts");
  let nextFillId = getXmlCollectionCount(stylesXml, "fills");
  let nextBorderId = getXmlCollectionCount(stylesXml, "borders");
  let nextXfId = getXmlCollectionCount(stylesXml, "cellXfs");
  const numFmtState = {
    nextId: Math.max(163, maxExistingNumFmtId(stylesXml)),
    ids: new Map(),
    entries: []
  };
  const fontEntries = [];
  const fillEntries = [];
  const borderEntries = [];
  const xfEntries = [];
  const styleIds = new Map();

  formats.forEach((format, key) => {
    const fontXml = xlsxStyleFontXml(format);
    const fillXml = xlsxStyleFillXml(format);
    const borderXml = xlsxStyleBorderXml(format);
    const ids = {};
    if (fontXml) {
      ids.fontId = nextFontId;
      nextFontId += 1;
      fontEntries.push(fontXml);
    }
    if (fillXml) {
      ids.fillId = nextFillId;
      nextFillId += 1;
      fillEntries.push(fillXml);
    }
    if (borderXml) {
      ids.borderId = nextBorderId;
      nextBorderId += 1;
      borderEntries.push(borderXml);
    }
    const numFmtId = xlsxStyleNumberFormatId(format.numberFormat, numFmtState);
    styleIds.set(key, nextXfId);
    nextXfId += 1;
    xfEntries.push(xlsxStyleXfXml(format, ids, numFmtId));
  });

  let nextStylesXml = appendXmlNumFormats(stylesXml, numFmtState.entries);
  nextStylesXml = appendXmlCollectionEntries(nextStylesXml, "fonts", fontEntries);
  nextStylesXml = appendXmlCollectionEntries(nextStylesXml, "fills", fillEntries);
  nextStylesXml = appendXmlCollectionEntries(nextStylesXml, "borders", borderEntries);
  nextStylesXml = appendXmlCollectionEntries(nextStylesXml, "cellXfs", xfEntries);
  return { stylesXml: nextStylesXml, styleIds };
}

function applyStyleIndexToCellXml(sheetXml = "", address = "", styleIndex = 0) {
  const pattern = new RegExp(`(<c\\b[^>]*\\br="${address}"[^>]*)(>)`);
  if (!pattern.test(sheetXml)) {
    return sheetXml;
  }
  return sheetXml.replace(pattern, (match, open, close) => {
    if (/\bs="\d+"/.test(open)) {
      return `${open.replace(/\bs="\d+"/, `s="${styleIndex}"`)}${close}`;
    }
    return `${open} s="${styleIndex}"${close}`;
  });
}

function applyHydriaWorkbookViewToXlsxBuffer(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  const workbookEntry = zip.getEntry("xl/workbook.xml");
  if (!workbookEntry) {
    return buffer;
  }
  const sheets = Array.isArray(model.sheets) ? model.sheets : [];
  let activeSheetIndex = sheets.findIndex((sheet) => sheet.id === model.activeSheetId && !sheet.hidden);
  if (activeSheetIndex < 0) {
    activeSheetIndex = Math.max(0, sheets.findIndex((sheet) => !sheet.hidden));
  }
  const workbookViewXml = `<bookViews><workbookView firstSheet="${activeSheetIndex}" activeTab="${activeSheetIndex}"/></bookViews>`;
  let workbookXml = workbookEntry.getData().toString("utf8").replace(/<bookViews\b[\s\S]*?<\/bookViews>/i, "");
  const insertAfterWorkbookPr = /<workbookPr\b[^>]*(?:\/>|>[\s\S]*?<\/workbookPr>)/i.exec(workbookXml);
  if (insertAfterWorkbookPr) {
    const insertAt = insertAfterWorkbookPr.index + insertAfterWorkbookPr[0].length;
    workbookXml = `${workbookXml.slice(0, insertAt)}${workbookViewXml}${workbookXml.slice(insertAt)}`;
  } else {
    workbookXml = workbookXml.replace(/<sheets\b/i, `${workbookViewXml}<sheets`);
  }
  zip.updateFile("xl/workbook.xml", Buffer.from(workbookXml, "utf8"));

  sheets.forEach((sheet, sheetIndex) => {
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    let sheetXml = sheetEntry.getData().toString("utf8").replace(/\s+tabSelected="1"/g, "");
    if (sheetIndex === activeSheetIndex) {
      sheetXml = sheetXml.replace(/<sheetView\b([^>]*)\/>/i, '<sheetView$1 tabSelected="1"/>');
      sheetXml = sheetXml.replace(/<sheetView\b([^>]*)>/i, (match, attributes = "") =>
        /\btabSelected=/.test(match) ? match : `<sheetView${attributes} tabSelected="1">`
      );
    }
    zip.updateFile(sheetPath, Buffer.from(sheetXml, "utf8"));
  });

  return zip.toBuffer();
}

function sanitizeXlsxTableName(value = "", fallback = "Table1", usedNames = new Set()) {
  let name = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");
  if (!name || /^\$?[A-Z]+\$?\d+$/i.test(name)) {
    name = fallback;
  }
  name = name.slice(0, 255) || fallback;
  const base = name;
  let suffix = 1;
  while (usedNames.has(name.toLowerCase())) {
    suffix += 1;
    name = `${base.slice(0, Math.max(1, 255 - String(suffix).length))}${suffix}`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function uniqueXlsxTableColumnNames(headers = []) {
  const used = new Set();
  return headers.map((header, index) => {
    const base = String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    let name = base;
    let suffix = 1;
    while (used.has(name.toLowerCase())) {
      suffix += 1;
      name = `${base} ${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function xlsxTableStyleName(style = "blue") {
  switch (String(style || "").toLowerCase()) {
    case "green":
      return "TableStyleMedium4";
    case "orange":
      return "TableStyleMedium3";
    case "purple":
      return "TableStyleMedium5";
    case "gray":
      return "TableStyleMedium7";
    case "blue":
    default:
      return "TableStyleMedium2";
  }
}

function hydriaTableTotalFunctionToXlsx(value = "") {
  switch (String(value || "").toLowerCase()) {
    case "sum":
    case "average":
    case "count":
    case "min":
    case "max":
      return String(value || "").toLowerCase();
    default:
      return "";
  }
}

function createHydriaXlsxTableXml({ tableId = 1, tableName = "Table1", table = {}, sheet = {} } = {}) {
  const bounds = normalizeHydriaStructureBounds(table);
  const ref = hydriaBoundsToXlsxRef(bounds);
  const headerNames = uniqueXlsxTableColumnNames(getHydriaTableHeaderNames(sheet, table));
  const hasTotals = Boolean(table.showTotalRow);
  const autoFilterEndRow = hasTotals ? Math.max(bounds.startRowIndex, bounds.endRowIndex - 1) : bounds.endRowIndex;
  const autoFilterRef =
    table.showFilterButtons === false || autoFilterEndRow <= bounds.startRowIndex
      ? ""
      : XLSX.utils.encode_range({
          s: { r: bounds.startRowIndex, c: bounds.startColumnIndex },
          e: { r: autoFilterEndRow, c: bounds.endColumnIndex }
        });
  const totalFunctions = table.totalFunctions && typeof table.totalFunctions === "object" ? table.totalFunctions : {};
  const columnsXml = headerNames
    .map((name, index) => {
      const columnIndex = bounds.startColumnIndex + index;
      const totalFunction = hasTotals ? hydriaTableTotalFunctionToXlsx(totalFunctions[String(columnIndex)]) : "";
      const totalCellText = hasTotals ? getHydriaGridCellText(sheet, bounds.endRowIndex, columnIndex) : "";
      const attributes = [`id="${index + 1}"`, `name="${escapeXmlAttribute(name)}"`];
      if (totalFunction) {
        attributes.push(`totalsRowFunction="${totalFunction}"`);
      } else if (hasTotals && totalCellText && !String(totalCellText).startsWith("=")) {
        attributes.push(`totalsRowLabel="${escapeXmlAttribute(totalCellText)}"`);
      }
      return `<tableColumn ${attributes.join(" ")}/>`;
    })
    .join("");
  const styleXml = `<tableStyleInfo name="${xlsxTableStyleName(table.style)}" showFirstColumn="${table.showFirstColumn ? 1 : 0}" showLastColumn="${table.showLastColumn ? 1 : 0}" showRowStripes="${table.showBandedRows === false ? 0 : 1}" showColumnStripes="${table.showBandedColumns ? 1 : 0}"/>`;
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tableId}" name="${escapeXmlAttribute(tableName)}" displayName="${escapeXmlAttribute(tableName)}" ref="${ref}" headerRowCount="${table.showHeaderRow === false ? 0 : 1}" totalsRowShown="${hasTotals ? 1 : 0}">`,
    autoFilterRef ? `<autoFilter ref="${autoFilterRef}"/>` : "",
    `<tableColumns count="${headerNames.length}">${columnsXml}</tableColumns>`,
    styleXml,
    "</table>"
  ].join("");
}

function appendXlsxContentTypeOverrides(zip, partNames = []) {
  if (!partNames.length) {
    return;
  }
  const entry = zip.getEntry("[Content_Types].xml");
  if (!entry) {
    return;
  }
  let xml = entry.getData().toString("utf8");
  const overrides = partNames
    .filter((partName) => !xml.includes(`PartName="${partName}"`))
    .map(
      (partName) =>
        `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`
    );
  if (!overrides.length) {
    return;
  }
  xml = xml.replace(/<\/Types>\s*$/i, `${overrides.join("")}</Types>`);
  zip.updateFile("[Content_Types].xml", Buffer.from(xml, "utf8"));
}

function nextRelationshipId(relationshipsXml = "") {
  const ids = Array.from(relationshipsXml.matchAll(/\bId="rId(\d+)"/gi), (match) => Number(match[1])).filter(Number.isFinite);
  return `rId${ids.length ? Math.max(...ids) + 1 : 1}`;
}

function addWorksheetTableRelationships(zip, sheetIndex = 0, tablePartNames = []) {
  const relPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`;
  const existingEntry = zip.getEntry(relPath);
  let xml = existingEntry
    ? existingEntry.getData().toString("utf8")
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const relationshipIds = [];
  tablePartNames.forEach((partName) => {
    const relationshipId = nextRelationshipId(xml);
    const target = `../tables/${partName.split("/").pop()}`;
    const relationship = `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="${target}"/>`;
    xml = xml.replace(/<\/Relationships>\s*$/i, `${relationship}</Relationships>`);
    relationshipIds.push(relationshipId);
  });
  if (existingEntry) {
    zip.updateFile(relPath, Buffer.from(xml, "utf8"));
  } else {
    zip.addFile(relPath, Buffer.from(xml, "utf8"));
  }
  return relationshipIds;
}

function insertWorksheetTableParts(sheetXml = "", relationshipIds = []) {
  if (!relationshipIds.length) {
    return sheetXml;
  }
  let xml = sheetXml.replace(/<tableParts\b[\s\S]*?<\/tableParts>/i, "").replace(/<tableParts\b[^>]*\/>/i, "");
  if (!/xmlns:r=/.test(xml)) {
    xml = xml.replace(/<worksheet\b/i, '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }
  const block = `<tableParts count="${relationshipIds.length}">${relationshipIds.map((id) => `<tablePart r:id="${id}"/>`).join("")}</tableParts>`;
  const insertBefore = /<extLst\b/i.exec(xml);
  if (insertBefore) {
    return `${xml.slice(0, insertBefore.index)}${block}${xml.slice(insertBefore.index)}`;
  }
  return xml.replace(/<\/worksheet>\s*$/i, `${block}</worksheet>`);
}

function applyHydriaTablesToXlsxBuffer(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  const tablePartNames = [];
  const usedTableNames = new Set();
  let nextTableId = 1;

  (Array.isArray(model.sheets) ? model.sheets : []).forEach((sheet, sheetIndex) => {
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    const rowCount = Math.max(1, 1 + (Array.isArray(sheet.rows) ? sheet.rows.length : 0));
    const columnCount = Math.max(1, Array.isArray(sheet.columns) ? sheet.columns.length : 0);
    const validTables = normalizeHydriaTables(sheet.tables)
      .map((table) =>
        normalizeHydriaTables([
          {
            ...table,
            startRowIndex: Math.min(table.startRowIndex, rowCount - 1),
            endRowIndex: Math.min(table.endRowIndex, rowCount - 1),
            startColumnIndex: Math.min(table.startColumnIndex, columnCount - 1),
            endColumnIndex: Math.min(table.endColumnIndex, columnCount - 1)
          }
        ])[0]
      )
      .filter(
        (table) =>
          table &&
          table.endColumnIndex >= table.startColumnIndex &&
          table.endRowIndex > table.startRowIndex
      );
    if (!validTables.length) {
      return;
    }

    const currentTablePartNames = validTables.map((table) => {
      const tableId = nextTableId;
      nextTableId += 1;
      const tableName = sanitizeXlsxTableName(table.name, `Table${tableId}`, usedTableNames);
      const partName = `/xl/tables/table${tableId}.xml`;
      tablePartNames.push(partName);
      zip.addFile(
        `xl/tables/table${tableId}.xml`,
        Buffer.from(createHydriaXlsxTableXml({ tableId, tableName, table, sheet }), "utf8")
      );
      return partName;
    });
    const relationshipIds = addWorksheetTableRelationships(zip, sheetIndex, currentTablePartNames);
    const sheetXml = sheetEntry.getData().toString("utf8");
    zip.updateFile(sheetPath, Buffer.from(insertWorksheetTableParts(sheetXml, relationshipIds), "utf8"));
  });

  appendXlsxContentTypeOverrides(zip, tablePartNames);
  return tablePartNames.length ? zip.toBuffer() : buffer;
}

function applyHydriaStylesToXlsxBuffer(buffer, model = {}) {
  const formats = collectHydriaStyleFormats(model);
  if (!formats.size) {
    return buffer;
  }
  const zip = new AdmZip(buffer);
  const stylesEntry = zip.getEntry("xl/styles.xml");
  if (!stylesEntry) {
    return buffer;
  }
  const currentStylesXml = stylesEntry.getData().toString("utf8");
  const { stylesXml, styleIds } = buildHydriaStyleSheetXml(currentStylesXml, model);
  zip.updateFile("xl/styles.xml", Buffer.from(stylesXml, "utf8"));

  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    const tables = normalizeHydriaTables(sheet.tables);
    let sheetXml = sheetEntry.getData().toString("utf8");
    Object.keys(sheet.cellFormats || {}).forEach((key) => {
      const [rowIndexText, columnIndexText] = key.split(":");
      const rowIndex = Number(rowIndexText);
      const columnIndex = Number(columnIndexText);
      if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
        return;
      }
      const normalized = hydriaCellFormatForXlsxExport(sheet, tables, rowIndex, columnIndex);
      if (isHydriaCellFormatEmpty(normalized)) {
        return;
      }
      const styleIndex = styleIds.get(JSON.stringify(normalized));
      if (!Number.isInteger(styleIndex)) {
        return;
      }
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      sheetXml = applyStyleIndexToCellXml(sheetXml, address, styleIndex);
    });
    zip.updateFile(sheetPath, Buffer.from(sheetXml, "utf8"));
  });

  return zip.toBuffer();
}

function hydriaValidationOperatorToXlsx(operator = "between") {
  switch (operator) {
    case "notBetween":
      return "notBetween";
    case "equal":
      return "equal";
    case "notEqual":
      return "notEqual";
    case "greaterThan":
      return "greaterThan";
    case "lessThan":
      return "lessThan";
    case "greaterOrEqual":
      return "greaterThanOrEqual";
    case "lessOrEqual":
      return "lessThanOrEqual";
    case "between":
    default:
      return "between";
  }
}

function hydriaValidationListFormula(source = "") {
  const text = String(source || "").trim();
  if (!text) {
    return "";
  }
  const rangeLike = /^=?(?:'[^']+'!|[A-Za-z0-9_ ]+!)?\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?$/i.test(text);
  if (rangeLike) {
    return text.startsWith("=") ? text.slice(1) : text;
  }
  const csvList = text
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
  return `"${csvList.replaceAll("\"", "\"\"")}"`;
}

function hydriaDataValidationXml(key = "", rule = {}) {
  const normalized = normalizeHydriaDataValidationRule(rule);
  if (!normalized) {
    return "";
  }
  const [rowIndexText, columnIndexText] = String(key).split(":");
  const rowIndex = Number(rowIndexText);
  const columnIndex = Number(columnIndexText);
  if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || columnIndex < 0) {
    return "";
  }
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const attributes = [
    `type="${normalized.type}"`,
    `allowBlank="${normalized.allowBlank ? 1 : 0}"`,
    'showErrorMessage="1"',
    `sqref="${address}"`
  ];
  if (normalized.type !== "list") {
    attributes.push(`operator="${hydriaValidationOperatorToXlsx(normalized.operator)}"`);
  }
  if (normalized.message) {
    attributes.push(`error="${escapeXmlAttribute(normalized.message)}"`);
  }

  const formula1 = normalized.type === "list"
    ? hydriaValidationListFormula(normalized.source)
    : normalized.minimum;
  if (!String(formula1 || "").trim()) {
    return "";
  }
  const formulas = [`<formula1>${escapeXmlText(formula1)}</formula1>`];
  if ((normalized.operator === "between" || normalized.operator === "notBetween") && normalized.type !== "list") {
    formulas.push(`<formula2>${escapeXmlText(normalized.maximum || normalized.minimum)}</formula2>`);
  }
  return `<dataValidation ${attributes.join(" ")}>${formulas.join("")}</dataValidation>`;
}

function insertWorksheetDataValidations(sheetXml = "", validationEntries = []) {
  if (!validationEntries.length) {
    return sheetXml;
  }
  const withoutExisting = sheetXml.replace(/<dataValidations\b[\s\S]*?<\/dataValidations>/i, "");
  const block = `<dataValidations count="${validationEntries.length}">${validationEntries.join("")}</dataValidations>`;
  const insertBefore = /<(hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/i.exec(withoutExisting);
  if (insertBefore) {
    return `${withoutExisting.slice(0, insertBefore.index)}${block}${withoutExisting.slice(insertBefore.index)}`;
  }
  return withoutExisting.replace(/<\/worksheet>\s*$/i, `${block}</worksheet>`);
}

function applyHydriaDataValidationsToXlsxBuffer(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  let changed = false;
  model.sheets.forEach((sheet, sheetIndex) => {
    const validations = Object.entries(normalizeHydriaDataValidations(sheet.dataValidations || sheet.validations))
      .map(([key, rule]) => hydriaDataValidationXml(key, rule))
      .filter(Boolean);
    if (!validations.length) {
      return;
    }
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    const sheetXml = sheetEntry.getData().toString("utf8");
    zip.updateFile(sheetPath, Buffer.from(insertWorksheetDataValidations(sheetXml, validations), "utf8"));
    changed = true;
  });
  return changed ? zip.toBuffer() : buffer;
}

function appendXmlDxfs(xml = "", entries = []) {
  if (!entries.length) {
    return xml;
  }
  if (/<dxfs\b/i.test(xml)) {
    return appendXmlCollectionEntries(xml, "dxfs", entries);
  }
  const insertBefore = /<(tableStyles|colors|extLst)\b/i.exec(xml);
  const block = `<dxfs count="${entries.length}">${entries.join("")}</dxfs>`;
  if (insertBefore) {
    return `${xml.slice(0, insertBefore.index)}${block}${xml.slice(insertBefore.index)}`;
  }
  return xml.replace(/<\/styleSheet>\s*$/i, `${block}</styleSheet>`);
}

function hydriaConditionalFormatDxfXml(rule = {}) {
  const normalized = normalizeHydriaConditionalFormatRule(rule);
  if (!normalized) {
    return "";
  }
  const parts = [];
  const textRgb = hexToXlsxRgb(normalized.textColor);
  if (textRgb || normalized.bold) {
    parts.push(`<font>${normalized.bold ? "<b/>" : ""}${textRgb ? `<color rgb="${textRgb}"/>` : ""}</font>`);
  }
  const fillRgb = hexToXlsxRgb(normalized.fillColor);
  if (fillRgb) {
    parts.push(`<fill><patternFill patternType="solid"><fgColor rgb="${fillRgb}"/><bgColor indexed="64"/></patternFill></fill>`);
  }
  return `<dxf>${parts.join("")}</dxf>`;
}

function hydriaConditionalFormatOperator(type = "") {
  switch (type) {
    case "greaterThan":
      return "greaterThan";
    case "lessThan":
      return "lessThan";
    case "between":
      return "between";
    case "equal":
      return "equal";
    default:
      return "";
  }
}

function hydriaConditionalFormatFormulaForText(rule = {}) {
  const range = String(rule.range || "A1").split(/\s+/)[0];
  const firstRef = String(range.split(":")[0] || "A1").replace(/\$/g, "");
  return `NOT(ISERROR(SEARCH("${String(rule.value1 || "").replaceAll("\"", "\"\"")}",${firstRef})))`;
}

function hydriaConditionalFormatRuleXml(rule = {}, dxfId = 0, priority = 1) {
  const normalized = normalizeHydriaConditionalFormatRule(rule);
  if (!normalized) {
    return "";
  }
  const baseAttributes = [`priority="${priority}"`, `dxfId="${dxfId}"`];
  if (normalized.type === "duplicate") {
    return `<cfRule type="duplicateValues" ${baseAttributes.join(" ")}/>`;
  }
  if (normalized.type === "textContains") {
    return `<cfRule type="containsText" operator="containsText" text="${escapeXmlAttribute(normalized.value1)}" ${baseAttributes.join(" ")}><formula>${escapeXmlText(hydriaConditionalFormatFormulaForText(normalized))}</formula></cfRule>`;
  }
  const operator = hydriaConditionalFormatOperator(normalized.type);
  if (!operator) {
    return "";
  }
  const formulas = [`<formula>${escapeXmlText(normalized.value1)}</formula>`];
  if (normalized.type === "between") {
    formulas.push(`<formula>${escapeXmlText(normalized.value2)}</formula>`);
  }
  return `<cfRule type="cellIs" operator="${operator}" ${baseAttributes.join(" ")}>${formulas.join("")}</cfRule>`;
}

function insertWorksheetConditionalFormats(sheetXml = "", entries = []) {
  if (!entries.length) {
    return sheetXml;
  }
  const withoutExisting = sheetXml.replace(/<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/gi, "");
  const block = entries.join("");
  const insertBefore = /<(dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/i.exec(withoutExisting);
  if (insertBefore) {
    return `${withoutExisting.slice(0, insertBefore.index)}${block}${withoutExisting.slice(insertBefore.index)}`;
  }
  return withoutExisting.replace(/<\/worksheet>\s*$/i, `${block}</worksheet>`);
}

function applyHydriaConditionalFormatsToXlsxBuffer(buffer, model = {}) {
  const normalizedRules = [];
  model.sheets.forEach((sheet, sheetIndex) => {
    normalizeHydriaConditionalFormats(sheet.conditionalFormats || sheet.conditionalFormatting).forEach((rule) => {
      normalizedRules.push({ ...rule, sheetIndex });
    });
  });
  if (!normalizedRules.length) {
    return buffer;
  }

  const zip = new AdmZip(buffer);
  const stylesEntry = zip.getEntry("xl/styles.xml");
  if (!stylesEntry) {
    return buffer;
  }
  const stylesXml = stylesEntry.getData().toString("utf8");
  const existingDxfCount = getXmlCollectionCount(stylesXml, "dxfs");
  const dxfEntries = normalizedRules.map((rule) => hydriaConditionalFormatDxfXml(rule)).filter(Boolean);
  if (!dxfEntries.length) {
    return buffer;
  }
  zip.updateFile("xl/styles.xml", Buffer.from(appendXmlDxfs(stylesXml, dxfEntries), "utf8"));

  let priority = 1;
  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetRules = normalizeHydriaConditionalFormats(sheet.conditionalFormats || sheet.conditionalFormatting);
    if (!sheetRules.length) {
      return;
    }
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    const entries = sheetRules
      .map((rule, ruleIndex) => {
        const dxfId = existingDxfCount + normalizedRules.findIndex((entry) => entry.sheetIndex === sheetIndex && entry.id === rule.id);
        const cfRule = hydriaConditionalFormatRuleXml(rule, Math.max(existingDxfCount + ruleIndex, dxfId), priority);
        priority += 1;
        return cfRule ? `<conditionalFormatting sqref="${escapeXmlAttribute(rule.range)}">${cfRule}</conditionalFormatting>` : "";
      })
      .filter(Boolean);
    if (!entries.length) {
      return;
    }
    const sheetXml = sheetEntry.getData().toString("utf8");
    zip.updateFile(sheetPath, Buffer.from(insertWorksheetConditionalFormats(sheetXml, entries), "utf8"));
  });

  return zip.toBuffer();
}

function decodeXmlAttribute(value = "") {
  return String(value)
    .replaceAll("&quot;", "\"")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseXmlAttributes(tag = "") {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([\w:]+)="([^"]*)"/g), (match) => [match[1], decodeXmlAttribute(match[2])])
  );
}

function extractXmlCollectionItems(xml = "", collectionTag = "", itemTag = "") {
  const collectionMatch = new RegExp(`<${collectionTag}\\b[^>]*>([\\s\\S]*?)</${collectionTag}>`, "i").exec(xml);
  if (!collectionMatch) {
    return [];
  }
  return Array.from(
    collectionMatch[1].matchAll(new RegExp(`<${itemTag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${itemTag}>)`, "gi")),
    (match) => match[0]
  );
}

function numberFormatFromXlsxId(numFmtId = 0, customFormats = new Map()) {
  const numericId = Number(numFmtId);
  if (numericId === 2 || numericId === 3 || numericId === 4) {
    return "number";
  }
  if (numericId === 9 || numericId === 10) {
    return "percent";
  }
  if (numericId >= 14 && numericId <= 22) {
    return "date";
  }
  const formatCode = String(customFormats.get(numericId) || "");
  if (!formatCode) {
    return "";
  }
  if (/%/.test(formatCode)) {
    return "percent";
  }
  if (/[$]|eur|usd|gbp|jpy|currency/i.test(formatCode)) {
    return "currency";
  }
  if (/[ymdhs]/i.test(formatCode) && !/[#0]/.test(formatCode.replace(/[ymdhs]/gi, ""))) {
    return "date";
  }
  if (/[#0]/.test(formatCode)) {
    return "number";
  }
  return "";
}

function hydriaFormatFromFontXml(fontXml = "") {
  const format = {};
  if (/<b\b/i.test(fontXml)) {
    format.bold = true;
  }
  if (/<i\b/i.test(fontXml)) {
    format.italic = true;
  }
  if (/<u\b/i.test(fontXml)) {
    format.underline = true;
  }
  const sizeMatch = /<sz\b[^>]*val="([^"]+)"/i.exec(fontXml);
  if (sizeMatch) {
    const fontSize = Number(sizeMatch[1]);
    if (Number.isFinite(fontSize)) {
      format.fontSize = Math.max(8, Math.min(36, Math.round(fontSize)));
    }
  }
  const colorMatch = /<color\b[^>]*rgb="([^"]+)"/i.exec(fontXml);
  const textColor = xlsxColorToHex({ rgb: colorMatch?.[1] || "" });
  if (textColor) {
    format.textColor = textColor;
  }
  return format;
}

function hydriaFormatFromFillXml(fillXml = "") {
  if (!/patternType="solid"/i.test(fillXml)) {
    return {};
  }
  const colorMatch = /<fgColor\b[^>]*rgb="([^"]+)"/i.exec(fillXml);
  const fillColor = xlsxColorToHex({ rgb: colorMatch?.[1] || "" });
  return fillColor ? { fillColor } : {};
}

function hydriaFormatFromBorderXml(borderXml = "") {
  const border = {};
  BORDER_EDGES.forEach((edge) => {
    const edgeMatch = new RegExp(`<${edge}\\b([^>]*)>([\\s\\S]*?)</${edge}>|<${edge}\\b([^>]*)/>`, "i").exec(borderXml);
    const edgeAttributes = parseXmlAttributes(edgeMatch?.[1] || edgeMatch?.[3] || "");
    if (edgeAttributes.style) {
      border[edge] = true;
      const colorMatch = /<color\b[^>]*rgb="([^"]+)"/i.exec(edgeMatch?.[2] || "");
      border.color = xlsxColorToHex({ rgb: colorMatch?.[1] || "" }) || border.color;
    }
  });
  const normalized = normalizeHydriaBorder(border);
  return normalized ? { border: normalized } : {};
}

function hydriaFormatFromXfXml(xfXml = "", lookup = {}) {
  const xfAttributes = parseXmlAttributes(xfXml);
  const format = {};
  const numberFormat = numberFormatFromXlsxId(xfAttributes.numFmtId, lookup.customFormats);
  if (numberFormat) {
    format.numberFormat = numberFormat;
  }
  const fontId = Number(xfAttributes.fontId || 0);
  if (fontId > 0 && lookup.fonts[fontId]) {
    Object.assign(format, lookup.fonts[fontId]);
  }
  const fillId = Number(xfAttributes.fillId || 0);
  if (fillId > 1 && lookup.fills[fillId]) {
    Object.assign(format, lookup.fills[fillId]);
  }
  const borderId = Number(xfAttributes.borderId || 0);
  if (borderId > 0 && lookup.borders[borderId]) {
    Object.assign(format, lookup.borders[borderId]);
  }
  const alignmentMatch = /<alignment\b([^>]*)\/?>/i.exec(xfXml);
  if (alignmentMatch) {
    const alignment = parseXmlAttributes(alignmentMatch[1]);
    if (HORIZONTAL_ALIGNMENTS.has(alignment.horizontal)) {
      format.horizontalAlign = alignment.horizontal;
    }
    if (alignment.vertical === "center") {
      format.verticalAlign = "middle";
    } else if (VERTICAL_ALIGNMENTS.has(alignment.vertical)) {
      format.verticalAlign = alignment.vertical;
    }
  }
  return normalizeHydriaCellFormat(format);
}

function extractHydriaStyleFormatsFromXlsxBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const stylesEntry = zip.getEntry("xl/styles.xml");
  if (!stylesEntry) {
    return { zip, styleFormats: [] };
  }
  const stylesXml = stylesEntry.getData().toString("utf8");
  const customFormats = new Map(
    Array.from(stylesXml.matchAll(/<numFmt\b([^>]*)\/>/gi), (match) => {
      const attributes = parseXmlAttributes(match[1]);
      return [Number(attributes.numFmtId), attributes.formatCode || ""];
    })
  );
  const fonts = extractXmlCollectionItems(stylesXml, "fonts", "font").map(hydriaFormatFromFontXml);
  const fills = extractXmlCollectionItems(stylesXml, "fills", "fill").map(hydriaFormatFromFillXml);
  const borders = extractXmlCollectionItems(stylesXml, "borders", "border").map(hydriaFormatFromBorderXml);
  const styleFormats = extractXmlCollectionItems(stylesXml, "cellXfs", "xf").map((xfXml) =>
    hydriaFormatFromXfXml(xfXml, { customFormats, fonts, fills, borders })
  );
  return { zip, styleFormats };
}

function applyXlsxStyleFormatsToHydriaModel(buffer, model = {}) {
  const { zip, styleFormats } = extractHydriaStyleFormatsFromXlsxBuffer(buffer);
  if (!styleFormats.length) {
    return model;
  }

  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetEntry = zip.getEntry(`xl/worksheets/sheet${sheetIndex + 1}.xml`);
    if (!sheetEntry) {
      return;
    }
    const sheetXml = sheetEntry.getData().toString("utf8");
    const dimensionMatch = /<dimension\b[^>]*ref="([^"]+)"/i.exec(sheetXml);
    const dimensionStart = String(dimensionMatch?.[1] || "A1").split(":")[0] || "A1";
    const rangeStart = XLSX.utils.decode_cell(dimensionStart);
    sheet.cellFormats = sheet.cellFormats || {};

    Array.from(sheetXml.matchAll(/<c\b([^>]*)>/gi)).forEach((match) => {
      const attributes = parseXmlAttributes(match[1]);
      if (!attributes.r || !attributes.s) {
        return;
      }
      const cellAddress = XLSX.utils.decode_cell(attributes.r);
      const rowIndex = cellAddress.r - rangeStart.r;
      const columnIndex = cellAddress.c - rangeStart.c;
      if (rowIndex < 0 || columnIndex < 0) {
        return;
      }
      const styleFormat = styleFormats[Number(attributes.s)] || {};
      if (isHydriaCellFormatEmpty(styleFormat)) {
        return;
      }
      const key = `${rowIndex}:${columnIndex}`;
      const mergedFormat = normalizeHydriaCellFormat({
        ...(sheet.cellFormats[key] || {}),
        ...styleFormat
      });
      if (!isHydriaCellFormatEmpty(mergedFormat)) {
        sheet.cellFormats[key] = mergedFormat;
      }
    });
  });

  return model;
}

function hydriaOperatorFromXlsx(operator = "between") {
  switch (operator) {
    case "greaterThanOrEqual":
      return "greaterOrEqual";
    case "lessThanOrEqual":
      return "lessOrEqual";
    case "notBetween":
    case "equal":
    case "notEqual":
    case "greaterThan":
    case "lessThan":
    case "between":
      return operator;
    default:
      return "between";
  }
}

function normalizeImportedListFormula(formula = "") {
  const text = String(formula || "").trim();
  if (text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1).replaceAll("\"\"", "\"");
  }
  return text;
}

function eachXlsxSqrefCell(sqref = "", callback = () => {}) {
  String(sqref || "")
    .split(/\s+/)
    .filter(Boolean)
    .forEach((ref) => {
      try {
        const range = XLSX.utils.decode_range(ref);
        for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
          for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
            callback(rowIndex, columnIndex);
          }
        }
      } catch {
        // Ignore invalid workbook refs while importing user files.
      }
    });
}

function extractFormulaText(xml = "", index = 1) {
  const match = new RegExp(`<formula${index}>([\\s\\S]*?)</formula${index}>`, "i").exec(xml);
  return decodeXmlAttribute(match?.[1] || "");
}

function applyXlsxDataValidationsToHydriaModel(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetEntry = zip.getEntry(`xl/worksheets/sheet${sheetIndex + 1}.xml`);
    if (!sheetEntry) {
      return;
    }
    const sheetXml = sheetEntry.getData().toString("utf8");
    const dimensionMatch = /<dimension\b[^>]*ref="([^"]+)"/i.exec(sheetXml);
    const dimensionStart = String(dimensionMatch?.[1] || "A1").split(":")[0] || "A1";
    const rangeStart = XLSX.utils.decode_cell(dimensionStart);
    const validations = {};

    Array.from(sheetXml.matchAll(/<dataValidation\b([^>]*)(?:\/>|>([\s\S]*?)<\/dataValidation>)/gi)).forEach((match) => {
      const attributes = parseXmlAttributes(match[1]);
      const type = String(attributes.type || "list");
      if (!DATA_VALIDATION_TYPES.has(type)) {
        return;
      }
      const body = match[2] || "";
      const rule = normalizeHydriaDataValidationRule({
        type,
        operator: hydriaOperatorFromXlsx(attributes.operator || "between"),
        allowBlank: attributes.allowBlank !== "0",
        showDropdown: attributes.showDropDown !== "1",
        source: type === "list" ? normalizeImportedListFormula(extractFormulaText(body, 1)) : "",
        minimum: type === "list" ? "" : extractFormulaText(body, 1),
        maximum: type === "list" ? "" : extractFormulaText(body, 2),
        message: attributes.error || ""
      });
      if (!rule) {
        return;
      }
      eachXlsxSqrefCell(attributes.sqref || "", (absoluteRowIndex, absoluteColumnIndex) => {
        const rowIndex = absoluteRowIndex - rangeStart.r;
        const columnIndex = absoluteColumnIndex - rangeStart.c;
        if (rowIndex >= 0 && columnIndex >= 0) {
          validations[`${rowIndex}:${columnIndex}`] = rule;
        }
      });
    });

    if (Object.keys(validations).length) {
      sheet.dataValidations = {
        ...(sheet.dataValidations || {}),
        ...validations
      };
    }
  });
  return model;
}

function hydriaModelToWorkbook(model = {}) {
  const normalized = normalizeHydriaWorkbook(model);
  const workbook = XLSX.utils.book_new();
  const workbookSheets = [];
  workbook.Workbook = {
    ...(workbook.Workbook || {}),
    CalcPr: {
      fullCalcOnLoad: true
    },
    Sheets: workbookSheets
  };
  const usedNames = new Set();
  const sheetNameById = new Map();
  normalized.sheets.forEach((sheet) => {
    const sheetName = uniqueSheetName(sheet.name, usedNames);
    sheetNameById.set(sheet.id, sheetName);
    workbookSheets.push({
      name: sheetName,
      Hidden: sheet.hidden ? 1 : 0
    });
    XLSX.utils.book_append_sheet(workbook, hydriaSheetToWorksheet(sheet), sheetName);
  });
  const activeSheetIndex = Math.max(
    0,
    normalized.sheets.findIndex((sheet) => sheet.id === normalized.activeSheetId)
  );
  workbook.Workbook.Views = [{ activeTab: activeSheetIndex }];
  const workbookNames = normalizeHydriaNamedRanges(normalized.namedRanges)
    .map((namedRange) => {
      const sheetName = sheetNameById.get(namedRange.sheetId) || sheetNameById.get(normalized.activeSheetId) || workbook.SheetNames[0];
      const ref = hydriaRangeToAbsoluteXlsxRef(namedRange.range);
      if (!sheetName || !ref) {
        return null;
      }
      return {
        Name: namedRange.name,
        Ref: `${quoteXlsxSheetName(sheetName)}!${ref}`,
        Comment: namedRange.comment || undefined
      };
    })
    .filter(Boolean);
  if (workbookNames.length) {
    workbook.Workbook.Names = workbookNames;
  }
  return workbook;
}

function buildSheetPdfBuffer(model = {}, sheetId = "") {
  const normalized = normalizeHydriaWorkbook(model);
  const sheet = normalized.sheets.find((entry) => entry.id === sheetId) || normalized.sheets[0];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 32,
      size: "A4",
      layout: "landscape"
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const columns = Array.isArray(sheet?.columns) && sheet.columns.length ? sheet.columns : [...DEFAULT_COLUMNS];
    const rows = Array.isArray(sheet?.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]];
    const maxColumns = Math.min(columns.length, 8);
    const visibleColumns = columns.slice(0, maxColumns);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableTop = 88;
    const rowHeight = 20;
    const footerHeight = 34;
    const rowsPerPage = Math.max(10, Math.floor((doc.page.height - tableTop - footerHeight) / rowHeight) - 1);
    const columnWidth = pageWidth / Math.max(1, visibleColumns.length);

    const drawHeader = (startRowIndex = 0) => {
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#111827").text(sheet?.name || "Sheet", doc.page.margins.left, 28);
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
      doc.text(
        `${rows.length + 1} rows | ${columns.length} columns${columns.length > maxColumns ? ` | PDF shows first ${maxColumns} columns` : ""}`,
        doc.page.margins.left,
        48
      );
      const headerY = tableTop;
      visibleColumns.forEach((label, columnIndex) => {
        const x = doc.page.margins.left + columnIndex * columnWidth;
        doc
          .rect(x, headerY, columnWidth, rowHeight)
          .fillAndStroke("#f3f4f6", "#d1d5db");
        doc
          .fillColor("#111827")
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(String(label || `Column ${columnIndex + 1}`), x + 4, headerY + 6, {
            width: columnWidth - 8,
            height: rowHeight - 8,
            ellipsis: true
          });
      });
      doc.fillColor("#111827").font("Helvetica").fontSize(8);
      return headerY + rowHeight;
    };

    for (let pageRowIndex = 0; pageRowIndex < rows.length; pageRowIndex += rowsPerPage) {
      if (pageRowIndex > 0) {
        doc.addPage();
      }
      let cursorY = drawHeader(pageRowIndex);
      rows.slice(pageRowIndex, pageRowIndex + rowsPerPage).forEach((row) => {
        visibleColumns.forEach((_, columnIndex) => {
          const x = doc.page.margins.left + columnIndex * columnWidth;
          doc
            .rect(x, cursorY, columnWidth, rowHeight)
            .stroke("#e5e7eb");
          doc
            .fillColor("#111827")
            .font("Helvetica")
            .fontSize(8)
            .text(normalizeCellText(row?.[columnIndex]), x + 4, cursorY + 6, {
              width: columnWidth - 8,
              height: rowHeight - 8,
              ellipsis: true
            });
        });
        cursorY += rowHeight;
      });
    }

    doc.end();
  });
}

function safeDownloadFilename(value = "hydria-sheet.xlsx") {
  const name = String(value || "hydria-sheet.xlsx")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || "hydria-sheet.xlsx").toLowerCase().endsWith(".xlsx") ? name : `${name || "hydria-sheet"}.xlsx`;
}

function safePdfFilename(value = "hydria-sheet.pdf") {
  const name = String(value || "hydria-sheet.pdf")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || "hydria-sheet.pdf").toLowerCase().endsWith(".pdf") ? name : `${name || "hydria-sheet"}.pdf`;
}

router.post("/import-xlsx", upload.single("workbook"), (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      throw new AppError("No XLSX workbook uploaded", 400);
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
      cellText: true,
      cellStyles: true
    });

    res.json({
      success: true,
      filename: req.file.originalname || "",
      model: applyXlsxDataValidationsToHydriaModel(
        req.file.buffer,
        applyXlsxStyleFormatsToHydriaModel(req.file.buffer, workbookToHydriaModel(workbook))
      )
    });
  } catch (error) {
    next(error);
  }
});

router.post("/export-xlsx", (req, res, next) => {
  try {
    const normalizedModel = normalizeHydriaWorkbook(req.body?.model || {});
    const workbook = hydriaModelToWorkbook(normalizedModel);
    const rawBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
      bookSST: true
    });
    const viewBuffer = applyHydriaWorkbookViewToXlsxBuffer(rawBuffer, normalizedModel);
    const tableBuffer = applyHydriaTablesToXlsxBuffer(viewBuffer, normalizedModel);
    const styledBuffer = applyHydriaStylesToXlsxBuffer(tableBuffer, normalizedModel);
    const validationBuffer = applyHydriaDataValidationsToXlsxBuffer(styledBuffer, normalizedModel);
    const buffer = applyHydriaConditionalFormatsToXlsxBuffer(validationBuffer, normalizedModel);

    res.setHeader("Content-Type", XLSX_MIME_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadFilename(req.body?.filename)}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/export-pdf", async (req, res, next) => {
  try {
    const normalizedModel = normalizeHydriaWorkbook(req.body?.model || {});
    const targetSheetId =
      normalizedModel.sheets.some((sheet) => sheet.id === req.body?.sheetId) ? String(req.body?.sheetId) : normalizedModel.activeSheetId;
    const buffer = await buildSheetPdfBuffer(normalizedModel, targetSheetId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safePdfFilename(req.body?.filename)}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
