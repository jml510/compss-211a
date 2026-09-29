const trackedKinds=new Set(['rating','check','flashcard','drill']);
const KEY='compss-211a-activity-v1',EVENT=KEY+':event:';
// Explicit events only: callers must never pass student code, answers, or other free text.
// endpoint: '' sends to this site; a URL sends to a separate activity service; null means tracking is unavailable here.
export function createActivityTracker({storage,send=fetch,endpoint='',onStatus=()=>{}}={}){
 if(!storage){try{storage=globalThis.localStorage;}catch{storage={length:0,getItem:()=>null,setItem:()=>{},removeItem:()=>{},key:()=>null};}}
 let refused=false,state={token:null,classCode:null},memory=new Map(),timer=null,busy=false;
 try{const value=JSON.parse(storage.getItem(KEY)||'null');if(value?.token&&value?.classCode)state=value;}catch{}
 function status(text){onStatus(text);}
 function pending(){
  const records=new Map(memory);
  try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(EVENT)){const record=JSON.parse(storage.getItem(key));if(record?.token===state.token)records.set(record.event.id,record.event);}}}catch{}
  for(const [id,event] of records){if(!trackedKinds.has(event.kind)){records.delete(id);memory.delete(id);try{storage.removeItem(EVENT+id);}catch{}}}
  return [...records.values()];
 }
 function join(code){
  if(!/^[a-f0-9]{48}$/.test(code))return false;
  if(endpoint===null){refused=true;status('Anonymous activity tracking is not available on this copy of the page. Your practice is still saved in this browser.');return false;}
  try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(saved?.token)state.token=saved.token;}catch{}
  state.classCode=code;state.token??=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
  try{storage.setItem(KEY,JSON.stringify(state));}catch{status('Browser storage is unavailable. Activity can only be retried while this page stays open.');}
  status('Anonymous practice activity is recorded automatically for your instructor’s class summary.');flush();return true;
 }
 function record(kind,skill,value,variant='skill'){
  if(!state.classCode||!trackedKinds.has(kind))return;
  if(pending().length>=500){status('Activity could not sync. Reconnect before continuing to keep all activity records.');return;}
  const event={id:crypto.randomUUID(),kind,skill,value,variant:String(variant)};
  memory.set(event.id,event);
  try{storage.setItem(EVENT+event.id,JSON.stringify({token:state.token,event}));}catch{}
  status('Saving anonymous practice activity…');clearTimeout(timer);timer=setTimeout(flush,800);
 }
 async function flush(){
  if(busy||!state.classCode||endpoint===null)return;
  const batch=pending().slice(0,40);if(!batch.length)return;
  busy=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   // A plain-text body carrying the browser key is a simple request, so a separate activity service needs no CORS preflight.
   const response=await send(endpoint+'/api/activity',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({classCode:state.classCode,browserKey:state.token,events:batch}),signal:controller.signal,keepalive:true});
   if(!response.ok)throw new Error('Save failed');
   const result=await response.json();if(result.saved!==batch.length)throw new Error('No acknowledgement');
   for(const event of batch){memory.delete(event.id);try{storage.removeItem(EVENT+event.id);}catch{}}
   status('Anonymous practice activity is saved for your instructor’s class summary.');
  }catch{status('Activity is waiting to sync. Keep using this browser; it will retry when connected.');}
  finally{clearTimeout(timeout);busy=false;if(pending().length){clearTimeout(timer);timer=setTimeout(flush,15000);}}
 }
 function start(){if(refused)return;if(state.classCode&&endpoint!==null){status('Anonymous practice activity is recorded automatically for your instructor’s class summary.');flush();}else status('Practice is saved in this browser. Open your course’s practice link to enable anonymous class activity tracking.');}
 function stop(){clearTimeout(timer);}
 return {join,record,flush,start,stop,enabled:()=>!!state.classCode};
}
