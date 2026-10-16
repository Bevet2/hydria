import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  backupHydriaData, verifyHydriaBackup, restoreHydriaBackup
} from "../services/backup/osBackup.js";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"hydria-os-backup-ci-"));
const data=path.join(root,"data"),saved=path.join(root,"archives","backup1");
const restored=path.join(root,"restored");
fs.mkdirSync(path.join(data,"generated"),{recursive:true});
fs.writeFileSync(path.join(data,"generated","note.txt"),"Do not lose this document");
fs.mkdirSync(path.join(data,"api-catalog"),{recursive:true});
fs.writeFileSync(path.join(data,"api-catalog","custom-apis.json"),'{"list":[]}');
fs.mkdirSync(path.join(data,"uploads-temp"),{recursive:true});
fs.writeFileSync(path.join(data,"uploads-temp","scratch.txt"),"temporary file");
const liveDb=new Database(path.join(data,"hydria.sqlite"));
try {
  liveDb.pragma("journal_mode = WAL");
  liveDb.exec("CREATE TABLE docs(id INTEGER PRIMARY KEY, text TEXT)");
  liveDb.prepare("INSERT INTO docs(text) VALUES (?)").run("persistent document");
  assert.equal(fs.existsSync(path.join(data,"hydria.sqlite-wal")),true);
  const snapshot=await backupHydriaData(data,saved);
  assert.ok(snapshot.fileCount >= 3);
  assert.equal(snapshot.backupDir,saved);
  assert.ok(fs.existsSync(path.join(saved,"backup-manifest.json")));
  assert.equal(fs.existsSync(path.join(saved,"hydria.sqlite-wal")),false);
  assert.equal(fs.existsSync(path.join(saved,"uploads-temp","scratch.txt")),false);
  assert.equal((await verifyHydriaBackup(saved)).files,snapshot.fileCount);
  await assert.rejects(backupHydriaData(data,saved),/already exists/);
  await assert.rejects(backupHydriaData(data,path.join(data,"backup")),/separate/);
  const result=await restoreHydriaBackup(saved,restored);
  assert.equal(result.restoredDir,restored);
  assert.equal(fs.readFileSync(path.join(restored,"generated","note.txt"),"utf8"),
    "Do not lose this document");
  assert.equal(fs.existsSync(path.join(restored,"uploads-temp","scratch.txt")),false);
  const freshDb=new Database(path.join(restored,"hydria.sqlite"),{readonly:true});
  try {
    assert.equal(freshDb.prepare("SELECT text FROM docs").get().text,"persistent document");
    assert.equal(freshDb.pragma("integrity_check",{simple:true}),"ok");
  } finally { freshDb.close();}
  await assert.rejects(restoreHydriaBackup(saved,restored),/must not exist/);

  fs.writeFileSync(path.join(saved,"generated","note.txt"),"tampered");
  await assert.rejects(verifyHydriaBackup(saved),/checksum mismatch/);
  await assert.rejects(restoreHydriaBackup(saved,path.join(root,"badrestore")),/checksum mismatch/);
  assert.equal(fs.existsSync(path.join(root,"badrestore")),false);
  fs.writeFileSync(path.join(saved,"generated","note.txt"),"Do not lose this document");
  assert.equal((await verifyHydriaBackup(saved)).files,snapshot.fileCount);
  fs.symlinkSync(data,path.join(data,"unsafe-link"));
  await assert.rejects(backupHydriaData(data,path.join(root,"archives","badbackup")),
    /Symbolic links/);
  assert.equal(fs.existsSync(path.join(root,"archives","badbackup")),false);
  console.log("Hydria OS WAL backup, checksums, tamper detection and restore gate passed.");
} finally {
  liveDb.close();
  fs.rmSync(root,{recursive:true,force:true});
}
