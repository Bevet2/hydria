import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parsePdfBytes } from "../utils/pdfReader.js";
import { extractDocumentLikeContent } from "../services/attachments/extractors/documentExtractors.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/pdfcraft-incremental-rotation.json", import.meta.url), "utf8"));
const bytes = Buffer.from(fixture.base64, "base64");
assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.sha256);
let cases = 0;
for (const offset of [0, 8, 17, 64, 513, 2368]) {
  const backing = Buffer.allocUnsafeSlow(offset + bytes.length + 37);
  backing.fill(0x58); bytes.copy(backing, offset);
  const bufferView = backing.subarray(offset, offset + bytes.length);
  const typedView = new Uint8Array(backing.buffer, bufferView.byteOffset, bufferView.byteLength);
  const snapshot = Buffer.from(backing);
  for (const input of [bufferView, typedView]) {
    const rotations = [];
    const parsed = await parsePdfBytes(input, { pagerender: async page => {
      rotations.push(page.rotate);
      return (await page.getTextContent()).items.map(i => i.str).join(" ");
    } });
    assert.equal(parsed.numpages, fixture.pages);
    assert.ok(parsed.text.includes(fixture.expectedText));
    assert.deepEqual(rotations, [fixture.rotation]);
    assert.deepEqual(backing, snapshot, "Input backing memory must remain unchanged");
    cases++;
  }
  const extracted = await extractDocumentLikeContent({ originalname: "rotated.pdf", buffer: bufferView }, "pdf");
  assert.equal(extracted.parser, "pdf-parse", "Valid PDF must not fall through to regex extraction");
  assert.ok(extracted.text.includes(fixture.expectedText));
}
const parsedBuffer = await parsePdfBytes(Uint8Array.from(bytes).buffer);
assert.equal(parsedBuffer.numpages, fixture.pages);
for (const input of [undefined, null, "not binary", [1,2,3]]) {
  await assert.rejects(() => parsePdfBytes(input), TypeError);
}
console.log("PDF reader regression passed:", cases, "offset Buffer/Uint8Array cases, ArrayBuffer input, unchanged bytes, real attachment extraction and invalid input rejection.");
