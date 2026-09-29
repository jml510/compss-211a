import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {validateEvents,activityReport,reportCSV} from '../activity-model.mjs';
import {createActivityTracker} from '../activity-client.mjs';
import {api,createWorker} from '../server.mjs';
import {sqliteDatabase} from './sqlite-adapter.mjs';
import {activityEndpoint} from '../activity-config.mjs';
import pagesWorker from '../worker.mjs';
globalThis.crypto??=webcrypto;
const event=(kind,value,variant='skill')=>({id:crypto.randomUUID(),kind,value,skill:'sql-basics',variant});
test('events strip names, code and answer text; reject unknown actions and skills',()=>{
 const e=event('check','fail');assert.deepEqual(validateEvents([{...e,name:'Name',code:'private',answer:'private'}]),[e]);
 assert.throws(()=>validateEvents([{...e,skill:'unknown'}]));
 assert.throws(()=>validateEvents([{...e,kind:'keystroke'}]));
 assert.throws(()=>validateEvents([{...e,value:'private text'}]));
 assert.throws(()=>validateEvents(Array(41).fill(e)));
});
test('reports count attempts separately from unique browsers, exclude legacy hints and retain latest outcomes',()=>{
 const t=Date.now();
 const events=[['one','rating','red'],['one','check','fail'],['one','check','pass'],['one','hint','opened'],['two','check','fail'],['one','rating','unrated']].map(([browser_hash,kind,value],i)=>({...event(kind,value),browser_hash,received_at:t+i}));
 const report=activityReport(events,{week:5,now:t+10,days:7}),sql=report.rows.find(s=>s.skill==='SQL basics');
 assert.equal(report.browsers,2);assert.equal(sql.checks,3);assert.equal(sql.incorrect,2);assert.equal(sql.tried,2);assert.equal(sql.latestIncorrect,1);assert.equal(sql.hints,0);assert.equal(sql.rated,0);assert.equal(sql.needsHelp,0);
 assert.ok(!reportCSV(report).includes('browser_hash'));assert.equal(reportCSV(report).split('\r\n')[0].split(',').length,22);
});
test('code drill events name a drill that belongs to the skill and never carry code',()=>{
 const e={id:crypto.randomUUID(),kind:'drill',value:'pass',skill:'join-tables',variant:'merge'};
 assert.deepEqual(validateEvents([{...e,code:'joined = requests.merge(districts)'}]),[e]);
 assert.throws(()=>validateEvents([{...e,variant:'groupby-mean'}]));
 assert.throws(()=>validateEvents([{...e,variant:'skill'}]));
 assert.throws(()=>validateEvents([{...e,value:'opened'}]));
});
test('reports add code drill checks as trailing columns',()=>{
 const t=Date.now(),drill=(browser_hash,value,i)=>({id:crypto.randomUUID(),kind:'drill',value,skill:'join-tables',variant:'merge',browser_hash,received_at:t+i});
 const report=activityReport([drill('one','fail',0),drill('one','pass',1),drill('two','fail',2)],{week:5,now:t+10,days:7}),row=report.rows.find(r=>r.skill==='Join tables');
 assert.equal(row.drillChecks,3);assert.equal(row.drillFails,2);assert.equal(row.drillPassed,1);assert.equal(row.checks,0);
 const [header,line]=reportCSV(report).split('\r\n').filter(l=>l.startsWith('"Join tables"')||l.startsWith('"Skill"'));
 assert.deepEqual(header.split(',').slice(-3),['"Code drill checks"','"Code drill checks not passed"','"Browsers passed a code drill"']);
 assert.deepEqual(line.split(',').slice(-3),['"3"','"2"','"1"']);
});
test('durable API deduplicates retries and returns aggregate data only to the private feed key',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'practice-events-'));
 try{
 const env={DB:sqliteDatabase(join(directory,'events.sqlite')),CLASS_CODE:'a'.repeat(48),REPORT_KEY:'test-report-key'};
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+'b'.repeat(48)};
 const e=event('check','fail'),body=JSON.stringify({classCode:env.CLASS_CODE,events:[e]});
 const submit=(payload=body,h=headers)=>api(new Request('https://course.test/api/activity',{method:'POST',headers:h,body:payload}),env);
 assert.equal((await submit()).status,200);assert.equal((await submit()).status,200);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM activity_events').first()).n,1);
 const retired=[event('hint','opened'),event('solution','opened')];
 const ignored=await submit(JSON.stringify({classCode:env.CLASS_CODE,events:retired}));
 assert.equal(ignored.status,200);assert.equal((await ignored.json()).saved,2);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM activity_events').first()).n,1);
 const stored=await env.DB.prepare('SELECT * FROM activity_events').first();assert.notEqual(stored.browser_hash,'b'.repeat(48));assert.equal(stored.skill,'sql-basics');
 assert.equal((await submit(body,{...headers,origin:'https://evil.test'})).status,403);
 assert.equal((await submit(JSON.stringify({classCode:'wrong',events:[e]}))).status,403);
 assert.equal((await api(new Request('https://course.test/api/report.csv'),env)).status,403);
 assert.equal((await api(new Request('https://course.test/api/instructor'),env)).status,404);
 const report=await api(new Request('https://course.test/api/report.csv?key=test-report-key'),env);
 assert.equal(report.status,200);assert.equal(report.headers.get('cache-control'),'private, no-store');assert.match(await report.text(),/"SQL basics"/);
 await env.DB.prepare('UPDATE activity_events SET received_at = ?').bind(Date.now()-10*86400000).run();
 const recent=await api(new Request('https://course.test/api/report.csv?key=test-report-key&days=7'),env);
 assert.ok(!(await recent.text()).includes(stored.browser_hash));
 assert.equal((await api(new Request('https://course.test/api/report.csv?key=test-report-key&days=4'),env)).status,400);
 const worker=createWorker({'/index.html':{type:'text/html',body:'student'}});
 assert.equal((await worker.fetch(new Request('https://course.test/instructor.html'),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://course.test/server.mjs'),env)).status,404);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
test('client records automatically after joining and never sends unjoined activity',async()=>{
 const storage=memoryStorage(),calls=[];
 const tracker=createActivityTracker({storage,send:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({saved:calls.at(-1).events.length})};}});
 tracker.record('rating','sql-basics','red');await tracker.flush();assert.equal(calls.length,0);
 tracker.join('a'.repeat(48));tracker.record('rating','sql-basics','red');await tracker.flush();tracker.stop();
 assert.equal(calls.length,1);assert.equal(calls[0].events[0].value,'red');assert.equal(storage.length,1);
});
test('failed sends survive reload; concurrent tabs keep distinct events and keys',async()=>{
 const storage=memoryStorage();
 const first=createActivityTracker({storage,send:async()=>{throw new Error('offline');}});
 first.join('a'.repeat(48));first.record('rating','sql-basics','red');await first.flush();first.stop();
 const second=createActivityTracker({storage,send:async()=>{throw new Error('offline');}});second.record('check','sql-basics','fail');second.stop();
 const calls=[],third=createActivityTracker({storage,send:async(_,o)=>{const p=JSON.parse(o.body);calls.push(p);return {ok:true,json:async()=>({saved:p.events.length})};}});
 await third.flush();third.stop();assert.equal(calls[0].events.length,2);assert.equal(storage.length,1);
});
test('client drops queued hint/solution events and ignores new openings while retaining checks',async()=>{
 const storage=memoryStorage(),token='b'.repeat(48),calls=[];
 storage.setItem('compss-211a-activity-v1',JSON.stringify({token,classCode:'a'.repeat(48)}));
 for(const kind of ['hint','solution','check']){
  const e=event(kind,kind==='check'?'pass':'opened');
  storage.setItem('compss-211a-activity-v1:event:'+e.id,JSON.stringify({token,event:e}));
 }
 const tracker=createActivityTracker({storage,send:async(_,o)=>{const p=JSON.parse(o.body);calls.push(p);return {ok:true,json:async()=>({saved:p.events.length})};}});
 tracker.record('hint','sql-basics','opened');tracker.record('solution','sql-basics','opened');
 await tracker.flush();tracker.stop();
 assert.deepEqual(calls[0].events.map(e=>e.kind),['check']);assert.equal(storage.length,1);
});

test('the GitHub Pages copy sends plain-text activity to an allowed separate service',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'practice-pages-'));
 try{
 const pages='https://macss-berkeley.github.io',env={DB:sqliteDatabase(join(directory,'events.sqlite')),CLASS_CODE:'a'.repeat(48),REPORT_KEY:'k',ALLOWED_ORIGINS:pages};
 const e=event('check','pass'),post=(origin,body={classCode:env.CLASS_CODE,browserKey:'b'.repeat(48),events:[e]})=>pagesWorker.fetch(new Request('https://practice.workers.test/api/activity',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',origin,'sec-fetch-site':'cross-site'},body:JSON.stringify(body)}),env);
 const ok=await post(pages);assert.equal(ok.status,200);assert.equal(ok.headers.get('access-control-allow-origin'),pages);assert.equal((await ok.json()).saved,1);
 assert.equal((await post('https://evil.test')).status,403);
 assert.equal((await post(pages,{classCode:env.CLASS_CODE,events:[e]})).status,401);
 const preflight=await pagesWorker.fetch(new Request('https://practice.workers.test/api/activity',{method:'OPTIONS',headers:{origin:pages}}),env);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),pages);
 assert.equal((await pagesWorker.fetch(new Request('https://practice.workers.test/index.html'),env)).status,404);
 const stored=await env.DB.prepare('SELECT browser_hash FROM activity_events').first();assert.notEqual(stored.browser_hash,'b'.repeat(48));
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('the client sends to the configured service and does not track where none is set',async()=>{
 assert.equal(activityEndpoint('localhost'),null);assert.equal(activityEndpoint('practice.example.site'),'');
 const calls=[],tracker=createActivityTracker({storage:memoryStorage(),endpoint:'https://api.test',send:async(url,o)=>{calls.push([url,o]);return {ok:true,json:async()=>({saved:1})};}});
 tracker.join('a'.repeat(48));tracker.record('check','sql-basics','pass');await tracker.flush();tracker.stop();
 assert.equal(calls[0][0],'https://api.test/api/activity');assert.match(calls[0][1].headers['Content-Type'],/^text\/plain/);assert.equal(JSON.parse(calls[0][1].body).browserKey.length,48);
 const offline=createActivityTracker({storage:memoryStorage(),endpoint:null,send:async()=>{throw new Error('should not send');}});
 assert.equal(offline.join('a'.repeat(48)),false);offline.record('check','sql-basics','pass');await offline.flush();assert.equal(offline.enabled(),false);
});
