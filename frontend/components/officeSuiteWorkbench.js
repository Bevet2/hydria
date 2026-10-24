/** Installed headless Office engines; ElyOffice remains a desktop-only companion. */
function node(tag,className="",text="") {
  const e=document.createElement(tag);
  if(className)e.className=className;
  if(text)e.textContent=text;
  return e;
}
export async function renderOfficeSuiteWorkbench(container) {
  container.replaceChildren();
  const root=node("section","hydria-office-suite");
  root.setAttribute("aria-label","Moteurs Office dans Hydria");
  const title=node("header","hydria-office-head");
  title.append(node("p","hydria-office-eyebrow","HYDRIA / OFFICE ENGINES"),
    node("h2","","Moteurs bureautiques"),
    node("p","","Choisissez un moteur installé pour convertir un fichier. Vos fichiers restent dans votre instance locale."));
  const message=node("p","hydria-office-message","Détection des moteurs…");
  message.setAttribute("role","status");
  root.append(title,message);
  container.append(root);
  try {
    const response=await fetch("/api/office-engines",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("Service indisponible (HTTP "+response.status+")");
    const data=await response.json();
    if(!root.isConnected)return;
    const list=node("div","hydria-office-list");
    const selector=node("select","hydria-office-select");
    selector.setAttribute("aria-label","Moteur de conversion");
    for(const engine of data.engines){
      const row=node("div","hydria-office-engine");
      const copy=node("div","hydria-office-engine-copy");
      copy.append(node("strong","",engine.label),node("span","",engine.mode==="desktop"?"Application locale indépendante":engine.configured?"Chemin du moteur configuré":"Moteur non installé sur ce serveur"));
      const link=node("a","hydria-office-source","Code source");
      link.href=engine.source;link.target="_blank";link.rel="noopener noreferrer";
      row.append(copy,link);
      list.append(row);
      if(engine.mode==="cli"){
        const option=node("option","",engine.label+(engine.configured?"":" · installation requise"));
        option.value=engine.id;option.disabled=!engine.configured;
        selector.append(option);
      }
    }
    const enabled=data.enabled && data.engines.some(e=>e.mode==="cli"&&e.configured);
    message.textContent=!data.enabled?"Passerelle de conversion désactivée. Activez-la uniquement sur une instance Hydria locale privée.":enabled?"Sélectionnez un moteur configuré et un document.":"Installez au moins un moteur et configurez son chemin absolu côté serveur.";
    const form=node("form","hydria-office-form");
    const format=node("select","hydria-office-select");
    format.setAttribute("aria-label","Format de sortie");
    const file=node("input","hydria-office-file");
    file.type="file";file.setAttribute("aria-label","Fichier source");
    const submit=node("button","hydria-artcraft-button","Convertir et télécharger");
    submit.type="submit";submit.disabled=!enabled;
    const selected=()=>data.engines.find(e=>e.id===selector.value);
    const formats=()=>{
      format.replaceChildren();
      const engine=selected();
      for(const suffix of engine?.outputs||[]){const option=node("option","",suffix.toUpperCase());option.value=suffix;format.append(option);}
      file.accept=(engine?.inputs||[]).map(ext=>"."+ext).join(",");
      file.value="";
    };
    selector.addEventListener("change",formats);
    selector.value=data.engines.find(e=>e.mode==="cli"&&e.configured)?.id||"";
    formats();
    form.append(node("label","","Moteur"),selector,node("label","","Document"),file,node("label","","Exporter en"),format,submit);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      if(submit.disabled||!file.files?.[0]){message.textContent="Sélectionnez un fichier.";return;}
      const source=file.files[0];
      if(source.size>12*1024*1024){message.textContent="Fichier limité à 12 Mio.";return;}
      submit.disabled=true;message.textContent="Conversion en cours…";
      try{
        const body=new FormData();body.set("engine",selector.value);body.set("format",format.value);body.set("file",source);
        const response=await fetch("/api/office-engines/convert",{method:"POST",body,credentials:"same-origin"});
        if(!response.ok){const err=await response.json().catch(()=>({}));throw Error(err.error||"HTTP "+response.status);}
        const blob=await response.blob();
        const original=source.name.replace(/\.[^.]+$/,"").replace(/[^\p{L}\p{N}._-]/gu,"_").slice(0,80)||"document";
        const url=URL.createObjectURL(blob);
        try {const a=node("a");a.href=url;a.download=original+"."+format.value;root.append(a);a.click();a.remove();}
        finally {setTimeout(()=>URL.revokeObjectURL(url),10000);}
        message.textContent="Conversion terminée. Vérifiez votre téléchargement.";
      }catch(err){message.textContent=String(err.message||"Conversion impossible.");}
      finally{submit.disabled=false;}
    });
    const note=node("p","hydria-office-note","ElyOffice : ouvrez les fichiers exportés par Hydria dans son application desktop. Cette version ne pilote pas ElyOffice à distance. Les modules Enterprise de GenOffice sont exclus.");
    root.append(list,form,note);
  }catch(error){message.textContent="Impossible de charger les moteurs : "+String(error.message||error);}
}
