import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import XLSX from "xlsx";
import { runFlow } from "../services/flow/flowEngine.js";
import { spreadsheetSheetToFlowRows, selectableExcelSheets } from "../../frontend/components/workspaceFlowManager.js";
const baseUrl = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";

async function exportFile(path, body, contentType) {
  const response = await fetch(baseUrl + path, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(path + " responded " + response.status + ": " + (await response.text()).slice(0, 500));
  assert.match(response.headers.get("content-type") || "", contentType, path + " content type");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 200, path + " should not be an empty file");
  return bytes;
}
function officeZip(bytes, entry) {
  assert.equal(bytes.subarray(0, 2).toString("utf8"), "PK", "Office exports must be ZIP packages");
  const zip = new AdmZip(bytes);
  const file = zip.getEntry(entry);
  assert.ok(file, "Missing Office package part: " + entry);
  return { contents: zip.readAsText(file), entries: zip.getEntries().length };
}
const svgResponse = await fetch(baseUrl + "/api/canvas/export-svg", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: "Hydria SVG regression",
    boardWidth: 900, boardHeight: 600,
    elements: [
      {id:"a",type:"shape",shape:"diamond",x:30,y:60,width:180,height:120,title:"A <script>alert(1)</script>"},
      {id:"b",type:"note",x:400,y:100,width:200,height:160,title:"Second",body:"Save & export"}
    ],
    links: [{id:"a-b",from:"a",to:"b",label:"Connection"}]
  })
});
assert.equal(svgResponse.status,200);
assert.match(svgResponse.headers.get("content-type") || "",/image\/svg\+xml/);
const svg = await svgResponse.text();
assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(svg, /<polygon/);
assert.match(svg, /<path[^>]+marker-end/);
assert.match(svg, /Connection/);
assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(svg, /<script>/);
assert.match(svg, /Save &amp; export/);
const documentHtml = "<h1>Hydria Docs</h1><p>Export regression test</p><table><tr><th>Item</th><th>Amount</th></tr><tr><td>Revenue</td><td>42</td></tr></table>";
const docx = await exportFile("/api/docs/export-docx", { title: "Hydria export test", html: documentHtml }, /wordprocessingml\.document/);
const docXml = officeZip(docx, "word/document.xml");
assert.match(docXml.contents, /Export regression test/);
assert.match(docXml.contents, /Revenue/);
const docsPdf = await exportFile("/api/docs/export-pdf", { title: "Hydria export test", html: documentHtml }, /application\/pdf/);
assert.equal(docsPdf.subarray(0, 4).toString("utf8"), "%PDF");
const samplePng = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAIAAAD38zoCAAAAFElEQVR4nGOUqzjBgA0wYRWlrgQAqm4BaJxIOe4AAAAASUVORK5CYII=";
const imageDocument = "<h1>Image export</h1>" +
  '<p>Before <img src="data:image/png;base64,' + samplePng +
  '" width="160" alt="Blue rectangle"> After</p>' +
  '<img src="data:image/png;base64,' + samplePng + '" width="100" alt="Second picture">';
const imageDocx = await exportFile("/api/docs/export-docx", {
  title: "Hydria DOCX embedded images", html: imageDocument
}, /wordprocessingml\.document/);
const imageZip = new AdmZip(imageDocx);
const pictureFiles = imageZip.getEntries().filter((entry) =>
  /^word\/media\/.*\.png$/.test(entry.entryName));
assert.equal(pictureFiles.length,2,"DOCX should contain actual embedded PNG files, not just alt text");
assert.match(imageZip.readAsText("word/document.xml"), /a:blip/);
const imagePdf = await exportFile("/api/docs/export-pdf", {
  title: "Hydria PDF embedded images", html: imageDocument
}, /application\/pdf/);
assert.equal(imagePdf.subarray(0,4).toString("utf8"),"%PDF");
assert.match(imagePdf.toString("latin1"), /\/Subtype\s*\/Image/);
const oversizedImage = await fetch(baseUrl + "/api/docs/export-docx",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({title:"Oversized image",html:
    '<img src="data:image/png;base64,' + "A".repeat(1400000) + '">'})
});
assert.equal(oversizedImage.status,413,"DOCX image size guard should return 413");

const model = {
  kind: "hydria-sheet", activeSheetId: "sheet-1",
  sheets: [{ id: "sheet-1", name: "Sales Report", columns: ["City", "Amount"], rows: [["Paris", 42], ["Lyon", 25]], charts: [] }]
};
const xlsx = await exportFile("/api/sheets/export-xlsx", { filename: "hydria-test.xlsx", model }, /spreadsheetml\.sheet/);
const book = officeZip(xlsx, "xl/workbook.xml");
assert.match(book.contents, /Sales Report/);
assert.ok(book.entries >= 5, "XLSX should contain multiple workbook parts");

const roundtripData = new FormData();
roundtripData.append("workbook", new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "hydria-roundtrip.xlsx");
const importedResponse = await fetch(baseUrl + "/api/sheets/import-xlsx", { method: "POST", body: roundtripData });
if (!importedResponse.ok) throw new Error("XLSX roundtrip import failed: " + importedResponse.status + " " + (await importedResponse.text()).slice(0, 400));
const imported = await importedResponse.json();
assert.equal(imported.success, true);
assert.ok(imported.model?.sheets?.some(sheet => sheet.name === "Sales Report"), "XLSX roundtrip should preserve sheet names");
assert.ok(JSON.stringify(imported.model).includes("Paris"), "XLSX roundtrip should preserve data values");
const salesSheet = imported.model.sheets.find(sheet => sheet.name === "Sales Report");
const flowRows = spreadsheetSheetToFlowRows(salesSheet);
assert.deepEqual(flowRows, [
  {City:"Paris", Amount:"42"},
  {City:"Lyon", Amount:"25"}
], "XLSX imported via Sheets must become typed Flow Manager source rows");
const excelFlow = runFlow({
  stages:[
    {id:"excel",type:"input.table",config:{data:JSON.stringify(flowRows)}},
    {id:"filter",type:"transform.filter",config:{column:"Amount",operator:"gte",value:"40"}},
    {id:"result",type:"output.table",config:{}}
  ],
  links:[
    {from:"excel",to:"filter",toPort:0},
    {from:"filter",to:"result",toPort:0}
  ]
});
assert.equal(excelFlow.success,true,"Flow Manager must execute a table sourced from Excel");
assert.deepEqual(excelFlow.outputs[0].preview,[{City:"Paris",Amount:"42"}]);

const exportedFlow = {
  title: "Flow Excel export",
  stages:[
    {id:"source",type:"input.table",config:{data:JSON.stringify([
      {city:"Paris",amount:42,unsafe:"=1+1"},
      {city:"Lyon",amount:25,unsafe:"+2+2"}
    ])}},
    {id:"result",type:"output.table",config:{}}
  ],
  links:[{from:"source",to:"result",toPort:0}]
};
const flowXlsx = await exportFile(
  "/api/flows/export-xlsx",
  {flow:exportedFlow, outputId:"result"},
  /spreadsheetml\.sheet/
);
officeZip(flowXlsx, "xl/workbook.xml");
const flowBook = XLSX.read(flowXlsx, {type:"buffer"});
assert.deepEqual(flowBook.SheetNames, ["Flow Result"]);
const flowSheet = flowBook.Sheets["Flow Result"];
const flowMatrix = XLSX.utils.sheet_to_json(flowSheet, {header:1,defval:null});
assert.deepEqual(flowMatrix, [
  ["city","amount","unsafe"],
  ["Paris",42,"=1+1"],
  ["Lyon",25,"+2+2"]
], "Flow export must preserve columns, values and original string literals");
assert.equal(flowSheet.C2.f,undefined,"Untrusted strings must not execute as Excel formulas");
const invalidOutput = await fetch(baseUrl + "/api/flows/export-xlsx", {
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({flow:exportedFlow,outputId:"missing"})
});
assert.equal(invalidOutput.status,422,"Invalid output IDs must be rejected");

const bundleFlow = {
  stages: [
    {id:"source",type:"input.table",config:{data:JSON.stringify([{city:"Paris",amount:42},{city:"Lyon",amount:25}])}},
    {id:"a",type:"output.table",config:{}},
    {id:"b",type:"output.table",config:{}}
  ],
  links: [{from:"source",to:"a",toPort:0},{from:"source",to:"b",toPort:0}]
};
const flowBundle = await exportFile("/api/flows/export-bundle", {flow:bundleFlow}, /application\/zip/);
const flowArchive = new AdmZip(flowBundle);
const flowManifest = JSON.parse(flowArchive.readAsText("manifest.json"));
assert.equal(flowManifest.outputs.length,2);
assert.equal(flowManifest.outputs[0].rows,2);
assert.match(flowArchive.readAsText("output-01.csv"),/Paris,42/);
assert.match(flowArchive.readAsText("output-02.csv"),/Lyon,25/);
// Flow execution metadata survive across requests, without storing row data.
const historyId = crypto.randomUUID();
const historyFlow = {
  stages:[
    {id:"source",type:"input.table",config:{data:JSON.stringify([{secret:"never-persist-this-value",amount:42}])}},
    {id:"output",type:"output.table",config:{}}
  ],
  links:[{from:"source",to:"output",toPort:0}]
};
const runResponse = await fetch(baseUrl + "/api/flows/run", {
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({flow:historyFlow,historyId})
});
assert.equal(runResponse.status,200);
const runListResponse = await fetch(baseUrl + "/api/flows/history/" + historyId);
assert.equal(runListResponse.status,200);
const runList = await runListResponse.json();
assert.equal(runList.runs.length,1);
assert.equal(runList.runs[0].status,"success");
assert.equal(runList.runs[0].outputRows,1);
assert.ok(!JSON.stringify(runList).includes("never-persist-this-value"),"History must not expose row data");
assert.equal((await fetch(baseUrl + "/api/flows/history/not-a-uuid")).status,400);
const failedResponse = await fetch(baseUrl + "/api/flows/run", {
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({flow:{stages:[{id:"broken",type:"input.table",config:{data:"invalid"}}],links:[]},historyId})
});
assert.equal(failedResponse.status,422);
const failedHistory = await (await fetch(baseUrl + "/api/flows/history/" + historyId)).json();
assert.equal(failedHistory.runs[0].status,"failed");
assert.equal(failedHistory.runs[1].status,"success");

const multiModel = {
  kind:"hydria-sheet",activeSheetId:"sheet-a",sheets:[
    {id:"sheet-a",name:"Alpha",columns:["City"],rows:[["Paris"]],charts:[]},
    {id:"sheet-b",name:"Beta",columns:["City"],rows:[["Lyon"]],charts:[]}
  ]
};
const multiWorkbook = await exportFile("/api/sheets/export-xlsx", {model:multiModel}, /spreadsheetml\.sheet/);
const sheetSelectionForm = new FormData();
sheetSelectionForm.append("workbook",new Blob([multiWorkbook]),"multi-sheets.xlsx");
const selectionResponse = await fetch(baseUrl + "/api/sheets/import-xlsx",{method:"POST",body:sheetSelectionForm});
assert.equal(selectionResponse.status,200);
const selectionImport = await selectionResponse.json();
const selectable = selectableExcelSheets(selectionImport.model);
assert.deepEqual(selectable.map(sheet=>sheet.name),["Alpha","Beta"]);
assert.deepEqual(spreadsheetSheetToFlowRows(selectable[1]),[{City:"Lyon"}]);

const allOutputsXlsx = await exportFile("/api/flows/export-workbook", {flow:bundleFlow}, /spreadsheetml\.sheet/);
officeZip(allOutputsXlsx,"xl/workbook.xml");
const outputsWorkbook = XLSX.read(allOutputsXlsx,{type:"buffer"});
assert.deepEqual(outputsWorkbook.SheetNames,["Output 1","Output 2"]);
for (const name of outputsWorkbook.SheetNames) {
  assert.deepEqual(
    XLSX.utils.sheet_to_json(outputsWorkbook.Sheets[name],{header:1}),
    [["city","amount"],["Paris",42],["Lyon",25]],
    "Multi-output XLSX must keep each table in its own sheet"
  );
}
const noOutputWorkbook = await fetch(baseUrl + "/api/flows/export-workbook",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({flow:{stages:[{id:"src",type:"input.table",config:{data:'[]'}}],links:[]}})
});
assert.equal(noOutputWorkbook.status,422);

const sheetPdf = await exportFile("/api/sheets/export-pdf", { filename: "hydria-test.pdf", model }, /application\/pdf/);
assert.equal(sheetPdf.subarray(0, 4).toString("utf8"), "%PDF");
const pptx = await exportFile("/api/work-objects/export-smoke/presentation-export", {
  title: "Hydria Slides",
  markdown: "# Hydria Slides\n\n## Introduction\n\nPresentation export regression\n\n## Analysis\n\nSecond slide"
}, /presentationml\.presentation/);
const slidesZip = new AdmZip(pptx);
const slideEntries = slidesZip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
assert.ok(slideEntries.length >= 1, "PowerPoint should contain at least one slide");
assert.ok(slideEntries.some(e => slidesZip.readAsText(e).includes("Presentation export regression")), "PowerPoint should preserve slide text");
console.log(JSON.stringify({
  success: true,
  exports: ["DOCX", "Docs PDF", "XLSX", "XLSX import roundtrip", "Flow XLSX", "Sheets PDF", "PPTX", "Canvas SVG"],
  docxBytes: docx.length,
  docsPdfBytes: docsPdf.length,
  xlsxBytes: xlsx.length,
  sheetsPdfBytes: sheetPdf.length,
  pptxBytes: pptx.length,
  slides: slideEntries.length
}, null, 2));
