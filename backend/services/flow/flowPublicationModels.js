// Preserve the native Hydria Sheets/Dashboard formats when publishing a saved
// Flow Manager output. No formula evaluation, HTML insertion or external I/O.
import { FlowResultError } from "./flowResults.js";

const MAX_ROWS=5000, MAX_COLUMNS=50, MAX_CELLS=100000;
const clip=(value)=>String(value ?? "").slice(0,8192);
const number=(value)=>{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  return null;
};
export function flowPublicationModels(snapshot, { sheetId="", title="" } = {}) {
  const source=Array.isArray(snapshot?.rows)?snapshot.rows:null;
  if(!source)throw new FlowResultError("Invalid saved result.",400);
  const columns=[...new Set(source.flatMap(row=>Object.keys(row||{})))];
  if(source.length>MAX_ROWS || columns.length>MAX_COLUMNS ||
      (source.length+1)*Math.max(columns.length,1)>MAX_CELLS) {
    throw new FlowResultError("Publish supports 5,000 rows, 50 columns and 100,000 cells maximum.",413);
  }
  const safeColumns=columns.map(clip);
  // Escaping formula-like strings matters when content is later exported to CSV
  // or passed through Sheet formula engines. Numeric input remains numeric.
  const cell=(value)=>{
    if(value===null||value===undefined)return "";
    if(typeof value==="number")return Number.isFinite(value)?value:"";
    if(typeof value==="boolean")return value;
    const str=typeof value==="string"?value:JSON.stringify(value);
    return /^[=+@\-\t\r]/.test(str)?"'"+clip(str):clip(str);
  };
  const tableRows=source.map(row=>columns.map(column=>cell(row[column])));
  const sheetTitle=clip(title||snapshot.label||"Flow result").slice(0,100);
  const tab={
    id:"sheet-1",name:"Flow data",columns:safeColumns,
    rows:[safeColumns,...tableRows],columnWidths:{},rowHeights:{},merges:[],
    cellFormats:{},cellNotes:{},dataValidations:{},conditionalFormats:[],
    tables:[],pivotTables:[],charts:[],sparklines:[],slicers:[],
    filterQuery:"",filterColumnIndex:-1,tableFilters:{},sort:null,
    hidden:false,protected:false,protectedRanges:[],zoomLevel:1,showGridlines:true,
    frozenRows:1,frozenColumns:0
  };
  const sheet={kind:"hydria-sheet",version:1,activeSheetId:"sheet-1",namedRanges:[],sheets:[tab]};
  const category=columns.find(col=>source.some(row=>typeof row[col]==="string"))||columns[0]||"Row";
  const measure=columns.find(col=>source.some(row=>number(row[col])!==null))||"";
  const groups=new Map();
  for(const [idx,row] of source.entries()){
    const key=category==="Row"?String(idx+1):clip(row[category]||"(vide)").slice(0,80);
    groups.set(key,(groups.get(key)||0)+(measure?(number(row[measure])??0):1));
  }
  const points=[...groups.entries()].slice(0,12).map(([label,value])=>({label,value}));
  const total=points.reduce((sum,x)=>sum+x.value,0);
  const dash={
    title:sheetTitle+" · Dashboard",
    summary:"Flow Manager · "+source.length+" lignes · actualisé le "+snapshot.createdAt,
    source:{type:"hydria-sheet",workObjectId:sheetId,filePath:"table.csv",
      sheetId:"sheet-1",sheetName:"Flow data",title:sheetTitle},
    filters:["Overview"],
    metrics:[{label:"Rows",value:String(source.length),delta:""},
      {label:measure?("Total "+measure):"Groups",value:String(measure?
        source.reduce((acc,row)=>acc+(number(row[measure])??0),0):groups.size),delta:""}],
    charts:[{id:"chart-1",kind:"bar",title:measure?(measure+" by "+category):"Rows by "+category,points}],
    widgets:[],
    table:{columns:safeColumns,rows:tableRows.slice(0,200).map(row=>row.map(v=>clip(v)))}
  };
  return {sheet,dashboard:dash,columns:safeColumns,rowCount:source.length};
}
