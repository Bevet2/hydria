#!/usr/bin/env node
// Run in the backend container or from a local checkout with npm ci installed.
// Restore creates a NEW directory only; stop Hydria before switching volumes.
import config from "../config/hydria.config.js";
import {
  backupHydriaData, verifyHydriaBackup, restoreHydriaBackup
} from "../services/backup/osBackup.js";

const [command, first, second] = process.argv.slice(2);
try {
  let result;
  if (command === "backup" && first && !second) {
    result = await backupHydriaData(config.paths.dataDir, first);
  } else if(command === "verify" && first && !second) {
    result = await verifyHydriaBackup(first);
  } else if(command === "restore" && first && second) {
    result = await restoreHydriaBackup(first, second);
  } else {
    console.error("Usage:\n  node backend/scripts/osBackup.mjs backup /path/to/new-backup-directory\n  node backend/scripts/osBackup.mjs verify /path/to/backup-directory\n  node backend/scripts/osBackup.mjs restore /path/to/backup-directory /path/to/NEW-restored-data-directory");
    process.exitCode = 2;
  }
  if(result) console.log(JSON.stringify({success:true,action:command,...result},null,2));
} catch(error){
  console.error("Backup operation failed:",String(error?.message || error));
  process.exitCode=1;
}
