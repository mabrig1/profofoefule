import test from "node:test";
import assert from "node:assert/strict";
import { normalizeArticle, normalizeProfile, editorAPI } from "../worker/editor-api.js";
import portfolio from "../worker/index.js";
import defaults from "../site/data/profile-defaults.json" with { type: "json" };

const base="https://profofoefule.online";
const deny=async()=>{throw Object.assign(new Error("Unauthorized"),{status:401})};
const allow=async()=>true;
const put=(path,value)=>new Request(base+path,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
const article={title:"Evaluation of Pharmaceutical Excipients",authors:"Prof. S. I. Ofoefule",year:2026,doi:"10.1234/example",license:"metadata",status:"published"};

test("profile schema accepts current approved biography fields",()=>{
 const result=normalizeProfile(defaults);
 assert.equal(result.affiliations,defaults.affiliations);
 assert.ok(result.administrative_positions.includes("Dean, Student Affairs"));
});
test("profile schema blocks incomplete and oversized changes",()=>{
 assert.throws(()=>normalizeProfile({biography:"A"}),/Missing profile field/);
 assert.throws(()=>normalizeProfile({...defaults,mentorship:"x".repeat(2100)}),/too long/);
});
test("article schema validates DOI, rights and public metadata",()=>{
 assert.equal(normalizeArticle(article).status,"published");
 assert.throws(()=>normalizeArticle({...article,link_url:"javascript:alert(1)"}),/Invalid publication URL|Use an HTTP/);
 assert.throws(()=>normalizeArticle({...article,pdf_url:"/api/media/files/12345678-1234-1234-1234-123456789abc.pdf"}),/permission/);
 assert.throws(()=>normalizeArticle({...article,doi:"",link_url:"",pdf_url:""}),/need a DOI/);
});
test("unconfigured public APIs fall back safely",async()=>{
 const p=await editorAPI(new Request(base+"/api/profile"),{},"/api/profile",deny);
 const a=await editorAPI(new Request(base+"/api/articles"),{},"/api/articles",deny);
 assert.equal(p.status,200);
 assert.deepEqual(await p.json(),{profile:null});
 assert.deepEqual(await a.json(),{articles:[]});
});
test("private dashboard APIs fail without an authorized Access JWT",async()=>{
 const s=await editorAPI(new Request(base+"/api/admin/session"),{},"/api/admin/session",deny);
 assert.equal(s.status,401);
 const write=await editorAPI(put("/api/admin/profile",defaults),{DB:{}},"/api/admin/profile",deny);
 assert.equal(write.status,401);
});
test("profile writes require D1 and do not accept unapproved mutations",async()=>{
 const denied=await editorAPI(put("/api/admin/profile",defaults),{},"/api/admin/profile",allow);
 assert.equal(denied.status,503);
 let content="";
 const db={prepare(sql){return{
  first:async()=>content?{content}:null,
  bind(...args){content=args[0];return this},
  run:async()=>({success:true})
 }}};
 const saved=await editorAPI(put("/api/admin/profile",defaults),{DB:db},"/api/admin/profile",allow);
 assert.equal(saved.status,200);
 const viewed=await editorAPI(new Request(base+"/api/profile"),{DB:db},"/api/profile",allow);
 assert.equal((await viewed.json()).profile.mentorship,defaults.mentorship);
});
test("the Worker preserves static pages and blocks dashboard without Access",async()=>{
 const env={ASSETS:{fetch:async()=>new Response("<html>Home</html>",{status:200})}};
 const home=await portfolio.fetch(new Request(base+"/"),env,{});
 assert.equal(home.status,200);
 const forbidden=await portfolio.fetch(new Request(base+"/dashboard"),env,{});
 assert.equal(forbidden.status,503); // No Access settings: intentionally fail closed.
});
