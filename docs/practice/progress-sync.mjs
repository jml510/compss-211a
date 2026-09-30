// Optional progress sync for students who use more than one browser or device.
// The browser makes a random sync code; the server stores a hash of it with a copy of the progress.
// Only fixed labels, booleans, numbers and dates are synced. Code drafts never leave the browser.
const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SYNC_STATE_KEY='compss-211a-sync-v1';
export const SYNC_LIMIT=60000;

// 16 characters of Crockford base32: 80 random bits, short enough to type on a phone.
export function newSyncCode(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>ALPHABET[n&31]).join('');}
export function normalizeSyncCode(text){
  const code=String(text??'').toUpperCase().replace(/[\s-]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1');
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(code)?code:null;
}
export const formatSyncCode=code=>code.match(/.{4}/g).join('-');

// Shape checks only, so the server keeps skills, drills and cards it doesn't know yet.
// The page still runs validateProgress against its own catalog before using a synced copy.
const isDate=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const isId=v=>/^[a-z0-9][a-z0-9_-]{0,79}$/.test(v);
function group(raw,max,check,keys){
  if(raw===undefined)return {};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>max)throw new Error('Invalid synced progress.');
  const out={};
  for(const [id,v] of Object.entries(raw)){
    if(!isId(id)||!v||typeof v!=='object'||!check(v))throw new Error('Invalid synced progress.');
    out[id]=Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
  }
  return out;
}
const indexes=v=>Array.isArray(v)&&v.length<=3&&v.every(x=>Number.isInteger(x)&&x>=0&&x<3);
export function syncedProgress(raw){
  if(!raw||typeof raw!=='object'||raw.version!==1)throw new Error('Invalid synced progress.');
  const attempts=group(raw.attempts,3,a=>indexes(a.tried)&&indexes(a.passed)&&isDate(a.updatedAt),['tried','passed','updatedAt']);
  if(Object.keys(attempts).some(id=>!['filter','function','debug'].includes(id)))throw new Error('Invalid synced progress.');
  const result=v=>typeof v.passed==='boolean'&&isDate(v.updatedAt);
  return {version:1,
    ratings:group(raw.ratings,300,v=>['green','yellow','red'].includes(v.value)&&isDate(v.updatedAt),['value','updatedAt']),
    attempts,
    drafts:{},
    checks:group(raw.checks,300,result,['passed','updatedAt']),
    flashcards:group(raw.flashcards,500,v=>Number.isFinite(v.intervalDays)&&v.intervalDays>=0&&v.intervalDays<=365&&Number.isInteger(v.reviews)&&v.reviews>=0&&v.reviews<=1000000&&['again','hard','good','easy'].includes(v.grade)&&isDate(v.dueAt)&&isDate(v.updatedAt)&&(v.suspended===undefined||typeof v.suspended==='boolean'),['intervalDays','reviews','grade','dueAt','updatedAt','suspended']),
    drills:group(raw.drills,300,result,['passed','updatedAt'])};
}

// Key order and set order don't count as changes.
const canonical=value=>JSON.stringify(value,(key,v)=>Array.isArray(v)&&v.every(Number.isInteger)?[...v].sort((x,y)=>x-y):v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([x],[y])=>x<y?-1:x>y?1:0)):v);
const synced=progress=>canonical(syncedProgress(progress));

// state {code, revision, dirty}: while dirty is false, this browser holds the server copy at revision,
// so a newer server copy can replace it (and removals carry over). Unsent changes are merged instead.
// The first check after the page opens always merges, in case this browser lost or never sent its copy.
// endpoint: '' is this site, a URL is a separate service, null means sync is unavailable here.
export function createProgressSync({endpoint,storage,send=(...args)=>fetch(...args),getProgress,apply,validate,merge,onChange=()=>{},delay=2000}){
  if(!storage){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const available=typeof endpoint==='string';
  let state=read()??null,status=state?'pending':'off',message='',syncedAt=null,lastSent=null,edits=0,timer=null,pulledAt=0,chain=Promise.resolve();
  // undefined: storage is unreadable, so keep the copy in memory.
  function read(){try{const s=JSON.parse(storage.getItem(SYNC_STATE_KEY)||'null'),code=normalizeSyncCode(s?.code);return code&&Number.isInteger(s.revision)&&s.revision>=0?{code,revision:s.revision,dirty:!!s.dirty}:null;}catch{return undefined;}}
  function write(){try{if(state)storage.setItem(SYNC_STATE_KEY,JSON.stringify(state));else storage.removeItem(SYNC_STATE_KEY);}catch{}}
  function refresh(){const saved=read();if(saved!==undefined)state=saved;if(!state)status='off';}
  function set(next,text=''){status=next;message=text;if(next==='synced')syncedAt=new Date();onChange();}
  const snapshot=()=>synced(getProgress());
  const queue=task=>{const run=chain.then(task);chain=run.catch(()=>{});return run;};
  async function call(body,keepalive=false){
    const text=JSON.stringify(body);if(text.length>SYNC_LIMIT)throw new SyncError('Your progress is too large to sync. Download a backup instead.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    let response;
    try{response=await send(endpoint+'/api/sync',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:text,signal:controller.signal,keepalive});}
    catch{throw new SyncError('offline');}
    finally{clearTimeout(timeout);}
    const data=await response.json().catch(()=>({}));
    if(![200,404,409].includes(response.status))throw new SyncError(response.status>=500?'offline':data.error||'Sync failed.');
    return {status:response.status,data};
  }
  // Fold a newer server copy into unsent local changes. Local code drafts are kept.
  function mergeRemote(remote){apply(merge(getProgress(),validate({...remote.progress,drafts:{}})));state.revision=remote.revision;write();}
  async function push(keepalive=false){
    for(let attempt=0;attempt<3;attempt++){
      const text=snapshot(),sent=edits;
      const {status:code,data}=await call({op:'push',code:state.code,baseRevision:state.revision,progress:JSON.parse(text)},keepalive);
      if(code===200){state.revision=data.revision;if(edits===sent)state.dirty=false;write();lastSent=text;return;}
      if(code===404)return lost();
      mergeRemote(data);
    }
    throw new SyncError('offline');
  }
  function lost(){state=null;write();set('off','No synced progress uses this code any more, so sync is off in this browser. Your progress here is unchanged.');}
  async function exchange(keepalive=false){
    const {status:code,data}=await call({op:'pull',code:state.code});
    pulledAt=Date.now();
    if(code===404)return lost();
    if(data.revision!==state.revision&&!state.dirty){
      // Nothing unsent here: take the newer copy as it is. Local code drafts are kept.
      if(synced(data.progress)!==snapshot())apply(validate({...data.progress,drafts:getProgress().drafts}));
    }else if(data.revision!==state.revision||lastSent===null){
      const merged=merge(getProgress(),validate({...data.progress,drafts:{}}));
      if(synced(merged)!==snapshot())apply(merged);
      if(synced(merged)!==synced(data.progress))state.dirty=true;
    }
    state.revision=data.revision;write();
    if(state.dirty)await push(keepalive);else lastSent=snapshot();
  }
  async function guarded(task){
    refresh();if(!state||!available){onChange();return;}
    try{await task();if(state)set(state.dirty?'pending':'synced');}
    catch(e){if(!state)return;const offline=e.message==='offline';set(offline?'offline':'error',offline?'':e.message);clearTimeout(timer);timer=setTimeout(()=>sync(),30000);}
  }
  const sync=()=>queue(()=>guarded(exchange));
  // Before the first check since the page opened, a push could overwrite progress this browser lost, so check first.
  const flush=(keepalive=false)=>{clearTimeout(timer);return queue(()=>guarded(async()=>{if(lastSent===null)await exchange(keepalive);else if(state.dirty||snapshot()!==lastSent)await push(keepalive);}));};
  function changed(){
    if(!available||!state||lastSent!==null&&!state.dirty&&snapshot()===lastSent)return;
    edits++;if(!state.dirty){state.dirty=true;write();}
    if(status!=='pending')set('pending');
    clearTimeout(timer);timer=setTimeout(()=>flush(),delay);
  }
  function enable(){return queue(async()=>{
    const code=newSyncCode(),text=snapshot();
    const {status:result,data}=await call({op:'push',code,baseRevision:0,progress:syncedProgress(getProgress())});
    if(result!==200)throw new SyncError('Sync could not start. Try again.');
    state={code,revision:data.revision,dirty:false};write();lastSent=text;set('synced');return formatSyncCode(code);
  }).catch(rethrow);}
  function connect(input){return queue(async()=>{
    const code=normalizeSyncCode(input);if(!code)throw new SyncError('That doesn’t look like a sync code. It has 16 letters and numbers, like 7KQ3-M9TX-4HRP-2WZB.');
    const {status:result,data}=await call({op:'pull',code});
    if(result===404)throw new SyncError('No synced progress uses that code. Check it and try again.');
    // Connected from here on. If the upload fails, the merged progress is sent on the next retry.
    const merged=merge(getProgress(),validate({...data.progress,drafts:{}}));
    state={code,revision:data.revision,dirty:synced(merged)!==synced(data.progress)};write();
    apply(merged);lastSent=state.dirty?null:snapshot();
    await guarded(async()=>{if(state.dirty)await push();});
  }).catch(rethrow);}
  function disconnect(){clearTimeout(timer);state=null;lastSent=null;write();set('off');}
  function start(){
    if(!available||typeof document==='undefined')return;
    if(state)sync();
    document.addEventListener('visibilitychange',()=>{if(!state)return;if(document.hidden)flush(true);else if(Date.now()-pulledAt>15000)sync();});
    window.addEventListener('online',()=>{if(state)sync();});
  }
  return {available,start,changed,flush,sync,enable,connect,disconnect,
    refresh(){refresh();onChange();},
    info:()=>({available,on:!!state,code:state?formatSyncCode(state.code):null,status,message,syncedAt})};
}
class SyncError extends Error{}
function rethrow(e){throw e.message==='offline'?new SyncError('Can’t reach the sync service. Check your connection and try again.'):e;}
