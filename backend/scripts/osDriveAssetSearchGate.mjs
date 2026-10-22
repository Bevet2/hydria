import assert from "node:assert/strict";
import { createDriveAssetSearch, driveAssetWorkspaceUrl, filterDriveAssetSearch } from "../../frontend/services/driveAssetSearch.js";

const assets = {
  pdf:"10000000-0000-4000-8000-000000000001",
  image:"10000000-0000-4000-8000-000000000002",
  design:"10000000-0000-4000-8000-000000000003",
  "photo-project":"10000000-0000-4000-8000-000000000004"
};
const routes = {
  pdf:"/workspace/pdf?assetId=" + assets.pdf,
  image:"/workspace/photo?imageId=" + assets.image,
  design:"/workspace/fig?designId=" + assets.design,
  "photo-project":"/workspace/photo?photoProjectId=" + assets["photo-project"]
};
for (const [family,id] of Object.entries(assets)) {
  assert.equal(driveAssetWorkspaceUrl({id,assetFamily:family}),routes[family]);
}
for (const item of [
  {id: "../evil",assetFamily: "pdf"},
  {id: assets.pdf,assetFamily: "unknown"},
  {id: assets.pdf,assetFamily: "__proto__"},
  {id: assets.pdf},
  null
]) assert.equal(driveAssetWorkspaceUrl(item),null, "Invalid paths are refused");

let clock=1000, loads = {pdf:0,image:0,design:0,"photo-project":0};
const loaders=Object.fromEntries(Object.entries(assets).map(([family,id])=>[
  family,async()=>{
    loads[family]++;
    return [{id,filename:"Hydria-Quarterly-" + family + ".file", updated_at:"2026-10-21T10:00:00Z"},
      {id:"forged-uuid",filename:"should not appear"}];
  }
]));
const search=createDriveAssetSearch({loaders,now:()=>clock,ttlMs:2000});
assert.deepEqual(await search("x"),[]); // Minimum query length; no outgoing request.
assert.deepEqual(loads,{pdf:0,image:0,design:0,"photo-project":0});
const [first,second]=await Promise.all([search("Quarterly"),search("quarterly")]);
assert.equal(first.length,4);
assert.deepEqual(first.map(item=>item.assetFamily).sort(),Object.keys(assets).sort());
assert.deepEqual(second,first);
assert.deepEqual(loads,{pdf:1,image:1,design:1,"photo-project":1},"Concurrent searches coalesce");
assert.equal((await search("Quarterly")).length,4);
assert.equal(loads.pdf,1,"Cached queries don't repeat four upstream calls");
clock+=2100;
await search("Quarterly");
assert.equal(loads.design,2,"Cache expires and refreshes");

const broken = createDriveAssetSearch({loaders:{
  pdf:async()=>[{id:assets.pdf,filename:"quarterly-report.pdf"}],
  image:async()=>{throw Error("Image service offline");},
  design:async()=>[],
  "photo-project":async()=>[]
}});
assert.deepEqual((await broken("quarterly")).map(x=>x.assetFamily),["pdf"],"One API outage cannot hide other files");
const unavailable = createDriveAssetSearch({loaders:Object.fromEntries(
  Object.keys(assets).map(family=>[family,async()=>{throw Error("offline")}]))});
assert.deepEqual(await unavailable("quarterly"),[],"Complete outage doesn't throw into the palette");
assert.deepEqual(filterDriveAssetSearch([{assetFamily:"pdf",id:assets.pdf,title:"Test.pdf"}],"test").length,1);
assert.deepEqual(filterDriveAssetSearch([{assetFamily:"pdf",id:assets.pdf,title:"Test.pdf"}],"te"),[]);
// A renamed file must be immediately discoverable under its new name.
// A pending old listing must not overwrite the cache after invalidation.
let filename = "before-rename.pdf";
const mutable = createDriveAssetSearch({loaders:{
  pdf:async()=>[{id:assets.pdf,filename}],
  image:async()=>[],design:async()=>[],"photo-project":async()=>[]
}});
assert.equal((await mutable("before-rename")).length,1);
filename="after-rename.pdf";
assert.equal((await mutable("after-rename")).length,0,"Cached list is intentionally stale before invalidation");
mutable.invalidate();
assert.equal((await mutable("after-rename")).length,1,"Invalidate must refresh renamed filename");
assert.equal((await mutable("before-rename")).length,0,"Old filename must disappear");

let finishOld;
const oldBlocked = new Promise(resolve=>{finishOld=resolve});
let pdfLoads = 0;
const racing = createDriveAssetSearch({loaders:{
  pdf:async()=>{
    const call=++pdfLoads;
    if(call===1){await oldBlocked;return [{id:assets.pdf,filename:"old-pending.pdf"}];}
    return [{id:assets.pdf,filename:"new-saved.pdf"}];
  },
  image:async()=>[],design:async()=>[],"photo-project":async()=>[]
}});
const pendingOld=racing("old-pending");
racing.invalidate();
assert.equal((await racing("new-saved")).length,1);
finishOld();
await pendingOld;
assert.equal((await racing("new-saved")).length,1,
  "An obsolete async request must never replace the freshly cached results");

console.log("Hydria universal Drive asset search, cache, failure isolation and safe routes passed.");
