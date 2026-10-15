import { Router } from "express";
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
  const text = String(value == null ? "" : value).slice(0, 10000);
  return /[,"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
router.post("/export", (req, res) => {
  const result = runFlow(req.body?.flow || {}, { includeAllOutputs: true });
  if (!result.success) {
    res.status(422).json({ success: false, errors: result.errors });
    return;
  }
  const output = result.outputs.find((item) => item.id === req.body?.outputId) || result.outputs[0];
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

export default router;
