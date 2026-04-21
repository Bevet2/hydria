import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
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

function normalizeCellText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
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

function worksheetToHydriaSheet(worksheet, sheetName = "Sheet", index = 0) {
  const range = worksheet?.["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    return {
      id: `sheet-${index + 1}`,
      name: sheetName || `Sheet ${index + 1}`,
      columns: [...DEFAULT_COLUMNS],
      rows: [["", "", ""]],
      columnWidths: {},
      rowHeights: {},
      merges: [],
      cellFormats: {}
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

  return {
    id: `sheet-${index + 1}`,
    name: sheetName || `Sheet ${index + 1}`,
    columns,
    rows,
    columnWidths,
    rowHeights,
    merges,
    cellFormats
  };
}

function workbookToHydriaModel(workbook) {
  const sheets = (workbook.SheetNames || []).map((sheetName, index) =>
    worksheetToHydriaSheet(workbook.Sheets[sheetName], sheetName, index)
  );
  const safeSheets = sheets.length
    ? sheets
    : [
        {
          id: "sheet-1",
          name: "Sheet 1",
          columns: [...DEFAULT_COLUMNS],
          rows: [["", "", ""]],
          columnWidths: {},
          rowHeights: {},
          merges: [],
          cellFormats: {}
        }
      ];

  return {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: safeSheets[0].id,
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
    cellFormats: normalizeHydriaCellFormats(sheet.cellFormats)
  };
}

function normalizeHydriaWorkbook(model = {}) {
  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeHydriaSheet(sheet, index))
    : [normalizeHydriaSheet(model, 0)];
  return {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: sheets.some((sheet) => sheet.id === model.activeSheetId) ? String(model.activeSheetId) : sheets[0].id,
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

function writeHydriaCellValue(worksheet, address, value = "", format = {}) {
  const normalizedFormat = normalizeHydriaCellFormat(format);
  const numberFormat = normalizedFormat.numberFormat || "";
  const text = normalizeCellText(value);
  if (text.startsWith("=") && text.length > 1) {
    worksheet[address] = {
      t: "n",
      f: text.slice(1),
      v: 0
    };
  } else if (numberFormat && text.trim() && Number.isFinite(Number(text.replace(",", ".")))) {
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

function hydriaSheetToWorksheet(sheet = {}) {
  const rows = [sheet.columns, ...sheet.rows];
  const rowCount = Math.max(1, rows.length);
  const columnCount = Math.max(1, sheet.columns.length);
  const worksheet = {};

  rows.forEach((row, rowIndex) => {
    Array.from({ length: columnCount }, (_, columnIndex) => normalizeCellText(row?.[columnIndex])).forEach(
      (value, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        writeHydriaCellValue(worksheet, address, value, sheet.cellFormats?.[`${rowIndex}:${columnIndex}`] || "");
      }
    );
  });

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowCount - 1, c: columnCount - 1 }
  });

  worksheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => {
    const pixelWidth = Number(sheet.columnWidths?.[String(columnIndex)]);
    return Number.isFinite(pixelWidth) && pixelWidth > 0 ? { wch: Math.max(1, Math.round((pixelWidth - 24) / 8)) } : {};
  });

  worksheet["!rows"] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const pixelHeight = Number(sheet.rowHeights?.[String(rowIndex)]);
    return Number.isFinite(pixelHeight) && pixelHeight > 0 ? { hpx: pixelHeight } : {};
  });

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
  return `<border>${BORDER_EDGES.map(edgeXml).join("")}<diagonal/></border>`;
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
    Object.values(sheet.cellFormats || {}).forEach((format) => {
      const normalized = normalizeHydriaCellFormat(format);
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
    let sheetXml = sheetEntry.getData().toString("utf8");
    Object.entries(sheet.cellFormats || {}).forEach(([key, format]) => {
      const normalized = normalizeHydriaCellFormat(format);
      if (isHydriaCellFormatEmpty(normalized)) {
        return;
      }
      const [rowIndexText, columnIndexText] = key.split(":");
      const rowIndex = Number(rowIndexText);
      const columnIndex = Number(columnIndexText);
      if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
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

function hydriaModelToWorkbook(model = {}) {
  const normalized = normalizeHydriaWorkbook(model);
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = {
    ...(workbook.Workbook || {}),
    CalcPr: {
      fullCalcOnLoad: true
    }
  };
  const usedNames = new Set();
  normalized.sheets.forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, hydriaSheetToWorksheet(sheet), uniqueSheetName(sheet.name, usedNames));
  });
  return workbook;
}

function safeDownloadFilename(value = "hydria-sheet.xlsx") {
  const name = String(value || "hydria-sheet.xlsx")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || "hydria-sheet.xlsx").toLowerCase().endsWith(".xlsx") ? name : `${name || "hydria-sheet"}.xlsx`;
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
      model: applyXlsxStyleFormatsToHydriaModel(req.file.buffer, workbookToHydriaModel(workbook))
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
      cellStyles: true
    });
    const buffer = applyHydriaStylesToXlsxBuffer(rawBuffer, normalizedModel);

    res.setHeader("Content-Type", XLSX_MIME_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadFilename(req.body?.filename)}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
