// SQLite-indexed native Drive payload usage for the private owner pilot.
// Sizes represent recorded file bytes (including historic revisions and trash),
// NOT allocated filesystem blocks, backups, orphan files or vendor runtimes.
const SOURCE = Object.freeze([
  {key:"pdf",label:"PDF",assets:"drive_pdf_assets",versions:"drive_pdf_versions"},
  {key:"image",label:"Images",assets:"drive_image_assets",versions:"drive_image_versions"},
  {key:"design",label:"FigCraft",assets:"drive_design_assets",versions:"drive_design_versions"},
  {key:"photo-project",label:"PhotoCraft",assets:"drive_photo_project_assets",versions:"drive_photo_project_versions"}
]);
function exists(database,table) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}
const toSafeNumber = number => {
  const converted = Number(number || 0);
  if (!Number.isSafeInteger(converted) || converted < 0) {
    throw Error("Native Drive usage exceeds safe integer precision");
  }
  return converted;
};
function emptyStats(source) {
  return {key:source.key,label:source.label,activeFiles:0,trashedFiles:0,
    versions:0,activeBytes:0,trashedBytes:0,historicalBytes:0,storedBytes:0,
    legacyUnversionedFiles:0};
}
export function calculateNativeDriveUsage(database) {
  const families = SOURCE.map(source => {
    if (!exists(database,source.assets)) return emptyStats(source);
    const table = source.assets; // Fixed from SOURCE, never request data.
    const cols = new Set(database.prepare("PRAGMA table_info("+table+")").all().map(x=>x.name));
    if (!cols.has("size")) throw Error("Invalid native Drive asset schema");
    // Older databases are counted as active until their idempotent migration.
    const condition = cols.has("deleted_at") ? "deleted_at IS NULL" : "1=1";
    const active = database.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes FROM "+table+" WHERE "+condition).get();
    const trash = cols.has("deleted_at")
      ? database.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes FROM "+table+" WHERE deleted_at IS NOT NULL").get()
      : {count:0,bytes:0};
    const nowBytes=toSafeNumber(active.bytes)+toSafeNumber(trash.bytes);
    let storedBytes=nowBytes, versions=toSafeNumber(active.count)+toSafeNumber(trash.count);
    let legacyUnversionedFiles=versions;
    if (exists(database,source.versions)) {
      const versionTable=source.versions;
      const versionsRow=database.prepare(
        "SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes FROM "+versionTable
      ).get();
      // Count legacy files not yet backfilled to the revisions table.
      const legacy=database.prepare(
        "SELECT COUNT(*) AS count,COALESCE(SUM(a.size),0) AS bytes FROM "+table+" a " +
        "WHERE NOT EXISTS (SELECT 1 FROM "+versionTable+" v WHERE v.asset_id=a.id)"
      ).get();
      legacyUnversionedFiles=toSafeNumber(legacy.count);
      storedBytes=toSafeNumber(versionsRow.bytes)+toSafeNumber(legacy.bytes);
      versions=toSafeNumber(versionsRow.count)+legacyUnversionedFiles;
    }
    return {
      key:source.key,label:source.label,
      activeFiles:toSafeNumber(active.count),trashedFiles:toSafeNumber(trash.count),
      versions,activeBytes:toSafeNumber(active.bytes),trashedBytes:toSafeNumber(trash.bytes),
      historicalBytes:Math.max(0,storedBytes-nowBytes),
      storedBytes,legacyUnversionedFiles
    };
  });
  const keys=["activeFiles","trashedFiles","versions","activeBytes",
    "trashedBytes","historicalBytes","storedBytes","legacyUnversionedFiles"];
  const total=Object.fromEntries(keys.map(key=>[key,families.reduce((n,f)=>n+f[key],0)]));
  return {scope:"sqlite-indexed-file-bytes",families,total};
}
