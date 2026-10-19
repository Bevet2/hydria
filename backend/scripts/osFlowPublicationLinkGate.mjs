// Browser acceptance: a link to a published native work object must open the
// requested document, not only navigate to the generic workspace landing page.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base=process.env.HYDRIA_VISUAL_BASE_URL||"http://127.0.0.1:3001";
const users=await (await fetch(base+"/api/users")).json();
const id=users.users?.[0]?.id;
assert.ok(id,"Hydria CI must have a selected user");
const make=async(kind,title,workspaceFamilyId)=>{
  const reply=await fetch(base+"/api/work-objects/new",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind,title,workspaceFamilyId,userId:id})});
  assert.equal(reply.status,200,await reply.text());
  const body=await reply.json();
  return body.workObject.id;
};
const sheet=await make("dataset","Hydria deep link Sheet","data_spreadsheet");
const dashboard=await make("dashboard","Hydria deep link Dashboard","analytics_dashboard");
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1365,height:850}});
  for(const [slug,target,expected] of [
    ["sheets",sheet,"Hydria deep link Sheet"],
    ["dashboard",dashboard,"Hydria deep link Dashboard"]
  ]){
    await page.goto(base+"/workspace/"+slug+"?openObject="+encodeURIComponent(target),
      {waitUntil:"domcontentloaded",timeout:20000});
    await page.waitForFunction(()=>document.documentElement.dataset.hydriaBoot==="ready",null,{timeout:22000});
    await page.waitForFunction(id=>{
      const selected=document.querySelector('.hydria-explorer-entry[data-object-id="'+id+'"] .workspace-nav-item');
      return selected?.classList.contains("active")||selected?.classList.contains("is-active")||
        !!document.querySelector('#workspace-panel-root[data-has-workspace="true"]');
    },target,{timeout:15000});
    await page.waitForFunction(
      title=>document.querySelector("#workspace-title")?.textContent?.includes(title),
      expected,{timeout:15000}
    );
    assert.ok(!new URL(page.url()).searchParams.has("openObject"),"Consumed deep link should clear query");
    console.log("Native deep link opened",slug,target);
  }
  await page.close();
  console.log("Hydria Sheets/Dashboard native work object deep-link browser gate passed.");
}finally{await browser.close();}
