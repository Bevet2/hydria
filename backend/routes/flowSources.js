import { Router } from "express";
import {
  FlowSourceError, checkFlowSourceToken,
  listFlowSqliteTables, readFlowSqliteTable
} from "../services/flow/flowSqliteSource.js";

const router = Router();
function protectedSource(handler) {
  return (req, res, next) => {
    try {
      checkFlowSourceToken(req.get("x-hydria-flow-token"));
      res.json({ success: true, ...handler(req) });
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
export default router;
