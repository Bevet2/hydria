import assert from "node:assert/strict";
import { FLOW_NODE_CATALOG, runFlow, validateFlow } from "../services/flow/flowEngine.js";
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
console.log("Hydria dataflow integration gate passed (validation, ETL transforms, joins, cycles, limits and errors).");
