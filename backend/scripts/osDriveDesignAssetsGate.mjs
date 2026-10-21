import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";

const origin = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const api = origin + "/api/drive/design-assets";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function designZip(title, version = 1) {
  const zip = new AdmZip();
  zip.addFile("document.json", Buffer.from(JSON.stringify({
    format: "figcraft", version: 1, name: title, pages: [],
    testMetadata: { title, revisionMarker: version }
  })));
  return zip.toBuffer();
}
async function upload(bytes, name, { assetId, expectedRevision } = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/octet-stream" }), name);
  if (expectedRevision !== undefined) form.append("expectedRevision", String(expectedRevision));
  return fetch(assetId ? api + "/" + assetId + "/versions" : api, {
    method: "POST", body: form
  });
}

const initialRes = await fetch(api);
assert.equal(initialRes.status, 200);
const before = (await initialRes.json()).items;
assert.ok(Array.isArray(before));
const original = designZip("Fichier de test v1");
const createdRes = await upload(original, "maquette.figcraft");
assert.equal(createdRes.status, 201);
const created = await createdRes.json();
assert.equal(created.filename, "maquette.figcraft");
assert.equal(created.revision, 1);
assert.equal(created.sha256, sha(original));
assert.equal(created.size, original.length);
assert.match(created.id, /^[a-f0-9-]{36}$/);
const listed = await fetch(api).then(r=>r.json());
assert.equal(listed.items.length, before.length + 1);
assert.equal(listed.items.find(x=>x.id===created.id).revision,1);
const d1 = await fetch(api+"/"+created.id+"/download");
assert.equal(d1.status,200);
assert.equal(d1.headers.get("x-content-type-options"),"nosniff");
assert.match(d1.headers.get("content-disposition") || "",/attachment/);
assert.deepEqual(Buffer.from(await d1.arrayBuffer()), original);

const versions = [designZip("Fichier de test v2", 2), designZip("Conflit v2", 3)];
const concurrent = await Promise.all(versions.map(bytes =>
  upload(bytes, "maquette-modifiee.figcraft", {assetId:created.id,expectedRevision:1})));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
const winner = concurrent.findIndex(x=>x.status===201);
const second = await concurrent[winner].json();
assert.equal(second.id,created.id);
assert.equal(second.revision,2);
assert.equal(second.sha256,sha(versions[winner]));
const details = await fetch(api+"/"+created.id).then(r=>r.json());
assert.equal(details.revision,2);
const history = await fetch(api+"/"+created.id+"/versions").then(r=>r.json());
assert.deepEqual(history.items.map(x=>x.revision),[2,1]);
assert.equal(history.items[1].sha256,sha(original));
for (const [version,expected] of [[1,original],[2,versions[winner]]]) {
  const response = await fetch(api+"/"+created.id+"/versions/"+version+"/download");
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
}
assert.deepEqual(Buffer.from(await fetch(api+"/"+created.id+"/download").then(r=>r.arrayBuffer())),versions[winner]);
assert.equal((await upload(original,"stale.figcraft",{assetId:created.id,expectedRevision:1})).status,409);
for (const revision of [0,-1,51,"2oops"])
  assert.equal((await upload(original,"bad.figcraft",{assetId:created.id,expectedRevision:revision})).status,400);
assert.equal((await upload(Buffer.from("not zip"),"fake.figcraft")).status,400);
const zipNotFig = new AdmZip();
zipNotFig.addFile("document.json", Buffer.from(JSON.stringify({format:"else",version:1})));
assert.equal((await upload(zipNotFig.toBuffer(),"fake.figcraft")).status,400);
const emptyZip = new AdmZip();
emptyZip.addFile("README",Buffer.from("not figcraft"));
assert.equal((await upload(emptyZip.toBuffer(),"fake.figcraft")).status,400);
const newer = new AdmZip();
newer.addFile("document.json", Buffer.from(JSON.stringify({format:"figcraft",version:999})));
assert.equal((await upload(newer.toBuffer(),"future.figcraft")).status,400);
assert.equal((await fetch(api+"/invalid/download")).status,400);
assert.equal((await fetch(api+"/11111111-1111-4111-8111-111111111111/download")).status,404);
assert.equal((await fetch(api+"/"+created.id+"/versions/0/download")).status,400);
assert.equal((await fetch(api+"/"+created.id+"/versions/3/download")).status,404);
const noFile = await fetch(api,{method:"POST",body:new FormData()});
assert.equal(noFile.status,400);
const huge = new FormData();
huge.append("file",new Blob([Buffer.alloc(30*1024*1024+32)]),"huge.figcraft");
assert.equal((await fetch(api,{method:"POST",body:huge})).status,413);
assert.equal((await fetch(api).then(r=>r.json())).items.length,before.length+1);
console.log("Native FigCraft Drive passed: ZIP contract, upload/download identical, revision 2, 409, history and limits.");
