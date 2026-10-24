/**
 * Hydria Office Bridges. Opt-in converters built from independently installed,
 * unmodified open-source engines. No third-party brand is shipped or renamed.
 * No user-controlled shell, command, executable path, working directory or URL.
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, lstat, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const ENGINE_CATALOG = Object.freeze([
  Object.freeze({ id:"wordcraft", label:"WordCraft", mode:"cli", source:"https://github.com/storytold/wordcraft", env:"HYDRIA_WORDCRAFT_CLI", inputs:["docx","doc","odt","rtf","html","md","txt"], outputs:["docx","pdf","odt","rtf","html","md","txt"] }),
  Object.freeze({ id:"gridcraft", label:"GridCraft", mode:"cli", source:"https://github.com/storytold/gridcraft", env:"HYDRIA_GRIDCRAFT_CLI", inputs:["xlsx","xlsb","ods","csv","tsv"], outputs:["xlsx","csv","tsv","json","html","pdf"] }),
  Object.freeze({ id:"deckcraft", label:"DeckCraft", mode:"cli", source:"https://github.com/storytold/deckcraft", env:"HYDRIA_DECKCRAFT_CLI", inputs:["pptx","deckcraft"], outputs:["pptx","deckcraft","pdf","txt","md","png","jpg","gif"] }),
  Object.freeze({ id:"genoffice", label:"GenOffice", mode:"cli", source:"https://github.com/genspark-ai/genoffice", env:"HYDRIA_GENOFFICE_CLI", inputs:["docx","xlsx","pptx","pdf","md","html","csv","txt"], outputs:["docx","xlsx","pptx","pdf","md","html","csv","txt"] }),
  Object.freeze({ id:"elyoffice", label:"ElyOffice", mode:"desktop", source:"https://github.com/ELY-Open-Source/ElyOffice", inputs:["docx","xlsx","pptx","pdf","md"], outputs:[] })
]);
const MAX_INPUT = 12 * 1024 * 1024;
const MAX_OUTPUT = 32 * 1024 * 1024;
const ENGINE_BY_ID = new Map(ENGINE_CATALOG.map(engine=>[engine.id,engine]));

export function officeEngineState(id, env=process.env) {
  const engine = ENGINE_BY_ID.get(id);
  if (!engine) throw Error("Moteur inconnu");
  const executable = engine.mode==="cli" ? String(env[engine.env]||"").trim() : "";
  return { ...engine, configured: engine.mode==="cli" && path.isAbsolute(executable),
    available: engine.mode==="cli" && path.isAbsolute(executable),
    note: engine.mode==="desktop" ? "Application desktop indépendante : passerelle serveur à développer." : "Binaire externe facultatif ; son fonctionnement est vérifié lors de la conversion." };
}

export function planConversion(id, filename, requestedFormat) {
  const engine = ENGINE_BY_ID.get(String(id||""));
  if (!engine) throw Error("Moteur inconnu");
  if (engine.mode==="desktop") throw Error("ElyOffice fonctionne comme application de bureau ; aucune conversion serveur exposée.");
  const original = String(filename||"").split(/[\\/]/).at(-1) || "";
  const match = /\.([a-z0-9]{1,16})$/i.exec(original);
  const extension = match?.[1]?.toLowerCase();
  const format = String(requestedFormat||"").toLowerCase();
  if (!engine.inputs.includes(extension) || !engine.outputs.includes(format) ||
      !/^[a-z0-9]+$/.test(format)) throw Error("Format d’entrée ou de sortie non pris en charge.");
  const stem = original.slice(0,-match[0].length).replace(/[^\p{L}\p{N}._-]/gu,"_").replace(/^\.+/,"").slice(0,80) || "document";
  return { engine, extension, format, filename: `${stem}.${format}`,
    args: engine.id==="genoffice" ? ["convert","INPUT","--to",format,"--out","OUTPUT"] : ["convert","INPUT","OUTPUT"] };
}

export function runOfficeCommand(binary,args,{cwd,timeoutMs=20000}={}) {
  return new Promise((resolve,reject)=>{
    const child = spawn(binary,args,{
      cwd, shell:false, windowsHide:true, stdio:["ignore","pipe","pipe"],
      env: { PATH:process.env.PATH||"", SystemRoot:process.env.SystemRoot||"",
        HOME:process.env.HOME||"", TMPDIR:cwd, LANG:process.env.LANG||"C.UTF-8", GENOFFICE_ALLOWED_ROOTS:cwd }
    });
    let finished=false;
    const timer=setTimeout(()=>{ child.kill("SIGKILL"); settle(Error("Délai de conversion dépassé.")); },timeoutMs);
    const settle=(err)=>{ if(finished)return; finished=true;clearTimeout(timer);err?reject(err):resolve(); };
    child.stderr.on("data",()=>{});
    child.stdout.on("data",()=>{});
    child.on("error",settle);
    child.on("close",code=>settle(code===0?null:Error("Moteur externe indisponible ou conversion refusée ("+code+").")));
  });
}

export async function convertOfficeFile({engine,filename,bytes,format}, {env=process.env,runner=runOfficeCommand}={}) {
  const plan=planConversion(engine,filename,format);
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length>MAX_INPUT) throw Error("Fichier vide ou supérieur à 12 Mio.");
  const executable=String(env[plan.engine.env]||"").trim();
  if (!path.isAbsolute(executable)) throw Error("Moteur non configuré : chemin absolu du binaire requis.");
  const cwd=await mkdtemp(path.join(os.tmpdir(),"hydria-office-"));
  try {
    const input=path.join(cwd,`input.${plan.extension}`),output=path.join(cwd,`output.${plan.format}`);
    await writeFile(input,bytes,{flag:"wx",mode:0o600});
    const args=plan.args.map(a=>a==="INPUT"?input:a==="OUTPUT"?output:a);
    await runner(executable,args,{cwd,timeoutMs:20000});
    const stats=await lstat(output);
    if (!stats.isFile() || !stats.size || stats.size>MAX_OUTPUT) throw Error("Résultat absent ou trop volumineux.");
    return {buffer:await readFile(output),filename:plan.filename,format:plan.format};
  } finally { await rm(cwd,{recursive:true,force:true}); }
}
