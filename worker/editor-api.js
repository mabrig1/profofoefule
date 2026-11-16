// Cloudflare-backed self-service editorial API. No browser-supplied identity is trusted.
const send=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const trim=(x,max)=>String(x==null?"":x).trim().slice(0,max);
const profileKeys=["biography","career","leadership","service","administrative_positions","research","research_outputs","mentorship","affiliations"];
const maxLen={biography:3500,career:2500,leadership:3500,service:2000,administrative_positions:3000,research:3500,research_outputs:2000,mentorship:2000,affiliations:3500};
const idOk=x=>/^[a-z0-9-]{36}$/i.test(x||"");
const mediaUrl=x=>/^\/api\/media\/files\/[0-9a-f-]{36}\.(?:pdf|png|jpg|webp)$/i.test(x||"");
function safeExternal(raw){
 const s=trim(raw,1800);if(!s)return "";
 try{const u=new URL(s);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)fail(400,"Use an HTTP(S) publication URL.");return u.toString()}catch(e){if(e.status)throw e;fail(400,"Invalid publication URL.")}
}
export function normalizeProfile(data){
 if(!data||typeof data!=="object"||Array.isArray(data))fail(400,"Invalid profile.");
 const result={};
 for(const key of profileKeys){if(typeof data[key]!=="string")fail(400,"Missing profile field: "+key);if(data[key].length>maxLen[key])fail(400,"Field is too long: "+key);result[key]=data[key].trim();}
 if(!result.biography)fail(400,"Biography is required.");
 return result;
}
export function normalizeArticle(data){
 if(!data||typeof data!=="object"||Array.isArray(data))fail(400,"Invalid article.");
 const a={title:trim(data.title,350),authors:trim(data.authors,350),journal:trim(data.journal,250),
  abstract:trim(data.abstract,7000),doi:trim(data.doi,200),link_url:safeExternal(data.link_url),
  pdf_url:trim(data.pdf_url,250),year:data.year===""||data.year==null?null:Number(data.year),
  status:data.status==="published"?"published":"draft",license:data.license==="authorized"?"authorized":"metadata"};
 if(!a.title||!a.authors)fail(400,"Article title and author(s) are required.");
 if(a.year!==null&&(!Number.isInteger(a.year)||a.year<1900||a.year>2100))fail(400,"Invalid article year.");
 if(a.doi&&!/^10\.\d{4,9}\/\S+$/i.test(a.doi))fail(400,"Enter the DOI without a https:// prefix.");
 if(a.pdf_url&&!mediaUrl(a.pdf_url))fail(400,"The article PDF must be an uploaded file.");
 if(a.pdf_url&&a.license!=="authorized")fail(400,"Confirm author/publisher permission before attaching an article PDF.");
 if(a.status==="published"&&!a.link_url&&!a.pdf_url&&!a.doi)fail(400,"Published articles need a DOI, publication link or authorized PDF.");
 return a;
}
const articleColumns=["title","authors","journal","abstract","doi","link_url","pdf_url","year","status","license","updated_at"];
const publicArticle=a=>({id:a.id,title:a.title,authors:a.authors,journal:a.journal,abstract:a.abstract,doi:a.doi,link_url:a.link_url,pdf_url:a.license==="authorized"?a.pdf_url:"",year:a.year,updated_at:a.updated_at});
async function bodyJson(req){
 const mime=(req.headers.get("content-type")||"").toLowerCase();
 if(!mime.startsWith("application/json"))fail(415,"Send JSON content.");
 const raw=await req.text();if(raw.length>22000)fail(413,"Request too large.");
 try{return JSON.parse(raw)}catch{fail(400,"Malformed JSON.")}
}
async function listArticles(db,admin){
 const {results}=await db.prepare("SELECT * FROM articles "+(admin?"":"WHERE status='published' ")+"ORDER BY year DESC, updated_at DESC").all();
 return (results||[]).map(a=>admin?a:publicArticle(a));
}
export async function editorAPI(req,env,path,verify){
 try{
  if(path==="/api/profile"&&req.method==="GET"){
   if(!env.DB)return send({profile:null});
   const row=await env.DB.prepare("SELECT content FROM academic_profile WHERE id=1").first();
   return send({profile:row?JSON.parse(row.content):null});
  }
  if(path==="/api/articles"&&req.method==="GET"){
   return send({articles:env.DB?await listArticles(env.DB,false):[]});
  }
  if(!path.startsWith("/api/admin/"))return send({error:"Not found."},404);
  await verify(req,env); // Always verify Cloudflare Access JWT + allowed email before any admin data.
  if(path==="/api/admin/session"&&req.method==="GET"){
   return send({authenticated:true,database_ready:!!env.DB,files_ready:!!env.BOOK_FILES});
  }
  if(!env.DB)fail(503,"Publishing database not connected. Bind D1 as DB and run migrations.");
  if(path==="/api/admin/profile"){
   if(req.method==="GET"){
    const row=await env.DB.prepare("SELECT content FROM academic_profile WHERE id=1").first();
    return send({profile:row?JSON.parse(row.content):null});
   }
   if(req.method==="PUT"){
    const p=normalizeProfile(await bodyJson(req));
    await env.DB.prepare("INSERT INTO academic_profile(id,content,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").bind(JSON.stringify(p),new Date().toISOString()).run();
    return send({profile:p});
   }
  }
  if(path==="/api/admin/articles"){
   if(req.method==="GET")return send({articles:await listArticles(env.DB,true)});
   if(req.method==="POST"){
    const a=normalizeArticle(await bodyJson(req));
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO articles(id,"+articleColumns.join(",")+") VALUES("+Array(articleColumns.length+1).fill("?").join(",")+")").bind(id,...articleColumns.map(k=>k==="updated_at"?now:a[k]??null)).run();
    return send({article:{id,...a,updated_at:now}},201);
   }
  }
  const match=path.match(/^\/api\/admin\/articles\/([0-9a-f-]{36})$/i);
  if(match&&idOk(match[1])){
   const id=match[1];
   if(req.method==="PUT"){
    const old=await env.DB.prepare("SELECT id FROM articles WHERE id=?").bind(id).first();
    if(!old)fail(404,"Article not found.");
    const a=normalizeArticle(await bodyJson(req));const now=new Date().toISOString();
    await env.DB.prepare("UPDATE articles SET "+articleColumns.map(k=>k+"=?").join(",")+" WHERE id=?").bind(...articleColumns.map(k=>k==="updated_at"?now:a[k]??null),id).run();
    return send({article:{id,...a,updated_at:now}});
   }
   if(req.method==="DELETE"){
    await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
    return send({deleted:true});
   }
  }
  return send({error:"Not found."},404);
 }catch(e){if(e.status)return send({error:e.message},e.status);console.error("Editorial API error",e);return send({error:"Publishing service unavailable. Check database migrations and Worker logs."},503)}
}
