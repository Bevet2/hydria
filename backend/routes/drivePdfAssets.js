import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/sqlite.js";
import config from "../config/hydria.config.js";
import { AppError } from "../utils/errors.js";

const router = Router();
const maxPdfBytes = 20 * 1024 * 1024;
const assetDir = path.join(path.dirname(config.paths.databaseFile), "drive-pdf-assets");
const ensureSchema = () => db.exec(`CREATE TABLE IF NOT EXISTS drive_pdf_assets (
 id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL,
 sha256 TEXT NOT NULL, created_at TEXT NOT NULL
)`);
function safeName(name) {
  const cleaned = String(name || "document.pdf").replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 150);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
}
function pdfValid(bytes) {
  return bytes.length >= 8 && bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1").includes("%%EOF");
}
router.post("/", async (req, res, next) => {
  try {
    ensureSchema();
    const base64 = req.body?.base64;
    if (typeof base64 !== "string" || base64.length > Math.ceil(maxPdfBytes * 4 / 3) + 16 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new AppError("Invalid PDF payload", 400);
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > maxPdfBytes || !pdfValid(bytes)) throw new AppError("Invalid PDF file", 400);
    const id = randomUUID(), filename = safeName(req.body?.filename);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(assetDir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(assetDir, id + ".pdf"), bytes, { flag: "wx", mode: 0o600 });
    try {
      db.prepare("INSERT INTO drive_pdf_assets(id,filename,size,sha256,created_at) VALUES(?,?,?,?,?)")
        .run(id, filename, bytes.length, sha256, new Date().toISOString());
    } catch (error) {
      await unlink(path.join(assetDir, id + ".pdf")).catch(() => {});
      throw error;
    }
    res.status(201).json({ id, filename, size: bytes.length, sha256 });
  } catch (error) { next(error); }
});
router.get("/", (_req, res, next) => {
  try {
    ensureSchema();
    res.json({ items: db.prepare("SELECT id,filename,size,sha256,created_at FROM drive_pdf_assets ORDER BY created_at DESC LIMIT 500").all() });
  } catch (error) { next(error); }
});
router.get("/:id/download", async (req, res, next) => {
  try {
    ensureSchema();
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) throw new AppError("Invalid asset id", 400);
    const item = db.prepare("SELECT * FROM drive_pdf_assets WHERE id = ?").get(req.params.id);
    if (!item) throw new AppError("PDF not found", 404);
    const bytes = await readFile(path.join(assetDir, item.id + ".pdf"));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) {
      throw new AppError("PDF integrity check failed", 500);
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(bytes);
  } catch (error) { next(error); }
});
export default router;
