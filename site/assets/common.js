(function(){
  const year=document.getElementById('year'); if(year)year.textContent=new Date().getFullYear();
  const menu=document.getElementById('mobileToggle'),links=document.getElementById('navLinks');
  if(menu&&links){menu.addEventListener('click',()=>{const active=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(active));}); links.addEventListener('click',e=>{if(e.target.closest('a')){links.classList.remove('open');menu.setAttribute('aria-expanded','false');}});}
  const canonical='https://profofoefule.online/';
  if(location.protocol==='file:')console.info('Use a local HTTP server for data-driven book pages: python3 -m http.server 8000');
  window.ProfSite={
    async loadBooks(){try{let r=await fetch('/api/books',{headers:{Accept:'application/json'}});if(r.ok){let a=await r.json();if(Array.isArray(a))return a;}}catch{}try{let r=await fetch('data/books.json',{cache:'no-store'});if(r.ok){let a=await r.json();return Array.isArray(a)?a:[];}}catch{}return[]},
    esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    safeUrl(raw){const url=String(raw||'').trim();if(!url)return'';try{const u=new URL(url,location.origin);return['https:','http:'].includes(u.protocol)?u.href:'';}catch{return''}},
    fallbackCover(title){return `<div class="book-placeholder"><small>PROF. S. I. OFOEFULE</small><b>${window.ProfSite.esc(title)}</b><small>ACADEMIC COLLECTION</small></div>`}
  };
})();
