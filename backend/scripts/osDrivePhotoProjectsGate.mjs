import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";

const origin = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const api = origin + "/api/drive/photo-projects";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function photoZip(title, version = 1) {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({
    format_version: 1, document: { name: title, layers: [] },
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
const original = photoZip("Fichier de test v1");
const createdRes = await upload(original, "maquette.pcraft");
assert.equal(createdRes.status, 201);
const created = await createdRes.json();
assert.equal(created.filename, "maquette.pcraft");
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

const versions = [photoZip("Fichier de test v2", 2), photoZip("Conflit v2", 3)];
const concurrent = await Promise.all(versions.map(bytes =>
  upload(bytes, "maquette-modifiee.pcraft", {assetId:created.id,expectedRevision:1})));
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
assert.equal((await upload(original,"stale.pcraft",{assetId:created.id,expectedRevision:1})).status,409);
for (const revision of [0,-1,51,"2oops"])
  assert.equal((await upload(original,"bad.pcraft",{assetId:created.id,expectedRevision:revision})).status,400);
assert.equal((await upload(Buffer.from("not zip"),"fake.pcraft")).status,400);
const zipNotFig = new AdmZip();
zipNotFig.addFile("manifest.json", Buffer.from(JSON.stringify({format_version:999,document:{layers:[]}})));
assert.equal((await upload(zipNotFig.toBuffer(),"fake.pcraft")).status,400);
const emptyZip = new AdmZip();
emptyZip.addFile("README",Buffer.from("not pcraft"));
assert.equal((await upload(emptyZip.toBuffer(),"fake.pcraft")).status,400);
const newer = new AdmZip();
newer.addFile("manifest.json", Buffer.from(JSON.stringify({format_version:999,document:{layers:[]}})));
assert.equal((await upload(newer.toBuffer(),"future.pcraft")).status,400);
assert.equal((await fetch(api+"/invalid/download")).status,400);
assert.equal((await fetch(api+"/11111111-1111-4111-8111-111111111111/download")).status,404);
assert.equal((await fetch(api+"/"+created.id+"/versions/0/download")).status,400);
assert.equal((await fetch(api+"/"+created.id+"/versions/3/download")).status,404);
const noFile = await fetch(api,{method:"POST",body:new FormData()});
assert.equal(noFile.status,400);
const huge = new FormData();
huge.append("file",new Blob([Buffer.alloc(30*1024*1024+32)]),"huge.pcraft");
assert.equal((await fetch(api,{method:"POST",body:huge})).status,413);
assert.equal((await fetch(api).then(r=>r.json())).items.length,before.length+1);

// PhotoCraft's real web Save can produce a layered Photoshop PSD/PSB,
// not merely .pcraft. Keep the original bytes and extension unchanged.
function photoshopDocument(version = 1) {
  const data = Buffer.alloc(72);
  data.write("8BPS", 0, 4, "ascii");
  data.writeUInt16BE(version, 4);
  data.writeUInt16BE(3, 12);
  data.writeUInt32BE(24, 14);
  data.writeUInt32BE(48, 18);
  data.writeUInt16BE(8, 22);
  data.writeUInt16BE(3, 24);
  return data;
}
for (const [ext,version] of [["psd",1],["psb",2]]) {
  const initial = photoshopDocument(version);
  const saved = await upload(initial, "calques." + ext);
  assert.equal(saved.status, 201, "Native Photoshop " + ext + " upload must succeed");
  const asset = await saved.json();
  assert.equal(asset.filename,"calques." + ext);
  assert.equal(asset.sha256,sha(initial));
  assert.deepEqual(
    Buffer.from(await fetch(api+"/"+asset.id+"/download").then(r=>r.arrayBuffer())),initial
  );
  const changed = Buffer.concat([initial,Buffer.from("modified Photoshop bytes")]);
  const secondResponse = await upload(changed, "calques." + ext, {
    assetId:asset.id,expectedRevision:1
  });
  assert.equal(secondResponse.status,201);
  assert.equal((await secondResponse.json()).revision,2);
  assert.deepEqual(
    Buffer.from(await fetch(api+"/"+asset.id+"/download").then(r=>r.arrayBuffer())),changed
  );
  assert.deepEqual(
    Buffer.from(await fetch(api+"/"+asset.id+"/versions/1/download").then(r=>r.arrayBuffer())),initial
  );
  assert.equal((await upload(initial,"stale."+ext,{
    assetId:asset.id,expectedRevision:1
  })).status,409);
  // A malicious or mislabeled binary must not be stored.
  assert.equal((await upload(initial,"mismatch."+ (ext === "psd" ? "psb" : "psd"))).status,400);
  const corrupt=Buffer.from(initial);
  corrupt.write("RIFF",0,4,"ascii");
  assert.equal((await upload(corrupt,"bad."+ext)).status,400);
}
console.log("Native PhotoCraft Drive passed: ZIP + PSD/PSB byte-exact versions, 409, history and limits.");
