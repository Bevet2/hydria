// Hydria OS product shell enhancements.
// Progressive enhancement only: preserve the existing workspace module actions.
const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
  chat:'<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.4A7.5 7.5 0 1 1 20 11.5z"/><path d="M8 11h8M8 14h5"/>',
  docs:'<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v6h5M9 13h7M9 17h7"/>',
  sheets:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M11 9v12"/>',
  slides:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M12 18v3M8 21h8M7 9h6M7 13h10"/>',
  dashboard:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="8" height="7" rx="1"/>',
  crm:'<circle cx="8" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M17 8h5M19.5 5.5v5M16 17h6"/>',
  automation:'<rect x="2.5" y="3" width="7" height="7" rx="1.5"/><rect x="14.5" y="14" width="7" height="7" rx="1.5"/><path d="M9.5 6.5h5a3 3 0 0 1 3 3v4.5M11 18h3.5"/>',
  flows:'<rect x="2" y="8" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="16" y="15" width="6" height="6" rx="1"/><path d="M8 11h3.5a3 3 0 0 0 3-3V6h1.5M8 11h3.5a3 3 0 0 1 3 3v4h1.5"/>',
  builder:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M8 9v12M6 6h.01M9 6h.01"/>',
  whiteboard:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 15 4-4 3 3 3-5M7 18h10"/>',
  code:'<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>'
};
const pages=['home','chat','docs','sheets','slides','dashboard','crm','automation','flows','builder','whiteboard','code'];
const nav=document.getElementById("workspace-switcher");
const workspaceLabel=document.getElementById("os-active-workspace");
const mobileMenu=document.getElementById("os-mobile-menu");
const sidebarScrim=document.getElementById("os-sidebar-scrim");
const collapseBtn=document.getElementById("os-collapse-sidebar");
const themeBtn=document.getElementById("os-theme-toggle");
const searchBtn=document.getElementById("os-command-search");
const safelyGet=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
const safelySet=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const svg=(key)=>`<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[key]||icons.home}</svg>`;
let scheduled=false;
function refreshNavigation(){
  scheduled=false;
  if(!nav)return;
  const chips=[...nav.querySelectorAll(".workspace-switcher-chip")];
  chips.forEach((chip,index)=>{
    const key=chip.classList.contains("workspace-search-chip")?"search":pages[index]||"builder";
    // A data attribute provides future per-module styling without coupling to app.js.
    chip.dataset.osIcon=key;
    if(!chip.querySelector(".os-nav-icon")){
      const span=document.createElement("span");
      span.className="os-nav-icon";
      span.innerHTML=svg(key); // Static trusted SVG constants; no server HTML.
      chip.prepend(span);
    }
    const text=chip.querySelector(":scope > span:not(.os-nav-icon)")?.textContent ||
      chip.textContent.replace(/\d+$/,"").trim();
    chip.title=text;
    if(document.body.classList.contains("os-sidebar-collapsed"))
      chip.setAttribute("aria-label",text);
  });
  const selected=chips.find(x=>x.classList.contains("active"));
  if(selected&&workspaceLabel){
    const name=selected.querySelector(":scope > span:not(.os-nav-icon)")?.textContent ||
      selected.textContent.trim();
    workspaceLabel.textContent=selected.classList.contains("workspace-switcher-home")?"Accueil":name;
    document.title=`${workspaceLabel.textContent} · Hydria OS`;
  }
}
function scheduleNav(){if(!scheduled){scheduled=true;requestAnimationFrame(refreshNavigation);}}
if(nav){
  new MutationObserver(scheduleNav).observe(nav,{childList:true,subtree:false});
  // Rendering replaces nav children; no need for repeated polling or extra events.
  scheduleNav();
}
function setMobileOpen(open){
  document.body.classList.toggle("os-sidebar-open",Boolean(open));
  mobileMenu?.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){
    const first=nav?.querySelector(".workspace-switcher-chip.active");
    first?.focus({preventScroll:true});
  }else mobileMenu?.focus({preventScroll:true});
}
mobileMenu?.addEventListener("click",()=>setMobileOpen(true));
sidebarScrim?.addEventListener("click",()=>setMobileOpen(false));
nav?.addEventListener("click",(event)=>{
  if(event.target.closest("button")&&window.matchMedia("(max-width:960px)").matches) {
    setMobileOpen(false);
  }
});
collapseBtn?.addEventListener("click",()=>{
  if(window.matchMedia("(max-width:960px)").matches){setMobileOpen(false);return;}
  const state=!document.body.classList.contains("os-sidebar-collapsed");
  document.body.classList.toggle("os-sidebar-collapsed",state);
  collapseBtn.setAttribute("aria-label",state?"Déplier la navigation":"Réduire la navigation");
  collapseBtn.title=state?"Déplier la navigation":"Réduire la navigation";
  safelySet("hydria:os:sidebar-collapsed",state?"1":"0");
  scheduleNav();
});
if(safelyGet("hydria:os:sidebar-collapsed")==="1")
  document.body.classList.add("os-sidebar-collapsed");

function applyTheme(theme){
  document.body.dataset.osTheme=theme;
  themeBtn?.setAttribute("aria-label",theme==="dark"?"Passer au thème clair":"Passer au thème sombre");
  themeBtn?.setAttribute("aria-pressed",String(theme==="dark"));
  themeBtn.title=theme==="dark"?"Thème clair":"Thème sombre";
  safelySet("hydria:os:theme",theme);
}
applyTheme(safelyGet("hydria:os:theme")==="dark"?"dark":"light");
themeBtn?.addEventListener("click",()=>applyTheme(
  document.body.dataset.osTheme==="dark"?"light":"dark"
));
searchBtn?.addEventListener("click",()=>{
  nav?.querySelector(".workspace-search-chip")?.click();
});
document.addEventListener("keydown",(event)=>{
  if(event.key==="Escape"&&document.body.classList.contains("os-sidebar-open"))
    setMobileOpen(false);
});

/* The original workspaces are real buttons with native creation callbacks.
   Recompose their DOM into a more useful home layout without replacing events. */
const launcher=document.getElementById("workspace-launcher");
const quickTools=new Set(["docs","sheets","slides","flows"]);
function enhanceLauncher() {
  if(!launcher || launcher.classList.contains("hidden") || launcher.querySelector(".os-home-section, .os-create-card"))return;
  const grid=launcher.querySelector(".workspace-launcher-grid");
  const header=launcher.querySelector(".workspace-launcher-header");
  if(!grid||!header)return;
  const cards=[...grid.querySelectorAll(":scope > .workspace-launcher-card")];
  if(!cards.length)return;

  // A single workspace page must preserve the original create-object click.
  if(grid.classList.contains("workspace-launcher-grid-single")){
    const card=cards[0],kind=card.dataset.workspace||"docs";
    const translated={
      docs:["Créer un document","Rédigez et mettez en forme dans l’éditeur Docs."],
      sheets:["Créer un tableur","Analysez vos données avec Sheets et les formules."],
      slides:["Créer une présentation","Composez vos diapositives dans Slides."],
      dashboard:["Créer un tableau de bord","Visualisez des indicateurs et des graphiques."],
      flows:["Créer un flux de données","Assemblez vos nœuds et exécutez des transformations."],
      automation:["Créer une automatisation","Configurez des étapes et des déclencheurs."],
      whiteboard:["Créer un tableau blanc","Organisez des notes, blocs et connexions."],
      "app-builder":["Créer une application","Construisez et prévisualisez votre interface."],
      "code":["Créer un projet code","Ouvrez un espace de développement."]
    };
    const copy=translated[kind];
    if(copy){
      card.querySelector("strong").textContent=copy[0];
      card.querySelector("span").textContent=copy[1];
    }
    card.classList.add("os-create-card");
    return;
  }
  const title=header.querySelector("h3"), subtitle=header.querySelector("p");
  const pageTitle=document.getElementById("workspace-title");
  const pageSubtitle=document.getElementById("workspace-subtitle");
  if(pageTitle)pageTitle.textContent="Accueil";
  if(pageSubtitle)pageSubtitle.textContent="Retrouvez votre travail ou créez un nouvel élément.";
  if(title)title.textContent="Démarrer";
  if(subtitle)subtitle.textContent="Choisissez un outil pour commencer.";
  const quick=document.createElement("section");
  quick.className="os-home-section";
  const quickTitle=document.createElement("h4");quickTitle.textContent="Nouveau";
  const quickGrid=document.createElement("div");quickGrid.className="os-quick-grid";
  const explore=document.createElement("section");
  explore.className="os-home-section os-home-explore";
  const exploreTitle=document.createElement("h4");exploreTitle.textContent="Explorer les espaces";
  const exploreGrid=document.createElement("div");exploreGrid.className="os-explore-grid";
  for(const card of cards){
    const kind=card.dataset.workspace||"builder";
    const icon=document.createElement("span");icon.className="os-home-card-icon";
    icon.innerHTML=svg(kind==="app-builder"?"builder":kind);
    card.prepend(icon);
    card.setAttribute("title",card.querySelector("strong")?.textContent||kind);
    if(quickTools.has(kind)){
      card.classList.add("os-quick-card");
      quickGrid.appendChild(card);
    }else {
      card.classList.add("os-explore-card");
      const arrow=document.createElement("span");
      arrow.className="os-explore-arrow";
      arrow.textContent="→";
      arrow.setAttribute("aria-hidden","true");
      card.append(arrow);
      exploreGrid.appendChild(card);
    }
  }
  quick.append(quickTitle,quickGrid);
  explore.append(exploreTitle,exploreGrid);
  grid.replaceWith(quick,explore);
}
if(launcher){
  let launcherScheduled=false;
  new MutationObserver(()=>{
    if(launcherScheduled)return;
    launcherScheduled=true;
    requestAnimationFrame(()=>{launcherScheduled=false;enhanceLauncher();});
  }).observe(launcher,{childList:true});
  enhanceLauncher();
}

/* Mobile document navigator: the file explorer becomes an on-demand panel
   instead of permanently pushing the working editor off-screen. */
const mobileFiles=document.getElementById("os-mobile-files");
const workspaceRoot=document.getElementById("workspace-panel-root");
function updateMobileFiles() {
  if(!workspaceRoot || !mobileFiles)return;
  const hasObject=workspaceRoot.dataset.hasWorkspace==="true";
  mobileFiles.hidden=!hasObject;
  if(!hasObject){
    document.body.classList.remove("os-workspace-files-open");
    mobileFiles.setAttribute("aria-expanded","false");
  }
}
mobileFiles?.addEventListener("click",()=>{
  const open=!document.body.classList.contains("os-workspace-files-open");
  document.body.classList.toggle("os-workspace-files-open",open);
  mobileFiles.setAttribute("aria-expanded",String(open));
  mobileFiles.setAttribute("aria-label",open?"Masquer les fichiers":"Afficher les fichiers");
  mobileFiles.title=open?"Masquer les fichiers":"Afficher les fichiers";
  if(open)workspaceRoot?.querySelector(".workspace-sidebar")?.scrollIntoView({block:"nearest",behavior:"instant"});
});
if(workspaceRoot){
  new MutationObserver(updateMobileFiles).observe(workspaceRoot,{attributes:true,attributeFilter:["data-has-workspace"]});
  updateMobileFiles();
}
