import assert from "node:assert/strict";
import { flowGraphFit, flowNodePositionFromClient } from "../../frontend/components/flowCanvasGeometry.js";

const rect={left:180,top:130};
assert.deepEqual(flowNodePositionFromClient(480,270,rect,1),{x:192,y:104});
assert.deepEqual(flowNodePositionFromClient(480,270,rect,0.5),{x:492,y:244});
assert.deepEqual(flowNodePositionFromClient(-999,-999,rect,1),{x:0,y:0});
assert.deepEqual(flowNodePositionFromClient(9999,9999,rect,1),{x:1584,y:1080});
assert.throws(()=>flowNodePositionFromClient(1,2,rect,0),/Invalid flow zoom/);
assert.deepEqual(flowGraphFit([],800,500),{zoom:1,scrollLeft:0,scrollTop:0});
const fit=flowGraphFit([{x:800,y:600},{x:1050,y:780}],900,530);
assert.ok(fit.zoom>=0.5&&fit.zoom<=1.5);
assert.ok(fit.scrollLeft>0&&fit.scrollTop>0);
const tight=flowGraphFit([{x:0,y:0},{x:1400,y:1000}],320,220);
assert.equal(tight.zoom,0.5);
console.log("Flow node drop geometry and viewport fitting passed.");
