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

export default router;
