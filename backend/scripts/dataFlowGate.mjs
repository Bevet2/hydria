import assert from "node:assert/strict";
import { FLOW_NODE_CATALOG, runFlow, validateFlow } from "../services/flow/flowEngine.js";
import { parseCSV, spreadsheetSheetToFlowRows, normalizedJsonApiRows, selectableExcelSheets } from "../../frontend/components/workspaceFlowManager.js";
function node(id, type, config = {}) { return { id, type, label: id, config }; }
function link(from, to, toPort = 0) { return { id: from + "-" + to + "-" + toPort, from, to, toPort }; }
const sample = {
  title: "Sales by city", stages: [
    node("source", "input.table", { data: '[{"city":"Paris","sales":10},{"city":"Lyon","sales":7},{"city":"Paris","sales":5}]' }),
    node("filter", "transform.filter", { column: "sales", operator: "gte", value: "7" }),
    node("aggregate", "transform.aggregate", { groupBy: "city", column: "sales", operation: "sum", target: "total" }),
    node("result", "output.table")
  ],
  links: [link("source","filter"), link("filter","aggregate"), link("aggregate","result")]
};
assert.ok(FLOW_NODE_CATALOG.length >= 8);
const check = validateFlow(sample);
assert.equal(check.valid, true);
assert.deepEqual(check.order, ["source","filter","aggregate","result"]);
const result = runFlow(sample);
assert.equal(result.success,true);
assert.equal(result.outputs[0].rows,2);
assert.deepEqual(result.outputs[0].preview, [{city:"Paris",total:10},{city:"Lyon",total:7}]);
const derived = runFlow({
  stages:[node("src","input.table",{data:'[{"a":4},{"a":6}]'}), node("calc","transform.derive",{column:"a",target:"b",operator:"multiply",value:"3"}),node("sort","transform.sort",{column:"b",direction:"desc"}),node("out","output.table")],
  links:[link("src","calc"),link("calc","sort"),link("sort","out")]
});
assert.equal(derived.success,true);
assert.deepEqual(derived.outputs[0].preview.map(r=>r.b),[18,12]);
const pivotFlow = runFlow({
  stages:[
    node("source","input.table",{data:JSON.stringify([
      {city:"Paris",year:"2025",sales:10},
      {city:"Paris",year:"2026",sales:12},
      {city:"Paris",year:"2025",sales:7},
      {city:"Lyon",year:"2026",sales:5}
    ])}),
    node("pivot","transform.pivot",{index:"city",pivotColumn:"year",valueColumn:"sales",operation:"sum"}),
    node("output","output.table")
  ],
  links:[link("source","pivot"),link("pivot","output")]
});
assert.equal(pivotFlow.success,true);
assert.deepEqual(pivotFlow.outputs[0].preview,[
  {city:"Paris","2025":17,"2026":12},
  {city:"Lyon","2025":null,"2026":5}
]);
const unpivotFlow = runFlow({
  stages:[
    node("source","input.table",{data:JSON.stringify(pivotFlow.outputs[0].preview)}),
    node("unpivot","transform.unpivot",{columns:"2025,2026",nameColumn:"year",valueColumn:"sales"}),
    node("output","output.table")
  ],
  links:[link("source","unpivot"),link("unpivot","output")]
});
assert.equal(unpivotFlow.success,true);
assert.deepEqual(unpivotFlow.outputs[0].preview,[
  {city:"Paris",year:"2025",sales:17},
  {city:"Paris",year:"2026",sales:12},
  {city:"Lyon",year:"2025",sales:null},
  {city:"Lyon",year:"2026",sales:5}
]);
const invalidPivot = runFlow({
  stages:[node("s","input.table",{data:'[{"city":"Paris","year":"city","sales":7}]'}),
    node("p","transform.pivot",{index:"city",pivotColumn:"year",valueColumn:"sales",operation:"sum"})],
  links:[link("s","p")]
});
assert.equal(invalidPivot.success,false);
assert.match(invalidPivot.errors[0],/conflicts with an index/i);
const invalidUnpivot = runFlow({
  stages:[node("s","input.table",{data:'[{"city":"Paris","sales":7}]'}),
    node("p","transform.unpivot",{columns:"sales",nameColumn:"city",valueColumn:"value"})],
  links:[link("s","p")]
});
assert.equal(invalidUnpivot.success,false);
assert.match(invalidUnpivot.errors[0],/overwrite/i);
const oversizedUnpivot = runFlow({
  stages:[node("s","input.table",{data:JSON.stringify(Array.from({length:10001},(_,i)=>({x:i,y:i})))}),
    node("p","transform.unpivot",{columns:"x,y",nameColumn:"field",valueColumn:"value"})],
  links:[link("s","p")]
});
assert.equal(oversizedUnpivot.success,false);
assert.match(oversizedUnpivot.errors[0],/20,000 row/i);

const join = runFlow({
  stages:[node("l","input.table",{data:'[{"id":1,"name":"a"},{"id":2,"name":"b"}]'}),node("r","input.table",{data:'[{"id":2,"tier":"premium"}]'}),node("j","transform.join",{leftKey:"id",rightKey:"id",how:"left"}),node("o","output.table")],
  links:[link("l","j",0),link("r","j",1),link("j","o")]
});
assert.equal(join.success,true);
assert.equal(join.outputs[0].rows,2);
assert.equal(join.outputs[0].preview[1].tier,"premium");
const cycle = validateFlow({ stages:[node("a","transform.select",{columns:"x"}),node("b","transform.select",{columns:"x"})],links:[link("a","b"),link("b","a")]});
assert.equal(cycle.valid,false);
assert.ok(cycle.errors.some(x=>x.includes("cycle")));
const invalidPort = validateFlow({stages:[node("src","input.table",{data:"[]"}),node("out","output.table")],links:[link("src","out",1)]});
assert.equal(invalidPort.valid,false);
assert.ok(invalidPort.errors.some(x=>x.includes("port")));
const malformed = runFlow({stages:[node("s","input.table",{data:"{bad json"})],links:[]});
assert.equal(malformed.success,false);
assert.equal(malformed.failedNodeId,"s");
const zero = runFlow({stages:[node("s","input.table",{data:'[{"a":2}]'}),node("d","transform.derive",{column:"a",target:"b",operator:"divide",value:0})],links:[link("s","d")]});
assert.equal(zero.success,false);
const huge = runFlow({stages:[node("s","input.table",{data:JSON.stringify(Array.from({length:20001},()=>({x:1})))})],links:[]});
assert.equal(huge.success,false);
const noCode = runFlow({stages:[node("s","input.table",{data:"[]"}),node("e","output.table")],links:[link("s","e")]});
assert.equal(noCode.success,true);
const cleanup = runFlow({
  stages: [
    node("source","input.table",{data:JSON.stringify([{city:"Paris",amount:null},{city:"Paris",amount:null},{city:"Lyon",amount:5}])}),
    node("fill","transform.fill",{column:"amount",value:"0"}),
    node("unique","transform.unique",{columns:"city,amount"}),
    node("rename","transform.rename",{from:"city",to:"location"}),
    node("out","output.table")
  ],
  links:[link("source","fill"),link("fill","unique"),link("unique","rename"),link("rename","out")]
});
assert.equal(cleanup.success,true);
assert.deepEqual(cleanup.outputs[0].preview,[{location:"Paris",amount:"0"},{location:"Lyon",amount:5}]);

const union = runFlow({
  stages:[
    node("left","input.table",{data:'[{"city":"Paris","sales":10}]'}),
    node("right","input.table",{data:'[{"city":"Lyon","department":"69"}]'}),
    node("concat","transform.union"),
    node("out","output.table")
  ],
  links:[link("left","concat",0),link("right","concat",1),link("concat","out")]
});
assert.equal(union.success,true);
assert.deepEqual(union.outputs[0].preview,[
  {city:"Paris",sales:10,department:null},
  {city:"Lyon",sales:null,department:"69"}
]);
const collision = runFlow({
  stages:[
    node("src","input.table",{data:'[{"city":"Paris","location":"France"}]'}),
    node("rename","transform.rename",{from:"city",to:"location"})
  ],
  links:[link("src","rename")]
});
assert.equal(collision.success,false);
assert.equal(collision.failedNodeId,"rename");
// Imported sources must handle European CSV and spreadsheet TSV without
// silently discarding columns or treating separators inside quotes as real.
assert.deepEqual(
  parseCSV('\uFEFFcity;amount;amount\r\n"Paris; Nord";"5,42";"8"\r\nLyon;7;9'),
  [
    {city:"Paris; Nord",amount:"5,42",amount_2:"8"},
    {city:"Lyon",amount:"7",amount_2:"9"}
  ]
);
assert.deepEqual(parseCSV('city\tsales\nParis\t10\nLyon\t20'),[
  {city:"Paris",sales:"10"}, {city:"Lyon",sales:"20"}
]);
assert.deepEqual(parseCSV('name,notes\n"Hydria","Line 1\nLine 2"'),[
  {name:"Hydria",notes:"Line 1\nLine 2"}
]);
assert.throws(()=>parseCSV('name,sales\n"unclosed,3'),/Unclosed CSV quote/);
const delimitedFlow = runFlow({
  stages:[
    node("csv","input.table",{data:JSON.stringify(parseCSV('city;amount\nParis;42\nLyon;25'))}),
    node("filter","transform.filter",{column:"amount",operator:"gte",value:"40"}),
    node("output","output.table")
  ],links:[link("csv","filter"),link("filter","output")]
});
assert.equal(delimitedFlow.success,true);
assert.deepEqual(delimitedFlow.outputs[0].preview,[{city:"Paris",amount:"42"}]);
assert.deepEqual(selectableExcelSheets({sheets:[
  {name:"Hidden",hidden:true,columns:["id"],rows:[["secret"]]},
  {name:"Visible A",hidden:false,columns:["id"],rows:[["a"]]},
  {name:"Visible B",columns:["id"],rows:[["b"]]}
]}).map(sheet => sheet.name),["Visible A","Visible B"]);
assert.deepEqual(selectableExcelSheets({sheets:[
  {name:"Hidden",hidden:true,columns:["id"],rows:[["private"]]}
]}).map(sheet => sheet.name),["Hidden"]);
assert.deepEqual(selectableExcelSheets({sheets:[]}),[]);
assert.deepEqual(
  spreadsheetSheetToFlowRows({
    columns: ["City", "Amount", "City"],
    rows: [["Paris", 42, "France"], ["Lyon", 25, "France"], ["", "", ""]]
  }),
  [
    {City:"Paris",Amount:"42",City_2:"France"},
    {City:"Lyon",Amount:"25",City_2:"France"}
  ]
);
assert.throws(
  ()=>spreadsheetSheetToFlowRows({columns:["x"],rows:Array.from({length:20001},()=>["v"])}),
  /20,000 rows/
);
const qualityFlow = runFlow({
  stages:[
    node("source","input.table",{data:JSON.stringify([
      {city:" Paris ",amount:"12,50",active:"oui"},
      {city:" Lyon ",amount:"7.0",active:"non"},
      {city:"  ",amount:null,active:""}
    ])}),
    node("trim","transform.text",{column:"city",target:"city",textAction:"trim"}),
    node("upper","transform.text",{column:"city",target:"label",textAction:"upper"}),
    node("amount","transform.cast",{column:"amount",target:"amount",valueType:"number"}),
    node("active","transform.cast",{column:"active",target:"active",valueType:"boolean"}),
    node("profile","transform.profile",{}),
    node("out","output.table")
  ],
  links:[
    link("source","trim"),link("trim","upper"),link("upper","amount"),
    link("amount","active"),link("active","profile"),link("profile","out")
  ]
});
assert.equal(qualityFlow.success,true);
assert.deepEqual(qualityFlow.steps.find(step=>step.id==="amount").preview.map(r=>r.amount),[12.5,7,null]);
assert.deepEqual(qualityFlow.steps.find(step=>step.id==="active").preview.map(r=>r.active),[true,false,null]);
assert.deepEqual(qualityFlow.steps.find(step=>step.id==="upper").preview.map(r=>r.label),["PARIS","LYON",null]);
assert.deepEqual(qualityFlow.outputs[0].preview.find(r=>r.column==="amount"),{
  column:"amount",rows:3,missing:1,distinct:2,numeric:2,inferredType:"number"
});
assert.deepEqual(qualityFlow.outputs[0].preview.find(r=>r.column==="active"),{
  column:"active",rows:3,missing:1,distinct:2,numeric:0,inferredType:"boolean"
});
const invalidCast=runFlow({
  stages:[node("s","input.table",{data:'[{"n":"wrong"}]'}),node("c","transform.cast",{column:"n",valueType:"number"})],
  links:[link("s","c")]
});
assert.equal(invalidCast.success,false);
assert.equal(invalidCast.failedNodeId,"c");
assert.match(invalidCast.errors[0],/row 1 column n/i);
const replaced=runFlow({
  stages:[node("s","input.table",{data:'[{"name":"Paris Paris"},{"name":"Nice"}]'}),
    node("r","transform.text",{column:"name",target:"name",textAction:"replace",find:"Paris",replacement:"Lyon"}),
    node("o","output.table")],
  links:[link("s","r"),link("r","o")]
});
assert.equal(replaced.success,true);
assert.deepEqual(replaced.outputs[0].preview,[{name:"Lyon Lyon"},{name:"Nice"}]);
assert.equal(
  runFlow({stages:[node("s","input.table",{data:'[{"name":"Nice"}]'}),node("r","transform.text",{column:"name",textAction:"replace",find:""})],links:[link("s","r")]}).success,
  false
);
const twoOutputs = runFlow({
  stages: [
    node("source","input.table",{data:'[{"city":"Paris","sales":10},{"city":"Lyon","sales":7}]'}),
    node("filtered","transform.filter",{column:"city",operator:"eq",value:"Paris"}),
    node("all","output.table"),
    node("paris","output.table")
  ],
  links: [link("source","all"),link("source","filtered"),link("filtered","paris")]
}, { includeAllOutputs: true });
assert.equal(twoOutputs.success,true);
assert.equal(twoOutputs.outputs.length,2);
assert.deepEqual(twoOutputs.outputs.find((item)=>item.id==="all").data.map((r)=>r.city),["Paris","Lyon"]);
assert.deepEqual(twoOutputs.outputs.find((item)=>item.id==="paris").data.map((r)=>r.city),["Paris"]);
assert.deepEqual(
  normalizedJsonApiRows({ data: [{name:"Paris",value:3,missing:null},{name:"Lyon",value:5}] }),
  [{name:"Paris",value:3,missing:null},{name:"Lyon",value:5}]
);
assert.deepEqual(normalizedJsonApiRows({rows:[{name:"France"}]}),[{name:"France"}]);
assert.throws(()=>normalizedJsonApiRows({error:"no rows"}),/REST JSON source/);
assert.throws(()=>normalizedJsonApiRows([null]),/object row/);
assert.throws(()=>normalizedJsonApiRows([{a:1,b:2}].map(()=>Object.fromEntries(Array.from({length:101},(_,i)=>["c"+i,i])))),/object row/);
console.log("Hydria dataflow integration gate passed (ETL transforms, CSV/TSV/XLSX inputs, joins, cleanup, type conversion, column profiling, limits and errors).");
