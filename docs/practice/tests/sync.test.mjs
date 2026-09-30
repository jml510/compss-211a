import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {api} from '../server.mjs';
import {sqliteDatabase} from './sqlite-adapter.mjs';
import {createProgressSync,newSyncCode,normalizeSyncCode,formatSyncCode,syncedProgress,SYNC_STATE_KEY} from '../progress-sync.mjs';
import {freshProgress,validateProgress,mergeProgress} from '../exercises.mjs';
import {skills} from '../catalog.mjs';
globalThis.crypto??=webcrypto;
const [a,b,c]=skills.map(s=>s.id),ids=skills.map(s=>s.id);
const rated=(value,updatedAt=new Date().toISOString())=>({value,updatedAt});
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function withServer(run){return async()=>{
  const directory=mkdtempSync(join(tmpdir(),'practice-sync-'));
  try{await run({DB:sqliteDatabase(join(directory,'sync.sqlite'))});}finally{rmSync(directory,{recursive:true,force:true});}
};}
const post=(env,body,headers={})=>api(new Request('https://course.test/api/sync',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...headers},body:typeof body==='string'?body:JSON.stringify(body)}),env);
function device(env,progress=freshProgress()){
  const d={progress,online:true,storage:memoryStorage()};
  d.sync=createProgressSync({endpoint:'https://course.test',storage:d.storage,delay:60000,
    send:async(url,options)=>{if(!d.online)throw new TypeError('Failed to fetch');return api(new Request(url,{method:options.method,headers:options.headers,body:options.body}),env);},
    getProgress:()=>d.progress,apply:next=>{d.progress=next;},validate:raw=>validateProgress(raw,ids),merge:mergeProgress});
  return d;
}

test('sync codes are 16 unambiguous characters and tolerate how people retype them',()=>{
  const code=newSyncCode();
  assert.match(code,/^[0-9A-HJKMNP-TV-Z]{16}$/);assert.notEqual(code,newSyncCode());
  assert.equal(normalizeSyncCode(formatSyncCode(code).toLowerCase()),code);
  assert.equal(normalizeSyncCode(' 7kq3-m9tx 4hrp-2wzb '),'7KQ3M9TX4HRP2WZB');
  assert.equal(normalizeSyncCode('OIL0-0000-0000-0000'),'0110000000000000');
  assert.equal(normalizeSyncCode('7KQ3-M9TX-4HRP'),null);assert.equal(normalizeSyncCode('7KQ3-M9TX-4HRP-2WZU'),null);assert.equal(normalizeSyncCode(undefined),null);
});

test('synced progress never includes code drafts or free text',()=>{
  const now=new Date().toISOString();
  const raw={...freshProgress(),ratings:{[a]:{...rated('green',now),note:'private'},'skill-added-next-week':rated('red',now)},drafts:{'function:0':{code:'print("mine")',updatedAt:now}},name:'Student',checks:{[b]:{passed:true,updatedAt:now}}};
  const out=syncedProgress(raw);
  assert.deepEqual(out.drafts,{});assert.equal(out.name,undefined);assert.deepEqual(out.ratings[a],rated('green',now));
  assert.ok(out.ratings['skill-added-next-week'],'skills the server does not know yet are kept');
  assert.ok(!JSON.stringify(out).includes('mine')&&!JSON.stringify(out).includes('private'));
  assert.throws(()=>syncedProgress({...raw,ratings:{[a]:rated('purple',now)}}));
  assert.throws(()=>syncedProgress({...raw,ratings:{'my name is':rated('red',now)}}));
  assert.throws(()=>syncedProgress({...raw,checks:{[b]:{passed:'yes',updatedAt:now}}}));
  assert.throws(()=>syncedProgress({...raw,attempts:{essay:{tried:[],passed:[],updatedAt:now}}}));
  assert.throws(()=>syncedProgress({...raw,version:2}));
});

test('the sync API stores a hash of the code, rejects stale writes and other sites',withServer(async env=>{
  const code=newSyncCode(),progress={...freshProgress(),ratings:{[a]:rated('red')},drafts:{'function:0':{code:'secret_draft = 1',updatedAt:new Date().toISOString()}}};
  assert.equal((await post(env,{op:'pull',code})).status,404);
  const created=await post(env,{op:'push',code,baseRevision:0,progress});
  assert.equal(created.status,200);assert.equal((await created.json()).revision,1);
  const row=await env.DB.prepare('SELECT * FROM progress_sync').first();
  assert.notEqual(row.code_hash,code);assert.ok(!row.snapshot.includes('secret_draft'));assert.ok(!JSON.stringify(row).includes(code));
  const pulled=await (await post(env,{op:'pull',code:formatSyncCode(code).toLowerCase()})).json();
  assert.equal(pulled.revision,1);assert.equal(pulled.progress.ratings[a].value,'red');
  assert.equal((await post(env,{op:'push',code,baseRevision:1,progress:{...progress,ratings:{[a]:rated('yellow')}}})).status,200);
  const stale=await post(env,{op:'push',code,baseRevision:1,progress});
  assert.equal(stale.status,409);const current=await stale.json();assert.equal(current.revision,2);assert.equal(current.progress.ratings[a].value,'yellow');
  assert.equal((await post(env,{op:'push',code,baseRevision:0,progress})).status,409,'a new code can never overwrite an existing copy');
  assert.equal((await post(env,{op:'push',code:'not-a-code',baseRevision:0,progress})).status,400);
  assert.equal((await post(env,{op:'push',code:newSyncCode(),baseRevision:0,progress:{...progress,ratings:{[a]:rated('purple')}}})).status,400);
  assert.equal((await post(env,'x'.repeat(70000))).status,400);
  assert.equal((await post(env,{op:'pull',code},{origin:'https://evil.test'})).status,403);
  const allowed=await post({...env,ALLOWED_ORIGINS:'https://pages.test'},{op:'pull',code},{origin:'https://pages.test'});
  assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://pages.test');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM progress_sync').first()).n,1);
}));

test('two devices share progress, removals carry over, and code drafts stay on each device',withServer(async env=>{
  const laptop=device(env,{...freshProgress(),ratings:{[a]:rated('red','2026-09-01T00:00:00Z')},drafts:{'function:0':{code:'laptop draft',updatedAt:'2026-09-01T00:00:00Z'}}});
  const phone=device(env,{...freshProgress(),ratings:{[b]:rated('green','2026-09-02T00:00:00Z')}});
  const code=await laptop.sync.enable();
  assert.equal(laptop.sync.info().on,true);assert.equal(laptop.sync.info().status,'synced');assert.equal(laptop.sync.info().code,code);
  assert.ok(laptop.storage.getItem(SYNC_STATE_KEY));

  await phone.sync.connect(code);
  assert.deepEqual(Object.keys(phone.progress.ratings).sort(),[a,b].sort(),'connecting merges both devices');
  assert.deepEqual(phone.progress.drafts,{},'drafts do not travel');
  await laptop.sync.sync();
  assert.equal(laptop.progress.ratings[b].value,'green');assert.equal(laptop.progress.drafts['function:0'].code,'laptop draft');

  // Clearing a rating on one device clears it on the other.
  delete laptop.progress.ratings[b];laptop.sync.changed();assert.equal(laptop.sync.info().status,'pending');
  await laptop.sync.flush();assert.equal(laptop.sync.info().status,'synced');
  await phone.sync.sync();
  assert.equal(phone.progress.ratings[b],undefined);assert.equal(phone.progress.ratings[a].value,'red');

  // Editing only a code draft is not a synced change.
  laptop.progress.drafts['function:0']={code:'edited',updatedAt:new Date().toISOString()};laptop.sync.changed();
  assert.equal(laptop.sync.info().status,'synced');

  // Both devices change something before syncing: neither change is lost.
  laptop.progress.ratings[c]=rated('yellow');laptop.sync.changed();
  phone.progress.ratings[a]=rated('green');phone.sync.changed();
  await laptop.sync.flush();await phone.sync.flush();await laptop.sync.sync();
  for(const d of [laptop,phone]){assert.equal(d.progress.ratings[a].value,'green');assert.equal(d.progress.ratings[c].value,'yellow');}

  laptop.sync.disconnect();phone.sync.disconnect();
  assert.equal(laptop.storage.getItem(SYNC_STATE_KEY),null);
  const pulled=await (await post(env,{op:'pull',code})).json();
  assert.equal(pulled.progress.ratings[c].value,'yellow','stopping sync leaves the synced copy for reconnecting');
}));

test('offline changes wait and sync later; a wrong code gives a clear message',withServer(async env=>{
  const laptop=device(env),tablet=device(env);
  const code=await laptop.sync.enable();
  laptop.online=false;laptop.progress.ratings[a]=rated('red');laptop.sync.changed();
  await laptop.sync.flush();assert.equal(laptop.sync.info().status,'offline');
  assert.equal(JSON.parse(laptop.storage.getItem(SYNC_STATE_KEY)).dirty,true,'the unsent change survives a reload');
  laptop.online=true;await laptop.sync.sync();assert.equal(laptop.sync.info().status,'synced');
  await tablet.sync.connect(code);assert.equal(tablet.progress.ratings[a].value,'red');
  const stranger=device(env);
  await assert.rejects(stranger.sync.connect('7KQ3-M9TX-4HRP-2WZB'),/No synced progress uses that code/);
  await assert.rejects(stranger.sync.connect('hello'),/doesn’t look like a sync code/);
  stranger.online=false;await assert.rejects(stranger.sync.enable(),/Can’t reach the sync service/);
  assert.equal(stranger.sync.info().on,false);
  laptop.sync.disconnect();tablet.sync.disconnect();
}));

test('a browser that has lost its saved progress gets the synced copy back',withServer(async env=>{
  const laptop=device(env,{...freshProgress(),ratings:{[a]:rated('green')}});
  await laptop.sync.enable();
  // Same browser after its progress was unreadable: sync state is intact but progress is empty.
  const reopened=device(env);reopened.storage=laptop.storage;
  reopened.sync=createProgressSync({endpoint:'https://course.test',storage:laptop.storage,delay:60000,send:async(url,o)=>api(new Request(url,{method:o.method,headers:o.headers,body:o.body}),env),
    getProgress:()=>reopened.progress,apply:next=>{reopened.progress=next;},validate:raw=>validateProgress(raw,ids),merge:mergeProgress});
  await reopened.sync.sync();
  assert.equal(reopened.progress.ratings[a].value,'green');
  laptop.sync.disconnect();reopened.sync.disconnect();
}));

test('an edit made before the first check cannot overwrite the synced copy, and a newly opened page still gets removals',withServer(async env=>{
  const laptop=device(env,{...freshProgress(),ratings:{[a]:rated('green'),[b]:rated('red')}});
  const code=await laptop.sync.enable();
  const open=storage=>{const d=device(env);d.storage=storage;d.sync=createProgressSync({endpoint:'https://course.test',storage,delay:60000,send:async(url,o)=>api(new Request(url,{method:o.method,headers:o.headers,body:o.body}),env),getProgress:()=>d.progress,apply:next=>{d.progress=next;},validate:raw=>validateProgress(raw,ids),merge:mergeProgress});return d;};
  // Progress was lost, and the student rates a skill before the page has checked the server.
  const blank=open(laptop.storage);blank.progress.ratings[c]=rated('yellow');blank.sync.changed();await blank.sync.flush();
  const server=(await (await post(env,{op:'pull',code})).json()).progress;
  assert.deepEqual(Object.keys(server.ratings).sort(),[a,b,c].sort());
  // Another device removes a rating; a page opened afterwards in this browser drops it too.
  const phone=device(env);await phone.sync.connect(code);delete phone.progress.ratings[b];phone.sync.changed();await phone.sync.flush();
  const reopened=open(laptop.storage);reopened.progress=blank.progress;await reopened.sync.sync();
  assert.equal(reopened.progress.ratings[b],undefined);assert.equal(reopened.progress.ratings[c].value,'yellow');
  for(const d of [laptop,blank,phone,reopened])d.sync.disconnect();
}));
