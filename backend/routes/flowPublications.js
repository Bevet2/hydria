// Private-pilot publication of a persisted Flow output to native Work Objects.
// Credential scope is the administrator flow token, NOT multi-tenant ACL.
import { Router } from "express";
import { db } from "../db/sqlite.js";
import { checkFlowSourceToken, FlowSourceError } from "../services/flow/flowSqliteSource.js";
import { readFlowResult, listFlowResults, FlowResultError } from "../services/flow/flowResults.js";
import { flowPublicationModels } from "../services/flow/flowPublicationModels.js";
import WorkObjectService from "../src/work-objects/workObject.service.js";
import agenticConfig from "../src/config/agenticConfig.js";
import { AppError } from "../utils/errors.js";

const router=Router();
const objects=new WorkObjectService({
  filePath:agenticConfig.files.workObjectStore,
  rootDir:agenticConfig.files.workObjectRoot
});
function ensureTable(){
  db.exec(`CREATE TABLE IF NOT EXISTS flow_work_object_publications (
    flow_key TEXT NOT NULL,
    output_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    sheet_id TEXT NOT NULL,
    dashboard_id TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (flow_key,output_id,user_id)
  )`);
}
const getPublication=dbQuery=>db.prepare(`
  SELECT sheet_id AS sheetId,dashboard_id AS dashboardId,
         snapshot_id AS snapshotId,updated_at AS updatedAt
    FROM flow_work_object_publications WHERE flow_key=? AND output_id=? AND user_id=?
`).get(...dbQuery);
function requireUserId(value){
  if(!Number.isSafeInteger(value)||value<=0||!db.prepare("SELECT id FROM users WHERE id=?").get(value)){
    throw new FlowResultError("Select an existing Hydria user first.",400);
  }
  return value;
}
async function publish({flowKey,outputId,snapshotId,userId}){
  const id=requireUserId(userId);
  if(typeof outputId!=="string"||!outputId||outputId.length>128){
    throw new FlowResultError("Select a valid output node.",400);
  }
  ensureTable();
  const selected=snapshotId
    ?readFlowResult(db,flowKey,snapshotId)
    :(()=>{
      const latest=listFlowResults(db,flowKey).find(x=>x.outputId===outputId);
      if(!latest)throw new FlowResultError("No saved dataset for this output. Save a dataset first.",404);
      return readFlowResult(db,flowKey,latest.id);
    })();
  if(selected.outputId!==outputId)throw new FlowResultError("Snapshot belongs to another output.",409);
  const existing=getPublication([flowKey,outputId,id]);
  const title=(selected.label||"Flow data").slice(0,90);
  const source={sourceFlowKey:flowKey,sourceOutputId:outputId,sourceSnapshotId:selected.id};
  const sheetModel=flowPublicationModels(selected,{title}).sheet;
  let sheet=existing?.sheetId?objects.get(existing.sheetId):null;
  if(sheet&&sheet.kind!=="dataset")throw new FlowResultError("The published Sheet is no longer a spreadsheet.",409);
  if(!sheet){
    sheet=objects.createBlankWorkObject({
      kind:"dataset",title:"Flow · "+title,userId:id,workspaceFamilyId:"data_spreadsheet",
      metadata:{flowPublication:source}
    });
  }
  await objects.updateContent({
    workObjectId:sheet.id,entryPath:"table.csv",
    content:JSON.stringify(sheetModel,null,2),actorUserId:id,
    expectedRevision:sheet.revision,note:"Flow snapshot "+selected.id,
    actor:"flow-publication"
  });
  const dashboardModel=flowPublicationModels(selected,{sheetId:sheet.id,title}).dashboard;
  let dashboard=existing?.dashboardId?objects.get(existing.dashboardId):null;
  if(dashboard&&dashboard.kind!=="dashboard")throw new FlowResultError("Published Dashboard is no longer a dashboard.",409);
  if(!dashboard){
    dashboard=objects.createBlankWorkObject({
      kind:"dashboard",title:"Flow · "+title+" · Dashboard",
      userId:id,workspaceFamilyId:"analytics_dashboard",
      metadata:{flowPublication:source}
    });
  }
  await objects.updateContent({
    workObjectId:dashboard.id,entryPath:"dashboard.json",
    content:JSON.stringify(dashboardModel,null,2),actorUserId:id,
    expectedRevision:dashboard.revision,note:"Flow snapshot "+selected.id,
    actor:"flow-publication"
  });
  const updatedAt=new Date().toISOString();
  db.prepare(`INSERT INTO flow_work_object_publications
    (flow_key,output_id,user_id,sheet_id,dashboard_id,snapshot_id,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(flow_key,output_id,user_id) DO UPDATE SET
      sheet_id=excluded.sheet_id,dashboard_id=excluded.dashboard_id,
      snapshot_id=excluded.snapshot_id,updated_at=excluded.updated_at`
  ).run(flowKey,outputId,id,sheet.id,dashboard.id,selected.id,updatedAt);
  return {flowKey,outputId,snapshotId:selected.id,updatedAt,
    sheet:{id:sheet.id,title:sheet.title},
    dashboard:{id:dashboard.id,title:dashboard.title},
    rowCount:selected.rowCount};
}
router.post("/",async(req,res,next)=>{
  try{
    checkFlowSourceToken(req.get("x-hydria-flow-token"));
    res.setHeader("Cache-Control","no-store");
    const result=await publish(req.body||{});
    res.status(200).json({success:true,publication:result});
  }catch(err){
    if(err instanceof FlowResultError||err instanceof FlowSourceError||err instanceof AppError){
      res.status(err.status||400).json({success:false,error:err.message});
    }else next(err);
  }
});
router.get("/:flowKey/:outputId", (req,res,next)=>{
  try{
    checkFlowSourceToken(req.get("x-hydria-flow-token"));
    res.setHeader("Cache-Control","no-store");
    const id=requireUserId(Number(req.query.userId));
    // Validate flow ID via the canonical reader, even if no publication exists.
    listFlowResults(db,req.params.flowKey);
    ensureTable();
    const record=getPublication([req.params.flowKey,req.params.outputId,id]);
    if(!record)return res.status(404).json({success:false,error:"No publication found."});
    res.json({success:true,publication:record});
  }catch(err){
    if(err instanceof FlowResultError||err instanceof FlowSourceError){
      res.status(err.status||400).json({success:false,error:err.message});
    }else next(err);
  }
});
export default router;
