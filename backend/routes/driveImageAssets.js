// PhotoCraft / Hydria Drive images: private single-owner binary storage.
// Protected by the existing OS production access gate. NOT multi-user ACLs.
import { Router } from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import config from "../config/hydria.config.js";
import { db } from "../db/sqlite.js";
import { AppError } from "../utils/errors.js";

export const MAX_DRIVE_IMAGE_BYTES = 15 * 1024 * 1024;
const router = Router();
const dir = path.join(config.paths.dataDir, "drive-images");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DRIVE_IMAGE_BYTES, files: 1, parts: 2, fields: 1, fieldSize: 128 }
});
function schema() {
  db.exec(`CREATE TABLE IF NOT EXISTS drive_image_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
    size INTEGER NOT NULL CHECK (size > 0),
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
}
export function detectRasterFormat(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 16) return null;
  if (bytes.length >= 32 &&
      bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      bytes.toString("ascii",12,16) === "IHDR" &&
      bytes.subarray(-8,-4).toString("ascii") === "IEND") {
    return { mime: "image/png", extension: ".png" };
  }
  if (bytes.length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    return { mime: "image/jpeg", extension: ".jpg" };
  }
  if (bytes.length >= 20 && bytes.toString("ascii",0,4) === "RIFF" &&
      bytes.toString("ascii",8,12) === "WEBP" &&
      bytes.readUInt32LE(4) === bytes.length - 8) {
    return { mime: "image/webp", extension: ".webp" };
  }
  return null;
}
export function safeImageFilename(raw, ext) {
  const cleaned = String(raw || "image")
    .replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, "_")
    .trim().slice(0,120).replace(/\.(png|jpe?g|webp)$/i, "");
  return (cleaned && !/^\.+$/.test(cleaned) ? cleaned : "image") + ext;
}
function uploadImage(req, res, next) {
  upload.single("file")(req,res,(err)=>{
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "Image exceeds 15 MiB" : "Invalid image upload",
        err.code === "LIMIT_FILE_SIZE" ? 413 : 400));
    }
    return err ? next(err) : next();
  });
}
router.post("/", uploadImage, async (req,res,next)=>{
  try {
    schema();
    const bytes = req.file?.buffer;
    const type = detectRasterFormat(bytes);
    if (!type) throw new AppError("Unsupported or invalid image. Use PNG, JPEG or WebP", 400);
    const id = randomUUID();
    const filename = safeImageFilename(req.file.originalname, type.extension);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(dir,{recursive:true,mode:0o700});
    const absolute = path.join(dir,id+type.extension);
    await writeFile(absolute,bytes,{flag:"wx",mode:0o600});
    try {
      db.prepare("INSERT INTO drive_image_assets(id,filename,mime,size,sha256,created_at) VALUES(?,?,?,?,?,?)")
        .run(id,filename,type.mime,bytes.length,sha256,new Date().toISOString());
    } catch (error) { await unlink(absolute).catch(()=>{}); throw error; }
    res.setHeader("Cache-Control","private, no-store");
    res.status(201).json({ id, filename, mime: type.mime, size:bytes.length, sha256 });
  } catch(error) { next(error); }
});
router.get("/",(_req,res,next)=>{
  try {
    schema();
    res.setHeader("Cache-Control","private, no-store");
    res.json({items:db.prepare(
      "SELECT id,filename,mime,size,sha256,created_at FROM drive_image_assets ORDER BY created_at DESC,id DESC LIMIT 500"
    ).all()});
  } catch(error) { next(error); }
});
async function serve(req,res,next,disposition) {
  try {
    schema();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))
      throw new AppError("Invalid image id",400);
    const item=db.prepare("SELECT * FROM drive_image_assets WHERE id=?").get(req.params.id);
    if (!item) throw new AppError("Image not found",404);
    const ext={ "image/png":".png", "image/jpeg":".jpg", "image/webp":".webp" }[item.mime];
    if (!ext) throw new AppError("Unrecognized image type",500);
    const bytes=await readFile(path.join(dir,item.id+ext));
    if(bytes.length!==item.size || createHash("sha256").update(bytes).digest("hex")!==item.sha256)
      throw new AppError("Image integrity check failed",500);
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");
    if (disposition === "attachment") res.attachment(item.filename);
    else res.setHeader("Content-Disposition","inline");
    res.type(item.mime);
    res.send(bytes);
  } catch(error) { next(error); }
}
router.get("/:id/preview",(req,res,next)=>serve(req,res,next,"inline"));
router.get("/:id/download",(req,res,next)=>serve(req,res,next,"attachment"));
export default router;
