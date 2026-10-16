import assert from "node:assert/strict";
import { aggregateSnapshotRows } from "../../frontend/components/flowDashboardView.js";

const dataset = [
  { city:"Paris", total: 10, comment:"<img src=x onerror=alert(1)>" },
  { city:"Lyon", total: 6, comment:"safe" },
  { city:"Paris", total: 5, comment:"safe" },
  { city:"Nice", total:null, comment:"safe" }
];
const all = aggregateSnapshotRows(dataset,{groupBy:"city",measure:"total",operation:"sum"});
assert.equal(all.rows.length,4);
assert.deepEqual(all.groups.map(({name,value})=>[name,value]),[
  ["Paris",15],["Lyon",6],["Nice",0]
]);
const averages = aggregateSnapshotRows(dataset,{groupBy:"city",measure:"total",operation:"avg"});
assert.equal(averages.groups.find(x=>x.name==="Paris").value,7.5);
assert.equal(averages.groups.find(x=>x.name==="Nice").value,0);
const counts = aggregateSnapshotRows(dataset,{groupBy:"city",measure:"total",operation:"count",filter:"safe"});
assert.deepEqual(counts.groups.map(({name,value})=>[name,value]),[
  ["Lyon",1],["Nice",1],["Paris",1]
]);
assert.equal(aggregateSnapshotRows([],{}).groups.length,0);
assert.equal(aggregateSnapshotRows(null,{}).rows.length,0);
assert.equal(all.rows[0].comment,"<img src=x onerror=alert(1)>");
console.log("Hydria live Flow dashboard aggregation gate passed.");
