import { createHash, randomUUID } from "node:crypto";
import { HyperFormula } from "hyperformula";
import { AppError } from "../../utils/errors.js";

const ENGINE_TTL_MS = 30 * 60 * 1000;
const MAX_ENGINES = 50;
const engines = new Map();

function stableHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 20);
}

function normalizeWorkbook(model = {}) {
  const sheets =
    Array.isArray(model.sheets) && model.sheets.length
      ? model.sheets
      : [model];
  return sheets.map((sheet, index) => {
    const columns =
      Array.isArray(sheet.columns) && sheet.columns.length
        ? sheet.columns.map((value) => String(value ?? ""))
        : ["Column 1"];
    const rows = Array.isArray(sheet.rows)
      ? sheet.rows.map((row) =>
          Array.from({ length: columns.length }, (_, columnIndex) =>
            String(row?.[columnIndex] ?? "")
          )
        )
      : [];
    return {
      id: String(sheet.id || `sheet-${index + 1}`),
      name: String(sheet.name || `Sheet ${index + 1}`),
      matrix: [columns, ...rows]
    };
  });
}

function uniqueSheetNames(sheets = []) {
  const used = new Set();
  return sheets.map((sheet, index) => {
    const base = String(sheet.name || `Sheet ${index + 1}`)
      .replace(/[[\]*?:/\\]/g, " ")
      .trim()
      .slice(0, 31) || `Sheet ${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) {
      const tail = ` ${suffix}`;
      name = `${base.slice(0, Math.max(1, 31 - tail.length))}${tail}`;
      suffix += 1;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function buildEngine(sheets = [], requestedId = "") {
  const names = uniqueSheetNames(sheets);
  const sheetData = Object.fromEntries(
    sheets.map((sheet, index) => [names[index], sheet.matrix])
  );
  const instance = HyperFormula.buildFromSheets(sheetData, {
    licenseKey: "gpl-v3",
    leapYear1900: true,
    smartRounding: true,
    useArrayArithmetic: true,
    useColumnIndex: true
  });
  return {
    id: requestedId || randomUUID(),
    instance,
    sheets,
    names,
    structureHash: stableHash(
      sheets.map((sheet) => ({
        id: sheet.id,
        rows: sheet.matrix.length,
        columns: Math.max(0, ...sheet.matrix.map((row) => row.length))
      }))
    ),
    touchedAt: Date.now()
  };
}

function disposeOldEngines() {
  const cutoff = Date.now() - ENGINE_TTL_MS;
  for (const [id, cached] of engines.entries()) {
    if (cached.touchedAt < cutoff) {
      cached.instance.destroy();
      engines.delete(id);
    }
  }
  if (engines.size <= MAX_ENGINES) return;
  [...engines.values()]
    .sort((left, right) => left.touchedAt - right.touchedAt)
    .slice(0, engines.size - MAX_ENGINES)
    .forEach((cached) => {
      cached.instance.destroy();
      engines.delete(cached.id);
    });
}

function updateEngine(cached, sheets) {
  const structureHash = stableHash(
    sheets.map((sheet) => ({
      id: sheet.id,
      rows: sheet.matrix.length,
      columns: Math.max(0, ...sheet.matrix.map((row) => row.length))
    }))
  );
  if (structureHash !== cached.structureHash) return false;
  cached.instance.batch(() => {
    sheets.forEach((sheet, sheetIndex) => {
      const previous = cached.sheets[sheetIndex]?.matrix || [];
      sheet.matrix.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
          if (String(previous[rowIndex]?.[columnIndex] ?? "") === String(value ?? "")) {
            return;
          }
          cached.instance.setCellContents(
            { sheet: sheetIndex, row: rowIndex, col: columnIndex },
            [[value]]
          );
        });
      });
    });
  });
  cached.sheets = sheets;
  cached.touchedAt = Date.now();
  return true;
}

function serializeValue(value) {
  if (value && typeof value === "object" && typeof value.value === "string") {
    return value.value;
  }
  if (value instanceof Date) return value.toISOString();
  return value ?? "";
}

function serializeAddress(instance, address = {}) {
  const sheetId = Number(address.sheet ?? address.start?.sheet ?? 0);
  const sheetName = instance.getSheetName(sheetId);
  if (
    Number.isInteger(address.start?.row) &&
    Number.isInteger(address.end?.row)
  ) {
    return {
      sheet: sheetName,
      start: { row: address.start.row, column: address.start.col },
      end: { row: address.end.row, column: address.end.col }
    };
  }
  return {
    sheet: sheetName,
    row: Number(address.row || 0),
    column: Number(address.col || 0)
  };
}

function collectResults(cached) {
  const formulaValues = {};
  const errors = [];
  const dependencies = {};
  let formulaCount = 0;
  cached.sheets.forEach((sheet, sheetIndex) => {
    const sheetValues = {};
    sheet.matrix.forEach((row, rowIndex) => {
      row.forEach((_rawValue, columnIndex) => {
        const address = { sheet: sheetIndex, row: rowIndex, col: columnIndex };
        if (!cached.instance.doesCellHaveFormula(address)) return;
        formulaCount += 1;
        const key = `${rowIndex}:${columnIndex}`;
        const value = cached.instance.getCellValue(address);
        sheetValues[key] = serializeValue(value);
        if (value && typeof value === "object" && value.type) {
          errors.push({
            sheetId: sheet.id,
            rowIndex,
            columnIndex,
            type: value.type,
            value: value.value,
            message: value.message || ""
          });
        }
        dependencies[`${sheet.id}:${key}`] = {
          precedents: cached.instance
            .getCellPrecedents(address)
            .map((item) => serializeAddress(cached.instance, item)),
          dependents: cached.instance
            .getCellDependents(address)
            .map((item) => serializeAddress(cached.instance, item))
        };
      });
    });
    formulaValues[sheet.id] = sheetValues;
  });
  return { formulaValues, errors, dependencies, formulaCount };
}

export function calculateWorkbook({ model = {}, engineId = "" } = {}) {
  disposeOldEngines();
  const sheets = normalizeWorkbook(model);
  if (!sheets.length) throw new AppError("A workbook is required", 400);
  let cached = engineId ? engines.get(String(engineId)) : null;
  if (cached && !updateEngine(cached, sheets)) {
    cached.instance.destroy();
    engines.delete(cached.id);
    cached = null;
  }
  if (!cached) {
    cached = buildEngine(sheets, String(engineId || ""));
    engines.set(cached.id, cached);
  }
  cached.touchedAt = Date.now();
  return {
    engineId: cached.id,
    engine: "hyperformula",
    version: "3.3.0",
    ...collectResults(cached)
  };
}

export function formulaEngineCapabilities() {
  return {
    engine: "hyperformula",
    version: "3.3.0",
    incremental: true,
    circularReferenceDetection: true,
    dependencyGraph: true,
    supportedFunctionCount: HyperFormula.getRegisteredFunctionNames("enGB").length,
    license: "GPL-3.0-only"
  };
}
