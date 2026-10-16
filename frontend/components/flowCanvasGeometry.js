// Geometry shared by pointer interactions and automatic viewport fitting.
// Coordinates are in the graph's unscaled 1800x1200 workspace.
const GRAPH_WIDTH=1800, GRAPH_HEIGHT=1200;
const NODE_WIDTH=216, NODE_HEIGHT=120;
export function flowNodePositionFromClient(clientX,clientY,graphRect,zoom=1) {
  const scale=Number(zoom);
  if(!Number.isFinite(scale)||scale<=0)throw new Error("Invalid flow zoom");
  const x=(Number(clientX)-graphRect.left)/scale-NODE_WIDTH/2;
  const y=(Number(clientY)-graphRect.top)/scale-36;
  const finite=(v)=>Number.isFinite(v)?v:0;
  return {
    x:Math.round(Math.max(0,Math.min(GRAPH_WIDTH-NODE_WIDTH,finite(x)))),
    y:Math.round(Math.max(0,Math.min(GRAPH_HEIGHT-NODE_HEIGHT,finite(y))))
  };
}
export function flowGraphFit(stages,viewportWidth,viewportHeight) {
  const entries=Array.isArray(stages)?stages:[];
  if(!entries.length)return {zoom:1,scrollLeft:0,scrollTop:0};
  const points=entries.map(item=>({
    x:Number.isFinite(Number(item.x))?Number(item.x):0,
    y:Number.isFinite(Number(item.y))?Number(item.y):0
  }));
  const left=Math.min(...points.map(p=>p.x));
  const top=Math.min(...points.map(p=>p.y));
  const right=Math.max(...points.map(p=>p.x+NODE_WIDTH));
  const bottom=Math.max(...points.map(p=>p.y+NODE_HEIGHT));
  const width=Math.max(1,Number(viewportWidth)||1),height=Math.max(1,Number(viewportHeight)||1);
  const padding=36;
  const scale=Math.min(1.5,Math.max(0.5,Math.min(
    (width-padding*2)/(right-left),(height-padding*2)/(bottom-top)
  )));
  return {
    zoom:Math.round(scale*100)/100,
    scrollLeft:Math.max(0,Math.round(left*scale-padding)),
    scrollTop:Math.max(0,Math.round(top*scale-padding))
  };
}

// Place a new block as near as possible to the user's drop point without
// covering existing blocks. Default collision margin keeps port hit targets usable.
export function flowAvoidNodeOverlap(position,stages=[],gap=18) {
  const occupied=Array.isArray(stages)?stages:[];
  const collides=(test)=>occupied.some(item=>{
    const x=Number(item.x)||0,y=Number(item.y)||0;
    return test.x < x+NODE_WIDTH+gap && test.x+NODE_WIDTH+gap > x &&
      test.y < y+NODE_HEIGHT+gap && test.y+NODE_HEIGHT+gap > y;
  });
  const inside=(test)=>test.x>=0&&test.y>=0&&
    test.x<=GRAPH_WIDTH-NODE_WIDTH&&test.y<=GRAPH_HEIGHT-NODE_HEIGHT;
  if(inside(position)&&!collides(position))return position;
  const dx=NODE_WIDTH+gap,dy=NODE_HEIGHT+gap;
  const candidates=[];
  // Progressive rings prioritize the shortest *pixel* distance to the drop.
  for(let ring=1;ring<=10;ring++){
    for(let x=-ring;x<=ring;x++){
      for(let y=-ring;y<=ring;y++){
        if(Math.max(Math.abs(x),Math.abs(y))!==ring)continue;
        const candidate={x:position.x+x*dx,y:position.y+y*dy};
        if(!inside(candidate))continue;
        candidates.push({candidate,distance:Math.hypot(x*dx,y*dy)});
      }
    }
    candidates.sort((a,b)=>a.distance-b.distance||
      a.candidate.y-b.candidate.y||a.candidate.x-b.candidate.x);
    const free=candidates.find(item=>!collides(item.candidate));
    if(free)return free.candidate;
    candidates.length=0;
  }
  return position; // A saturated graph remains editable; never block adding.
}
