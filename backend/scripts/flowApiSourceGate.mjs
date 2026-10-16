import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listFlowApiSources, readFlowApiSource } from "../services/flow/flowApiSource.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hydria-api-source-"));
const file = path.join(dir, "sources.json");
const authSecret = "never-leak-my-api-key";
const settings = {
  HYDRIA_FLOW_API_SOURCES_FILE: file,
  HYDRIA_FLOW_API_REPORTS_KEY: authSecret
};
const write = (records) => fs.writeFileSync(file, JSON.stringify(records));
const spec = {
  id: "sales_api", label: "Sales API",
  url: "https://api.example.com/v1/sales?year=2026",
  itemsPath: "payload.items", authHeader: "x-api-key", authEnv: "HYDRIA_FLOW_API_REPORTS_KEY",
  maxPages: 3, pageParam: "page", firstPage: 1, pageSizeParam: "size", pageSize: 2
};
let calls = [];
const request = async (url, options) => {
  calls.push({ url, options });
  const page = Number(new URL(url).searchParams.get("page"));
  const data = page === 1 ?
    [{city:"Paris",amount:3,flag:"=SUM(1,2)",nested:{hello:"world"}},
     {city:"Lyon",amount:4}] :
    page === 2 ? [{city:"Nice",amount:9}] : [];
  return new Response(JSON.stringify({payload:{items:data}}),{
    status:200,headers:{"content-type":"application/json"}
  });
};
try {
  write([spec]);
  assert.deepEqual(listFlowApiSources({settings}),[{id:"sales_api",label:"Sales API"}]);
  const result = await readFlowApiSource({sourceId:"sales_api",limit:5,settings,request});
  assert.equal(result.count,3);
  assert.deepEqual(result.columns,["city","amount","flag","nested"]);
  assert.deepEqual(result.rows.map(x=>x.city),["Paris","Lyon","Nice"]);
  assert.equal(result.rows[0].nested,'{"hello":"world"}');
  assert.equal(result.rows[0].flag,"=SUM(1,2)");
  assert.equal(calls.length,2);
  assert.equal(new URL(calls[0].url).searchParams.get("size"),"2");
  assert.equal(new URL(calls[1].url).searchParams.get("page"),"2");
  assert.equal(calls[0].options.headers["x-api-key"],authSecret);
  assert.equal(JSON.stringify(result).includes(authSecret),false);
  assert.equal(calls[0].options.redirect,"error");
  assert.equal(calls[0].options.method,"GET");

  calls=[];
  const onlyOne = await readFlowApiSource({sourceId:"sales_api",limit:1,settings,request:
    async(url,opts)=>{calls.push(url);return new Response(
      JSON.stringify({payload:{items:[{city:"Paris",amount:1}]}}),
      {headers:{"content-type":"application/json"}})}});
  assert.equal(onlyOne.count,1); assert.equal(calls.length,1);
  await assert.rejects(readFlowApiSource({sourceId:"unknown",settings,request}),e=>e.status===404);
  await assert.rejects(readFlowApiSource({sourceId:"https://localhost",settings,request}),/Invalid API source ID/);
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",limit:20001,settings,request}),/1–20,000/);
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",settings:{...settings,HYDRIA_FLOW_API_REPORTS_KEY:""},request}),e=>e.status===503);
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",settings,request:async()=>{throw Error("url and secret "+authSecret)}}),
    e=>e.status===502 && !e.message.includes(authSecret));
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",settings,request:async()=>new Response("<html/>",{headers:{"content-type":"text/html"}})}),
    e=>e.status===502);
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",settings,request:async()=>new Response(
    JSON.stringify({payload:{items:[{x:1},{x:2},{x:3}]}}),{headers:{"content-type":"application/json"}})}),
    e=>e.status===413);
  await assert.rejects(readFlowApiSource({sourceId:"sales_api",settings,request:async()=>new Response(
    JSON.stringify({payload:{items:{"not":"an array"}}}),{headers:{"content-type":"application/json"}})}),
    e=>e.status===502);

  write([{...spec,url:"http://169.254.169.254/latest/meta-data"}]);
  assert.throws(()=>listFlowApiSources({settings}),e=>e.status===503);
  write([{...spec,url:"https://127.0.0.1/path"}]);
  assert.throws(()=>listFlowApiSources({settings}),e=>e.status===503);
  write([{...spec,url:"https://username:password@api.example.com/v1"}]);
  assert.throws(()=>listFlowApiSources({settings}),e=>e.status===503);
  write([{...spec,itemsPath:"payload.constructor.prototype"}]);
  assert.throws(()=>listFlowApiSources({settings}),e=>e.status===503);
  write([spec,spec]);
  assert.throws(()=>listFlowApiSources({settings}),e=>e.status===503);
  write([spec]);
  assert.deepEqual(listFlowApiSources({settings:{}}),[]);
  console.log("Hydria managed API connector gate passed.");
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
