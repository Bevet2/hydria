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
const BORDER_STYLES = new Set(["thin", "medium", "thick", "dashed", "dotted", "double"]);
const TABLE_STYLES = new Set(["blue", "green", "orange", "purple", "gray"]);
const TABLE_TOTAL_FUNCTIONS = new Set(["sum", "average", "count", "min", "max", "none"]);
const PIVOT_AGGREGATES = new Set(["sum", "count", "average", "min", "max"]);
const CHART_KINDS = new Set([
  "column",
  "stacked-column",
  "percent-column",
  "line",
  "line-markers",
  "combo",
  "scatter",
  "bubble",
  "radar",
  "pie",
  "donut",
  "sunburst",
  "bar",
  "stacked-bar",
  "percent-bar",
  "histogram",
  "box",
  "waterfall",
  "area",
  "stacked-area",
  "funnel",
  "treemap"
]);
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
const XLSX_FORMULA_NAME_ALIASES = {
  SI: "IF",
  SIERREUR: "IFERROR",
  ET: "AND",
  OU: "OR",
  NON: "NOT",
  VRAI: "TRUE",
  FAUX: "FALSE",
  AVG: "AVERAGE",
  SOMME: "SUM",
  "SOMME.SI": "SUMIF",
  "SOMME.SI.ENS": "SUMIFS",
  MOYENNE: "AVERAGE",
  "MOYENNE.SI": "AVERAGEIF",
  "MOYENNE.SI.ENS": "AVERAGEIFS",
  NB: "COUNT",
  NBVAL: "COUNTA",
  "NB.VIDE": "COUNTBLANK",
  "NB.SI": "COUNTIF",
  "NB.SI.ENS": "COUNTIFS",
  AUJOURDHUI: "TODAY",
  MAINTENANT: "NOW",
  TEXTE: "TEXT",
  GAUCHE: "LEFT",
  DROITE: "RIGHT",
  STXT: "MID",
  SUPPRESPACE: "TRIM",
  VALEUR: "VALUE",
  FILTRE: "FILTER",
  TRIER: "SORT",
  UNIQUE: "UNIQUE",
  EQUIV: "MATCH",
  RECHERCHEV: "VLOOKUP",
  RECHERCHEX: "XLOOKUP",
  "SOUS.TOTAL": "SUBTOTAL",
  ARRONDI: "ROUND",
  "ARRONDI.INF": "ROUNDDOWN",
  "ARRONDI.SUP": "ROUNDUP",
  PRODUIT: "PRODUCT",
  CONCATENER: "CONCAT"
};
const XLSX_ZERO_ARGUMENT_FORMULAS = new Set(["NOW", "TODAY", "TRUE", "FALSE", "RAND"]);
const XLSX_TABLE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml";
const XLSX_DRAWING_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.drawing+xml";
const XLSX_CHART_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const XLSX_METADATA_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml";
const XLSX_RELATIONSHIPS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
const XLSX_TABLE_RELATIONSHIP_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table";
const XLSX_DRAWING_RELATIONSHIP_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const XLSX_CHART_RELATIONSHIP_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const XLSX_METADATA_RELATIONSHIP_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata";
const XLSX_EMUS_PER_PIXEL = 9525;
const HYDRIA_ROW_HEADER_WIDTH = 52;
const HYDRIA_COLUMN_HEADER_HEIGHT = 34;
const HYDRIA_DEFAULT_COLUMN_WIDTH = 132;
const HYDRIA_DEFAULT_ROW_HEIGHT = 34;
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
const XLSX_FUTURE_FORMULA_PREFIXES = {
  ANCHORARRAY: "_xlfn.ANCHORARRAY",
  CONCAT: "_xlfn.CONCAT",
  FILTER: "_xlfn._xlws.FILTER",
  LAMBDA: "_xlfn.LAMBDA",
  LET: "_xlfn.LET",
  RANDARRAY: "_xlfn.RANDARRAY",
  SEQUENCE: "_xlfn.SEQUENCE",
  SINGLE: "_xlfn.SINGLE",
  SORT: "_xlfn._xlws.SORT",
  SORTBY: "_xlfn.SORTBY",
  UNIQUE: "_xlfn.UNIQUE",
  XLOOKUP: "_xlfn.XLOOKUP",
  XMATCH: "_xlfn.XMATCH"
};
const XLSX_DYNAMIC_ARRAY_FORMULA_NAMES = new Set([
  "ANCHORARRAY",
  "FILTER",
  "RANDARRAY",
  "SEQUENCE",
  "SORT",
  "SORTBY",
  "UNIQUE"
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

function normalizeImportedXlsxFormulaForHydria(formula = "") {
  return replaceFormulaOutsideQuotes(decodeXmlAttribute(formula), (segment) =>
    stripImplicitIntersectionBeforeFunctions(segment)
      .replace(/_xlfn\._xlws\./gi, "")
      .replace(/_xlfn\./gi, "")
      .replace(/_xlws\./gi, "")
  );
}

function readWorksheetCellText(cell) {
  if (!cell) {
    return "";
  }
  if (cell.f) {
    return `=${normalizeImportedXlsxFormulaForHydria(cell.f)}`;
  }
  if (cell.v === null || cell.v === undefined) {
    return "";
  }
  if (cell.v instanceof Date) {
    return normalizeCellText(cell.v);
  }
  if (cell.t === "n") {
    return inferHydriaNumberFormat(cell) === "date" && cell.w
      ? normalizeCellText(cell.w)
      : normalizeCellText(cell.v);
  }
  if (cell.t === "b") {
    return cell.v ? "TRUE" : "FALSE";
  }
  return normalizeCellText(cell.v ?? cell.w);
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
  normalized.style = BORDER_STYLES.has(border.style) ? border.style : "medium";
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

function normalizeHydriaChartPoint(point = {}, index = 0) {
  if (typeof point === "string" || typeof point === "number") {
    return {
      label: `Point ${index + 1}`,
      value: String(point ?? ""),
      xValue: "",
      yValue: String(point ?? ""),
      sizeValue: "",
      secondaryValue: ""
    };
  }
  if (!point || typeof point !== "object" || Array.isArray(point)) {
    return null;
  }
  return {
    label: String(point.label || point.name || `Point ${index + 1}`),
    value: String(point.value ?? point.y ?? ""),
    xValue: String(point.xValue ?? point.x ?? ""),
    yValue: String(point.yValue ?? point.y ?? point.value ?? ""),
    sizeValue: String(point.sizeValue ?? point.size ?? point.z ?? ""),
    secondaryValue: String(point.secondaryValue ?? point.secondary ?? "")
  };
}

function normalizeHydriaChartMetric(value = 0, fallback = 0, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(numericValue, max));
}

function normalizeHydriaChartAxisMode(value = "auto") {
  const normalized = String(value || "auto").trim().toLowerCase();
  return normalized === "fixed" ? "fixed" : "auto";
}

function normalizeHydriaChartAxisDensity(value = "auto") {
  const normalized = String(value || "auto").trim().toLowerCase();
  return ["auto", "compact", "detailed"].includes(normalized) ? normalized : "auto";
}

function normalizeHydriaChartLegendPosition(value = "bottom") {
  const normalized = String(value || "bottom").trim().toLowerCase();
  return ["bottom", "top", "right", "left"].includes(normalized) ? normalized : "bottom";
}

function normalizeHydriaOptionalChartNumber(value = "") {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const numericValue = Number(String(value).replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : "";
}

function normalizeHydriaCharts(charts = []) {
  if (!Array.isArray(charts)) {
    return [];
  }
  return charts
    .filter((chart) => chart && typeof chart === "object" && !Array.isArray(chart))
    .map((chart, index) => {
      const kind = String(chart.kind || "").trim().toLowerCase();
      return {
        id: String(chart.id || `sheet-chart-${index + 1}`),
        title: String(chart.title || `Chart ${index + 1}`),
        kind: CHART_KINDS.has(kind) ? kind : "column",
        range: String(chart.range || ""),
        sourceTableId: String(chart.sourceTableId || chart.tableId || ""),
        seriesName: String(chart.seriesName || chart.series || ""),
        secondarySeriesName: String(chart.secondarySeriesName || chart.secondarySeries || ""),
        x: normalizeHydriaChartMetric(chart.x ?? chart.left, 212, { min: 0, max: 100000 }),
        y: normalizeHydriaChartMetric(chart.y ?? chart.top, 52, { min: 0, max: 100000 }),
        width: normalizeHydriaChartMetric(chart.width, 432, { min: 120, max: 100000 }),
        height: normalizeHydriaChartMetric(chart.height, 284, { min: 100, max: 100000 }),
        showTitle: chart.showTitle !== false,
        showLegend: chart.showLegend !== false,
        legendPosition: normalizeHydriaChartLegendPosition(chart.legendPosition),
        showAxes: chart.showAxes !== false,
        showAxisValues: chart.showAxisValues !== false,
        showGridlines: chart.showGridlines !== false,
        showDataLabels: chart.showDataLabels !== false,
        showDataTable: chart.showDataTable === true,
        axisMode: normalizeHydriaChartAxisMode(chart.axisMode || chart.axisScaleMode),
        axisTickDensity: normalizeHydriaChartAxisDensity(chart.axisTickDensity || chart.axisDensity),
        axisMin: normalizeHydriaOptionalChartNumber(chart.axisMin),
        axisMax: normalizeHydriaOptionalChartNumber(chart.axisMax),
        axisMajorUnit: normalizeHydriaOptionalChartNumber(chart.axisMajorUnit),
        points: Array.isArray(chart.points)
          ? chart.points.map((point, pointIndex) => normalizeHydriaChartPoint(point, pointIndex)).filter(Boolean)
          : []
      };
    })
    .filter((chart) => chart.points.length);
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
      charts: [],
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
          charts: [],
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
    charts: normalizeHydriaCharts(sheet.charts),
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
    const formula = normalizeHydriaFormulaForXlsx(text.slice(1), sheet, tables);
    worksheet[address] = isHydriaFormulaSafeForXlsx(formula)
      ? {
          t: "n",
          f: formula,
          v: 0
        }
      : {
          t: "s",
          v: text
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

function getHydriaExportCellText(sheet = {}, tables = [], rowIndex = 0, columnIndex = 0, value = "") {
  const headerTable = normalizeHydriaTables(tables).find((table) => {
    if (table.showHeaderRow === false) {
      return false;
    }
    const bounds = normalizeHydriaStructureBounds(table);
    return (
      rowIndex === bounds.startRowIndex &&
      columnIndex >= bounds.startColumnIndex &&
      columnIndex <= bounds.endColumnIndex
    );
  });
  if (!headerTable) {
    return value;
  }
  const bounds = normalizeHydriaStructureBounds(headerTable);
  const headerNames = uniqueXlsxTableColumnNames(getHydriaTableHeaderNames(sheet, headerTable));
  return headerNames[columnIndex - bounds.startColumnIndex] || `Column ${columnIndex - bounds.startColumnIndex + 1}`;
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

function normalizeXlsxFormulaFunctionName(name = "") {
  const unprefixed = String(name || "")
    .trim()
    .replace(/^_xlfn\._xlws\./i, "")
    .replace(/^_xlfn\./i, "");
  const canonical = XLSX_FORMULA_NAME_ALIASES[unprefixed.toUpperCase()] || unprefixed.toUpperCase();
  return XLSX_FUTURE_FORMULA_PREFIXES[canonical] || canonical;
}

function formulaUsesLocalizedSyntax(formula = "") {
  const outside = formulaOutsideQuotes(formula);
  return /;/.test(outside) || Object.keys(XLSX_FORMULA_NAME_ALIASES).some((name) =>
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "i").test(outside)
  );
}

function stripImplicitIntersectionBeforeFunctions(segment = "") {
  return String(segment || "").replace(
    /@\s*(?=(?:_xlfn(?:\._xlws)?\.)?[A-Za-z_\u00c0-\u017f][A-Za-z0-9_.\u00c0-\u017f]*\s*\()/gi,
    ""
  );
}

function localizeXlsxTextDateFormatForFrenchExcel(format = "") {
  return String(format || "")
    .replace(/yyyy/gi, "aaaa")
    .replace(/yy/gi, "aa")
    .replace(/dddd/gi, "jjjj")
    .replace(/ddd/gi, "jjj")
    .replace(/dd/gi, "jj")
    .replace(/d/gi, "j");
}

function normalizeXlsxTextDateFormatArguments(formula = "") {
  const source = String(formula || "");
  let output = "";
  let cursor = 0;
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes || !/^TEXT\s*\(/i.test(source.slice(index))) {
      continue;
    }
    const previous = source[index - 1] || "";
    if (/[A-Z0-9_.]/i.test(previous)) {
      continue;
    }
    const openIndex = source.indexOf("(", index);
    const closeIndex = findHydriaFormulaClosingParen(source, openIndex);
    if (openIndex < 0 || closeIndex < 0) {
      continue;
    }
    const args = splitHydriaFormulaArgs(source.slice(openIndex + 1, closeIndex));
    const formatArg = args[1] || "";
    if (/^"(?:[^"]|"")*"$/.test(formatArg) && /y{2,4}|d{1,4}/i.test(formatArg)) {
      const innerFormat = formatArg.slice(1, -1);
      args[1] = `"${localizeXlsxTextDateFormatForFrenchExcel(innerFormat)}"`;
      output += `${source.slice(cursor, openIndex + 1)}${args.join(",")})`;
      cursor = closeIndex + 1;
      index = closeIndex;
    }
  }

  return `${output}${source.slice(cursor)}`;
}

function normalizeHydriaFormulaForXlsx(formula = "", sheet = {}, tables = []) {
  const source = String(formula || "");
  const usesLocalizedSyntax = formulaUsesLocalizedSyntax(source);
  const normalized = replaceFormulaOutsideQuotes(source, (segment) =>
    stripImplicitIntersectionBeforeFunctions(segment)
      .replace(usesLocalizedSyntax ? /(\d),(\d)/g : /$^/, "$1.$2")
      .replace(/;/g, ",")
      .replace(
        /([A-Za-z_][A-Za-z0-9_.]*)\[([^\]]+)\]/g,
        (match, tableName, selector) =>
          hydriaStructuredReferenceToXlsxRange(sheet, tables, tableName, selector) || match
      )
      .replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_.]*)\s*(?=\()/g, (match, name) => {
        return normalizeXlsxFormulaFunctionName(name);
      })
  );
  return normalizeXlsxTextDateFormatArguments(normalized);
}

function isHydriaXlsxDynamicArrayFormula(formula = "") {
  return Boolean(getHydriaDynamicFormulaCall(formula));
}

function canonicalXlsxFormulaName(name = "") {
  return normalizeXlsxFormulaFunctionName(name)
    .replace(/^_xlfn\._xlws\./i, "")
    .replace(/^_xlfn\./i, "")
    .toUpperCase();
}

function formulaOutsideQuotes(formula = "") {
  let output = "";
  let inQuotes = false;
  const source = String(formula || "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      output += " ";
      continue;
    }
    output += inQuotes ? " " : char;
  }
  return output;
}

function hasBalancedFormulaParentheses(formula = "") {
  let depth = 0;
  for (const char of formulaOutsideQuotes(formula)) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

function findHydriaFormulaClosingParen(source = "", openIndex = 0) {
  let depth = 0;
  let inQuotes = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) {
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function hasUnsafeEmptyXlsxFormulaCall(formula = "") {
  const source = String(formula || "");
  const callPattern = /\b([A-Z][A-Z0-9_.]*)\s*\(/gi;
  let match;
  while ((match = callPattern.exec(source))) {
    const name = normalizeXlsxFormulaFunctionName(match[1]).replace(/^_xlfn\._xlws\./i, "").replace(/^_xlfn\./i, "");
    const openIndex = source.indexOf("(", match.index);
    const closeIndex = findHydriaFormulaClosingParen(source, openIndex);
    if (closeIndex < 0) {
      return true;
    }
    if (!source.slice(openIndex + 1, closeIndex).trim() && !XLSX_ZERO_ARGUMENT_FORMULAS.has(name.toUpperCase())) {
      return true;
    }
    callPattern.lastIndex = closeIndex + 1;
  }
  return false;
}

function isHydriaFormulaSafeForXlsx(formula = "") {
  const text = String(formula || "").trim();
  if (!text || /[\u0000-\u001f]/.test(text)) {
    return false;
  }
  if (!hasBalancedFormulaParentheses(text)) {
    return false;
  }
  const outside = formulaOutsideQuotes(text);
  if (/[A-Za-z_][A-Za-z0-9_.]*\[[^\]]+\]/.test(outside)) {
    return false;
  }
  if (/\)\s*(?:\$?[A-Z]{1,3}\$?\d+|[A-Z_][A-Z0-9_.]*|\d|\")/i.test(outside)) {
    return false;
  }
  if (hasUnsafeEmptyXlsxFormulaCall(text)) {
    return false;
  }
  return true;
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
        const exportValue = getHydriaExportCellText(sheet, normalizedTables, rowIndex, columnIndex, value);
        writeHydriaCellValue(
          worksheet,
          address,
          exportValue,
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
  const style = BORDER_STYLES.has(border.style) ? border.style : "medium";
  const edgeXml = (edge) =>
    border[edge] ? `<${edge} style="${style}"><color rgb="${color}"/></${edge}>` : `<${edge}/>`;
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

function addAttributeToXmlOpenTag(openTag = "", name = "", value = "") {
  if (!openTag || !name) {
    return openTag;
  }
  const escapedValue = escapeXmlAttribute(value);
  const attributePattern = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (attributePattern.test(openTag)) {
    return openTag.replace(attributePattern, ` ${name}="${escapedValue}"`);
  }
  return openTag.replace(/\/?>$/, (end) => ` ${name}="${escapedValue}"${end}`);
}

function splitHydriaFormulaArgs(value = "") {
  const args = [];
  const source = String(value || "");
  let current = "";
  let depth = 0;
  let inQuotes = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += `${char}${next}`;
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (inQuotes) {
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if ((char === "," || char === ";") && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  args.push(current.trim());
  return args;
}

function getHydriaDynamicFormulaCall(formula = "") {
  const source = decodeXmlAttribute(formula).trim();
  const match = /^((?:_xlfn\._xlws\.|_xlfn\.)?[A-Z][A-Z0-9_.]*)\s*\(/i.exec(source);
  if (!match) {
    return null;
  }
  const name = canonicalXlsxFormulaName(match[1]);
  if (!XLSX_DYNAMIC_ARRAY_FORMULA_NAMES.has(name)) {
    return null;
  }
  const openIndex = source.indexOf("(", match.index);
  const closeIndex = findHydriaFormulaClosingParen(source, openIndex);
  if (openIndex < 0 || closeIndex < 0) {
    return null;
  }
  return {
    name,
    args: splitHydriaFormulaArgs(source.slice(openIndex + 1, closeIndex))
  };
}

function hydriaFormulaRangeBounds(reference = "") {
  let text = decodeXmlAttribute(reference)
    .trim()
    .replace(/^=/, "");
  const bangIndex = text.lastIndexOf("!");
  if (bangIndex >= 0) {
    text = text.slice(bangIndex + 1);
  }
  text = text
    .replace(/^'|'$/g, "")
    .replace(/\$/g, "")
    .trim();
  if (!/^[A-Z]{1,3}\d+(?::[A-Z]{1,3}\d+)?$/i.test(text)) {
    return null;
  }
  const rangeText = text.includes(":") ? text : `${text}:${text}`;
  try {
    const range = XLSX.utils.decode_range(rangeText);
    return {
      startRowIndex: Math.min(range.s.r, range.e.r),
      endRowIndex: Math.max(range.s.r, range.e.r),
      startColumnIndex: Math.min(range.s.c, range.e.c),
      endColumnIndex: Math.max(range.s.c, range.e.c)
    };
  } catch {
    return null;
  }
}

function hydriaFormulaRangeShape(bounds = null) {
  if (!bounds) {
    return { rows: 1, columns: 1 };
  }
  return {
    rows: Math.max(1, bounds.endRowIndex - bounds.startRowIndex + 1),
    columns: Math.max(1, bounds.endColumnIndex - bounds.startColumnIndex + 1)
  };
}

function hydriaFormulaRangeMatrix(sheet = {}, bounds = null) {
  if (!bounds) {
    return [];
  }
  return Array.from({ length: bounds.endRowIndex - bounds.startRowIndex + 1 }, (_, rowOffset) =>
    Array.from({ length: bounds.endColumnIndex - bounds.startColumnIndex + 1 }, (_, columnOffset) =>
      getHydriaGridCellText(sheet, bounds.startRowIndex + rowOffset, bounds.startColumnIndex + columnOffset)
    )
  );
}

function hydriaFormulaComparableValue(value = "") {
  const text = String(value ?? "").trim();
  if (/^".*"$/.test(text)) {
    return text.slice(1, -1).replace(/""/g, "\"");
  }
  const normalizedNumber = text
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-]/g, "")
    .replace(/,(?=\d{1,}$)/, ".");
  const numeric = Number(normalizedNumber);
  return normalizedNumber && Number.isFinite(numeric) ? numeric : text;
}

function hydriaFormulaCompare(leftValue = "", operator = "=", rightValue = "") {
  const left = hydriaFormulaComparableValue(leftValue);
  const right = hydriaFormulaComparableValue(rightValue);
  const bothNumeric = typeof left === "number" && typeof right === "number";
  const compare = bothNumeric
    ? left - right
    : String(left ?? "").localeCompare(String(right ?? ""), "en", { numeric: true, sensitivity: "base" });
  switch (operator) {
    case ">":
      return compare > 0;
    case ">=":
      return compare >= 0;
    case "<":
      return compare < 0;
    case "<=":
      return compare <= 0;
    case "<>":
      return compare !== 0;
    case "=":
    default:
      return compare === 0;
  }
}

function inferHydriaFilterMask(sheet = {}, includeArg = "", expectedRows = 1) {
  const source = decodeXmlAttribute(includeArg).trim();
  const conditionMatch = /^(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)\s*(<=|>=|<>|=|<|>)\s*(.+)$/i.exec(source);
  if (conditionMatch) {
    const [, rangeRef, operator, rawRight] = conditionMatch;
    const bounds = hydriaFormulaRangeBounds(rangeRef);
    const matrix = hydriaFormulaRangeMatrix(sheet, bounds);
    const values = matrix.flat();
    if (values.length && values.length === expectedRows) {
      const rightBounds = hydriaFormulaRangeBounds(rawRight);
      const rightValue = rightBounds
        ? hydriaFormulaRangeMatrix(sheet, rightBounds).flat()[0]
        : rawRight;
      return values.map((value) => hydriaFormulaCompare(value, operator, rightValue));
    }
  }

  const bounds = hydriaFormulaRangeBounds(source);
  const values = hydriaFormulaRangeMatrix(sheet, bounds).flat();
  if (values.length && values.length === expectedRows) {
    return values.map((value) => Boolean(String(value ?? "").trim()) && String(value).trim() !== "0");
  }
  return null;
}

function inferHydriaDynamicFormulaSpillShape(formula = "", sheet = {}) {
  const call = getHydriaDynamicFormulaCall(formula);
  if (!call?.args?.length) {
    return null;
  }
  const sourceBounds = hydriaFormulaRangeBounds(call.args[0]);
  const sourceShape = hydriaFormulaRangeShape(sourceBounds);
  switch (call.name) {
    case "UNIQUE": {
      const matrix = hydriaFormulaRangeMatrix(sheet, sourceBounds);
      const seen = new Set();
      const uniqueRows = matrix.filter((row) => {
        const key = row.map((entry) => String(entry ?? "").toLowerCase()).join("\u001f");
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return {
        rows: Math.max(1, uniqueRows.length || sourceShape.rows),
        columns: sourceShape.columns
      };
    }
    case "FILTER": {
      const mask = inferHydriaFilterMask(sheet, call.args[1], sourceShape.rows);
      const matchCount = mask ? mask.filter(Boolean).length : sourceShape.rows;
      if (!matchCount && call.args[2] !== undefined) {
        return { rows: 1, columns: 1 };
      }
      return {
        rows: Math.max(1, matchCount),
        columns: sourceShape.columns
      };
    }
    case "SORT":
    case "SORTBY":
      return sourceShape;
    default:
      return null;
  }
}

function hydriaSpillRangeForFormula(address = "", formula = "", sheet = {}) {
  const shape = inferHydriaDynamicFormulaSpillShape(formula, sheet);
  if (!shape) {
    return "";
  }
  try {
    const start = XLSX.utils.decode_cell(address);
    return XLSX.utils.encode_range({
      s: start,
      e: {
        r: start.r + Math.max(1, shape.rows) - 1,
        c: start.c + Math.max(1, shape.columns) - 1
      }
    });
  } catch {
    return "";
  }
}

function hydriaSpillRangeIsBlocked(sheet = {}, anchorAddress = "", spillRange = "") {
  const bounds = hydriaFormulaRangeBounds(spillRange);
  if (!bounds) {
    return false;
  }
  let anchor;
  try {
    anchor = XLSX.utils.decode_cell(anchorAddress);
  } catch {
    anchor = null;
  }
  for (let rowIndex = bounds.startRowIndex; rowIndex <= bounds.endRowIndex; rowIndex += 1) {
    for (let columnIndex = bounds.startColumnIndex; columnIndex <= bounds.endColumnIndex; columnIndex += 1) {
      if (anchor && rowIndex === anchor.r && columnIndex === anchor.c) {
        continue;
      }
      if (String(getHydriaGridCellText(sheet, rowIndex, columnIndex) || "").trim()) {
        return true;
      }
    }
  }
  return false;
}

function markHydriaDynamicFormulaCells(sheetXml = "", sheet = {}) {
  let changed = false;
  const nextXml = String(sheetXml || "").replace(/<c\b[^>]*\br="([^"]+)"[^>]*>[\s\S]*?<\/c>/gi, (cellXml, address) => {
    const formulaMatch = cellXml.match(/<f\b[^>]*>[\s\S]*?<\/f>/i);
    if (!formulaMatch) {
      return cellXml;
    }
    const formulaTextMatch = formulaMatch[0].match(/<f\b[^>]*>([\s\S]*?)<\/f>/i);
    const formulaText = formulaTextMatch?.[1] || "";
    if (!isHydriaXlsxDynamicArrayFormula(formulaText)) {
      return cellXml;
    }
    changed = true;
    const cellOpen = cellXml.match(/^<c\b[^>]*>/i)?.[0] || "";
    const formulaOpen = formulaMatch[0].match(/^<f\b[^>]*>/i)?.[0] || "";
    const spillRange = hydriaSpillRangeForFormula(address, formulaText, sheet);
    const canWriteSpillRef = Boolean(spillRange && !hydriaSpillRangeIsBlocked(sheet, address, spillRange));
    let nextCellXml = cellXml.replace(cellOpen, addAttributeToXmlOpenTag(cellOpen, "cm", "1"));
    if (canWriteSpillRef) {
      nextCellXml = nextCellXml.replace(
        formulaOpen,
        addAttributeToXmlOpenTag(addAttributeToXmlOpenTag(formulaOpen, "t", "array"), "ref", spillRange)
      );
    }
    return nextCellXml;
  });
  return { xml: nextXml, changed };
}

function buildHydriaDynamicArrayMetadataXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">',
    '<metadataTypes count="1">',
    '<metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/>',
    "</metadataTypes>",
    '<futureMetadata name="XLDAPR" count="1">',
    '<bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}">',
    '<xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/>',
    "</ext></extLst></bk>",
    "</futureMetadata>",
    '<cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata>',
    "</metadata>"
  ].join("");
}

function ensureHydriaXlsxMetadataRelationship(zip) {
  const relPath = "xl/_rels/workbook.xml.rels";
  const relationshipsXml = readOrCreateXlsxRelationships(zip, relPath);
  if (relationshipsXml.includes(XLSX_METADATA_RELATIONSHIP_TYPE)) {
    return;
  }
  const { xml } = addRelationshipXml(relationshipsXml, {
    type: XLSX_METADATA_RELATIONSHIP_TYPE,
    target: "metadata.xml"
  });
  updateOrAddXlsxFile(zip, relPath, xml);
}

function applyHydriaDynamicFormulasToXlsxBuffer(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  let changed = false;
  zip.getEntries()
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.entryName))
    .forEach((entry) => {
      const sheetIndex = Math.max(0, Number(entry.entryName.match(/sheet(\d+)\.xml$/i)?.[1] || 1) - 1);
      const sheet = model.sheets?.[sheetIndex] || {};
      const sheetXml = entry.getData().toString("utf8");
      const marked = markHydriaDynamicFormulaCells(sheetXml, sheet);
      if (!marked.changed) {
        return;
      }
      zip.updateFile(entry.entryName, Buffer.from(marked.xml, "utf8"));
      changed = true;
    });

  if (!changed) {
    return buffer;
  }

  updateOrAddXlsxFile(zip, "xl/metadata.xml", buildHydriaDynamicArrayMetadataXml());
  appendXlsxContentTypeOverrides(zip, ["/xl/metadata.xml"], XLSX_METADATA_CONTENT_TYPE);
  ensureHydriaXlsxMetadataRelationship(zip);
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

function appendXlsxContentTypeOverrides(zip, partNames = [], contentType = XLSX_TABLE_CONTENT_TYPE) {
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
        `<Override PartName="${partName}" ContentType="${contentType}"/>`
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

function addRelationshipXml(relationshipsXml = XLSX_RELATIONSHIPS_XML, { type = "", target = "" } = {}) {
  const relationshipId = nextRelationshipId(relationshipsXml);
  const relationship = `<Relationship Id="${relationshipId}" Type="${escapeXmlAttribute(type)}" Target="${escapeXmlAttribute(target)}"/>`;
  return {
    relationshipId,
    xml: relationshipsXml.replace(/<\/Relationships>\s*$/i, `${relationship}</Relationships>`)
  };
}

function readOrCreateXlsxRelationships(zip, relPath = "") {
  const entry = zip.getEntry(relPath);
  return entry ? entry.getData().toString("utf8") : XLSX_RELATIONSHIPS_XML;
}

function updateOrAddXlsxFile(zip, path = "", xml = "") {
  const buffer = Buffer.from(xml, "utf8");
  if (zip.getEntry(path)) {
    zip.updateFile(path, buffer);
  } else {
    zip.addFile(path, buffer);
  }
}

function addWorksheetTableRelationships(zip, sheetIndex = 0, tablePartNames = []) {
  const relPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`;
  const existingEntry = zip.getEntry(relPath);
  let xml = existingEntry
    ? existingEntry.getData().toString("utf8")
    : XLSX_RELATIONSHIPS_XML;
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

function hydriaChartNumericValue(value = "") {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const normalized = text
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+\-eE]/g, "");
  if (!normalized || !/[0-9]/.test(normalized)) {
    return null;
  }
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function xlsxChartNumberText(value = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0";
  }
  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }
  return String(Math.abs(numericValue) < 1e12 ? Number(numericValue.toFixed(12)) : numericValue);
}

function stripHydriaChartSheetPrefix(range = "") {
  const text = String(range || "").trim();
  if (!text.includes("!")) {
    return text;
  }
  return text.slice(text.lastIndexOf("!") + 1);
}

function hydriaChartRangeBounds(range = "") {
  const cleanRange = stripHydriaChartSheetPrefix(range).replace(/\$/g, "");
  const [start, end = start] = cleanRange.split(":");
  try {
    const startCell = XLSX.utils.decode_cell(start);
    const endCell = XLSX.utils.decode_cell(end);
    return {
      minRow: Math.min(startCell.r, endCell.r),
      maxRow: Math.max(startCell.r, endCell.r),
      minColumn: Math.min(startCell.c, endCell.c),
      maxColumn: Math.max(startCell.c, endCell.c)
    };
  } catch {
    return null;
  }
}

function hydriaChartAbsoluteCellRef(rowIndex = 0, columnIndex = 0) {
  const row = Number(rowIndex);
  const column = Number(columnIndex);
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    return "";
  }
  return `$${XLSX.utils.encode_col(column)}$${row + 1}`;
}

function hydriaChartAbsoluteRangeRef(bounds = {}) {
  const start = hydriaChartAbsoluteCellRef(bounds.minRow, bounds.minColumn);
  const end = hydriaChartAbsoluteCellRef(bounds.maxRow, bounds.maxColumn);
  return start === end ? start : `${start}:${end}`;
}

function hydriaChartSheetRangeFormula(sheetName = "Sheet", bounds = null) {
  if (!bounds) {
    return "";
  }
  return `${quoteXlsxSheetName(sheetName)}!${hydriaChartAbsoluteRangeRef(bounds)}`;
}

function readHydriaSheetCell(sheet = {}, rowIndex = 0, columnIndex = 0) {
  return normalizeCellText(rowIndex === 0 ? sheet.columns?.[columnIndex] : sheet.rows?.[rowIndex - 1]?.[columnIndex]);
}

function hydriaChartColumnHasNumericData(sheet = {}, rowIndexes = [], columnIndex = 0) {
  return rowIndexes.some((rowIndex) => hydriaChartNumericValue(readHydriaSheetCell(sheet, rowIndex, columnIndex)) !== null);
}

function hydriaChartSelectionDescriptor(sheet = {}, bounds = null) {
  if (!bounds) {
    return null;
  }
  const width = bounds.maxColumn - bounds.minColumn + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  const hasHeaderRow = bounds.minRow === 0 && height >= 2;
  const startRowIndex = hasHeaderRow ? bounds.minRow + 1 : bounds.minRow;
  const dataRowIndexes = Array.from(
    { length: Math.max(0, bounds.maxRow - startRowIndex + 1) },
    (_, offset) => startRowIndex + offset
  );
  const columnIndexes = Array.from({ length: width }, (_, offset) => bounds.minColumn + offset);
  const numericColumns = columnIndexes.filter((columnIndex) =>
    hydriaChartColumnHasNumericData(sheet, dataRowIndexes, columnIndex)
  );
  const firstTextColumn = columnIndexes.find((columnIndex) =>
    dataRowIndexes.some((rowIndex) => {
      const raw = readHydriaSheetCell(sheet, rowIndex, columnIndex);
      return String(raw || "").trim() && hydriaChartNumericValue(raw) === null;
    })
  );
  const labelColumnIndex = firstTextColumn ?? (width >= 2 ? bounds.minColumn : null);
  const valueColumns = numericColumns.filter((columnIndex) => columnIndex !== labelColumnIndex);
  return {
    ...bounds,
    width,
    height,
    hasHeaderRow,
    startRowIndex,
    dataRowIndexes,
    columnIndexes,
    numericColumns,
    valueColumns,
    labelColumnIndex
  };
}

function hydriaChartSourceBounds(chart = {}, sheet = {}) {
  const table = chart.sourceTableId
    ? normalizeHydriaTables(sheet.tables).find((candidate) => candidate.id === chart.sourceTableId)
    : null;
  if (table) {
    const bounds = normalizeHydriaStructureBounds(table);
    return {
      minRow: bounds.startRowIndex,
      maxRow: bounds.endRowIndex,
      minColumn: bounds.startColumnIndex,
      maxColumn: bounds.endColumnIndex
    };
  }
  return hydriaChartRangeBounds(chart.range);
}

function hydriaChartDataRangeFormula(sheetName = "Sheet", minRow = 0, maxRow = 0, columnIndex = 0) {
  const column = Number(columnIndex);
  if (maxRow < minRow || !Number.isInteger(column) || column < 0) {
    return "";
  }
  return hydriaChartSheetRangeFormula(sheetName, {
    minRow,
    maxRow,
    minColumn: column,
    maxColumn: column
  });
}

function hydriaChartCellFormula(sheetName = "Sheet", rowIndex = 0, columnIndex = 0) {
  const row = Number(rowIndex);
  const column = Number(columnIndex);
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    return "";
  }
  return `${quoteXlsxSheetName(sheetName)}!${hydriaChartAbsoluteCellRef(row, column)}`;
}

function hydriaChartSeriesReferences(chart = {}, sheet = {}, sheetName = "Sheet") {
  const kind = String(chart.kind || "column").toLowerCase();
  if (["histogram", "box"].includes(kind)) {
    return {};
  }
  const descriptor = hydriaChartSelectionDescriptor(sheet, hydriaChartSourceBounds(chart, sheet));
  if (!descriptor || !descriptor.dataRowIndexes.length || descriptor.height === 1) {
    return {};
  }

  if (["scatter", "radar", "bubble"].includes(kind)) {
    const numericColumns = descriptor.numericColumns.length ? descriptor.numericColumns : descriptor.columnIndexes;
    const useRowIndexForXAxis = numericColumns.length <= 1;
    const xColumn = useRowIndexForXAxis ? null : (numericColumns[0] ?? descriptor.minColumn);
    let yColumn = useRowIndexForXAxis
      ? (numericColumns[0] ?? descriptor.minColumn)
      : (numericColumns[1] ?? descriptor.columnIndexes.find((columnIndex) => columnIndex !== xColumn) ?? xColumn);
    if (xColumn !== null && yColumn === xColumn && descriptor.columnIndexes.length > 1) {
      yColumn = descriptor.columnIndexes.find((columnIndex) => columnIndex !== xColumn) ?? yColumn;
    }
    const sizeColumn = kind === "bubble"
      ? numericColumns.find((columnIndex) => columnIndex !== xColumn && columnIndex !== yColumn) ?? null
      : null;
    return {
      primaryNameRef: descriptor.hasHeaderRow ? hydriaChartCellFormula(sheetName, descriptor.minRow, yColumn) : "",
      xValuesRef: xColumn === null ? "" : hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, xColumn),
      yValuesRef: hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, yColumn),
      bubbleSizesRef: sizeColumn === null ? "" : hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, sizeColumn)
    };
  }

  const primaryColumn =
    descriptor.valueColumns[0] ??
    descriptor.numericColumns[0] ??
    Math.min(descriptor.maxColumn, descriptor.minColumn + 1);
  const secondaryColumn = descriptor.valueColumns[1] ?? null;
  const labelColumn =
    descriptor.labelColumnIndex !== null &&
    descriptor.labelColumnIndex !== primaryColumn
      ? descriptor.labelColumnIndex
      : null;

  return {
    primaryNameRef: descriptor.hasHeaderRow ? hydriaChartCellFormula(sheetName, descriptor.minRow, primaryColumn) : "",
    secondaryNameRef:
      secondaryColumn !== null && descriptor.hasHeaderRow
        ? hydriaChartCellFormula(sheetName, descriptor.minRow, secondaryColumn)
        : "",
    categoriesRef:
      labelColumn !== null
        ? hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, labelColumn)
        : "",
    primaryValuesRef: hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, primaryColumn),
    secondaryValuesRef:
      secondaryColumn !== null
        ? hydriaChartDataRangeFormula(sheetName, descriptor.startRowIndex, descriptor.maxRow, secondaryColumn)
        : ""
  };
}

function hydriaChartSeries(chart = {}, sheet = {}, sheetName = "Sheet") {
  const points = (Array.isArray(chart.points) ? chart.points : [])
    .map((point, index) => {
      const primary = hydriaChartNumericValue(point.value);
      const secondary = hydriaChartNumericValue(point.secondaryValue);
      const yValue = hydriaChartNumericValue(point.yValue || point.value);
      const xValue = hydriaChartNumericValue(point.xValue) ?? index + 1;
      const sizeValue = hydriaChartNumericValue(point.sizeValue);
      return {
        label: String(point.label || `Point ${index + 1}`),
        primary,
        secondary,
        xValue,
        yValue,
        sizeValue
      };
    })
    .filter((point) => point.primary !== null || point.yValue !== null);
  const categories = points.map((point, index) => point.label || `Point ${index + 1}`);
  const primaryValues = points.map((point) => point.primary ?? point.yValue ?? 0);
  const secondaryValues = points.map((point) => point.secondary).filter((value) => value !== null);
  const hasSecondary = secondaryValues.length === points.length && points.length > 0;
  return {
    points,
    categories,
    primaryValues,
    secondaryValues: hasSecondary ? points.map((point) => point.secondary ?? 0) : [],
    xValues: points.map((point) => point.xValue ?? 0),
    yValues: points.map((point) => point.yValue ?? point.primary ?? 0),
    bubbleSizes: points.map((point) => point.sizeValue ?? 1),
    hasSecondary,
    references: hydriaChartSeriesReferences(chart, sheet, sheetName)
  };
}

function xlsxChartStringLiteral(values = []) {
  const points = values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXmlText(value)}</c:v></c:pt>`)
    .join("");
  return `<c:strLit><c:ptCount val="${values.length}"/>${points}</c:strLit>`;
}

function xlsxChartNumberLiteral(values = []) {
  const points = values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${xlsxChartNumberText(value)}</c:v></c:pt>`)
    .join("");
  return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numLit>`;
}

function xlsxChartStringCache(values = []) {
  const points = values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXmlText(value)}</c:v></c:pt>`)
    .join("");
  return `<c:strCache><c:ptCount val="${values.length}"/>${points}</c:strCache>`;
}

function xlsxChartNumberCache(values = []) {
  const points = values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${xlsxChartNumberText(value)}</c:v></c:pt>`)
    .join("");
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numCache>`;
}

function xlsxChartStringData(values = [], reference = "") {
  return reference
    ? `<c:strRef><c:f>${escapeXmlText(reference)}</c:f>${xlsxChartStringCache(values)}</c:strRef>`
    : xlsxChartStringLiteral(values);
}

function xlsxChartNumberData(values = [], reference = "") {
  return reference
    ? `<c:numRef><c:f>${escapeXmlText(reference)}</c:f>${xlsxChartNumberCache(values)}</c:numRef>`
    : xlsxChartNumberLiteral(values);
}

function xlsxChartSeriesNameXml(name = "Series", reference = "") {
  if (reference) {
    return `<c:tx><c:strRef><c:f>${escapeXmlText(reference)}</c:f>${xlsxChartStringCache([name || "Series"])}</c:strRef></c:tx>`;
  }
  return `<c:tx><c:v>${escapeXmlText(name || "Series")}</c:v></c:tx>`;
}

function xlsxChartTitleXml(title = "Chart") {
  return [
    "<c:title>",
    "<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang=\"en-US\" sz=\"1400\"/>",
    `<a:t>${escapeXmlText(title || "Chart")}</a:t>`,
    "</a:r></a:p></c:rich></c:tx>",
    "<c:layout/><c:overlay val=\"0\"/>",
    "</c:title>"
  ].join("");
}

function xlsxChartSeriesXml({
  index = 0,
  name = "Series",
  nameRef = "",
  categories = [],
  categoriesRef = "",
  values = [],
  valuesRef = "",
  chartType = "bar",
  xValues = [],
  xValuesRef = "",
  yValues = [],
  yValuesRef = "",
  bubbleSizes = [],
  bubbleSizesRef = "",
  markers = false
} = {}) {
  const base = [`<c:idx val="${index}"/>`, `<c:order val="${index}"/>`, xlsxChartSeriesNameXml(name || `Series ${index + 1}`, nameRef)];
  if (chartType === "scatter") {
    return [
      "<c:ser>",
      ...base,
      `<c:marker><c:symbol val="${markers ? "circle" : "auto"}"/></c:marker>`,
      `<c:xVal>${xlsxChartNumberData(xValues, xValuesRef)}</c:xVal>`,
      `<c:yVal>${xlsxChartNumberData(yValues, yValuesRef)}</c:yVal>`,
      "</c:ser>"
    ].join("");
  }
  if (chartType === "bubble") {
    return [
      "<c:ser>",
      ...base,
      "<c:invertIfNegative val=\"0\"/>",
      `<c:xVal>${xlsxChartNumberData(xValues, xValuesRef)}</c:xVal>`,
      `<c:yVal>${xlsxChartNumberData(yValues, yValuesRef)}</c:yVal>`,
      `<c:bubbleSize>${xlsxChartNumberData(bubbleSizes, bubbleSizesRef)}</c:bubbleSize>`,
      "</c:ser>"
    ].join("");
  }
  return [
    "<c:ser>",
    ...base,
    chartType === "line" ? `<c:marker><c:symbol val="${markers ? "circle" : "none"}"/></c:marker>` : "",
    `<c:cat>${xlsxChartStringData(categories, categoriesRef)}</c:cat>`,
    `<c:val>${xlsxChartNumberData(values, valuesRef)}</c:val>`,
    chartType === "line" ? "<c:smooth val=\"0\"/>" : "",
    "</c:ser>"
  ].join("");
}

function xlsxChartAxesXml({ catAxId = 50010001, valAxId = 50010002, horizontal = false, scatter = false, visible = true } = {}) {
  const deleteValue = visible ? 0 : 1;
  if (scatter) {
    return [
      `<c:valAx><c:axId val="${catAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${deleteValue}"/><c:axPos val="b"/>${visible ? "<c:majorGridlines/>" : ""}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valAxId}"/><c:crosses val="autoZero"/></c:valAx>`,
      `<c:valAx><c:axId val="${valAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${deleteValue}"/><c:axPos val="l"/>${visible ? "<c:majorGridlines/>" : ""}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${catAxId}"/><c:crosses val="autoZero"/></c:valAx>`
    ].join("");
  }
  const catAxisPosition = horizontal ? "l" : "b";
  const valueAxisPosition = horizontal ? "b" : "l";
  return [
    `<c:catAx><c:axId val="${catAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${deleteValue}"/><c:axPos val="${catAxisPosition}"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valAxId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`,
    `<c:valAx><c:axId val="${valAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${deleteValue}"/><c:axPos val="${valueAxisPosition}"/>${visible ? "<c:majorGridlines/>" : ""}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${catAxId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
  ].join("");
}

function hydriaChartGrouping(kind = "") {
  if (String(kind).includes("percent")) {
    return "percentStacked";
  }
  if (String(kind).includes("stacked")) {
    return "stacked";
  }
  return "clustered";
}

function hydriaChartPlotAreaXml(chart = {}, chartIndex = 1, sheet = {}, sheetName = "Sheet") {
  const series = hydriaChartSeries(chart, sheet, sheetName);
  if (!series.points.length) {
    return "";
  }
  const kind = String(chart.kind || "column");
  const showAxes = chart.showAxes !== false;
  const catAxId = 50010000 + chartIndex * 2 + 1;
  const valAxId = 50010000 + chartIndex * 2 + 2;
  const primaryName = chart.seriesName || String(chart.title || "").split(/\s+by\s+/i)[0] || "Series 1";
  const secondaryName = chart.secondarySeriesName || "Series 2";
  const refs = series.references || {};
  const standardSeries = [
    xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      categories: series.categories,
      categoriesRef: refs.categoriesRef,
      values: series.primaryValues,
      valuesRef: refs.primaryValuesRef,
      chartType: "line",
      markers: kind === "line-markers"
    }),
    ...(series.hasSecondary
      ? [
          xlsxChartSeriesXml({
            index: 1,
            name: secondaryName,
            nameRef: refs.secondaryNameRef,
            categories: series.categories,
            categoriesRef: refs.categoriesRef,
            values: series.secondaryValues,
            valuesRef: refs.secondaryValuesRef,
            chartType: "line",
            markers: kind === "line-markers"
          })
        ]
      : [])
  ];

  if (["pie", "sunburst", "treemap", "funnel"].includes(kind)) {
    return `<c:layout/><c:pieChart><c:varyColors val="1"/>${xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      categories: series.categories,
      categoriesRef: refs.categoriesRef,
      values: series.primaryValues,
      valuesRef: refs.primaryValuesRef,
      chartType: "pie"
    })}<c:firstSliceAng val="0"/></c:pieChart>`;
  }

  if (kind === "donut") {
    return `<c:layout/><c:doughnutChart><c:varyColors val="1"/>${xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      categories: series.categories,
      categoriesRef: refs.categoriesRef,
      values: series.primaryValues,
      valuesRef: refs.primaryValuesRef,
      chartType: "pie"
    })}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  }

  if (["scatter", "radar"].includes(kind)) {
    const scatterSeries = xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      chartType: "scatter",
      xValues: series.xValues,
      xValuesRef: refs.xValuesRef,
      yValues: series.yValues,
      yValuesRef: refs.yValuesRef,
      markers: true
    });
    return `<c:layout/><c:scatterChart><c:scatterStyle val="marker"/><c:varyColors val="0"/>${scatterSeries}<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:scatterChart>${xlsxChartAxesXml({ catAxId, valAxId, scatter: true, visible: showAxes })}`;
  }

  if (kind === "bubble") {
    const bubbleSeries = xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      chartType: "bubble",
      xValues: series.xValues,
      xValuesRef: refs.xValuesRef,
      yValues: series.yValues,
      yValuesRef: refs.yValuesRef,
      bubbleSizes: series.bubbleSizes,
      bubbleSizesRef: refs.bubbleSizesRef
    });
    return `<c:layout/><c:bubbleChart><c:varyColors val="0"/>${bubbleSeries}<c:bubbleScale val="100"/><c:showNegBubbles val="0"/><c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:bubbleChart>${xlsxChartAxesXml({ catAxId, valAxId, scatter: true, visible: showAxes })}`;
  }

  if (["line", "line-markers"].includes(kind)) {
    return `<c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${standardSeries.join("")}<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:lineChart>${xlsxChartAxesXml({ catAxId, valAxId, visible: showAxes })}`;
  }

  if (["area", "stacked-area"].includes(kind)) {
    const areaSeries = [
      xlsxChartSeriesXml({
        index: 0,
        name: primaryName,
        nameRef: refs.primaryNameRef,
        categories: series.categories,
        categoriesRef: refs.categoriesRef,
        values: series.primaryValues,
        valuesRef: refs.primaryValuesRef,
        chartType: "area"
      }),
      ...(series.hasSecondary
        ? [
            xlsxChartSeriesXml({
              index: 1,
              name: secondaryName,
              nameRef: refs.secondaryNameRef,
              categories: series.categories,
              categoriesRef: refs.categoriesRef,
              values: series.secondaryValues,
              valuesRef: refs.secondaryValuesRef,
              chartType: "area"
            })
          ]
        : [])
    ].join("");
    const grouping = kind === "stacked-area" ? "stacked" : "standard";
    return `<c:layout/><c:areaChart><c:grouping val="${grouping}"/><c:varyColors val="0"/>${areaSeries}<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:areaChart>${xlsxChartAxesXml({ catAxId, valAxId, visible: showAxes })}`;
  }

  const horizontal = ["bar", "stacked-bar", "percent-bar"].includes(kind);
  const grouping = hydriaChartGrouping(kind);
  const barSeries = [
    xlsxChartSeriesXml({
      index: 0,
      name: primaryName,
      nameRef: refs.primaryNameRef,
      categories: series.categories,
      categoriesRef: refs.categoriesRef,
      values: series.primaryValues,
      valuesRef: refs.primaryValuesRef,
      chartType: "bar"
    }),
    ...(series.hasSecondary
      ? [
          xlsxChartSeriesXml({
            index: 1,
            name: secondaryName,
            nameRef: refs.secondaryNameRef,
            categories: series.categories,
            categoriesRef: refs.categoriesRef,
            values: series.secondaryValues,
            valuesRef: refs.secondaryValuesRef,
            chartType: "bar"
          })
        ]
      : [])
  ].join("");
  const overlap = grouping === "clustered" ? "" : "<c:overlap val=\"100\"/>";
  return `<c:layout/><c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${grouping}"/><c:varyColors val="${series.hasSecondary ? 0 : 1}"/>${barSeries}<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>${overlap}<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:barChart>${xlsxChartAxesXml({ catAxId, valAxId, horizontal, visible: showAxes })}`;
}

function buildHydriaChartXml(chart = {}, chartIndex = 1, sheet = {}, sheetName = "Sheet") {
  const plotArea = hydriaChartPlotAreaXml(chart, chartIndex, sheet, sheetName);
  if (!plotArea) {
    return "";
  }
  const legend = chart.showLegend === false
    ? ""
    : "<c:legend><c:legendPos val=\"b\"/><c:layout/><c:overlay val=\"0\"/></c:legend>";
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<c:date1904 val="0"/><c:lang val="en-US"/><c:roundedCorners val="0"/>',
    "<c:chart>",
    xlsxChartTitleXml(chart.title || `Chart ${chartIndex}`),
    "<c:autoTitleDeleted val=\"0\"/>",
    `<c:plotArea>${plotArea}</c:plotArea>`,
    legend,
    "<c:plotVisOnly val=\"1\"/><c:dispBlanksAs val=\"gap\"/><c:showDLblsOverMax val=\"0\"/>",
    "</c:chart>",
    '<c:printSettings><c:headerFooter/><c:pageMargins l="0.7" r="0.7" t="0.75" b="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>',
    "</c:chartSpace>"
  ].join("");
}

function hydriaSheetDimensionPixels(sheet = {}, kind = "column", index = 0) {
  const dimensions = kind === "row" ? sheet.rowHeights : sheet.columnWidths;
  const fallback = kind === "row" ? HYDRIA_DEFAULT_ROW_HEIGHT : HYDRIA_DEFAULT_COLUMN_WIDTH;
  const numericValue = Number(dimensions?.[String(index)]);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function hydriaChartPixelToCellAnchor(offset = 0, sheet = {}, kind = "column") {
  let remaining = Math.max(0, Number(offset) || 0);
  let index = 0;
  while (remaining >= hydriaSheetDimensionPixels(sheet, kind, index) && index < 16384) {
    remaining -= hydriaSheetDimensionPixels(sheet, kind, index);
    index += 1;
  }
  return {
    index,
    offset: Math.max(0, Math.round(remaining * XLSX_EMUS_PER_PIXEL))
  };
}

function normalizeHydriaChartAnchor(chart = {}, sheet = {}) {
  const left = Math.max(0, Number(chart.x) - HYDRIA_ROW_HEADER_WIDTH);
  const top = Math.max(0, Number(chart.y) - HYDRIA_COLUMN_HEADER_HEIGHT);
  const right = left + Math.max(120, Number(chart.width) || 432);
  const bottom = top + Math.max(100, Number(chart.height) || 284);
  const fromColumn = hydriaChartPixelToCellAnchor(left, sheet, "column");
  const fromRow = hydriaChartPixelToCellAnchor(top, sheet, "row");
  const toColumn = hydriaChartPixelToCellAnchor(right, sheet, "column");
  const toRow = hydriaChartPixelToCellAnchor(bottom, sheet, "row");
  if (toColumn.index === fromColumn.index && toColumn.offset <= fromColumn.offset) {
    toColumn.index += 1;
    toColumn.offset = 0;
  }
  if (toRow.index === fromRow.index && toRow.offset <= fromRow.offset) {
    toRow.index += 1;
    toRow.offset = 0;
  }
  return { fromColumn, fromRow, toColumn, toRow };
}

function buildHydriaDrawingXml(chartEntries = [], sheet = {}) {
  const anchors = chartEntries
    .map(({ chart, relationshipId, objectId }) => {
      const anchor = normalizeHydriaChartAnchor(chart, sheet);
      return [
        '<xdr:twoCellAnchor editAs="oneCell">',
        "<xdr:from>",
        `<xdr:col>${anchor.fromColumn.index}</xdr:col><xdr:colOff>${anchor.fromColumn.offset}</xdr:colOff>`,
        `<xdr:row>${anchor.fromRow.index}</xdr:row><xdr:rowOff>${anchor.fromRow.offset}</xdr:rowOff>`,
        "</xdr:from>",
        "<xdr:to>",
        `<xdr:col>${anchor.toColumn.index}</xdr:col><xdr:colOff>${anchor.toColumn.offset}</xdr:colOff>`,
        `<xdr:row>${anchor.toRow.index}</xdr:row><xdr:rowOff>${anchor.toRow.offset}</xdr:rowOff>`,
        "</xdr:to>",
        '<xdr:graphicFrame macro="">',
        "<xdr:nvGraphicFramePr>",
        `<xdr:cNvPr id="${objectId}" name="Chart ${objectId}"/>`,
        "<xdr:cNvGraphicFramePr/>",
        "</xdr:nvGraphicFramePr>",
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>',
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">',
        `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relationshipId}"/>`,
        "</a:graphicData></a:graphic>",
        "</xdr:graphicFrame>",
        "<xdr:clientData/>",
        "</xdr:twoCellAnchor>"
      ].join("");
    })
    .join("");
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    anchors,
    "</xdr:wsDr>"
  ].join("");
}

function insertWorksheetDrawing(sheetXml = "", relationshipId = "") {
  if (!relationshipId) {
    return sheetXml;
  }
  let xml = sheetXml.replace(/<drawing\b[\s\S]*?<\/drawing>/i, "").replace(/<drawing\b[^>]*\/>/i, "");
  if (!/xmlns:r=/.test(xml)) {
    xml = xml.replace(/<worksheet\b/i, '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }
  const drawingXml = `<drawing r:id="${relationshipId}"/>`;
  const insertBefore = /<(legacyDrawing|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/i.exec(xml);
  if (insertBefore) {
    return `${xml.slice(0, insertBefore.index)}${drawingXml}${xml.slice(insertBefore.index)}`;
  }
  return xml.replace(/<\/worksheet>\s*$/i, `${drawingXml}</worksheet>`);
}

function addWorksheetDrawingRelationship(zip, sheetIndex = 0, drawingPartName = "") {
  const relPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`;
  const { relationshipId, xml } = addRelationshipXml(readOrCreateXlsxRelationships(zip, relPath), {
    type: XLSX_DRAWING_RELATIONSHIP_TYPE,
    target: `../drawings/${drawingPartName.split("/").pop()}`
  });
  updateOrAddXlsxFile(zip, relPath, xml);
  return relationshipId;
}

function applyHydriaChartsToXlsxBuffer(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  const chartPartNames = [];
  const drawingPartNames = [];
  let nextChartId = 1;
  let nextDrawingId = 1;
  let changed = false;
  const usedSheetNames = new Set();
  const exportedSheetNames = (Array.isArray(model.sheets) ? model.sheets : []).map((sheet) =>
    uniqueSheetName(sheet.name, usedSheetNames)
  );

  (Array.isArray(model.sheets) ? model.sheets : []).forEach((sheet, sheetIndex) => {
    const charts = normalizeHydriaCharts(sheet.charts);
    if (!charts.length) {
      return;
    }
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }

    let drawingRelationshipsXml = XLSX_RELATIONSHIPS_XML;
    const chartEntries = [];
    charts.forEach((chart) => {
      const chartXml = buildHydriaChartXml(chart, nextChartId, sheet, exportedSheetNames[sheetIndex] || sheet.name || `Sheet ${sheetIndex + 1}`);
      if (!chartXml) {
        return;
      }
      const chartPartName = `/xl/charts/chart${nextChartId}.xml`;
      const { relationshipId, xml } = addRelationshipXml(drawingRelationshipsXml, {
        type: XLSX_CHART_RELATIONSHIP_TYPE,
        target: `../charts/chart${nextChartId}.xml`
      });
      drawingRelationshipsXml = xml;
      zip.addFile(`xl/charts/chart${nextChartId}.xml`, Buffer.from(chartXml, "utf8"));
      chartPartNames.push(chartPartName);
      chartEntries.push({ chart, relationshipId, objectId: nextChartId });
      nextChartId += 1;
    });
    if (!chartEntries.length) {
      return;
    }

    const drawingId = nextDrawingId;
    nextDrawingId += 1;
    const drawingPartName = `/xl/drawings/drawing${drawingId}.xml`;
    zip.addFile(`xl/drawings/drawing${drawingId}.xml`, Buffer.from(buildHydriaDrawingXml(chartEntries, sheet), "utf8"));
    zip.addFile(`xl/drawings/_rels/drawing${drawingId}.xml.rels`, Buffer.from(drawingRelationshipsXml, "utf8"));
    drawingPartNames.push(drawingPartName);

    const worksheetRelationshipId = addWorksheetDrawingRelationship(zip, sheetIndex, drawingPartName);
    const sheetXml = sheetEntry.getData().toString("utf8");
    zip.updateFile(sheetPath, Buffer.from(insertWorksheetDrawing(sheetXml, worksheetRelationshipId), "utf8"));
    changed = true;
  });

  appendXlsxContentTypeOverrides(zip, drawingPartNames, XLSX_DRAWING_CONTENT_TYPE);
  appendXlsxContentTypeOverrides(zip, chartPartNames, XLSX_CHART_CONTENT_TYPE);
  return changed ? zip.toBuffer() : buffer;
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

function normalizeXlsxPartPath(value = "") {
  const parts = [];
  String(value || "")
    .replace(/^\/+/, "")
    .split("/")
    .forEach((part) => {
      if (!part || part === ".") {
        return;
      }
      if (part === "..") {
        parts.pop();
        return;
      }
      parts.push(part);
    });
  return parts.join("/");
}

function resolveXlsxRelationshipTarget(sourcePartPath = "", target = "") {
  const text = String(target || "").trim();
  if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text)) {
    return "";
  }
  if (text.startsWith("/")) {
    return normalizeXlsxPartPath(text);
  }
  const sourceDirectory = String(sourcePartPath || "").split("/").slice(0, -1).join("/");
  return normalizeXlsxPartPath(`${sourceDirectory}/${text}`);
}

function getXlsxRelationshipsForType(zip, sourcePartPath = "", relationshipType = "") {
  const parts = String(sourcePartPath || "").split("/");
  const fileName = parts.pop();
  const directory = parts.join("/");
  const relPath = `${directory}/_rels/${fileName}.rels`;
  const entry = zip.getEntry(relPath);
  if (!entry) {
    return [];
  }
  const xml = entry.getData().toString("utf8");
  return Array.from(xml.matchAll(/<Relationship\b([^>]*)\/?>/gi), (match) => parseXmlAttributes(match[1]))
    .filter((relationship) => relationship.Type === relationshipType && relationship.TargetMode !== "External")
    .map((relationship) => ({
      ...relationship,
      partPath: resolveXlsxRelationshipTarget(sourcePartPath, relationship.Target)
    }))
    .filter((relationship) => relationship.partPath);
}

function hydriaTableStyleFromXlsxName(styleName = "") {
  const text = String(styleName || "");
  if (/Medium4|Light13|Light14|Light15/i.test(text)) {
    return "green";
  }
  if (/Medium3|Medium9|Light10|Light11/i.test(text)) {
    return "orange";
  }
  if (/Medium5|Light18|Light19|Light20/i.test(text)) {
    return "purple";
  }
  if (/Medium7|Light1|Light2|Light3/i.test(text)) {
    return "gray";
  }
  return "blue";
}

function hydriaTableTotalFunctionFromXlsx(value = "") {
  const text = String(value || "").toLowerCase();
  return TABLE_TOTAL_FUNCTIONS.has(text) && text !== "none" ? text : "";
}

function xlsxTableXmlToHydriaTable(tableXml = "", originRange = null, tableIndex = 0) {
  const tableMatch = /<table\b([^>]*)>/i.exec(tableXml);
  const tableAttributes = parseXmlAttributes(tableMatch?.[1] || "");
  const bounds = rangeToHydriaStructureBounds(tableAttributes.ref || "", originRange);
  if (!bounds) {
    return null;
  }

  const columnAttributes = extractXmlCollectionItems(tableXml, "tableColumns", "tableColumn").map((columnXml) =>
    parseXmlAttributes(columnXml)
  );
  const styleMatch = /<tableStyleInfo\b([^>]*)(?:\/>|>)/i.exec(tableXml);
  const styleAttributes = parseXmlAttributes(styleMatch?.[1] || "");
  const hasTotalMetadata = columnAttributes.some((column) => column.totalsRowFunction || column.totalsRowLabel);
  const totalFunctions = {};
  columnAttributes.forEach((column, offset) => {
    const totalFunction = hydriaTableTotalFunctionFromXlsx(column.totalsRowFunction);
    if (totalFunction) {
      totalFunctions[String(bounds.startColumnIndex + offset)] = totalFunction;
    }
  });

  return {
    id: `sheet-table-${tableIndex + 1}`,
    name: String(tableAttributes.displayName || tableAttributes.name || `Table${tableIndex + 1}`).trim() || `Table${tableIndex + 1}`,
    ...bounds,
    style: hydriaTableStyleFromXlsxName(styleAttributes.name),
    showHeaderRow: tableAttributes.headerRowCount !== "0",
    showBandedRows: styleAttributes.showRowStripes !== "0",
    showBandedColumns: styleAttributes.showColumnStripes === "1",
    showFirstColumn: styleAttributes.showFirstColumn === "1",
    showLastColumn: styleAttributes.showLastColumn === "1",
    showFilterButtons: /<autoFilter\b/i.test(tableXml),
    showTotalRow: tableAttributes.totalsRowShown === "1" || tableAttributes.totalsRowCount === "1" || hasTotalMetadata,
    totalFunctions
  };
}

function worksheetOriginRangeFromXml(sheetXml = "", sheet = {}) {
  const dimensionMatch = /<dimension\b[^>]*ref="([^"]+)"/i.exec(sheetXml);
  const fallbackEndColumn = Math.max(0, (sheet.columns || []).length - 1);
  const fallbackEndRow = Math.max(0, (sheet.rows || []).length);
  const dimensionRef = dimensionMatch?.[1] || XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: fallbackEndRow, c: fallbackEndColumn }
  });
  try {
    return XLSX.utils.decode_range(dimensionRef);
  } catch {
    return XLSX.utils.decode_range("A1");
  }
}

function applyXlsxTablesToHydriaModel(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const sheetEntry = zip.getEntry(sheetPath);
    if (!sheetEntry) {
      return;
    }
    const sheetXml = sheetEntry.getData().toString("utf8");
    const originRange = worksheetOriginRangeFromXml(sheetXml, sheet);
    const importedTables = getXlsxRelationshipsForType(zip, sheetPath, XLSX_TABLE_RELATIONSHIP_TYPE)
      .map((relationship, tableIndex) => {
        const tableEntry = zip.getEntry(relationship.partPath);
        return tableEntry
          ? xlsxTableXmlToHydriaTable(tableEntry.getData().toString("utf8"), originRange, tableIndex)
          : null;
      })
      .filter(Boolean);
    if (importedTables.length) {
      sheet.tables = normalizeHydriaTables(importedTables);
    }
  });
  return model;
}

function applyXlsxWorkbookViewToHydriaModel(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  const workbookEntry = zip.getEntry("xl/workbook.xml");
  if (!workbookEntry || !Array.isArray(model.sheets) || !model.sheets.length) {
    return model;
  }
  const workbookXml = workbookEntry.getData().toString("utf8");
  const workbookViewMatch = /<workbookView\b([^>]*)\/?>/i.exec(workbookXml);
  const workbookViewAttributes = parseXmlAttributes(workbookViewMatch?.[1] || "");
  const activeTab = Number(workbookViewAttributes.activeTab ?? workbookViewAttributes.firstSheet);
  if (!Number.isInteger(activeTab) || activeTab < 0 || activeTab >= model.sheets.length) {
    return model;
  }
  const activeSheet = model.sheets[activeTab];
  model.activeSheetId = activeSheet.id;
  model.columns = activeSheet.columns;
  model.rows = activeSheet.rows;
  return model;
}

function xlsxDrawingMarkerToCellPoint(markerXml = "", sheet = {}) {
  const numberFromTag = (tagName = "") => {
    const match = new RegExp(`<xdr:${tagName}>([\\s\\S]*?)</xdr:${tagName}>`, "i").exec(markerXml);
    const value = Number(match?.[1] || 0);
    return Number.isFinite(value) ? value : 0;
  };
  const columnIndex = Math.max(0, Math.floor(numberFromTag("col")));
  const rowIndex = Math.max(0, Math.floor(numberFromTag("row")));
  const columnOffset = numberFromTag("colOff") / XLSX_EMUS_PER_PIXEL;
  const rowOffset = numberFromTag("rowOff") / XLSX_EMUS_PER_PIXEL;
  const x = Array.from({ length: columnIndex }, (_, index) =>
    Number(sheet.columnWidths?.[String(index)] || HYDRIA_DEFAULT_COLUMN_WIDTH)
  ).reduce((sum, width) => sum + width, 0) + columnOffset;
  const y = Array.from({ length: rowIndex }, (_, index) =>
    Number(sheet.rowHeights?.[String(index)] || HYDRIA_DEFAULT_ROW_HEIGHT)
  ).reduce((sum, height) => sum + height, 0) + rowOffset;
  return { x, y };
}

function xlsxDrawingAnchorFrame(anchorXml = "", sheet = {}) {
  const fromMatch = /<xdr:from>([\s\S]*?)<\/xdr:from>/i.exec(anchorXml);
  const toMatch = /<xdr:to>([\s\S]*?)<\/xdr:to>/i.exec(anchorXml);
  const from = xlsxDrawingMarkerToCellPoint(fromMatch?.[1] || "", sheet);
  const to = xlsxDrawingMarkerToCellPoint(toMatch?.[1] || "", sheet);
  return {
    x: Math.max(0, HYDRIA_ROW_HEADER_WIDTH + from.x),
    y: Math.max(0, HYDRIA_COLUMN_HEADER_HEIGHT + from.y),
    width: Math.max(180, to.x - from.x),
    height: Math.max(140, to.y - from.y)
  };
}

function getXmlTagBlock(xml = "", tagName = "") {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i").exec(xml);
  return match?.[1] || "";
}

function extractXlsxChartCacheValues(xml = "") {
  return Array.from(xml.matchAll(/<c:pt\b[^>]*idx="(\d+)"[^>]*>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>[\s\S]*?<\/c:pt>/gi))
    .map((match) => ({
      index: Number(match[1]),
      value: decodeXmlAttribute(match[2] || "")
    }))
    .filter((point) => Number.isInteger(point.index))
    .sort((left, right) => left.index - right.index)
    .map((point) => point.value);
}

function extractXlsxChartFormula(xml = "") {
  const match = /<c:f>([\s\S]*?)<\/c:f>/i.exec(xml);
  return decodeXmlAttribute(match?.[1] || "").replace(/\$/g, "");
}

function extractXlsxChartTitle(chartXml = "") {
  const titleBlock = getXmlTagBlock(chartXml, "c:title");
  const titleText = /<a:t>([\s\S]*?)<\/a:t>/i.exec(titleBlock)?.[1];
  return decodeXmlAttribute(titleText || "").trim();
}

function extractXlsxChartSeriesName(seriesXml = "") {
  const txBlock = getXmlTagBlock(seriesXml, "c:tx");
  const cached = extractXlsxChartCacheValues(txBlock)[0];
  if (cached) {
    return cached;
  }
  const directText = /<c:v>([\s\S]*?)<\/c:v>/i.exec(txBlock)?.[1];
  return decodeXmlAttribute(directText || "").trim();
}

function xlsxChartKindFromXml(chartXml = "") {
  if (/<c:pieChart\b/i.test(chartXml)) {
    return "pie";
  }
  if (/<c:doughnutChart\b/i.test(chartXml)) {
    return "donut";
  }
  if (/<c:lineChart\b/i.test(chartXml)) {
    return /<c:marker\b[\s\S]*?<c:symbol\b[^>]*val="none"/i.test(chartXml) ? "line" : "line-markers";
  }
  if (/<c:scatterChart\b/i.test(chartXml)) {
    return "scatter";
  }
  if (/<c:areaChart\b/i.test(chartXml)) {
    return /<c:grouping\b[^>]*val="stacked"/i.test(chartXml) ? "stacked-area" : "area";
  }
  if (/<c:barChart\b/i.test(chartXml)) {
    const horizontal = /<c:barDir\b[^>]*val="bar"/i.test(chartXml);
    const stacked = /<c:grouping\b[^>]*val="stacked"/i.test(chartXml);
    const percent = /<c:grouping\b[^>]*val="percentStacked"/i.test(chartXml);
    if (horizontal) {
      return percent ? "percent-bar" : stacked ? "stacked-bar" : "bar";
    }
    return percent ? "percent-column" : stacked ? "stacked-column" : "column";
  }
  return "column";
}

function xlsxChartDisplayRangeFromReferences(references = []) {
  const bounds = references
    .map((reference) => hydriaChartRangeBounds(stripHydriaChartSheetPrefix(reference).replace(/\$/g, "")))
    .filter(Boolean);
  if (!bounds.length) {
    return "";
  }
  return XLSX.utils.encode_range({
    s: {
      r: Math.min(...bounds.map((range) => range.minRow)),
      c: Math.min(...bounds.map((range) => range.minColumn))
    },
    e: {
      r: Math.max(...bounds.map((range) => range.maxRow)),
      c: Math.max(...bounds.map((range) => range.maxColumn))
    }
  });
}

function xlsxChartXmlToHydriaChart(chartXml = "", frame = {}, chartIndex = 0) {
  const seriesXml = /<c:ser\b[\s\S]*?<\/c:ser>/i.exec(chartXml)?.[0] || "";
  if (!seriesXml) {
    return null;
  }
  const catBlock = getXmlTagBlock(seriesXml, "c:cat") || getXmlTagBlock(seriesXml, "c:xVal");
  const valBlock = getXmlTagBlock(seriesXml, "c:val") || getXmlTagBlock(seriesXml, "c:yVal");
  const labels = extractXlsxChartCacheValues(catBlock);
  const values = extractXlsxChartCacheValues(valBlock).map((value) => hydriaChartNumericValue(value) ?? 0);
  const pointCount = Math.max(labels.length, values.length);
  if (!pointCount) {
    return null;
  }
  const categoryReference = extractXlsxChartFormula(catBlock);
  const valueReference = extractXlsxChartFormula(valBlock);
  const nameReference = extractXlsxChartFormula(getXmlTagBlock(seriesXml, "c:tx"));
  return {
    id: `sheet-chart-${chartIndex + 1}`,
    title: extractXlsxChartTitle(chartXml) || `Chart ${chartIndex + 1}`,
    kind: xlsxChartKindFromXml(chartXml),
    range: xlsxChartDisplayRangeFromReferences([nameReference, categoryReference, valueReference]),
    seriesName: extractXlsxChartSeriesName(seriesXml),
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    showLegend: /<c:legend\b/i.test(chartXml),
    legendPosition: /<c:legendPos\b[^>]*val="r"/i.test(chartXml) ? "right" : "bottom",
    showAxes: /<c:(catAx|valAx)\b/i.test(chartXml),
    showDataLabels: /<c:showVal\b[^>]*val="1"/i.test(chartXml),
    showGridlines: /<c:majorGridlines\b/i.test(chartXml),
    points: Array.from({ length: pointCount }, (_, index) => ({
      label: labels[index] || `Point ${index + 1}`,
      value: values[index] ?? 0
    }))
  };
}

function applyXlsxChartsToHydriaModel(buffer, model = {}) {
  const zip = new AdmZip(buffer);
  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const drawingRelationships = getXlsxRelationshipsForType(zip, sheetPath, XLSX_DRAWING_RELATIONSHIP_TYPE);
    const importedCharts = [];
    drawingRelationships.forEach((drawingRelationship) => {
      const drawingEntry = zip.getEntry(drawingRelationship.partPath);
      if (!drawingEntry) {
        return;
      }
      const drawingXml = drawingEntry.getData().toString("utf8");
      const chartRelationshipsById = new Map(
        getXlsxRelationshipsForType(zip, drawingRelationship.partPath, XLSX_CHART_RELATIONSHIP_TYPE).map((relationship) => [
          relationship.Id,
          relationship
        ])
      );
      Array.from(drawingXml.matchAll(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/gi)).forEach((anchorMatch) => {
        const anchorXml = anchorMatch[0];
        const chartRelationshipId = /<c:chart\b[^>]*\br:id="([^"]+)"/i.exec(anchorXml)?.[1];
        const chartRelationship = chartRelationshipsById.get(chartRelationshipId);
        if (!chartRelationship) {
          return;
        }
        const chartEntry = zip.getEntry(chartRelationship.partPath);
        if (!chartEntry) {
          return;
        }
        const chart = xlsxChartXmlToHydriaChart(
          chartEntry.getData().toString("utf8"),
          xlsxDrawingAnchorFrame(anchorXml, sheet),
          importedCharts.length
        );
        if (chart) {
          importedCharts.push(chart);
        }
      });
    });
    if (importedCharts.length) {
      sheet.charts = normalizeHydriaCharts(importedCharts);
    }
  });
  return model;
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
      border.style = BORDER_STYLES.has(edgeAttributes.style) ? edgeAttributes.style : border.style;
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

const PDF_CHART_PALETTE = ["#1a73e8", "#0f9d58", "#fbbc04", "#ea4335", "#7e57c2", "#00acc1", "#f4511e", "#5f6368"];
const PDF_SHEET_PIXEL_TO_POINT = 0.56;
const PDF_TABLE_PALETTES = {
  blue: { header: "#4472c4", banded: "#d9eaf7", total: "#b4c7e7", border: "#8ea9db" },
  green: { header: "#9bbb59", banded: "#eaf2dd", total: "#d8e4bc", border: "#a9d08e" },
  orange: { header: "#ed7d31", banded: "#fce4d6", total: "#f8cbad", border: "#f4b183" },
  purple: { header: "#8064a2", banded: "#e4dfec", total: "#d9d2e9", border: "#b4a7d6" },
  gray: { header: "#5f6368", banded: "#f1f3f4", total: "#e8eaed", border: "#c7c9cc" }
};
const HYDRIA_PDF_DEFAULT_SETTINGS = {
  printRange: "active",
  paperSize: "a4",
  orientation: "landscape",
  scaling: "fit-page",
  pagesPerSheet: "1",
  margins: "normal",
  showGridlines: false,
  showHeadings: false,
  blackAndWhite: false,
  centerHorizontally: false,
  centerVertically: false,
  showHeadersFooters: false,
  includeCharts: true
};
const HYDRIA_PDF_MARGINS = {
  normal: 32,
  narrow: 18,
  wide: 54
};

function normalizeHydriaPdfDisplaySheet(displaySheet = null, fallbackSheet = {}) {
  if (!displaySheet || typeof displaySheet !== "object" || Array.isArray(displaySheet)) {
    return fallbackSheet;
  }
  const normalizedSheet = normalizeHydriaSheet(
    {
      ...fallbackSheet,
      ...displaySheet,
      id: fallbackSheet.id || displaySheet.id,
      name: displaySheet.name || fallbackSheet.name,
      tables: displaySheet.tables || fallbackSheet.tables,
      pivotTables: displaySheet.pivotTables || fallbackSheet.pivotTables,
      charts: displaySheet.charts || fallbackSheet.charts,
      cellFormats: displaySheet.cellFormats || fallbackSheet.cellFormats,
      conditionalFormats: displaySheet.conditionalFormats || fallbackSheet.conditionalFormats,
      columnWidths: displaySheet.columnWidths || fallbackSheet.columnWidths,
      rowHeights: displaySheet.rowHeights || fallbackSheet.rowHeights
    },
    0
  );
  normalizedSheet.printBounds = normalizeHydriaPdfPrintBounds(displaySheet.printBounds);
  return normalizedSheet;
}

function normalizeHydriaPdfSettings(settings = {}) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const normalized = { ...HYDRIA_PDF_DEFAULT_SETTINGS, ...source };
  return {
    ...normalized,
    printRange: ["active", "selection"].includes(normalized.printRange) ? normalized.printRange : HYDRIA_PDF_DEFAULT_SETTINGS.printRange,
    paperSize: ["a4", "letter"].includes(normalized.paperSize) ? normalized.paperSize : HYDRIA_PDF_DEFAULT_SETTINGS.paperSize,
    orientation: ["portrait", "landscape"].includes(normalized.orientation)
      ? normalized.orientation
      : HYDRIA_PDF_DEFAULT_SETTINGS.orientation,
    scaling: ["default", "fit-page", "fit-width", "fit-height", "actual"].includes(normalized.scaling)
      ? normalized.scaling
      : HYDRIA_PDF_DEFAULT_SETTINGS.scaling,
    pagesPerSheet: ["1", "2", "4"].includes(String(normalized.pagesPerSheet))
      ? String(normalized.pagesPerSheet)
      : HYDRIA_PDF_DEFAULT_SETTINGS.pagesPerSheet,
    margins: ["normal", "narrow", "wide"].includes(normalized.margins) ? normalized.margins : HYDRIA_PDF_DEFAULT_SETTINGS.margins,
    showGridlines: Boolean(normalized.showGridlines),
    showHeadings: Boolean(normalized.showHeadings),
    blackAndWhite: Boolean(normalized.blackAndWhite),
    centerHorizontally: Boolean(normalized.centerHorizontally),
    centerVertically: Boolean(normalized.centerVertically),
    showHeadersFooters: Boolean(normalized.showHeadersFooters),
    includeCharts: normalized.includeCharts !== false
  };
}

function normalizeHydriaPdfPrintBounds(bounds = null) {
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    return null;
  }
  const minRow = Math.max(0, Math.floor(Number(bounds.minRow) || 0));
  const minColumn = Math.max(0, Math.floor(Number(bounds.minColumn) || 0));
  const maxRow = Math.max(minRow, Math.floor(Number(bounds.maxRow) || minRow));
  const maxColumn = Math.max(minColumn, Math.floor(Number(bounds.maxColumn) || minColumn));
  return { minRow, minColumn, maxRow, maxColumn };
}

function drawHydriaPdfHeadingCell(doc, text = "", x = 0, y = 0, width = 20, height = 14) {
  doc
    .rect(x, y, width, height)
    .fillAndStroke("#f3f4f6", "#cfd8e3")
    .fillColor("#4b5563")
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text(text, x + 2, y + Math.max(2, (height - 6.5) / 2), {
      width: Math.max(1, width - 4),
      height: Math.max(1, height - 3),
      align: "center",
      ellipsis: true
    });
}

function getHydriaPdfCellText(sheet = {}, rowIndex = 0, columnIndex = 0) {
  return normalizeCellText(rowIndex === 0 ? sheet.columns?.[columnIndex] : sheet.rows?.[rowIndex - 1]?.[columnIndex]);
}

function getHydriaPdfUsedBounds(sheet = {}) {
  const requestedBounds = normalizeHydriaPdfPrintBounds(sheet.printBounds);
  if (requestedBounds) {
    return requestedBounds;
  }
  const bounds = { minRow: 0, minColumn: 0, maxRow: 0, maxColumn: 0 };
  const rows = [sheet.columns || [], ...(sheet.rows || [])];
  rows.forEach((row, rowIndex) => {
    (row || []).forEach((value, columnIndex) => {
      if (normalizeCellText(value).trim()) {
        bounds.maxRow = Math.max(bounds.maxRow, rowIndex);
        bounds.maxColumn = Math.max(bounds.maxColumn, columnIndex);
      }
    });
  });
  normalizeHydriaTables(sheet.tables).forEach((table) => {
    bounds.maxRow = Math.max(bounds.maxRow, table.endRowIndex);
    bounds.maxColumn = Math.max(bounds.maxColumn, table.endColumnIndex);
  });
  normalizeHydriaPivotTables(sheet.pivotTables).forEach((pivotTable) => {
    const pivotBounds = hydriaChartRangeBounds(pivotTable.renderedRange) || {
      minRow: pivotTable.anchorRowIndex,
      maxRow: pivotTable.anchorRowIndex,
      minColumn: pivotTable.anchorColumnIndex,
      maxColumn: pivotTable.anchorColumnIndex
    };
    bounds.maxRow = Math.max(bounds.maxRow, pivotBounds.maxRow);
    bounds.maxColumn = Math.max(bounds.maxColumn, pivotBounds.maxColumn);
  });
  return bounds;
}

function hydriaPdfDimension(sheet = {}, kind = "column", index = 0) {
  const pixels = hydriaSheetDimensionPixels(sheet, kind, index);
  const points = pixels * PDF_SHEET_PIXEL_TO_POINT;
  return kind === "row" ? Math.max(16, Math.min(60, points)) : Math.max(40, Math.min(130, points));
}

function hydriaPdfSheetPixelToPoint(value = 0) {
  return Math.max(0, (Number(value) || 0) * PDF_SHEET_PIXEL_TO_POINT);
}

function getHydriaPdfChartFrame(chart = {}) {
  return {
    x: hydriaPdfSheetPixelToPoint(Math.max(0, Number(chart.x || 0) - HYDRIA_ROW_HEADER_WIDTH)),
    y: hydriaPdfSheetPixelToPoint(Math.max(0, Number(chart.y || 0) - HYDRIA_COLUMN_HEADER_HEIGHT)),
    width: Math.max(90, hydriaPdfSheetPixelToPoint(Number(chart.width || 360))),
    height: Math.max(76, hydriaPdfSheetPixelToPoint(Number(chart.height || 220)))
  };
}

function getHydriaPdfTableCellInfo(sheet = {}, rowIndex = 0, columnIndex = 0) {
  const table = normalizeHydriaTables(sheet.tables).find(
    (candidate) =>
      rowIndex >= candidate.startRowIndex &&
      rowIndex <= candidate.endRowIndex &&
      columnIndex >= candidate.startColumnIndex &&
      columnIndex <= candidate.endColumnIndex
  );
  if (!table) {
    return null;
  }
  const dataStartRow = table.startRowIndex + (table.showHeaderRow === false ? 0 : 1);
  return {
    table,
    isHeader: table.showHeaderRow !== false && rowIndex === table.startRowIndex,
    isTotal: table.showTotalRow && rowIndex === table.endRowIndex,
    isBanded: table.showBandedRows !== false && rowIndex >= dataStartRow && (rowIndex - dataStartRow) % 2 === 1,
    isBandedColumn: table.showBandedColumns && (columnIndex - table.startColumnIndex) % 2 === 1,
    isFirstColumn: table.showFirstColumn && columnIndex === table.startColumnIndex,
    isLastColumn: table.showLastColumn && columnIndex === table.endColumnIndex
  };
}

function getHydriaPdfCellStyle(sheet = {}, rowIndex = 0, columnIndex = 0, settings = HYDRIA_PDF_DEFAULT_SETTINGS) {
  const format = normalizeHydriaCellFormat(sheet.cellFormats?.[`${rowIndex}:${columnIndex}`]);
  const tableInfo = getHydriaPdfTableCellInfo(sheet, rowIndex, columnIndex);
  const palette = PDF_TABLE_PALETTES[tableInfo?.table?.style] || PDF_TABLE_PALETTES.blue;
  const cellText = getHydriaPdfCellText(sheet, rowIndex, columnIndex);
  const structuralFill =
    !tableInfo
      ? "#ffffff"
      : tableInfo.isHeader
      ? palette.header
      : tableInfo.isTotal
        ? palette.total
        : tableInfo.isBanded || tableInfo.isBandedColumn
          ? palette.banded
          : "#ffffff";
  const structuralColor = tableInfo?.isHeader ? "#ffffff" : "#111827";
  const shouldShowGridline = settings.showGridlines || tableInfo || cellText.trim() || format.fillColor || format.border;
  return {
    fill: settings.blackAndWhite ? "#ffffff" : format.fillColor || structuralFill,
    stroke: settings.blackAndWhite
      ? (shouldShowGridline ? "#9ca3af" : "#ffffff")
      : format.border?.color || (tableInfo ? palette.border : shouldShowGridline ? "#e5e7eb" : "#ffffff"),
    textColor: settings.blackAndWhite ? "#111827" : format.textColor || structuralColor,
    bold:
      Boolean(format.bold) ||
      Boolean(tableInfo?.isHeader || tableInfo?.isTotal || tableInfo?.isFirstColumn || tableInfo?.isLastColumn),
    italic: Boolean(format.italic),
    underline: Boolean(format.underline),
    align: format.horizontalAlign || "left",
    fontSize: Math.max(6, Math.min(14, Number(format.fontSize) || 8))
  };
}

function drawHydriaPdfCell(doc, sheet = {}, rowIndex = 0, columnIndex = 0, x = 0, y = 0, width = 60, height = 18, settings = HYDRIA_PDF_DEFAULT_SETTINGS) {
  const value = getHydriaPdfCellText(sheet, rowIndex, columnIndex);
  const style = getHydriaPdfCellStyle(sheet, rowIndex, columnIndex, settings);
  doc.save();
  doc.rect(x, y, width, height).fillAndStroke(style.fill || "#ffffff", style.stroke || "#e5e7eb");
  doc
    .fillColor(style.textColor || "#111827")
    .font(style.bold ? "Helvetica-Bold" : style.italic ? "Helvetica-Oblique" : "Helvetica")
    .fontSize(style.fontSize)
    .text(value, x + 4, y + Math.max(3, (height - style.fontSize) / 2), {
      width: Math.max(1, width - 8),
      height: Math.max(1, height - 4),
      ellipsis: true,
      align: style.align === "right" || style.align === "center" ? style.align : "left"
    });
  doc.restore();
}

function normalizedPdfChartPoints(chart = {}) {
  return (Array.isArray(chart.points) ? chart.points : [])
    .map((point, index) => ({
      label: normalizeCellText(point.label || point.name || `Point ${index + 1}`),
      value: hydriaChartNumericValue(point.value ?? point.yValue ?? point.y ?? 0) ?? 0
    }))
    .filter((point) => point.label || Number.isFinite(point.value));
}

function drawHydriaPdfPieSlice(doc, cx = 0, cy = 0, radius = 20, startAngle = -90, endAngle = 0, color = "#1a73e8") {
  const angleSpan = Math.max(0, endAngle - startAngle);
  if (!angleSpan) {
    return;
  }
  const steps = Math.max(3, Math.ceil(angleSpan / 8));
  doc.save();
  doc.moveTo(cx, cy);
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((startAngle + (angleSpan * step) / steps) * Math.PI) / 180;
    doc.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  doc.closePath().fill(color);
  doc.restore();
}

function getHydriaPdfChartLegendRows(doc, points = [], width = 220) {
  doc.font("Helvetica").fontSize(6);
  const items = points.slice(0, 8).map((point, index) => ({
    label: normalizeCellText(point.label || `Point ${index + 1}`),
    color: PDF_CHART_PALETTE[index % PDF_CHART_PALETTE.length],
    width: Math.min(74, Math.max(28, doc.widthOfString(normalizeCellText(point.label || `Point ${index + 1}`)) + 14))
  }));
  const rows = [];
  let row = [];
  let rowWidth = 0;
  items.forEach((item) => {
    const gap = row.length ? 10 : 0;
    if (row.length && rowWidth + gap + item.width > width) {
      rows.push(row);
      row = [item];
      rowWidth = item.width;
      return;
    }
    row.push(item);
    rowWidth += gap + item.width;
  });
  if (row.length) {
    rows.push(row);
  }
  return rows;
}

function drawHydriaPdfChartLegend(doc, points = [], x = 0, y = 0, width = 220) {
  const rows = getHydriaPdfChartLegendRows(doc, points, width);
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum, item) => sum + item.width, 0) + Math.max(0, row.length - 1) * 10;
    let cursorX = x + Math.max(0, (width - rowWidth) / 2);
    row.forEach((item) => {
      doc.rect(cursorX, y + rowIndex * 10 + 2, 5, 5).fill(item.color);
      doc
        .fillColor("#374151")
        .font("Helvetica")
        .fontSize(6)
        .text(item.label, cursorX + 8, y + rowIndex * 10, {
          width: Math.max(12, item.width - 8),
          height: 9,
          ellipsis: true
        });
      cursorX += item.width + 10;
    });
  });
}

function drawHydriaPdfChart(doc, chart = {}, x = 0, y = 0, width = 260, height = 170) {
  const points = normalizedPdfChartPoints(chart);
  if (!points.length) {
    return;
  }
  const kind = String(chart.kind || "column").toLowerCase();
  const isPieChart = kind.includes("pie") || kind.includes("donut");
  const isSingleSeriesBarChart = kind.includes("column") || kind.includes("bar");
  const shouldShowChartLegend = chart.showLegend !== false && (!isSingleSeriesBarChart || Boolean(chart.hasMultipleSeries));
  const hasBottomAxisLabels = !isPieChart && !kind.includes("line") && !(kind.includes("bar") && !kind.includes("column"));
  const padding = 18;
  const titleHeight = 18;
  const legendRows = shouldShowChartLegend ? getHydriaPdfChartLegendRows(doc, points, Math.max(40, width - padding * 2)) : [];
  const legendHeight = legendRows.length ? legendRows.length * 10 + 4 : 0;
  const bottomAxisHeight = hasBottomAxisLabels ? 12 : 0;
  const legendGap = legendHeight ? 6 : 0;
  const plotX = x + padding;
  const plotY = y + padding + titleHeight;
  const plotWidth = Math.max(40, width - padding * 2);
  const plotHeight = Math.max(36, height - padding * 2 - titleHeight - bottomAxisHeight - legendGap - legendHeight);
  const values = points.map((point) => Math.max(0, Number(point.value) || 0));
  const maxValue = Math.max(1, ...values);

  doc.save();
  doc.roundedRect(x, y, width, height, 3).fillAndStroke("#ffffff", "#cfd8e3");
  doc
    .fillColor("#374151")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(chart.title || "Chart", x + 8, y + 8, { width: width - 16, align: "center", ellipsis: true });

  if (isPieChart) {
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    const radius = Math.max(20, Math.min(plotWidth, plotHeight) / 2 - 6);
    const cx = plotX + plotWidth / 2;
    const cy = plotY + plotHeight / 2;
    let startAngle = -90;
    points.forEach((point, index) => {
      const angle = (Math.max(0, point.value) / total) * 360;
      const endAngle = startAngle + angle;
      drawHydriaPdfPieSlice(doc, cx, cy, radius, startAngle, endAngle, PDF_CHART_PALETTE[index % PDF_CHART_PALETTE.length]);
      startAngle = endAngle;
    });
    if (kind.includes("donut")) {
      doc.circle(cx, cy, radius * 0.48).fill("#ffffff");
    }
  } else if (kind.includes("line")) {
    const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
    doc.moveTo(plotX, plotY + plotHeight);
    points.forEach((point, index) => {
      const px = plotX + index * step;
      const py = plotY + plotHeight - (Math.max(0, point.value) / maxValue) * plotHeight;
      if (index === 0) {
        doc.moveTo(px, py);
      } else {
        doc.lineTo(px, py);
      }
    });
    doc.lineWidth(1.5).stroke(PDF_CHART_PALETTE[0]);
    points.forEach((point, index) => {
      const px = plotX + index * step;
      const py = plotY + plotHeight - (Math.max(0, point.value) / maxValue) * plotHeight;
      doc.circle(px, py, 2.4).fill(PDF_CHART_PALETTE[index % PDF_CHART_PALETTE.length]);
    });
  } else if (kind.includes("bar") && !kind.includes("column")) {
    const band = plotHeight / points.length;
    points.forEach((point, index) => {
      const barWidth = (Math.max(0, point.value) / maxValue) * (plotWidth - 32);
      const barY = plotY + index * band + band * 0.18;
      doc.roundedRect(plotX, barY, Math.max(2, barWidth), Math.max(4, band * 0.58), 3).fill(PDF_CHART_PALETTE[index % PDF_CHART_PALETTE.length]);
      doc.fillColor("#374151").font("Helvetica").fontSize(6).text(point.label, plotX + barWidth + 4, barY + 1, { width: 28, ellipsis: true });
    });
  } else {
    const band = plotWidth / points.length;
    doc.moveTo(plotX, plotY + plotHeight).lineTo(plotX + plotWidth, plotY + plotHeight).lineWidth(1).stroke("#d1d5db");
    points.forEach((point, index) => {
      const barWidth = Math.max(4, band * 0.46);
      const barHeight = (Math.max(0, point.value) / maxValue) * plotHeight;
      const barX = plotX + index * band + (band - barWidth) / 2;
      const barY = plotY + plotHeight - barHeight;
      doc.roundedRect(barX, barY, barWidth, Math.max(2, barHeight), 4).fill(PDF_CHART_PALETTE[index % PDF_CHART_PALETTE.length]);
      doc.fillColor("#374151").font("Helvetica-Bold").fontSize(6).text(String(point.value), barX, Math.max(plotY, barY - 9), { width: barWidth, align: "center" });
      doc.fillColor("#374151").font("Helvetica").fontSize(5.5).text(point.label, plotX + index * band, plotY + plotHeight + 3, { width: band, height: bottomAxisHeight, align: "center", ellipsis: true });
    });
  }

  if (shouldShowChartLegend) {
    drawHydriaPdfChartLegend(doc, points, x + padding, plotY + plotHeight + bottomAxisHeight + legendGap, plotWidth);
  }
  doc.restore();
}

function buildSheetPdfBuffer(model = {}, sheetId = "", { displaySheet = null, settings = {} } = {}) {
  const normalized = normalizeHydriaWorkbook(model);
  const fallbackSheet = normalized.sheets.find((entry) => entry.id === sheetId) || normalized.sheets[0];
  const sheet = normalizeHydriaPdfDisplaySheet(displaySheet, fallbackSheet);
  const pdfSettings = normalizeHydriaPdfSettings(settings);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: HYDRIA_PDF_MARGINS[pdfSettings.margins] || HYDRIA_PDF_MARGINS.normal,
      size: pdfSettings.paperSize === "letter" ? "LETTER" : "A4",
      layout: pdfSettings.orientation
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bounds = getHydriaPdfUsedBounds(sheet);
    const columns = Array.from({ length: bounds.maxColumn - bounds.minColumn + 1 }, (_, offset) => bounds.minColumn + offset);
    const rowIndexes = Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, offset) => bounds.minRow + offset);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableTop = 76;
    const footerHeight = pdfSettings.showHeadersFooters ? 28 : 12;
    const rawHeadingColumnWidth = pdfSettings.showHeadings ? 24 : 0;
    const rawHeadingRowHeight = pdfSettings.showHeadings ? 14 : 0;
    const rawColumnWidths = columns.map((columnIndex) => hydriaPdfDimension(sheet, "column", columnIndex));
    const rawRowHeights = rowIndexes.map((rowIndex) => hydriaPdfDimension(sheet, "row", rowIndex));
    const rawGridWidth = rawHeadingColumnWidth + rawColumnWidths.reduce((sum, width) => sum + width, 0);
    const rawGridHeight = rawHeadingRowHeight + rawRowHeights.reduce((sum, height) => sum + height, 0);
    const chartFrames = pdfSettings.includeCharts
      ? normalizeHydriaCharts(sheet.charts).map((chart) => {
          const frame = getHydriaPdfChartFrame(chart);
          return {
            chart,
            ...frame,
            x: rawHeadingColumnWidth + frame.x,
            y: rawHeadingRowHeight + frame.y
          };
        })
      : [];
    const rawContentWidth = Math.max(
      rawGridWidth,
      ...chartFrames.map((chart) => chart.x + chart.width),
      1
    );
    const rawContentHeight = Math.max(
      rawGridHeight,
      ...chartFrames.map((chart) => chart.y + chart.height),
      1
    );
    const availableHeight = doc.page.height - tableTop - footerHeight - doc.page.margins.bottom;
    const fitWidthScale = pageWidth / Math.max(1, rawContentWidth);
    const fitHeightScale = availableHeight / Math.max(1, rawContentHeight);
    const scalingMode = pdfSettings.scaling === "default" ? "fit-page" : pdfSettings.scaling;
    let scale = 1;
    if (scalingMode === "fit-page") {
      scale = Math.min(1, fitWidthScale, fitHeightScale);
    } else if (scalingMode === "fit-width") {
      scale = Math.min(1, fitWidthScale);
    } else if (scalingMode === "fit-height") {
      scale = Math.min(1, fitHeightScale);
    }
    if (pdfSettings.pagesPerSheet === "2") {
      scale *= 0.72;
    } else if (pdfSettings.pagesPerSheet === "4") {
      scale *= 0.5;
    }
    const columnWidths = rawColumnWidths.map((width) => Math.max(8, width * scale));
    const rowHeights = rawRowHeights.map((height) => Math.max(6, height * scale));
    const headingColumnWidth = rawHeadingColumnWidth * scale;
    const headingRowHeight = rawHeadingRowHeight * scale;
    const scaledContentWidth = rawContentWidth * scale;
    const scaledContentHeight = rawContentHeight * scale;
    const contentLeft = doc.page.margins.left + (pdfSettings.centerHorizontally ? Math.max(0, (pageWidth - scaledContentWidth) / 2) : 0);
    const contentTop = tableTop + (pdfSettings.centerVertically ? Math.max(0, (availableHeight - scaledContentHeight) / 2) : 0);
    const rowsPerPage = rowIndexes.length;

    const drawHeader = () => {
      if (pdfSettings.showHeadersFooters) {
        doc.fontSize(7).font("Helvetica").fillColor("#111827");
        doc.text(new Date().toLocaleString("fr-FR"), doc.page.margins.left, 22, { width: 160 });
        doc.text("Hydria", doc.page.margins.left, 22, { width: pageWidth, align: "center" });
      }
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#111827").text(sheet?.name || "Sheet", doc.page.margins.left, 28);
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
      doc.text(
        `${bounds.maxRow - bounds.minRow + 1} rows | ${bounds.maxColumn - bounds.minColumn + 1} columns`,
        doc.page.margins.left,
        48
      );
      return tableTop;
    };

    for (let pageRowIndex = 0; pageRowIndex < rowIndexes.length; pageRowIndex += rowsPerPage) {
      if (pageRowIndex > 0) {
        doc.addPage();
      }
      drawHeader();
      let cursorY = contentTop;
      if (pdfSettings.showHeadings) {
        let headingX = contentLeft;
        drawHydriaPdfHeadingCell(doc, "", headingX, cursorY, headingColumnWidth, headingRowHeight);
        headingX += headingColumnWidth;
        columns.forEach((columnIndex, columnOffset) => {
          drawHydriaPdfHeadingCell(
            doc,
            XLSX.utils.encode_col(columnIndex),
            headingX,
            cursorY,
            columnWidths[columnOffset] || 40,
            headingRowHeight
          );
          headingX += columnWidths[columnOffset] || 40;
        });
        cursorY += headingRowHeight;
      }
      rowIndexes.slice(pageRowIndex, pageRowIndex + rowsPerPage).forEach((rowIndex, rowOffset) => {
        const rowHeight = rowHeights[pageRowIndex + rowOffset] || 18;
        let cursorX = contentLeft;
        if (pdfSettings.showHeadings) {
          drawHydriaPdfHeadingCell(doc, String(rowIndex + 1), cursorX, cursorY, headingColumnWidth, rowHeight);
          cursorX += headingColumnWidth;
        }
        columns.forEach((columnIndex, columnOffset) => {
          const columnWidth = columnWidths[columnOffset] || 60;
          drawHydriaPdfCell(doc, sheet, rowIndex, columnIndex, cursorX, cursorY, columnWidth, rowHeight, pdfSettings);
          cursorX += columnWidth;
        });
        cursorY += rowHeight;
      });

      if (pageRowIndex === 0) {
        chartFrames.forEach((chartFrame) => {
          const chartX = contentLeft + chartFrame.x * scale;
          const chartY = contentTop + chartFrame.y * scale;
          const chartWidth = Math.max(80, chartFrame.width * scale);
          const chartHeight = Math.max(64, chartFrame.height * scale);
          if (chartY + chartHeight <= doc.page.height - doc.page.margins.bottom + 1) {
            drawHydriaPdfChart(doc, chartFrame.chart, chartX, chartY, chartWidth, chartHeight);
          }
        });
      }

      if (pdfSettings.showHeadersFooters) {
        doc.fontSize(7).font("Helvetica").fillColor("#111827");
        doc.text("localhost:3001", doc.page.margins.left, doc.page.height - 24, { width: 160 });
        doc.text("1/1", doc.page.margins.left, doc.page.height - 24, { width: pageWidth, align: "right" });
      }
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
        applyXlsxTablesToHydriaModel(
          req.file.buffer,
          applyXlsxChartsToHydriaModel(
            req.file.buffer,
            applyXlsxStyleFormatsToHydriaModel(
              req.file.buffer,
              applyXlsxWorkbookViewToHydriaModel(req.file.buffer, workbookToHydriaModel(workbook))
            )
          )
        )
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
    const conditionalBuffer = applyHydriaConditionalFormatsToXlsxBuffer(validationBuffer, normalizedModel);
    const dynamicFormulaBuffer = applyHydriaDynamicFormulasToXlsxBuffer(conditionalBuffer, normalizedModel);
    const buffer = applyHydriaChartsToXlsxBuffer(dynamicFormulaBuffer, normalizedModel);

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
    const buffer = await buildSheetPdfBuffer(normalizedModel, targetSheetId, {
      displaySheet: req.body?.displaySheet,
      settings: req.body?.pdfSettings || req.body?.printSettings
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safePdfFilename(req.body?.filename)}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
