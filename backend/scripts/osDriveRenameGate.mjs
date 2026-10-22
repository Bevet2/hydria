import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n", "ascii");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=", "base64");
function zipFile(name, document) {
  const zip = new AdmZip();
  zip.addFile(name, Buffer.from(JSON.stringify(document)));
  return zip.toBuffer();
}
const assets = [
  { family:"pdf", endpoint:"pdf-assets", original:"rename-report.pdf",ext:".pdf",blob:pdf },
  { family:"image", endpoint:"image-assets",original:"rename-picture.png",ext:".png",blob:png },
  { family:"design", endpoint:"design-assets",original:"rename-canvas.figcraft",ext:".figcraft",
    blob:zipFile("document.json",{format:"figcraft",version:1,name:"Design",pages:[]}) },
  { family:"photo", endpoint:"photo-projects",original:"rename-layers.pcraft",ext:".pcraft",
    blob:zipFile("manifest.json",{format_version:1,document:{name:"Photo",layers:[]}}) }
];
async function renamedAsset(entry, id, filename, expectedFilename, expectedRevision) {
  return fetch(base + "/api/drive/" + entry.endpoint + "/" + id + "/metadata", {
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({filename,expectedFilename,expectedRevision})
  });
}
for (const entry of assets) {
  const api=base + "/api/drive/" + entry.endpoint;
  const form=new FormData();
  form.append("file",new Blob([entry.blob]),entry.original);
  const uploaded=await fetch(api,{method:"POST",body:form});
  assert.equal(uploaded.status,201,"Create native " + entry.family + ": " + (await uploaded.clone().text()));
  const item=await uploaded.json();
  assert.match(item.id,/^[a-f0-9-]{36}$/);
  const start=entry.original;
  const named="renamed-" + entry.family + entry.ext;
  assert.equal((await renamedAsset(entry,"not-a-uuid",named,start,1)).status,400);
  assert.equal((await renamedAsset(entry,"11111111-1111-4111-8111-111111111111",named,start,1)).status,404);
  for (const invalid of ["../escape" + entry.ext, "evil/name" + entry.ext,
    "switch.exe", "bad\u0000name" + entry.ext, "name.", "  "]) {
    assert.equal((await renamedAsset(entry,item.id,invalid,start,1)).status,400,
      entry.family+" must refuse invalid "+JSON.stringify(invalid));
  }
  assert.equal((await renamedAsset(entry,item.id,named,"stale-name"+entry.ext,1)).status,409);
  assert.equal((await renamedAsset(entry,item.id,named,start,50)).status,409);
  const first=await renamedAsset(entry,item.id,named,start,1);
  assert.equal(first.status,200,"Rename: " + entry.family + " " + (await first.clone().text()));
  assert.match(first.headers.get("cache-control")||"",/no-store/);
  const saved=await first.json();
  assert.equal(saved.id,item.id);
  assert.equal(saved.filename,named);
  assert.equal(saved.revision,1,"Rename never consumes a binary revision");
  assert.equal(saved.size,item.size);
  assert.equal(saved.sha256,sha(entry.blob));
  const listed=await fetch(api).then(r=>r.json());
  assert.equal(listed.items.find(x=>x.id===item.id)?.filename,named);
  const versions=await fetch(api+"/"+item.id+"/versions").then(r=>r.json());
  assert.deepEqual(versions.items.map(x=>x.revision),[1]);
  assert.equal(versions.items[0].filename,start,"Immutable revision should retain its historical filename");
  const latest=await fetch(api+"/"+item.id+"/download");
  assert.equal(latest.status,200);
  assert.ok((latest.headers.get("content-disposition")||"").includes(named),"Renamed download should use new filename");
  assert.deepEqual(Buffer.from(await latest.arrayBuffer()),entry.blob);
  const historical=await fetch(api+"/"+item.id+"/versions/1/download");
  assert.equal(historical.status,200);
  assert.ok((historical.headers.get("content-disposition")||"").includes(start),"Historical revision should keep original filename");
  assert.deepEqual(Buffer.from(await historical.arrayBuffer()),entry.blob);
  const races=await Promise.all([
    renamedAsset(entry,item.id,"racing-A-"+entry.family+entry.ext,named,1),
    renamedAsset(entry,item.id,"racing-B-"+entry.family+entry.ext,named,1)
  ]);
  assert.deepEqual(races.map(r=>r.status).sort(),[200,409],
    "Only one concurrent rename wins even if the binary revision is unchanged");
  const winner=await races.find(r=>r.status===200).json();
  assert.equal((await renamedAsset(entry,item.id,named,named,1)).status,409);
  const current=await fetch(api).then(r=>r.json());
  assert.equal(current.items.find(x=>x.id===item.id)?.filename,winner.filename);
  assert.deepEqual(Buffer.from(await fetch(api+"/"+item.id+"/download").then(r=>r.arrayBuffer())),entry.blob);
  assert.equal((await fetch(api+"/"+item.id+"/versions").then(r=>r.json())).items.length,1);
  console.log("Drive rename passed:",entry.family,"byte-exact, stale conflict and historical filenames");
}
console.log("Four native Drive families: HTTP rename safety and immutable history passed.");
