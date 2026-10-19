// Deep-link to a native work object after the Hydria app has hydrated.
// The existing library button remains the only opener; never bypass access
// checks or duplicate the application's file/editor state.
const target=new URLSearchParams(window.location.search).get("openObject")||"";
if(/^[a-zA-Z0-9-]{8,80}$/.test(target)){
  let complete=false;
  const attempt=()=>{
    if(complete || document.documentElement.dataset.hydriaBoot!=="ready")return;
    const items=document.querySelectorAll("#workspace-object-list .hydria-explorer-entry[data-object-id]");
    const match=[...items].find(x=>x.dataset.objectId===target);
    const action=match?.querySelector(".workspace-nav-item");
    if(!action)return;
    complete=true;
    observer.disconnect();
    action.click();
    const next=new URL(window.location.href);
    next.searchParams.delete("openObject");
    window.history.replaceState(window.history.state,"",next);
  };
  const observer=new MutationObserver(attempt);
  observer.observe(document.documentElement,{
    subtree:true,childList:true,attributes:true,attributeFilter:["data-hydria-boot"]
  });
  attempt();
  window.setTimeout(()=>observer.disconnect(),15000);
}
