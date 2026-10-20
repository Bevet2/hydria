import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const origin = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const url = origin + "/api/drive/image-assets";
// Self-contained 1x1 PNG fixture (never an SVG/HTML payload).
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGN0rT7xn4GBgYGJAQoAJiUCi6vmjGkAAAAASUVORK5CYII=",
  "base64"
);
const baseline = await fetch(url);
assert.equal(baseline.status,200);
assert.match(baseline.headers.get("cache-control")||"",/no-store/);
const before = (await baseline.json()).items;
assert.ok(Array.isArray(before));

const form = new FormData();
form.append("file", new Blob([png], {type:"image/png"}), "retouche.png");
const created = await fetch(url, {method:"POST", body:form});
assert.equal(created.status,201);
const item = await created.json();
assert.match(item.id,/^[a-f0-9-]{36}$/);
assert.equal(item.filename,"retouche.png");
assert.equal(item.mime,"image/png");
assert.equal(item.size,png.length);
assert.equal(item.sha256,createHash("sha256").update(png).digest("hex"));

const after = await fetch(url);
assert.equal(after.status,200);
const items=(await after.json()).items;
assert.equal(items.length,before.length+1);
assert.equal(items.find(x=>x.id===item.id)?.sha256,item.sha256);
const preview = await fetch(url+"/"+item.id+"/preview");
assert.equal(preview.status,200);
assert.equal((preview.headers.get("content-type")||"").split(";")[0],"image/png");
assert.equal(preview.headers.get("x-content-type-options"),"nosniff");
assert.match(preview.headers.get("content-disposition")||"",/inline/);
assert.deepEqual(Buffer.from(await preview.arrayBuffer()),png);
const download = await fetch(url+"/"+item.id+"/download");
assert.equal(download.status,200);
assert.match(download.headers.get("content-disposition")||"",/attachment/);
assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);

const bad=new FormData();
bad.append("file",new Blob(["<svg><script>alert(1)</script></svg>"],{type:"image/png"}),"fake.png");
const invalid=await fetch(url,{method:"POST",body:bad});
assert.equal(invalid.status,400);
assert.equal((await fetch(url+"/invalid/download")).status,400);
assert.equal((await fetch(url+"/11111111-1111-4111-8111-111111111111/download")).status,404);
const empty=await fetch(url,{method:"POST",body:new FormData()});
assert.equal(empty.status,400);
const tooLargeForm = new FormData();
tooLargeForm.append("file",new Blob([Buffer.alloc(15 * 1024 * 1024 + 512)]),"large.png");
const over = await fetch(url,{method:"POST",body:tooLargeForm});
assert.equal(over.status,413);
assert.equal((await fetch(url).then(r=>r.json())).items.length,before.length+1);
console.log("Drive images HTTP gate passed: upload, list, inline preview, download, checksum and invalid inputs.");
