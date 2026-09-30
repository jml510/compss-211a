import {validateEvents,activityReport,reportCSV} from './activity-model.mjs';
import {course} from './catalog.mjs';
import {syncedProgress,normalizeSyncCode,SYNC_LIMIT} from './progress-sync.mjs';

const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const hash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
async function readJSON(request,limit=24000){
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing activity.');
 let text='',length=0;const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error('This request is too large.');}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
// A safety cap on stored copies, so a flood of new sync codes can't fill the database.
const MAX_SYNC_COPIES=5000;
// One synced copy per sync code, kept under a hash of the code. There is no way to list copies.
async function syncProgress(request,env,cors){
 if(!env.DB)return json({error:'Sync is not configured.'},503,cors);
 const type=request.headers.get('content-type')||'';
 if(!type.startsWith('application/json')&&!type.startsWith('text/plain'))return json({error:'Expected progress.'},415,cors);
 let raw;
 try{raw=await readJSON(request,SYNC_LIMIT);}catch(e){return json({error:e instanceof SyntaxError?'Invalid progress.':e.message},400,cors);}
 const code=normalizeSyncCode(raw?.code);
 if(!code)return json({error:'Check the sync code.'},400,cors);
 const key=await hash('sync:'+code);
 const current=async()=>{const row=await env.DB.prepare('SELECT snapshot, revision FROM progress_sync WHERE code_hash = ?').bind(key).first();return row&&{revision:row.revision,progress:JSON.parse(row.snapshot)};};
 if(raw.op==='pull'){const row=await current();return row?json(row,200,cors):json({error:'No synced progress uses that code.'},404,cors);}
 if(raw.op!=='push')return json({error:'Unknown sync request.'},400,cors);
 if(!Number.isInteger(raw.baseRevision)||raw.baseRevision<0)return json({error:'Invalid sync revision.'},400,cors);
 let snapshot;
 try{snapshot=JSON.stringify(syncedProgress(raw.progress));}catch(e){return json({error:e.message},400,cors);}
 const now=Date.now();let saved;
 if(raw.baseRevision===0){
  if((await env.DB.prepare('SELECT COUNT(*) AS n FROM progress_sync').first()).n>=MAX_SYNC_COPIES)return json({error:'Sync is full. Download a backup instead.'},507,cors);
  saved=await env.DB.prepare('INSERT INTO progress_sync (code_hash, snapshot, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(code_hash) DO NOTHING RETURNING revision').bind(key,snapshot,now).first();
 }else saved=await env.DB.prepare('UPDATE progress_sync SET snapshot = ?, revision = revision + 1, updated_at = ? WHERE code_hash = ? AND revision = ? RETURNING revision').bind(snapshot,now,key,raw.baseRevision).first();
 if(saved)return json({revision:saved.revision},200,cors);
 // Another device saved first: return its copy so this browser can merge and retry.
 const row=await current();
 return row?json(row,409,cors):json({error:'No synced progress uses that code.'},404,cors);
}
export async function api(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/api/report.csv'&&request.method==='GET'){
   if(!env.REPORT_KEY||url.searchParams.get('key')!==env.REPORT_KEY)return json({error:'Not authorized.'},403);
   if(!env.DB)return json({error:'Report storage is unavailable.'},503);
   const days=Number(url.searchParams.get('days')||7);
   if(![7,30,120].includes(days))return json({error:'Choose 7, 30, or 120 days.'},400);
   const now=Date.now();
   const {results}=await env.DB.prepare('SELECT browser_hash, skill, kind, value, variant, received_at FROM activity_events WHERE received_at >= ? ORDER BY received_at, rowid LIMIT 50001').bind(now-days*86400000).all();
   if(results.length>50000)return json({error:'This reporting period is too large. Choose a shorter period.'},413);
   const report=activityReport(results,{week:course.currentWeek,now,days});
   return new Response(reportCSV(report),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});
  }
  // There is no instructor interface or list/read API on the student website.
  // ALLOWED_ORIGINS lists other sites allowed to send activity, e.g. the GitHub Pages copy of the studio.
  const origin=request.headers.get('origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const route=path==='/api/activity'||path==='/api/sync';
  if(route&&request.method==='OPTIONS')return cors['Access-Control-Allow-Origin']?new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'86400'}}):json({error:'Open the course practice page.'},403);
  if(!route||request.method!=='POST')return json({error:'Not found.'},404);
  if(!cors['Access-Control-Allow-Origin']&&(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==url.origin)))return json({error:'Open the course practice page.'},403);
  if(path==='/api/sync')return await syncProgress(request,env,cors);
  if(!env.DB||!env.CLASS_CODE)return json({error:'Activity tracking is not configured.'},503,cors);
  // Current clients send plain text with the browser key in the body; older cached clients send JSON with a Bearer header.
  const type=request.headers.get('content-type')||'';
  if(!type.startsWith('application/json')&&!type.startsWith('text/plain'))return json({error:'Expected activity records.'},415,cors);
  let raw,events;
  try{raw=await readJSON(request);events=validateEvents(raw.events);}catch(e){return json({error:e instanceof SyntaxError?'Invalid activity.':e.message},400,cors);}
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||raw.browserKey;
  if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))return json({error:'Missing browser key.'},401,cors);
  if(raw.classCode!==env.CLASS_CODE)return json({error:'Use your course’s practice link.'},403,cors);
  const browser=await hash(token),now=Date.now();
  // Acknowledge obsolete events from cached clients without storing them.
  const tracked=events.filter(e=>['rating','check','flashcard','drill'].includes(e.kind));
  if(tracked.length)await env.DB.batch(tracked.map(e=>env.DB.prepare('INSERT OR IGNORE INTO activity_events (id, browser_hash, skill, kind, value, variant, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(browser+':'+e.id,browser,e.skill,e.kind,e.value,e.variant,now)));
  return json({saved:events.length},200,cors);
 }catch(error){console.error('Activity storage failure',error?.name);return json({error:'Storage is temporarily unavailable. Please retry.'},503);}
}
export function createWorker(assets){return {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path.startsWith('/api/'))return api(request,env);
 if(path==='/share.html')return Response.redirect(new URL('/index.html',request.url),302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=assets[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}};}
