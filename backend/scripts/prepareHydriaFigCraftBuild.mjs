// Package a locally compiled, source-pinned, Hydria-patched FigCraft Web
// runtime. Never replace an official ZIP in place without explicit opt-in.
// The upstream rust sources and notices remain available alongside the build.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { injectHydriaArtCraftBridge, validateArtCraftBuild } from "./installArtCraftWeb.mjs";

export async function prepareHydriaFigCraftBuild({
  source, target = path.resolve("frontend/vendor/figcraft")
}) {
  if (!source) throw Error("Missing source directory (patched FigCraft clone)");
  const dist=path.join(path.resolve(source),"dist","web");
  await validateArtCraftBuild("fig",dist);
  const original=await readFile(path.join(dist,"index.html"),"utf8");
  if(!/<html\b[^>]*>/i.test(original)) throw Error("Invalid compiled FigCraft HTML");
  const marked=original.replace(/<html\b([^>]*)>/i,
    '<html$1 data-hydria-fig-native="1">');
  const html=injectHydriaArtCraftBridge(marked,"fig");
  await rm(target,{force:true,recursive:true});
  await mkdir(path.dirname(target),{recursive:true});
  await cp(dist,target,{recursive:true});
  await writeFile(path.join(target,"index.html"),html,"utf8");
  await cp(path.join(path.resolve(source),"LICENSE-MIT"),
    path.join(target,"LICENSE-FIGCRAFT-MIT.txt"));
  await cp(path.join(path.resolve(source),"NOTICE"),
    path.join(target,"NOTICE-FIGCRAFT.txt"));
  await cp(path.join(path.resolve(source),"ATTRIBUTION.md"),
    path.join(target,"ATTRIBUTION-FIGCRAFT.md"));
  return {target,source,compiled:true};
}
if (process.argv[1]?.endsWith("prepareHydriaFigCraftBuild.mjs")) {
  prepareHydriaFigCraftBuild({source:process.argv[2],target:process.argv[3]})
    .then(r=>console.log("Hydria native FigCraft web build prepared: "+r.target))
    .catch(err=>{console.error(err);process.exitCode=1;});
}
