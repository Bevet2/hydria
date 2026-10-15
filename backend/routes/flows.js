import { Router } from "express";
import XLSX from "xlsx";
import { FLOW_NODE_CATALOG, runFlow, validateFlow } from "../services/flow/flowEngine.js";
const router = Router();

router.get("/catalog", (req, res) => {
  res.json({ success: true, nodes: FLOW_NODE_CATALOG });
});
router.post("/validate", (req, res) => {
  const result = validateFlow(req.body?.flow || {});
  res.json({ success: true, valid: result.valid, errors: result.errors, order: result.order });
});
router.post("/run", (req, res) => {
  const result = runFlow(req.body?.flow || {}, { sampleLimit: req.body?.sampleLimit });
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

export default router;
