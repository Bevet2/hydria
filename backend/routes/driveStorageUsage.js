import { Router } from "express";
import { db } from "../db/sqlite.js";
import { calculateNativeDriveUsage } from "../services/driveStorageUsage.js";
const router=Router();
router.get("/", (_req,res,next) => {
  try {
    res.setHeader("Cache-Control","private, no-store");
    res.json(calculateNativeDriveUsage(db));
  } catch(error) { next(error); }
});
export default router;
