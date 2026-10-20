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
assert.match(download.headers.get("content-type") || "", /application\\/pdf/);
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
