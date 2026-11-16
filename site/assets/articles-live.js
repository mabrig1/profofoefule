window.addEventListener("DOMContentLoaded",async()=>{
 const root=document.getElementById("editorArticles");if(!root)return;
 try{
  const r=await fetch("/api/articles",{headers:{Accept:"application/json"},cache:"no-store"});
  if(!r.ok)return;const body=await r.json(),items=body.articles;
  if(!Array.isArray(items)||!items.length)return;
  const box=document.createElement("section");
  const kicker=document.createElement("div");kicker.className="section-kicker";kicker.textContent="RECENTLY ADDED WORK";
  const heading=document.createElement("h2");heading.textContent="Additional research articles";heading.style.margin="12px 0 22px";
  box.append(kicker,heading);
  for(const a of items){
   const item=document.createElement("div");item.className="pub-item";
   const year=document.createElement("span");year.className="pub-year";year.textContent=a.year||"ART.";
   const main=document.createElement("div");
   const title=document.createElement("h3");title.textContent=a.title;
   const desc=document.createElement("p");desc.textContent=[a.authors,a.journal].filter(Boolean).join(" · ");
   main.append(title,desc);
   if(a.abstract){const summary=document.createElement("p");summary.textContent=a.abstract;summary.style.marginTop="7px";main.append(summary);}
   const link=document.createElement("a");
   const dest=a.link_url||(a.doi?"https://doi.org/"+a.doi:"")||a.pdf_url;
   if(dest){link.href=dest;link.target="_blank";link.rel="noopener noreferrer";link.textContent="↗";link.setAttribute("aria-label","View "+a.title);}
   else{link.textContent="";}
   item.append(year,main,link);
   if(a.pdf_url&&dest!==a.pdf_url){
     const pdf=document.createElement("a");pdf.href=a.pdf_url;pdf.target="_blank";pdf.rel="noopener noreferrer";
     pdf.textContent="PDF";pdf.style.fontSize="12px";pdf.style.alignSelf="center";
     main.append(pdf);
   }
   box.append(item);
  }
  root.replaceChildren(box);
 }catch{} // Keep source-linked static articles visible during outages.
});
