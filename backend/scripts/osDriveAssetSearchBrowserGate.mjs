import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = String(process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001");
const UUIDS = {
  pdf:"20000000-0000-4000-8000-000000000001",
  image:"20000000-0000-4000-8000-000000000002",
  design:"20000000-0000-4000-8000-000000000003",
  photo:"20000000-0000-4000-8000-000000000004"
};
const results = {
  "/api/drive/pdf-assets": [{id:UUIDS.pdf,filename:"search-gate-report.pdf",revision:1}],
  "/api/drive/image-assets": [{id:UUIDS.image,filename:"search-gate-photo.png",revision:1}],
  "/api/drive/design-assets": [{id:UUIDS.design,filename:"search-gate-fig.figcraft",revision:1}],
  "/api/drive/photo-projects": [{id:UUIDS.photo,filename:"search-gate-layered.pcraft",revision:1}]
};
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const page = await browser.newPage({viewport:{width:1280,height:820}});
const errors = [];
page.on("pageerror",error=>errors.push(String(error.message || error)));
try {
  for (const [endpoint,items] of Object.entries(results)) {
    await page.route("**"+endpoint,async route=>{
      await route.fulfill({status:200,contentType:"application/json",
        headers:{"Cache-Control":"no-store"},body:JSON.stringify({items})});
    });
  }
  await page.goto(base + "/workspace/drive",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.documentElement.dataset.hydriaBoot==="ready");
  const opener = page.locator("#os-command-search");
  await opener.click();
  const input = page.locator(".hydria-command-input");
  await input.fill("search-gate");
  const names = Object.values(results).map(items=>items[0].filename);
  for (const name of names) {
    await page.locator(".hydria-command-result").filter({hasText:name})
      .waitFor({state:"visible",timeout:20000});
  }
  assert.equal(await page.locator(".hydria-command-result").count(),4,
    "The search should include PDF, image, design, and photo project");
  // Opening a native asset must navigate to its editor rather than calling
  // the ordinary work-object selector with an unrelated UUID.
  await page.locator(".hydria-command-result").filter({hasText:names[2]}).click();
  await page.waitForURL(url => url.pathname === "/workspace/fig" && url.searchParams.has("designId"), { timeout: 20000 });
  assert.equal(new URL(page.url()).searchParams.get("designId"),UUIDS.design);
  assert.deepEqual(errors,[],"No browser JS exceptions while opening from global search");
  console.log("Global search reaches all four Drive native asset types and deep-links FigCraft.");
} finally {
  await browser.close();
}
