import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "frontend");
const out = path.join(root, "frontend-dist");
await fs.rm(out, { recursive: true, force: true });
const entries = [];
async function visit(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) { await visit(absolute); continue; }
    const relative = path.relative(source, absolute);
    // Integrity-verified third-party runtimes have their own loader, chunks and
    // WASM paths. Preserve those files byte for byte instead of rebundling them.
    if (item.name.endsWith(".js") && relative.split(path.sep)[0] !== "vendor") entries.push(absolute);
    else { await fs.mkdir(path.dirname(path.join(out, relative)), { recursive: true }); await fs.copyFile(absolute, path.join(out, relative)); }
  }
}
await visit(source);
const result = await build({ entryPoints: entries, outbase: source, outdir: out, bundle: true,
  splitting: true, format: "esm", platform: "browser", target: "es2022", minify: true,
  chunkNames: "chunks/[name]-[hash]", metafile: true, logLevel: "warning" });
await fs.writeFile(path.join(out, "build-manifest.json"), JSON.stringify({
  builtAt: new Date().toISOString(), outputs: Object.fromEntries(Object.entries(result.metafile.outputs).map(([file, info]) => [path.relative(out, path.resolve(file)), info.bytes]))
}, null, 2));
console.log("Production frontend bundled:", out);
