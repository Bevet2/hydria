import assert from "node:assert/strict";
const origin=process.env.HYDRIA_TEST_ORIGIN || "http://127.0.0.1:3001";
const api=origin+"/api/drive/pdf-assets";
async function usage() {
  const r=await fetch(origin+"/api/drive/usage");
  assert.equal(r.status,200);
  assert.match(r.headers.get("cache-control")||"",/no-store/);
  const u=await r.json();
  assert.equal(u.scope,"sqlite-indexed-file-bytes");
  assert.equal(u.families.length,4);
  assert.equal(u.total.storedBytes,
    u.families.reduce((n,f)=>n+f.storedBytes,0));
  return u;
}
const before=(await usage()).total;
const pdf=Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n","ascii");
const newer=Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Lang (fr) >>\nendobj\nstartxref\n0\n%%EOF\n","ascii");
function data(bytes,name,revision=null) {
  const form=new FormData();
  form.append("file",new Blob([bytes],{type:"application/pdf"}),name);
  if (revision!==null) form.append("expectedRevision",String(revision));
  return form;
}
const created=await fetch(api,{method:"POST",body:data(pdf,"usage-test.pdf")});
assert.equal(created.status,201);
const asset=await created.json();
const afterCreate=(await usage()).total;
assert.equal(afterCreate.activeFiles,before.activeFiles+1);
assert.equal(afterCreate.versions,before.versions+1);
assert.equal(afterCreate.activeBytes,before.activeBytes+pdf.length);
assert.equal(afterCreate.storedBytes,before.storedBytes+pdf.length);
const revised=await fetch(api+"/"+asset.id+"/versions",{
  method:"POST",body:data(newer,"usage-test.pdf",1)
});
assert.equal(revised.status,201);
const afterRevision=(await usage()).total;
assert.equal(afterRevision.versions,afterCreate.versions+1);
assert.equal(afterRevision.storedBytes,afterCreate.storedBytes+newer.length);
assert.equal(afterRevision.activeBytes,afterCreate.activeBytes-pdf.length+newer.length);
assert.equal(afterRevision.historicalBytes,afterCreate.historicalBytes+pdf.length);
const mutate=async(op)=>fetch(api+"/"+asset.id+"/"+op,{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({expectedFilename:"usage-test.pdf",expectedRevision:2})
});
assert.equal((await mutate("trash")).status,200);
const inTrash=(await usage()).total;
assert.equal(inTrash.storedBytes,afterRevision.storedBytes);
assert.equal(inTrash.activeFiles,afterRevision.activeFiles-1);
assert.equal(inTrash.trashedFiles,afterRevision.trashedFiles+1);
assert.equal(inTrash.trashedBytes,afterRevision.trashedBytes+newer.length);
assert.equal(inTrash.activeBytes,afterRevision.activeBytes-newer.length);
assert.equal((await mutate("restore")).status,200);
const afterRestore=(await usage()).total;
assert.deepEqual(afterRestore,afterRevision,"Restore doesn't duplicate stored bytes or revisions");
console.log("Drive storage HTTP usage passed: upload, versioning, trash and restoration.");
