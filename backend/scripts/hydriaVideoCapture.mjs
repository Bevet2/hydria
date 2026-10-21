import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
const out=path.resolve("dist/hydria-film-shots");
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const successes=[],failures=[];
const capture=async(page,id,url,{heading=null}={})=>{
 try{
  const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:40000});
  if(!response||response.status()>=400)throw Error("HTTP "+response?.status());
  if(heading)await page.getByRole("heading",{name:heading,exact:true}).first().waitFor({state:"visible",timeout:18000});
  await page.waitForTimeout(450);
  const file=path.join(out,id+".png");
  await page.screenshot({path:file,fullPage:false,animations:"disabled"});
  const stats=await fs.stat(file);
  if(stats.size<6000)throw Error("Screenshot unexpectedly small");
  successes.push({id,url,bytes:stats.size});
  console.log("SCREENSHOT",id,stats.size);
 }catch(error){failures.push({id,url,error:String(error)});console.log("CAPTURE_FAILED",id,String(error).slice(0,400));}
};
try{
 const os=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 const base="http://127.0.0.1:3001";
 await capture(os,"os-home",base+"/");
 for(const key of ["chat","drive","docs","sheets","slides","dashboard","crm","automation","flows","builder","whiteboard","code","pdf","photo","fig"]){
  const slug=key==="flows"?"flows":key;
  await capture(os,"os-"+key,base+"/workspace/"+slug);
 }
 await os.close();
 const crm=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 const host="http://127.0.0.1:5174";
 await crm.goto(host+"/crm/login",{waitUntil:"domcontentloaded",timeout:40000});
 await crm.getByLabel("Email",{exact:true}).fill("admin@northstar.local");
 await crm.getByLabel("Password",{exact:true}).fill("Northstar123!");
 await crm.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
 await crm.waitForURL(url => url.pathname === "/crm" || url.pathname === "/crm/",{timeout:20000});
 for(const [key,route,title] of [
 ["dashboard","","Dashboard"],["contacts","contacts","Contacts"],["companies","companies","Companies"],
 ["leads","leads","Leads"],["pipeline","pipeline","Pipeline"],["products","products","Products"],
 ["tasks","tasks","Tasks"],["tickets","tickets","Tickets"],["reports","reports","Reports"],
 ["sales-ops","sales-ops","Sales Operations"],["communications","communications","Communications"],
 ["custom-objects","custom-objects","Custom Objects"],["platform","platform","Platform"],["settings","settings","Settings"]
 ]){
  await capture(crm,"crm-"+key,host+"/crm/"+route);
 }
 await crm.close();
}finally{await browser.close();}
const manifest={date:new Date().toISOString(),successes,failures};
await fs.writeFile(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2));
console.log("Capture summary",JSON.stringify({successes:successes.length,failures:failures.length}));
if(!successes.some(x=>x.id==="crm-dashboard"))process.exitCode=1;
