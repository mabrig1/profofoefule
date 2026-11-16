// Self-service dashboard. Auth and publishing permissions are enforced server-side.
window.addEventListener("DOMContentLoaded",async()=>{
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 const status=$("#connectionStatus"), pForm=$("#profileForm"), bForm=$("#bookForm"), aForm=$("#articleForm");
 let ready=false,books=[],articles=[];
 const profileKeys=["biography","career","leadership","service","administrative_positions","research","research_outputs","mentorship","affiliations"];
 const bookKeys=["id","title","author","type","summary","year","publisher","isbn","edition","format","category","status","access","license","external_url"];
 const articleKeys=["id","title","authors","journal","year","abstract","doi","link_url","status","license"];
 function announce(selector,message,error=false){const el=$(selector);el.textContent=message;el.classList.toggle("dash-error",error);}
 function setReady(ok){ready=!!ok;all("[data-write]").forEach(x=>x.disabled=!ready);}
 async function request(url,init={}){
   const r=await fetch(url,{...init,headers:{...(init.headers||{}),Accept:"application/json"},credentials:"same-origin",cache:"no-store"});
   let body;try{body=await r.json()}catch{throw Error("Unexpected response from the publishing service.");}
   if(!r.ok)throw Error(body.error||"Request failed ("+r.status+").");
   return body;
 }
 const json=(method,obj)=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(obj)});
 function toObj(form,keys){const o={};for(const key of keys){const el=form.elements.namedItem(key);o[key]=el?el.value:"";}return o;}
 function fill(form,keys,data){for(const key of keys){const el=form.elements.namedItem(key);if(el)el.value=String(data?.[key]??"");}}
 function renderEntries(rootSelector,records,callback){
   const root=$(rootSelector);root.replaceChildren();
   if(!records.length){const p=document.createElement("p");p.className="preview-badge";p.textContent="No entries added yet.";root.append(p);return;}
   for(const record of records){const btn=document.createElement("button");btn.type="button";btn.className="dash-entry";
     const title=document.createElement("strong");title.textContent=record.title;
     const meta=document.createElement("small");meta.textContent=(record.year||"Year not listed")+" · "+record.status;
     btn.append(title,meta);btn.addEventListener("click",()=>callback(record));root.append(btn);}
 }
 function showDelete(type,on){$("#delete"+type).classList.toggle("hidden",!on);}
 function newBook(){bForm.reset();bForm.elements.namedItem("id").value="";bForm.elements.namedItem("author").value="Sabinus Ifeanyi Ofoefule";showDelete("Book",false);announce("#bookMessage","");}
 function editBook(b){newBook();fill(bForm,bookKeys,b);showDelete("Book",true);announce("#bookMessage","Editing "+b.title);}
 function newArticle(){aForm.reset();aForm.elements.namedItem("id").value="";aForm.elements.namedItem("authors").value="Sabinus Ifeanyi Ofoefule";showDelete("Article",false);announce("#articleMessage","");}
 function editArticle(a){newArticle();fill(aForm,articleKeys,a);showDelete("Article",true);announce("#articleMessage","Editing "+a.title);}
 async function refreshBooks(){const x=await request("/api/admin/books");books=Array.isArray(x)?x:[];renderEntries("#bookEntries",books,editBook);}
 async function refreshArticles(){const x=await request("/api/admin/articles");articles=x.articles||[];renderEntries("#articleEntries",articles,editArticle);}
 async function upload(kind,file){
   if(!file)return "";
   const max=kind==="cover"?8:40;
   if(file.size<8||file.size>max*1024*1024)throw Error("Upload limit: "+max+" MB maximum.");
   const form=new FormData();form.append("kind",kind);form.append("file",file);
   const response=await request("/api/admin/upload",{method:"POST",body:form});
   return response.url;
 }
 // Tabs
 for(const tab of all("[data-tab]"))tab.addEventListener("click",()=>{
   const name=tab.dataset.tab;
   all("[data-tab]").forEach(t=>{t.classList.toggle("active",t===tab);t.setAttribute("aria-selected",String(t===tab));});
   all(".dash-panel").forEach(p=>p.classList.toggle("hidden",p.id!=="tab-"+name));
 });
 $("#newBook").addEventListener("click",newBook);
 $("#newArticle").addEventListener("click",newArticle);
 pForm.addEventListener("submit",async e=>{
   e.preventDefault();if(!ready)return;
   const button=pForm.querySelector('[type="submit"]');button.disabled=true;announce("#profileMessage","Saving…");
   try{await request("/api/admin/profile",json("PUT",toObj(pForm,profileKeys)));announce("#profileMessage","Saved! Refresh the public biography to see your changes.");}
   catch(e){announce("#profileMessage",e.message,true)}finally{button.disabled=!ready;}
 });
 bForm.addEventListener("submit",async e=>{
   e.preventDefault();if(!ready)return;
   const button=bForm.querySelector('[type="submit"]');button.disabled=true;announce("#bookMessage","Saving…");
   try{
     const b=toObj(bForm,bookKeys),old=books.find(x=>x.id===b.id);
     Object.assign(b,{cover_url:old?.cover_url||"",sample_url:old?.sample_url||"",full_url:old?.full_url||""});
     if(b.license!=="authorized"){b.sample_url="";b.full_url="";}
     const cover=bForm.elements.namedItem("coverFile").files[0],sample=bForm.elements.namedItem("sampleFile").files[0],full=bForm.elements.namedItem("fullFile").files[0];
     if((sample||full)&&b.license!=="authorized")throw Error("Select PDF hosting permission before uploading files.");
     if(cover)b.cover_url=await upload("cover",cover);
     if(sample)b.sample_url=await upload("sample",sample);
     if(full)b.full_url=await upload("full",full);
     await request(b.id?"/api/admin/books/"+encodeURIComponent(b.id):"/api/admin/books",json(b.id?"PUT":"POST",b));
     await refreshBooks();newBook();announce("#bookMessage","Book saved. Published entries appear in the library.");
   }catch(e){announce("#bookMessage",e.message,true)}finally{button.disabled=!ready;}
 });
 aForm.addEventListener("submit",async e=>{
   e.preventDefault();if(!ready)return;
   const button=aForm.querySelector('[type="submit"]');button.disabled=true;announce("#articleMessage","Saving…");
   try{
     const a=toObj(aForm,articleKeys),old=articles.find(x=>x.id===a.id);
     a.pdf_url=a.license==="authorized"?(old?.pdf_url||""):"";
     const pdf=aForm.elements.namedItem("articleFile").files[0];
     if(pdf&&a.license!=="authorized")throw Error("Select PDF hosting permission before uploading an article file.");
     if(pdf)a.pdf_url=await upload("article",pdf);
     await request(a.id?"/api/admin/articles/"+encodeURIComponent(a.id):"/api/admin/articles",json(a.id?"PUT":"POST",a));
     await refreshArticles();newArticle();announce("#articleMessage","Article saved. Published entries appear on the research page.");
   }catch(e){announce("#articleMessage",e.message,true)}finally{button.disabled=!ready;}
 });
 $("#deleteBook").addEventListener("click",async()=>{
   const id=bForm.elements.namedItem("id").value;if(!ready||!id||!confirm("Delete this book record?"))return;
   try{await request("/api/admin/books/"+encodeURIComponent(id),{method:"DELETE"});await refreshBooks();newBook();announce("#bookMessage","Book record deleted.");}
   catch(e){announce("#bookMessage",e.message,true);}
 });
 $("#deleteArticle").addEventListener("click",async()=>{
   const id=aForm.elements.namedItem("id").value;if(!ready||!id||!confirm("Delete this article record?"))return;
   try{await request("/api/admin/articles/"+encodeURIComponent(id),{method:"DELETE"});await refreshArticles();newArticle();announce("#articleMessage","Article record deleted.");}
   catch(e){announce("#articleMessage",e.message,true);}
 });
 setReady(false);newBook();newArticle();
 try{
   const defaults=await (await fetch("data/profile-defaults.json",{cache:"no-store"})).json();
   fill(pForm,profileKeys,defaults);
 }catch{announce("#profileMessage","Starting biography could not be loaded.",true);}
 try{
   const s=await request("/api/admin/session");
   if(!s.authenticated){status.textContent="Cloudflare Access authentication required.";return;}
   if(!s.database_ready){status.textContent="Setup needed: connect D1 database and apply migrations before editing.";return;}
   status.textContent="Secure publishing connected"+(s.files_ready?" · File uploads enabled":" · Connect R2 for file uploads");
   setReady(true);
   const [profile]=await Promise.all([request("/api/admin/profile"),refreshBooks(),refreshArticles()]);
   if(profile.profile)fill(pForm,profileKeys,profile.profile);
 }catch(e){status.textContent="Publishing unavailable: "+e.message;setReady(false);}
});
