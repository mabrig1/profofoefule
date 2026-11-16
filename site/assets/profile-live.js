window.addEventListener("DOMContentLoaded",async()=>{
 try{
  const response=await fetch("/api/profile",{headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)return;
  const {profile}=await response.json();
  if(!profile||typeof profile!=="object")return;
  for(const element of document.querySelectorAll("[data-profile]")){
   const key=element.dataset.profile;
   if(typeof profile[key]==="string")element.textContent=profile[key];
  }
  for(const element of document.querySelectorAll("[data-profile-list]")){
   const key=element.dataset.profileList;
   if(typeof profile[key]!=="string")continue;
   const items=profile[key].split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const nodes=items.map(s=>{const li=document.createElement("li");li.textContent=s;return li;});
   element.replaceChildren(...nodes);
  }
 }catch{} // Original biography remains available if the editorial database is unavailable.
});
