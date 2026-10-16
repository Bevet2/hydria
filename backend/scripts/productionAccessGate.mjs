import assert from "node:assert/strict";
import express from "express";
import { productionSettings, ProductionConfigError, createProductionAccessGate } from "../middleware/osProductionAccess.js";

const username = "single_owner";
const password = "production-test-password-that-is-long";
const origin = "https://os.example.org";
const env = { NODE_ENV:"production",
  HYDRIA_OS_ACCESS_USERNAME:username,
  HYDRIA_OS_ACCESS_PASSWORD:password,
  HYDRIA_OS_PUBLIC_ORIGIN:origin
};
assert.equal(productionSettings({NODE_ENV:"test"}).production,false);
for (const config of [
  {...env,HYDRIA_OS_ACCESS_USERNAME:""},
  {...env,HYDRIA_OS_ACCESS_PASSWORD:"change-me"},
  {...env,HYDRIA_OS_ACCESS_PASSWORD:"abc"},
  {...env,HYDRIA_OS_PUBLIC_ORIGIN:"http://os.example.org"},
  {...env,HYDRIA_OS_PUBLIC_ORIGIN:"https://localhost:3001"},
  {...env,HYDRIA_OS_PUBLIC_ORIGIN:"https://os.example.org/path"}
]) assert.throws(()=>productionSettings(config),ProductionConfigError);
const app=express();
app.use(createProductionAccessGate(productionSettings(env)));
app.get("/livez",(_req,res)=>res.send("ok"));
app.get("/api/private",(_req,res)=>res.json({message:"private"}));
app.post("/api/write",(req,res)=>res.json({written:true}));
const server=app.listen(0,"127.0.0.1");
await new Promise(resolve=>server.once("listening",resolve));
const base="http://127.0.0.1:"+server.address().port;
const basic=(user,pass)=>"Basic "+Buffer.from(user+":"+pass).toString("base64");
const auth={authorization:basic(username,password)};
try {
  assert.equal((await fetch(base+"/livez")).status,200);
  const denied=await fetch(base+"/api/private");
  assert.equal(denied.status,401);
  assert.match(denied.headers.get("www-authenticate"),/Basic realm="Hydria OS"/);
  assert.equal((await fetch(base+"/api/private",{headers:{
    authorization:basic(username,"bad-password")
  }})).status,401);
  assert.equal((await fetch(base+"/api/private",{headers:{
    authorization:basic("bad-user",password)
  }})).status,401);
  assert.equal((await fetch(base+"/api/private",{headers:{
    authorization:"Basic ??"
  }})).status,401);
  const success=await fetch(base+"/api/private",{headers:auth});
  assert.equal(success.status,200);
  assert.equal(success.headers.get("x-content-type-options"),"nosniff");
  assert.equal(success.headers.get("x-frame-options"),"DENY");
  assert.equal((await success.json()).message,"private");
  assert.equal((await fetch(base+"/api/write",{method:"POST",
    headers:{...auth,origin:"https://attacker.example"}
  })).status,403);
  assert.equal((await fetch(base+"/api/write",{method:"POST",
    headers:{...auth,origin,"sec-fetch-site":"cross-site"}
  })).status,403);
  assert.equal((await fetch(base+"/api/write",{method:"POST",
    headers:{...auth,origin,"sec-fetch-site":"same-origin"}
  })).status,200);
  assert.equal((await fetch(base+"/api/write",{method:"POST",headers:auth})).status,200);
  assert.equal((await fetch(base+"/api/write",{method:"POST",
    headers:{origin}
  })).status,401);
  console.log("Hydria production access gate passed.");
} finally {
  await new Promise((resolve,reject)=>server.close((err)=>err?reject(err):resolve()));
}
