import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { ENGINE_CATALOG, planConversion, convertOfficeFile, officeEngineState } from "../services/office/officeEngines.js";

assert.deepEqual(ENGINE_CATALOG.map(e=>e.id), ["wordcraft","gridcraft","deckcraft","genoffice","elyoffice"]);
assert.equal(ENGINE_CATALOG.filter(e=>e.mode==="cli").length,4);
assert.equal(officeEngineState("elyoffice").mode,"desktop");
assert.deepEqual(planConversion("wordcraft","report.DOCX","pdf").args.slice(0,1),["convert"]);
assert.deepEqual(planConversion("genoffice","report.docx","pdf").args.slice(0,1),["convert"]);
assert.throws(()=>planConversion("elyoffice","report.docx","pdf"),/bureau|desktop/i);
assert.throws(()=>planConversion("wordcraft","malware.exe","pdf"),/format/i);
assert.throws(()=>planConversion("wordcraft","report.docx","exe"),/format/i);
assert.throws(()=>planConversion("wordcraft","report.docx","../pdf"),/format/i);
assert.throws(()=>planConversion("__proto__","report.docx","pdf"),/inconnu/i);

const captured=[];
const runner=async (binary,args,opts)=>{
  captured.push({binary,args,opts});
  await writeFile(args.at(-1),"PDFDATA");
};
const result=await convertOfficeFile({
  engine:"wordcraft",filename:"../../report.docx",bytes:Buffer.from("INPUT"),format:"pdf"
},{runner,env:{HYDRIA_WORDCRAFT_CLI:"/opt/office/wordcraft-cli"}});
assert.equal(result.filename,"report.pdf");
assert.equal(result.buffer.toString(),"PDFDATA");
assert.equal(captured[0].binary,"/opt/office/wordcraft-cli");
assert.ok(captured[0].args.every(a=>!a.includes("../")));
assert.throws(()=>planConversion("gridcraft","../../report.xlsx","pptx"),/format/i);
assert.equal(officeEngineState("wordcraft",{}).available,false);
await assert.rejects(convertOfficeFile({
  engine:"wordcraft",filename:"x.docx",bytes:Buffer.from("x"),format:"pdf"
},{env:{}}),/non configuré/i);

const genArgs=[];
const genResult=await convertOfficeFile({
  engine:"genoffice",filename:"data.xlsx",bytes:Buffer.from("DATA"),format:"pdf"
},{env:{HYDRIA_GENOFFICE_CLI:"/opt/genoffice"},runner:async (bin,args)=>{
  genArgs.push(...args);
  await writeFile(args.at(-1),"GENPDF");
}});
assert.equal(genResult.buffer.toString(),"GENPDF");
assert.deepEqual(genArgs.filter((arg)=>["convert","--to","pdf","--out"].includes(arg)),["convert","--to","pdf","--out"]);
console.log("Hydria Office Engines gate: PASS");
