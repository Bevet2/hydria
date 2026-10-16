import { Router } from "express";
import {
  FlowSourceError, checkFlowSourceToken,
  listFlowSqliteTables, readFlowSqliteTable
} from "../services/flow/flowSqliteSource.js";
import { listFlowPostgresTables, readFlowPostgresTable } from "../services/flow/flowPostgresSource.js";

const router = Router();
function protectedSource(handler) {
  return async (req, res, next) => {
    try {
      checkFlowSourceToken(req.get("x-hydria-flow-token"));
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true, ...await handler(req) });
    } catch (error) {
      if (error instanceof FlowSourceError) {
        res.status(error.status).json({ success: false, error: error.message });
      } else next(error);
    }
  };
}
router.get("/sqlite/tables", protectedSource(() => ({
  tables: listFlowSqliteTables()
})));
router.post("/sqlite/read", protectedSource((req) =>
  readFlowSqliteTable({ table: req.body?.table, limit: req.body?.limit ?? 1000 })
));
router.get("/postgres/tables", protectedSource(async () => ({
  tables: await listFlowPostgresTables()
})));
router.post("/postgres/read", protectedSource((req) =>
  readFlowPostgresTable({
    schema: req.body?.schema ?? "public",
    table: req.body?.table, limit: req.body?.limit ?? 1000
  })
));
export default router;
