// Recoverable backups for Hydria OS's single-node data directory.
// Uses better-sqlite3's online backup API (WAL-safe) and SHA-256 manifest.
// No destructive restore operation: the restore destination must be empty.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promises as fsp } from "node:fs";
import Database from "better-sqlite3";
import { inspectDriveSnapshot } from "./driveAssetIntegrity.js";

const DATABASE = "hydria.sqlite";
const MANIFEST = "backup-manifest.json";
const BACKUP_FORMAT = "hydria-os-backup-v1";

function invalid(message) { throw new Error("Hydria OS backup: " + message); }
function within(directory, target) {
  const relative = path.relative(directory, target);
  return relative === "" || (!relative.startsWith(".."+path.sep) &&
    relative !== ".." && !path.isAbsolute(relative));
}
function requireSafePath(relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\\") ||
      path.posix.isAbsolute(relative) ||
      relative.split("/").some((component) => !component || component === "." || component === "..")) {
    invalid("Unsafe manifest file path.");
  }
  return relative;
}
async function sha256(file) {
  const hash=crypto.createHash("sha256");
  const stream=fs.createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}
async function collectFiles(root) {
  const entries=[];
  async function walk(dir, relative="") {
    for(const item of await fsp.readdir(dir,{withFileTypes:true})){
      if (item.isSymbolicLink()) invalid("Symbolic links are not supported in backups.");
      const rel=relative ? relative+"/"+item.name : item.name;
      const file=path.join(dir,item.name);
      if (item.isDirectory()) await walk(file,rel);
      else if(item.isFile()){
        const stat=await fsp.stat(file);
        entries.push({path:requireSafePath(rel),size:stat.size,sha256:await sha256(file)});
      } else invalid("Unsupported file type in data directory.");
    }
  }
  await walk(root);
  return entries.sort((a,b)=>a.path.localeCompare(b.path));
}
async function copyDataTree(source, dest, relative="") {
  for (const item of await fsp.readdir(path.join(source,relative),{withFileTypes:true})) {
    if (item.isSymbolicLink()) invalid("Symbolic links cannot be backed up.");
    const rel=relative ? relative+"/"+item.name : item.name;
    // A SQLite WAL database must be copied through online backup, not cp.
    // Upload scratch files can be regenerated; skip them.
    if (rel === DATABASE || rel === DATABASE+"-wal" || rel === DATABASE+"-shm" ||
        rel === "uploads-temp") continue;
    const from=path.join(source,rel),to=path.join(dest,rel);
    if (item.isDirectory()) {
      await fsp.mkdir(to,{recursive:true,mode:0o700});
      await copyDataTree(source,dest,rel);
    } else if(item.isFile()){
      await fsp.copyFile(from,to);
      await fsp.chmod(to,0o600);
    } else invalid("Unsupported file type in persistent data.");
  }
}
export async function backupHydriaData(sourceDir, outputDir) {
  const source=path.resolve(sourceDir),out=path.resolve(outputDir);
  if (!fs.existsSync(path.join(source,DATABASE))) invalid("SQLite database does not exist.");
  if (within(source,out) || within(out,source)) invalid("Source and backup directories must be separate.");
  if (fs.existsSync(out)) invalid("Backup destination already exists; refusing overwrite.");
  const staging=out+".partial-"+crypto.randomUUID();
  await fsp.mkdir(path.dirname(out),{recursive:true});
  await fsp.mkdir(staging,{recursive:false,mode:0o700});
  try {
    const db=new Database(path.join(source,DATABASE),{readonly:true,fileMustExist:true});
    try {
      await db.backup(path.join(staging,DATABASE));
    } finally {db.close();}
    // The live source may use WAL mode. Normalize the *independent backup*
    // into DELETE journal mode, so a read-only integrity check cannot create
    // -wal/-shm sidecars that weren't listed in the checksum manifest.
    const backedUpDb = new Database(path.join(staging,DATABASE));
    try {
      backedUpDb.pragma("journal_mode = DELETE");
      if (backedUpDb.pragma("integrity_check",{simple:true}) !== "ok") {
        invalid("SQLite snapshot integrity check failed.");
      }
    } finally { backedUpDb.close(); }
    await copyDataTree(source,staging);
    // Copying a SQLite snapshot and filesystem blobs is not a distributed
    // transaction. Abort instead of shipping an internally inconsistent Drive.
    await inspectDriveSnapshot(path.join(staging,DATABASE),staging);
    const entries=await collectFiles(staging);
    const manifest={format:BACKUP_FORMAT,createdAt:new Date().toISOString(),files:entries};
    await fsp.writeFile(path.join(staging,MANIFEST),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
    await fsp.rename(staging,out);
    return {backupDir:out,fileCount:entries.length,totalBytes:entries.reduce((a,b)=>a+b.size,0)};
  } catch(error) {
    await fsp.rm(staging,{recursive:true,force:true});
    throw error;
  }
}
export async function verifyHydriaBackup(backupDir) {
  const dir=path.resolve(backupDir);
  let manifest;
  try { manifest=JSON.parse(await fsp.readFile(path.join(dir,MANIFEST),"utf8")); }
  catch {invalid("Cannot read backup manifest.");}
  if (manifest?.format !== BACKUP_FORMAT || !Array.isArray(manifest.files) ||
      manifest.files.length > 100_000) invalid("Unsupported backup manifest.");
  const seen=new Set();
  for(const entry of manifest.files){
    const rel=requireSafePath(entry?.path);
    if (seen.has(rel)) invalid("Duplicate manifest path.");
    seen.add(rel);
    const target=path.resolve(dir,rel);
    if(!within(dir,target) || (await fsp.lstat(target)).isSymbolicLink()) {
      invalid("Backup path escapes source directory.");
    }
    const stat=await fsp.stat(target);
    if (!stat.isFile() || stat.size !== entry.size || await sha256(target) !== entry.sha256) {
      invalid("Backup checksum mismatch: "+rel);
    }
  }
  if(!seen.has(DATABASE)) invalid("Missing SQLite database snapshot.");
  const actual=await collectFiles(dir);
  const paths=actual.filter(x=>x.path!==MANIFEST).map(x=>x.path);
  if (paths.length !== seen.size || paths.some(x=>!seen.has(x))) invalid("Unexpected backup contents.");
  const db=new Database(path.join(dir,DATABASE),{readonly:true,fileMustExist:true});
  try {
    const integrity=db.pragma("integrity_check",{simple:true});
    if (integrity !== "ok") invalid("SQLite backup integrity check failed.");
  } finally {db.close();}
  // Manifest checks alone cannot detect a binary omitted from a backup when
  // its catalog record was copied correctly. Cross-check all Drive versions.
  const drive=await inspectDriveSnapshot(path.join(dir,DATABASE),dir);
  return {
    drive,
    createdAt:manifest.createdAt,
    files:manifest.files.length,
    bytes:manifest.files.reduce((a,b)=>a+b.size,0)
  };
}
export async function restoreHydriaBackup(backupDir, targetDir) {
  const source=path.resolve(backupDir),target=path.resolve(targetDir);
  if(within(source,target) || within(target,source)) invalid("Restore target overlaps backup.");
  const verification=await verifyHydriaBackup(source);
  if(fs.existsSync(target)) invalid("Restore target must not exist; never overwrite live data.");
  const tmp=target+".partial-"+crypto.randomUUID();
  await fsp.mkdir(path.dirname(target),{recursive:true});
  await fsp.mkdir(tmp,{recursive:false,mode:0o700});
  try {
    const manifest=JSON.parse(await fsp.readFile(path.join(source,MANIFEST),"utf8"));
    for(const entry of manifest.files){
      const rel=requireSafePath(entry.path);
      const src=path.join(source,rel),dst=path.join(tmp,rel);
      await fsp.mkdir(path.dirname(dst),{recursive:true,mode:0o700});
      await fsp.copyFile(src,dst);
      await fsp.chmod(dst,0o600);
      if(await sha256(dst)!==entry.sha256)invalid("Restored file verification failed.");
    }
    await fsp.rename(tmp,target);
    return {restoredDir:target,...verification};
  } catch(error){
    await fsp.rm(tmp,{recursive:true,force:true});
    throw error;
  }
}
