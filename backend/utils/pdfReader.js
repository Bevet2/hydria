import pdfParse from "pdf-parse/lib/pdf-parse.js";

// The bundled PDF.js reader must receive an owned standard Uint8Array.
// A Node Buffer or subview can otherwise expose an unrelated memory prefix.
export async function parsePdfBytes(bytes, options = {}) {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!(view instanceof Uint8Array)) throw new TypeError("PDF input must be an ArrayBuffer or Uint8Array");
  // Copy the exact visible byte range, never the whole backing view.buffer.
  return pdfParse(Uint8Array.from(view), { version: "v2.0.550", ...options });
}
