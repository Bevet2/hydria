import { Router } from "express";
import multer from "multer";
import { ENGINE_CATALOG, convertOfficeFile, officeEngineState } from "../services/office/officeEngines.js";

const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024,files:1,fields:2,parts:3}});
const localConnection=req=>["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
const sameOrigin=req=>{
  const origin=req.get("origin");
  if(req.get("sec-fetch-site")==="cross-site") return false;
  if(!origin) return true;
  try{return new URL(origin).host===req.get("host") && ["http:","https:"].includes(new URL(origin).protocol);}
  catch{return false;}
};
const enabled=()=>process.env.HYDRIA_OFFICE_ENGINES_ENABLED==="true" && process.env.NODE_ENV!=="production";

router.get("/",(_req,res)=>{
  res.set("Cache-Control","no-store");
  res.json({success:true,enabled:enabled(),engines:ENGINE_CATALOG.map(e=>officeEngineState(e.id))});
});
let active=0;
router.post("/convert",(req,res)=>{
  if(!enabled()) return res.status(403).json({success:false,error:"Passerelle Office désactivée dans cet environnement."});
  if(!localConnection(req)||!sameOrigin(req)) return res.status(403).json({success:false,error:"Accès local et origine Hydria requis."});
  if(active>=2) return res.status(429).json({success:false,error:"Deux conversions simultanées au maximum."});
  upload.single("file")(req,res,async error=>{
    if(error) return res.status(400).json({success:false,error:"Fichier invalide ou supérieur à 12 Mio."});
    if(!req.file) return res.status(400).json({success:false,error:"Sélectionnez un fichier."});
    active++;
    try {
      const result=await convertOfficeFile({engine:req.body.engine,filename:req.file.originalname,bytes:req.file.buffer,format:req.body.format});
      const mime={docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",gif:"image/gif",csv:"text/csv; charset=utf-8",txt:"text/plain; charset=utf-8",html:"text/html; charset=utf-8",md:"text/markdown; charset=utf-8"};
      res.set("Cache-Control","no-store");
      res.type(mime[result.format]||"application/octet-stream");
      res.attachment(result.filename);
      res.send(result.buffer);
    } catch(err) {
      res.status(422).json({success:false,error:String(err?.message||"Conversion impossible.").slice(0,240)});
    } finally { active--; }
  });
});
export default router;
