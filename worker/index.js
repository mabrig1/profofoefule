/**
 * Optional Cloudflare Worker backend for Professor Ofoefule's portfolio.
 * Requires Cloudflare Access, D1 and R2 to be configured. Fail-closed by design.
 * No hard-coded admin password or unprotected public write endpoint.
 */
let cachedCerts = null;
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const err=(status,msg)=>json({error:msg},status);
const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s})};
function decodePart(part){const x=part.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(x.padEnd(Math.ceil(x.length/4)*4,'=')),c=>c.charCodeAt(0));return bytes;}
function decodeJson(part){return JSON.parse(new TextDecoder().decode(decodePart(part)))}
async function requireAdmin(req,env){
 const team=String(env.CF_ACCESS_TEAM_DOMAIN||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
 const aud=String(env.CF_ACCESS_AUD||'').trim();
 const admins=String(env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!team||!aud||!admins.length)fail(503,'Publisher studio not configured: Cloudflare Access settings required.');
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)fail(403,'Cross-origin writes are disabled.');
 const fetchSite=req.headers.get('sec-fetch-site');if(fetchSite==='cross-site')fail(403,'Cross-site writes are disabled.');
 const token=req.headers.get('Cf-Access-Jwt-Assertion');if(!token)fail(401,'Cloudflare Access sign-in required.');
 const parts=token.split('.');if(parts.length!==3)fail(401,'Invalid Access token.');
 let head,payload;try{head=decodeJson(parts[0]);payload=decodeJson(parts[1]);}catch{fail(401,'Invalid Access token.');}
 if(head.alg!=='RS256'||!head.kid)fail(401,'Unsupported token signature.');
 const now=Math.floor(Date.now()/1000);
 if(payload.iss!==`https://${team}`||payload.exp<=now||payload.nbf&&payload.nbf>now+30||!Array.isArray(payload.aud)||!payload.aud.includes(aud))fail(401,'Access token claims invalid.');
 if(!admins.includes(String(payload.email||'').toLowerCase()))fail(403,'Account not approved as a publisher.');
 if(!cachedCerts||cachedCerts.until<Date.now()||cachedCerts.team!==team){const r=await fetch(`https://${team}/cdn-cgi/access/certs`);if(!r.ok)fail(503,'Unable to verify Access certificates.');const j=await r.json();cachedCerts={team,keys:j.keys||[],until:Date.now()+30*60*1000};}
 const jwk=cachedCerts.keys.find(k=>k.kid===head.kid);if(!jwk)fail(401,'Access signing key not recognized.');
 const publicKey=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,decodePart(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
 if(!verified)fail(401,'Access token signature invalid.');
 return payload.email;
}
function cleanStr(v,max=220){return String(v??'').trim().slice(0,max)}
function requireUrl(v){if(!v)return'';try{const url=new URL(v,'https://profofoefule.online');if(!['http:','https:'].includes(url.protocol))return'';return String(v).startsWith('/api/media/')?String(v):url.href}catch{return''}}
function normalize(data){
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid book record.');
 const title=cleanStr(data.title),author=cleanStr(data.author,300),summary=cleanStr(data.summary,6000);if(!title||!author||!summary)fail(400,'Title, author and description are required.');
 const status=data.status==='published'?'published':'draft',type=data.type==='chapter'?'chapter':'book';
 const license=data.license==='authorized'?'authorized':'metadata',access=['free','external','inquiry'].includes(data.access)?data.access:'inquiry';
 if(status==='published'&&!cleanStr(data.publisher,200))fail(400,'Publisher must be verified before publishing.');
 if(access==='free'&&license!=='authorized')fail(400,'Free hosted editions require confirmed publication rights.');
 const external_url=requireUrl(data.external_url),cover_url=requireUrl(data.cover_url),sample_url=requireUrl(data.sample_url),full_url=requireUrl(data.full_url);
 if(access==='external'&&!external_url)fail(400,'An external distributor link is required for external purchase access.');
 if(license!=='authorized'&&(sample_url.startsWith('/api/media/')||full_url.startsWith('/api/media/')))fail(400,'Hosted PDF files require rights confirmation.');
 const slug=title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
 if(!slug)fail(400,'Title must produce a valid URL slug.');
 const year=data.year==null||data.year===''?null:Number(data.year);if(year!==null&&(!Number.isInteger(year)||year<1900||year>2100))fail(400,'Publication year invalid.');
 return {slug,title,author,summary,status,type,license,access,year,external_url,cover_url,sample_url,full_url,publisher:cleanStr(data.publisher,200),isbn:cleanStr(data.isbn,45),edition:cleanStr(data.edition,85),format:cleanStr(data.format,75),category:cleanStr(data.category,100)};
}
function publicBook(b){return {id:b.id,slug:b.slug,title:b.title,author:b.author,summary:b.summary,status:b.status,type:b.type,license:b.license,access:b.access,year:b.year,external_url:b.external_url,cover_url:b.cover_url,sample_url:b.sample_url,full_url:b.access==='free'&&b.license==='authorized'?b.full_url:'',publisher:b.publisher,isbn:b.isbn,edition:b.edition,format:b.format,category:b.category,updated_at:b.updated_at}}
function ensureDB(env){if(!env.DB)fail(503,'Book database not configured.');}
const columns=['id','slug','title','author','summary','status','type','license','access','year','external_url','cover_url','sample_url','full_url','publisher','isbn','edition','format','category','updated_at'];
async function listBooks(env,isAdmin=false){let {results}=await env.DB.prepare(`SELECT * FROM books ${isAdmin?'':"WHERE status='published'"} ORDER BY year DESC, updated_at DESC`).all();return results.map(x=>isAdmin?x:publicBook(x));}
async function addBook(env,data){const b=normalize(data),id=crypto.randomUUID(),now=new Date().toISOString();const record={id,...b,updated_at:now};await env.DB.prepare(`INSERT INTO books (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(k=>record[k]??null)).run();return record;}
async function updateBook(env,id,data){const exists=await env.DB.prepare('SELECT * FROM books WHERE id=?').bind(id).first();if(!exists)fail(404,'Book entry not found.');const b=normalize(data),now=new Date().toISOString();await env.DB.prepare(`UPDATE books SET ${columns.filter(k=>k!=='id').map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...columns.filter(k=>k!=='id').map(k=>k==='updated_at'?now:b[k]??null),id).run();return{id,...b,updated_at:now};}
async function uploadFile(req,env){if(!env.BOOK_FILES)fail(503,'File storage not configured.');let form;try{form=await req.formData()}catch{fail(400,'Expected multipart file upload.')}const file=form.get('file'),kind=form.get('kind');if(!(file instanceof File))fail(400,'Choose a file to upload.');if(!['cover','sample','full'].includes(kind))fail(400,'Invalid file type.');const isCover=kind==='cover',max=isCover?8*1024*1024:40*1024*1024;if(file.size>max)fail(413,'File exceeds size limit.');if(file.size<8)fail(400,'File too small.');const mime=String(file.type||'').toLowerCase();let ext;if(isCover){ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];if(!ext)fail(415,'Cover must be JPEG, PNG or WebP.');}else{if(mime!=='application/pdf')fail(415,'Only PDF files are supported for book editions.');ext='pdf';}
 const magic=new Uint8Array(await file.slice(0,16).arrayBuffer());const str=Array.from(magic).map(x=>String.fromCharCode(x)).join('');
 const valid=isCover?ext==='jpg'?magic[0]===0xff&&magic[1]===0xd8&&magic[2]===0xff:ext==='png'?str.startsWith('\x89PNG\r\n\x1a\n'):str.startsWith('RIFF')&&str.slice(8,12)==='WEBP':str.startsWith('%PDF-');if(!valid)fail(415,'File signature does not match its declared format.');
 const key=`files/${crypto.randomUUID()}.${ext}`;await env.BOOK_FILES.put(key,file.stream(),{httpMetadata:{contentType:mime},customMetadata:{kind}});return {url:`/api/media/${key}`,key,bytes:file.size};
}
async function media(req,env,path){ensureDB(env);if(!env.BOOK_FILES)fail(503,'File storage not configured.');const key=path.slice('/api/media/'.length);if(!/^files\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(key))return err(404,'File not found.');const ref=`/api/media/${key}`;
 const book=await env.DB.prepare('SELECT id FROM books WHERE status=\'published\' AND (cover_url=? OR (license=\'authorized\' AND sample_url=?) OR (license=\'authorized\' AND access=\'free\' AND full_url=?)) LIMIT 1').bind(ref,ref,ref).first();if(!book)return err(404,'File not published.');
 const obj=await env.BOOK_FILES.get(key);if(!obj)return err(404,'File unavailable.');const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('etag',obj.httpEtag);headers.set('x-content-type-options','nosniff');headers.set('content-security-policy',"default-src 'none'; sandbox");headers.set('cache-control','public, max-age=3600');headers.set('content-disposition',key.endsWith('.pdf')?'inline':'inline');return new Response(obj.body,{headers});}
export default{async fetch(req,env,ctx){const url=new URL(req.url),path=url.pathname;try{
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(path==='/api/health'&&req.method==='GET')return json({status:'ok',service:'book-library'});
 if(!env.DB)return err(503,'Publishing database not connected.');
 if(path==='/api/books'&&req.method==='GET')return json(await listBooks(env));
 if(path.startsWith('/api/media/')&&req.method==='GET')return media(req,env,path);
 if(!path.startsWith('/api/admin/'))return err(404,'Not found.');
 await requireAdmin(req,env);
 if(path==='/api/admin/books'&&req.method==='GET')return json(await listBooks(env,true));
 if(path==='/api/admin/books'&&req.method==='POST'){const data=await req.json();return json(await addBook(env,data),201)}
 const match=path.match(/^\/api\/admin\/books\/([0-9a-f-]{36})$/);
 if(match&&req.method==='PUT')return json(await updateBook(env,match[1],await req.json()));
 if(match&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM books WHERE id=?').bind(match[1]).run();return json({deleted:true})}
 if(path==='/api/admin/upload'&&req.method==='POST')return json(await uploadFile(req,env));
 return err(404,'Not found.');
 }catch(e){if(e.status)return err(e.status,e.message);console.error('Book worker request failed',e);return err(500,'Server error. Check deployment configuration and logs.');}}};
