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
    // selectWorkObject updates the route asynchronously; clear the one-shot
    // link after the application finishes its own history change.
    window.setTimeout(()=>{
      const next=new URL(window.location.href);
      if(next.searchParams.has("openObject")){
        next.searchParams.delete("openObject");
        window.history.replaceState(window.history.state,"",next);
      }
    },180);
  };
  const observer=new MutationObserver(attempt);
  observer.observe(document.documentElement,{
    subtree:true,childList:true,attributes:true,attributeFilter:["data-hydria-boot"]
  });
  attempt();
  window.setTimeout(()=>observer.disconnect(),15000);
}
