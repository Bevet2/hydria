import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const base = process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const api = base + "/api/drive/pdf-assets";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n", "ascii");
const originalItemsResponse = await fetch(api);
assert.equal(originalItemsResponse.status, 200);
assert.match(originalItemsResponse.headers.get("cache-control") || "", /no-store/);
const originalItems = (await originalItemsResponse.json()).items;
assert.ok(Array.isArray(originalItems));

const validUpload = new FormData();
validUpload.append("file", new Blob([pdf], { type: "application/pdf" }), "edition-test.pdf");
const created = await fetch(api, { method: "POST", body: validUpload });
assert.equal(created.status, 201);
const item = await created.json();
assert.match(item.id, /^[0-9a-f-]{36}$/);
assert.equal(item.filename, "edition-test.pdf");
assert.equal(item.size, pdf.length);
assert.equal(item.sha256, createHash("sha256").update(pdf).digest("hex"));

const listed = await fetch(api);
assert.equal(listed.status, 200);
const items = (await listed.json()).items;
assert.equal(items.length, originalItems.length + 1);
assert.equal(items.find(x => x.id === item.id)?.sha256, item.sha256);

const download = await fetch(api + "/" + item.id + "/download");
assert.equal(download.status, 200);
assert.equal((download.headers.get("content-type") || "").split(";")[0], "application/pdf");
assert.match(download.headers.get("content-disposition") || "", /attachment/);
assert.match(download.headers.get("cache-control") || "", /no-store/);
assert.equal(download.headers.get("x-content-type-options"), "nosniff");
assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);

const badForm = new FormData();
badForm.append("file", new Blob(["not a pdf"], { type: "application/pdf" }), "fake.pdf");
const invalid = await fetch(api, { method: "POST", body: badForm });
assert.equal(invalid.status, 400);
assert.equal((await fetch(api + "/broken/download")).status, 400);
assert.equal((await fetch(api + "/11111111-1111-4111-8111-111111111111/download")).status, 404);
const missingFile = await fetch(api, { method: "POST", body: new FormData() });
assert.equal(missingFile.status, 400);

const oversized = new FormData();
oversized.append("file", new Blob([Buffer.alloc(20 * 1024 * 1024 + 1024, 0)], {
  type: "application/pdf"
}), "oversized.pdf");
const tooBig = await fetch(api, { method: "POST", body: oversized });
assert.equal(tooBig.status, 413);
assert.equal((await fetch(api).then(r => r.json())).items.length, originalItems.length + 1);
console.log("Hydria PDF persistence API passed: save, list, download, hash, bad inputs and upload size limit.");

// Two editors of revision 1 must never both overwrite the same PDF.
async function revise(bytes, expectedRevision) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), "edition-test.pdf");
  form.append("expectedRevision", String(expectedRevision));
  return fetch(api + "/" + item.id + "/versions", { method: "POST", body: form });
}
const edits = [Buffer.from(pdf.toString().replace("/Catalog", "/Catalog /Marker (A)")),
  Buffer.from(pdf.toString().replace("/Catalog", "/Catalog /Marker (B)"))];
const concurrent = await Promise.all(edits.map(bytes => revise(bytes, 1)));
assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
const winner = concurrent.findIndex(r => r.status === 201);
const committed = await concurrent[winner].json();
assert.equal(committed.revision, 2);
assert.equal(committed.id, item.id);
assert.equal(committed.sha256, createHash("sha256").update(edits[winner]).digest("hex"));
const metadata = await fetch(api + "/" + item.id).then(r => r.json());
assert.equal(metadata.revision, 2);
assert.equal(metadata.sha256, committed.sha256);
const history = await fetch(api + "/" + item.id + "/versions").then(r => r.json());
assert.deepEqual(history.items.map(v => v.revision), [2, 1]);
assert.equal(history.items[1].sha256, item.sha256);
for (const [revision, expectedBytes] of [[1, pdf], [2, edits[winner]]]) {
  const response = await fetch(api + "/" + item.id + "/versions/" + revision + "/download");
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBytes);
}
assert.deepEqual(Buffer.from(await fetch(api + "/" + item.id + "/download").then(r => r.arrayBuffer())), edits[winner]);
assert.equal((await revise(pdf, 1)).status, 409);
for (const revision of [0, -1, "2garbage", 51]) assert.equal((await revise(pdf, revision)).status, 400);
assert.equal((await revise(Buffer.from("invalid"), 2)).status, 400);
assert.equal((await fetch(api + "/" + item.id + "/versions/3/download")).status, 404);
assert.equal((await fetch(api + "/" + item.id + "/versions/0/download")).status, 400);
assert.equal((await fetch(api + "/" + item.id + "/versions").then(r => r.json())).items.length, 2);
console.log("PDF immutable revisions passed: concurrent edits, 409 conflicts, metadata, old bytes and invalid revisions.");
