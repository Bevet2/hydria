import assert from "node:assert/strict";
import AdmZip from "adm-zip";

const base = process.env.HYDRIA_VISUAL_BASE_URL || "http://127.0.0.1:3001";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAIAAAD38zoCAAAAFElEQVR4nGOUqzjBgA0wYRWlrgQAqm4BaJxIOe4AAAAASUVORK5CYII=";
const src = "data:image/png;base64," + png;
const element = { id: "picture", type: "image", text: "Chart screenshot",
  src, x: 20, y: 16, w: 60, h: 62 };
const slideMeta = (e) => '<!-- hydria-slide: ' + JSON.stringify({elements:[e], notes:"Image export test"}) + ' -->';
async function call(markdown) {
  return fetch(base + "/api/work-objects/export-smoke/presentation-export", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({title:"Hydria slide image test",markdown})
  });
}
const response = await call("# Hydria\n\n## Image slide\n" + slideMeta(element));
assert.equal(response.status,200,await response.clone().text());
const archive = new AdmZip(Buffer.from(await response.arrayBuffer()));
const media = archive.getEntries().filter(x=>/^ppt\/media\/.*\.png$/i.test(x.entryName));
assert.ok(media.length>=1,"PPTX must contain a real PNG media entry");
const slideXml = archive.readAsText("ppt/slides/slide1.xml");
assert.match(slideXml,/<p:pic\b/,"Slide should contain a picture rather than a text placeholder");
assert.match(archive.readAsText("ppt/notesSlides/notesSlide1.xml"),/Image export test/);
const tooLarge = await call("# Test\n\n## Big image\n" + slideMeta({
  ...element,src:"data:image/png;base64," + "A".repeat(1_400_000)
}));
assert.equal(tooLarge.status,413,"Oversized PowerPoint media must be rejected");
console.log("Hydria PPTX embedded image and limits gate passed.");
