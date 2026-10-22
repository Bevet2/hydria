import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const filename="drive-recycle-browser-test.pdf";
const pdf=Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n","ascii");
const form=new FormData();
form.append("file",new Blob([pdf],{type:"application/pdf"}),filename);
const creation=await fetch(origin+"/api/drive/pdf-assets",{method:"POST",body:form});
assert.equal(creation.status,201);
const saved=await creation.json();
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
try {
  await page.goto(origin+"/workspace/drive",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.documentElement.dataset.hydriaBoot==="ready");
  const row=()=>page.locator(".hydria-drive-pdf-row").filter({hasText:filename});
  await row().waitFor({timeout:20000});
  await row().getByRole("button",{name:"Mettre à la corbeille "+filename}).click();
  // Confirm cannot happen silently. Escape/Cancel must leave file untouched.
  await row().getByRole("button",{name:"Annuler"}).press("Escape");
  assert.equal(await row().getByRole("button",{name:"Confirmer"}).count(),0);
  assert.equal((await fetch(origin+"/api/drive/pdf-assets").then(r=>r.json())).items.some(x=>x.id===saved.id),true);
  await row().getByRole("button",{name:"Mettre à la corbeille "+filename}).click();
  const trashResponse=page.waitForResponse(r=>r.url().endsWith("/"+saved.id+"/trash")&&r.status()===200);
  await row().getByRole("button",{name:"Confirmer"}).click();
  await trashResponse;
  await row().waitFor({state:"detached",timeout:20000});
  const toggle=page.getByRole("button",{name:"Afficher la corbeille Drive"});
  await toggle.click();
  await row().waitFor({state:"visible",timeout:20000});
  assert.equal(await row().getByRole("link",{name:"Télécharger"}).count(),0,
    "No binary download action should remain while the file is trashed");
  const restoreResponse=page.waitForResponse(r=>r.url().endsWith("/"+saved.id+"/restore")&&r.status()===200);
  await row().getByRole("button",{name:"Restaurer "+filename}).click();
  await restoreResponse;
  await row().waitFor({state:"detached",timeout:20000});
  await page.getByRole("button",{name:"Afficher les fichiers actifs"}).click();
  await row().waitFor({state:"visible",timeout:20000});
  assert.equal((await fetch(origin+"/api/drive/pdf-assets").then(r=>r.json())).items.find(x=>x.id===saved.id)?.revision,1);
  assert.deepEqual(Buffer.from(await fetch(origin+"/api/drive/pdf-assets/"+saved.id+"/download").then(r=>r.arrayBuffer())),pdf);
  assert.deepEqual(errors,[]);
  console.log("Drive recycle browser passed: cancel/escape, confirm, hidden download and restoration.");
} finally {
  await browser.close();
}
