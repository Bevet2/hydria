import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";

const origin = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const sha = buffer => createHash("sha256").update(buffer).digest("hex");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n","ascii");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=",
  "base64"
);
function archive(entry, value) {
  const zip = new AdmZip();
  zip.addFile(entry, Buffer.from(JSON.stringify(value)));
  return zip.toBuffer();
}
const files = [
  {name:"trash-test.pdf", api:"pdf-assets", bytes:pdf},
  {name:"trash-test.png", api:"image-assets", bytes:png},
  {name:"trash-test.figcraft", api:"design-assets", bytes:archive("document.json",{
    format:"figcraft",version:1,name:"Design",pages:[]
  })},
  {name:"trash-test.pcraft", api:"photo-projects", bytes:archive("manifest.json",{
    format_version:1,document:{name:"Photo",layers:[]}
  })}
];
function hasId(items, id) { return items.some(x => x.id === id); }
async function listing(api,trashed=false) {
  const response = await fetch(api + (trashed ? "?trashed=1" : ""));
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control")||"",/no-store/);
  return (await response.json()).items;
}
function change(api,id,operation,expectedFilename,expectedRevision) {
  return fetch(api + "/" + id + "/" + operation, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({expectedFilename,expectedRevision})
  });
}
async function uploadRevision(api,id,name,bytes) {
  const form = new FormData();
  form.append("file",new Blob([bytes]),name);
  form.append("expectedRevision","1");
  return fetch(api + "/" + id + "/versions",{method:"POST",body:form});
}
for (const file of files) {
  const api = origin + "/api/drive/" + file.api;
  const form = new FormData();
  form.append("file",new Blob([file.bytes]),file.name);
  const creation = await fetch(api,{method:"POST",body:form});
  assert.equal(creation.status,201,file.api+": "+await creation.clone().text());
  const saved = await creation.json();
  const id = saved.id;
  assert.equal(saved.sha256,sha(file.bytes));
  assert.equal(hasId(await listing(api),id),true);
  assert.equal(hasId(await listing(api,true),id),false);
  const invalidId = await change(api,"no-id","trash",file.name,1);
  assert.equal(invalidId.status,400);
  assert.equal((await change(api,id,"trash",file.name,0)).status,400);
  assert.equal((await change(api,id,"trash","wrong."+file.name,1)).status,409);
  const deleted = await change(api,id,"trash",file.name,1);
  assert.equal(deleted.status,200,file.api+": "+await deleted.clone().text());
  const trashed = await deleted.json();
  assert.equal(trashed.id,id);
  assert.ok(trashed.deleted_at);
  assert.equal(trashed.revision,1);
  assert.equal(trashed.sha256,saved.sha256);
  assert.equal(hasId(await listing(api),id),false);
  const trashItem = (await listing(api,true)).find(x=>x.id===id);
  assert.ok(trashItem?.deleted_at);
  assert.equal((await change(api,id,"trash",file.name,1)).status,409,
    "Repeated trash must not silently claim success");
  assert.equal((await fetch(api+"/"+id)).status,404);
  assert.equal((await fetch(api+"/"+id+"/versions")).status,404);
  assert.equal((await fetch(api+"/"+id+"/download")).status,404);
  assert.equal((await fetch(api+"/"+id+"/versions/1/download")).status,404);
  if (file.api==="image-assets") {
    assert.equal((await fetch(api+"/"+id+"/preview")).status,404);
  }
  assert.equal((await uploadRevision(api,id,file.name,file.bytes)).status,404,
    "An editor may not save over a trashed file");
  const rename = await fetch(api+"/"+id+"/metadata",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({filename:"nope."+file.name,expectedFilename:file.name,expectedRevision:1})
  });
  assert.equal(rename.status,404);
  assert.equal((await change(api,id,"restore","stale."+file.name,1)).status,409);
  const restored = await change(api,id,"restore",file.name,1);
  assert.equal(restored.status,200);
  const live=await restored.json();
  assert.equal(live.deleted_at,null);
  assert.equal(live.revision,1);
  assert.equal(live.sha256,saved.sha256);
  assert.equal(hasId(await listing(api),id),true);
  assert.equal(hasId(await listing(api,true),id),false);
  assert.equal((await change(api,id,"restore",file.name,1)).status,409);
  const versions=await fetch(api+"/"+id+"/versions").then(r=>r.json());
  assert.deepEqual(versions.items.map(x=>x.revision),[1]);
  assert.equal(versions.items[0].sha256,saved.sha256);
  for (const url of [api+"/"+id+"/download",api+"/"+id+"/versions/1/download"]) {
    const response=await fetch(url);
    assert.equal(response.status,200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),file.bytes,
      "Trash + restore must preserve exact original bytes");
  }
  // A rename after restoration remains a metadata-only operation.
  const renamed=await fetch(api+"/"+id+"/metadata",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({filename:"restored-"+file.name,expectedFilename:file.name,expectedRevision:1})
  });
  assert.equal(renamed.status,200);
  assert.equal((await renamed.json()).revision,1);
  const newName="restored-"+file.name;
  const race=await Promise.all([
    change(api,id,"trash",newName,1),
    change(api,id,"trash",newName,1)
  ]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const restoreRace=await Promise.all([
    change(api,id,"restore",newName,1),
    change(api,id,"restore",newName,1)
  ]);
  assert.deepEqual(restoreRace.map(r=>r.status).sort(),[200,409]);
  assert.equal((await listing(api)).find(x=>x.id===id)?.filename,newName);
  console.log("Drive trash/restore passed:",file.api,
    "hidden URL access, races, byte-exact history and metadata isolation");
}
console.log("Native Drive trash and restore E2E API: all four families passed.");
