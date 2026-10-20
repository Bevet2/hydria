// Hydria Drive PDF asset store — private single-owner pilot only.
// All routes are protected by the OS production access gate in server.js.
// This endpoint intentionally does not claim per-user ACLs or PDF editor write-back.
import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/sqlite.js";
import config from "../config/hydria.config.js";
import { AppError } from "../utils/errors.js";

export const MAX_DRIVE_PDF_BYTES = 20 * 1024 * 1024;
const assetDir = path.join(config.paths.dataDir, "drive-pdf-assets");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DRIVE_PDF_BYTES, files: 1, fields: 1, fieldSize: 256, parts: 2 }
});
const router = Router();

function ensureSchema() {
  db.exec(`CREATE TABLE IF NOT EXISTS drive_pdf_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size > 0),
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
}
export function safePdfName(input) {
  const cleaned = String(input || "document.pdf")
    .replace(/[\\/\x00-\x1f\x7f]/g, "_")
    .replace(/[<>:"|?*]/g, "_")
    .trim().slice(0, 150);
  const named = cleaned && !/^\.+$/.test(cleaned) ? cleaned : "document.pdf";
  return named.toLowerCase().endsWith(".pdf") ? named : named + ".pdf";
}
export function pdfBytesValid(bytes) {
  return Buffer.isBuffer(bytes) &&
    bytes.length >= 14 &&
    bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    /^\d\.\d/.test(bytes.subarray(5, 8).toString("ascii")) &&
    bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1").includes("%%EOF");
}
function handleUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(error.code === "LIMIT_FILE_SIZE"
        ? "PDF exceeds the 20 MiB limit"
        : "Invalid PDF upload", error.code === "LIMIT_FILE_SIZE" ? 413 : 400));
    }
    return error ? next(error) : next();
  });
}

router.post("/", handleUpload, async (req, res, next) => {
  try {
    ensureSchema();
    const bytes = req.file?.buffer;
    if (!pdfBytesValid(bytes)) throw new AppError("Invalid PDF file", 400);
    const id = randomUUID();
    const filename = safePdfName(req.file?.originalname || req.body?.filename);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    await mkdir(assetDir, { recursive: true, mode: 0o700 });
    const filePath = path.join(assetDir, id + ".pdf");
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
    try {
      db.prepare("INSERT INTO drive_pdf_assets(id,filename,size,sha256,created_at) VALUES(?,?,?,?,?)")
        .run(id, filename, bytes.length, sha256, new Date().toISOString());
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({ id, filename, size: bytes.length, sha256 });
  } catch (error) { next(error); }
});

router.get("/", (_req, res, next) => {
  try {
    ensureSchema();
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: db.prepare(
      "SELECT id,filename,size,sha256,created_at FROM drive_pdf_assets ORDER BY created_at DESC,id DESC LIMIT 500"
    ).all() });
  } catch (error) { next(error); }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    ensureSchema();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[a-f0-9]{12}$/i.test(req.params.id)) {
      throw new AppError("Invalid PDF id", 400);
    }
    const item = db.prepare("SELECT * FROM drive_pdf_assets WHERE id = ?").get(req.params.id);
    if (!item) throw new AppError("PDF not found", 404);
    const bytes = await readFile(path.join(assetDir, item.id + ".pdf"));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== item.sha256 || bytes.length !== item.size) {
      throw new AppError("PDF integrity check failed", 500);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.attachment(item.filename);
    res.type("application/pdf");
    res.send(bytes);
  } catch (error) { next(error); }
});

export default router;
