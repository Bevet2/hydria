import { Router } from "express";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { db } from "../db/sqlite.js";
import { FLOW_NODE_CATALOG, runFlow, validateFlow } from "../services/flow/flowEngine.js";
const router = Router();

router.get("/catalog", (req, res) => {
  res.json({ success: true, nodes: FLOW_NODE_CATALOG });
});
router.post("/validate", (req, res) => {
  const result = validateFlow(req.body?.flow || {});
  res.json({ success: true, valid: result.valid, errors: result.errors, order: result.order });
});
const FLOW_HISTORY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Database schema is initialized after route imports during server startup.
// Prepare statements lazily when the run endpoint is called.
function recordFlowRun(key, timestamp, result, durationMs) {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO flow_run_history
        (flow_key, started_at, status, duration_ms, step_count, output_rows, error_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(key, timestamp, result.success ? "success" : "failed", durationMs,
      result.steps.length, result.outputs.reduce((total, item) => total + item.rows, 0),
      result.errors.length
    );
    db.prepare(`
      DELETE FROM flow_run_history
      WHERE flow_key = ? AND id NOT IN (
        SELECT id FROM flow_run_history WHERE flow_key = ? ORDER BY id DESC LIMIT 50
      )
    `).run(key, key);
  })();
}

router.get("/history/:flowKey", (req, res) => {
  const flowKey = String(req.params.flowKey || "");
  if (!FLOW_HISTORY_KEY.test(flowKey)) {
    return res.status(400).json({ success: false, error: "Invalid flow history key." });
  }
  const runs = db.prepare(`
    SELECT id, started_at AS startedAt, status, duration_ms AS durationMs,
           step_count AS stepCount, output_rows AS outputRows, error_count AS errorCount
    FROM flow_run_history WHERE flow_key = ? ORDER BY id DESC LIMIT 50
  `).all(flowKey);
  res.json({ success: true, runs });
});

router.post("/run", (req, res) => {
  const flowKey = req.body?.historyId == null ? "" : String(req.body.historyId);
  if (flowKey && !FLOW_HISTORY_KEY.test(flowKey)) {
    return res.status(400).json({ success: false, errors: ["Invalid flow history key."] });
  }
  const start = Date.now();
  const startedAt = new Date(start).toISOString();
  const result = runFlow(req.body?.flow || {}, { sampleLimit: req.body?.sampleLimit });
  if (flowKey) recordFlowRun(flowKey, startedAt, result, Date.now() - start);
  res.status(result.success ? 200 : 422).json(result);
});

function csvCell(value) {
  const raw = String(value == null ? "" : value).slice(0, 10000);
  // Prevent spreadsheet formula execution when exported CSV is opened in Excel.
  const text = /^[=+@\-\t\r]/.test(raw) ? "\x27" + raw : raw;
  return /[,"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
router.post("/export", (req, res) => {
  const result = runFlow(req.body?.flow || {}, { includeAllOutputs: true });
  if (!result.success) {
    res.status(422).json({ success: false, errors: result.errors });
    return;
  }
  const outputId = String(req.body?.outputId || "");
  const output = outputId ? result.outputs.find((item) => item.id === outputId) : result.outputs[0];
  if (!output) {
    res.status(422).json({ success: false, errors: ["Connect at least one Table output node."] });
    return;
  }
  const data = output.data || [];
  const columns = [...new Set(data.flatMap((row) => Object.keys(row)))].slice(0, 100);
  const rows = [columns.map(csvCell).join(","), ...data.map((row) => columns.map((key) => csvCell(row[key])).join(","))];
  const csv = rows.join("\r\n");
  if (csv.length > 25_000_000) {
    res.status(413).json({ success: false, errors: ["Output exceeds the 25 MB export limit."] });
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="hydria-flow-output.csv"');
  res.send(csv);
});

// Export the complete selected output, not the small browser preview.
// SheetJS serializes untrusted strings as string cells (never Excel formulas).
router.post("/export-xlsx", (req, res, next) => {
  try {
    const result = runFlow(req.body?.flow || {}, { includeAllOutputs: true });
    if (!result.success) return res.status(422).json({ success: false, errors: result.errors });
    const outputId = String(req.body?.outputId || "");
    const output = outputId
      ? result.outputs.find((item) => item.id === outputId)
      : result.outputs[0];
    if (!output) {
      return res.status(422).json({ success: false, errors: ["Select a valid Table output node."] });
    }
    const data = output.data || [];
    const columnSet = new Set();
    for (const row of data) {
      for (const key of Object.keys(row)) columnSet.add(key);
      if (columnSet.size > 100) {
        return res.status(413).json({ success: false, errors: ["XLSX output exceeds 100 columns."] });
      }
    }
    const columns = [...columnSet];
    if (columns.length * Math.max(1, data.length) > 250000) {
      return res.status(413).json({ success: false, errors: ["XLSX output exceeds 250,000 cells."] });
    }
    const table = columns.length
      ? [columns, ...data.map((row) => columns.map((column) => row[column] ?? null))]
      : [["No rows"]];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(table);
    // Never allow input text resembling a formula to become an executable formula.
    for (const address of Object.keys(worksheet)) {
      if (address.startsWith("!")) continue;
      const cell = worksheet[address];
      if (typeof cell.v === "string") {
        cell.t = "s";
        delete cell.f;
      }
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, "Flow Result");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    if (bytes.length > 25_000_000) {
      return res.status(413).json({ success: false, errors: ["XLSX output exceeds 25 MB."] });
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="hydria-flow-output.xlsx"');
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});

// Export all outputs as a native multi-tab Excel workbook.
router.post("/export-workbook", (req, res, next) => {
  try {
    const result = runFlow(req.body?.flow || {}, { includeAllOutputs: true });
    if (!result.success) return res.status(422).json({ success: false, errors: result.errors });
    if (!result.outputs.length) return res.status(422).json({ success: false, errors: ["No table outputs to export."] });
    const workbook = XLSX.utils.book_new();
    let totalCells = 0;
    for (const [index, output] of result.outputs.entries()) {
      const data = output.data || [];
      const columns = [...new Set(data.flatMap((row) => Object.keys(row)))];
      if (columns.length > 100) return res.status(413).json({ success: false, errors: ["An output exceeds 100 columns."] });
      totalCells += Math.max(1, data.length + 1) * Math.max(1, columns.length);
      if (totalCells > 250000) return res.status(413).json({ success: false, errors: ["Workbook exceeds 250,000 cells."] });
      const table = columns.length
        ? [columns, ...data.map((row) => columns.map((name) => row[name] ?? null))]
        : [["No rows"]];
      const sheet = XLSX.utils.aoa_to_sheet(table);
      for (const address of Object.keys(sheet)) {
        if (address.startsWith("!")) continue;
        const cell = sheet[address];
        if (typeof cell.v === "string") {
          cell.t = "s";
          delete cell.f;
        }
      }
      XLSX.utils.book_append_sheet(workbook, sheet, "Output " + (index + 1));
    }
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    if (bytes.length > 25_000_000) {
      return res.status(413).json({ success: false, errors: ["Workbook exceeds 25 MB."] });
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="hydria-flow-all-outputs.xlsx"');
    res.send(bytes);
  } catch (error) { next(error); }
});

// Export every table output in a single portable archive.
router.post("/export-bundle", (req, res, next) => {
  try {
    const result = runFlow(req.body?.flow || {}, { includeAllOutputs: true });
    if (!result.success) return res.status(422).json({ success: false, errors: result.errors });
    if (!result.outputs.length) return res.status(422).json({ success: false, errors: ["No table outputs to export."] });
    const zip = new AdmZip();
    const manifest = [];
    let totalBytes = 0;
    for (const [index, output] of result.outputs.entries()) {
      const data = output.data || [];
      const columns = [...new Set(data.flatMap((row) => Object.keys(row)))];
      if (columns.length > 100) return res.status(413).json({ success: false, errors: ["An output exceeds 100 columns."] });
      const csv = [columns.map(csvCell).join(","), ...data.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n");
      const bytes = Buffer.from(csv, "utf8");
      totalBytes += bytes.length;
      if (totalBytes > 25_000_000) return res.status(413).json({ success: false, errors: ["Outputs exceed the 25 MB bundle limit."] });
      const filename = `output-${String(index + 1).padStart(2, "0")}.csv`;
      zip.addFile(filename, bytes);
      manifest.push({ id: output.id, filename, rows: data.length, columns });
    }
    zip.addFile("manifest.json", Buffer.from(JSON.stringify({ version: 1, outputs: manifest }, null, 2)));
    const bytes = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="hydria-flow-outputs.zip"');
    res.send(bytes);
  } catch (error) { next(error); }
});

export default router;
