import {drills,drillTopics,drillSetup,drillLoaded} from './drills.mjs';

// Code drills: write real Python on course data; Check runs the code in a worker and compares it with a model answer.
export function createDrills({getProgress,save,getWeek,skills,esc,title,track=()=>{},ratingBar,announce=()=>{},refresh}){
  const state={id:null,from:null,filter:'all',hints:{},answer:{},output:{},example:{},feedback:{},status:''};
  let worker=null,runTimer=null,runId=0,busy=null;
  const released=()=>drills.filter(d=>d.week<=getWeek());
  const done=id=>!!getProgress().drills?.[id]?.passed;
  const skillOf=d=>skills.find(s=>s.id===d.skill);
  const draft=d=>getProgress().drafts['drill:'+d.id]?.code??d.starter;
  const ratingOf=id=>getProgress().ratings[id]?.value;
  const needsPractice=d=>['yellow','red'].includes(ratingOf(d.skill));
  const current=()=>released().find(d=>d.id===state.id);
  // The "Write it yourself" label is shown as a tag, so titles drop it.
  const short=d=>{const t=d.title.replace('Write it yourself: ','');return t[0].toUpperCase()+t.slice(1);};

  function route(id,fromSkill){
    if(busy&&id!==state.id)stop();
    state.id=released().some(d=>d.id===id)?id:null;
    if(fromSkill!==undefined)state.from=fromSkill;
    // The back link returns to a skill page only while the drills belong to that skill.
    if(state.from&&current()?.skill!==state.from)state.from=null;
  }
  const dot=id=>{const v=ratingOf(id)||'unrated';return `<span class="drill-rating" data-color="${v}" title="Your self-check: ${v==='unrated'?'not rated':v}" aria-hidden="true"></span>`;};

  function renderList(){
    const list=released(),hidden=drills.length-list.length;
    const shown=list.filter(d=>state.filter==='all'||(state.filter==='todo'?!done(d.id):needsPractice(d)));
    const weeks=[...new Set(shown.map(d=>d.week))];
    return title('Code drills','Write real Python on the course data. Check tells you whether your code works. It also reruns your code on different data, so the code has to work in general.')+
      `<div class="filters"><label>Show<select id="drill-filter"><option value="all" ${state.filter==='all'?'selected':''}>All drills</option><option value="todo" ${state.filter==='todo'?'selected':''}>Not done yet</option><option value="practice" ${state.filter==='practice'?'selected':''}>Skills I rated yellow or red</option></select></label></div>
      <p class="drill-progress"><strong>${list.filter(d=>done(d.id)).length} of ${list.length}</strong> drills done${hidden?` · ${hidden} more open in later weeks`:''}</p>
      ${weeks.length?weeks.map(w=>`<section class="drill-week"><h2>${esc(drillTopics[w])}</h2><ol class="drill-list">${shown.filter(d=>d.week===w).map(d=>{const s=skillOf(d);return `<li class="drill-item${done(d.id)?' is-done':''}"><span class="drill-tick" aria-hidden="true">${done(d.id)?'✓':''}</span><div><a class="drill-link" href="#drill/${d.id}">${esc(short(d))}</a>${d.scratch?' <span class="drill-tag">Write it yourself</span>':''}${done(d.id)?'<span class="sr-only"> (done)</span>':''}<div class="drill-skill">${dot(s.id)}<a href="#skill/${s.id}">${esc(s.title)}</a></div></div></li>`;}).join('')}</ol></section>`).join('')
      :`<div class="empty"><h2>${state.filter==='practice'?'No drills for the skills you marked':'Nothing left here'}</h2><p>${state.filter==='practice'?'Rate skills yellow or red in the checklist, and their drills appear here.':'You have done every drill that is open so far.'}</p><button data-action="drill-filter-all">Show all drills</button></div>`}`;
  }

  function outputHTML(items){return items.length?items.map(o=>o.kind==='err'?`<span class="drill-err">${esc(o.text)}</span>`:esc(o.text)).join(''):'<span class="drill-dim">(no output)</span>';}

  function renderDrill(){
    const d=current();if(!d)return renderList();
    const list=released(),i=list.indexOf(d),prev=list[i-1],next=list[i+1],s=skillOf(d),n=state.hints[d.id]||0,running=busy?.drill===d.id;
    const back=state.from&&skills.some(x=>x.id===state.from)?`<a class="back-link" href="#skill/${state.from}">← ${esc(skills.find(x=>x.id===state.from).title)}</a>`:'<a class="back-link" href="#drills">← Code drills</a>';
    return back+title(esc(short(d)),'')+
      `<p class="skill-context">${esc(drillTopics[d.week])} · Practises <a href="#skill/${s.id}">${esc(s.title)}</a>${done(d.id)?' · <span class="drill-done">✓ Done</span>':''}</p>
      <article class="workbench"><header class="exercise-heading"><div><div class="step-label">${d.scratch?'Write it yourself':'Fill in the code'} <span class="micro"> / Drill ${i+1} of ${list.length}</span></div>
      ${d.scratch?'<p>Write the whole thing yourself, starting from an empty editor. Check runs several tests, some on small tables you haven’t seen, so your code has to work in general.</p>':`<div class="drill-intro">${d.intro}</div>`}</div></header>
      <div class="exercise-body"><div class="workspace">
        ${d.scratch?'':`<h3 class="drill-h">Example</h3><pre class="code">${esc(d.example)}</pre><div class="actions drill-small-actions"><button data-action="drill-example" ${busy?'disabled':''}>Run the example</button></div>${state.example[d.id]?`<pre class="drill-output" aria-label="Example output">${outputHTML(state.example[d.id])}</pre>`:''}`}
        <h3 class="drill-h">Your task</h3><div class="drill-task">${d.task}</div>
        ${d.examples?`<p class="micro">What it should do:</p><pre class="code">${esc(d.examples)}</pre>`:''}
        ${drillLoaded[d.data]?`<p class="drill-loaded">${drillLoaded[d.data]}</p><details class="solution"><summary>Show the setup code</summary><pre class="code">${esc(drillSetup[d.data])}</pre></details>`:''}
        <label class="editor-label" for="drill-code">Your code</label>
        <textarea class="editor" id="drill-code" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="drill-help" ${running?'readonly':''}>${esc(draft(d))}</textarea>
        <p id="drill-help" class="micro" style="margin-top:8px">Enter keeps the indentation (and adds four spaces after a line ending in a colon). Tab moves to the next control. Ctrl/⌘ + Enter checks your code.</p>
        <div class="actions"><button class="primary" data-action="drill-check" ${busy?'disabled':''}>${running&&busy.mode==='check'?'Checking…':'Check'}</button><button data-action="drill-run" ${busy?'disabled':''}>${running&&busy.mode==='run'?'Running…':'Run'}</button>${running?'<button data-action="drill-stop">Stop</button>':'<button data-action="drill-reset">Start over</button>'}</div>
        <div id="drill-feedback" aria-live="polite">${state.status&&running?`<div class="feedback"><span class="busy-spinner" aria-hidden="true"></span>${esc(state.status)}</div>`:state.feedback[d.id]||''}</div>
        ${state.output[d.id]?`<h3 class="drill-h">Output</h3><pre class="drill-output">${outputHTML(state.output[d.id])}</pre>`:''}
        ${done(d.id)?`<p class="drill-rate-note">You’ve done this drill. How do you feel about <strong>${esc(s.title)}</strong> now?</p>${ratingBar(d.skill)}`:''}
      </div>
      <aside class="companion"><section><h3>Hint</h3>${n?`<ol>${d.hints.slice(0,n).map(h=>`<li>${h}</li>`).join('')}</ol>`:'<p>Try it before opening a hint.</p>'}<button data-action="drill-hint" ${n>=d.hints.length?'disabled':''}>${n>=d.hints.length?'All hints shown':n?'Show another hint':'Show a hint'}</button></section>
      <section><h3>Stuck?</h3>${state.answer[d.id]?`<p>One possible answer. Others can be right too. Try typing it yourself rather than pasting it.</p><pre class="code drill-answer">${esc(d.solution)}</pre>`:'<p>Look at an answer after you have tried the hints.</p><button data-action="drill-answer">Show an answer</button>'}</section>
      <section><h3>This skill</h3><p>${dot(s.id)}${esc(s.title)}</p><a href="#skill/${s.id}">Quick check and self-check</a></section></aside></div></article>
      <nav class="drill-pager" aria-label="Other drills">${prev?`<a href="#drill/${prev.id}">← ${esc(short(prev))}</a>`:'<span></span>'}${next?`<a href="#drill/${next.id}">${esc(short(next))} →</a>`:'<span></span>'}</nav>`;
  }

  // Shown on each skill page: the drills that practise this skill.
  function skillSection(skillId){
    const all=drills.filter(d=>d.skill===skillId);if(!all.length)return '';
    const open=all.filter(d=>d.week<=getWeek()),later=all.length-open.length;
    return `<section class="skill-drills" aria-labelledby="skill-drills-title"><h2 id="skill-drills-title">Practise by writing code</h2>${open.length?`<ol class="drill-list">${open.map(d=>`<li class="drill-item${done(d.id)?' is-done':''}"><span class="drill-tick" aria-hidden="true">${done(d.id)?'✓':''}</span><div><a class="drill-link" href="#drill/${d.id}">${esc(short(d))}</a>${d.scratch?' <span class="drill-tag">Write it yourself</span>':''}${done(d.id)?'<span class="sr-only"> (done)</span>':''}</div></li>`).join('')}</ol>`:''}${later?`<p class="micro">${later} more ${later===1?'drill opens':'drills open'} in Week ${Math.min(...all.filter(d=>d.week>getWeek()).map(d=>d.week))}.</p>`:''}</section>`;
  }
  // One line for the checklist rows: progress plus a link to the next drill.
  function skillLink(skillId){
    const open=drills.filter(d=>d.skill===skillId&&d.week<=getWeek());if(!open.length)return '';
    const n=open.filter(d=>done(d.id)).length,nextUp=open.find(d=>!done(d.id));
    return `<a class="drill-chip" href="#drill/${(nextUp||open[0]).id}">Code drills: ${n} of ${open.length} done</a>`;
  }
  function counts(){const list=released();return {done:list.filter(d=>done(d.id)).length,total:list.length};}

  function setFeedback(d,html){state.feedback[d.id]=html;}
  function verdictHTML(d,v){
    const next=released()[released().indexOf(d)+1];
    if(v.passed)return `<div class="feedback good"><strong>${v.tests?`All ${v.tests} tests passed.`:'Correct.'}</strong><p>Your code also worked on different data.${next?` <a href="#drill/${next.id}">Next: ${esc(short(next))} →</a>`:' That’s the last drill for now.'}</p></div>`;
    if(v.reason==='error')return '<div class="feedback needs-work"><strong>Your code stopped with an error.</strong><p>Read the last line of the error in the output below, fix it, and check again.</p></div>';
    if(v.reason==='tests'){const passed=v.tests.filter(t=>t.ok).length,labels=d.check.labels||[];return `<div class="feedback needs-work"><strong>${passed} of ${v.tests.length} tests passed.</strong><ul class="drill-tests">${v.tests.map((t,i)=>`<li>${t.ok?'✓':'✗'} ${labels[i]?esc(labels[i].text):`<code>${esc(t.expr)}</code>`}${t.ok?'':': '+(labels[i]?esc(labels[i].fail):code(t.message))}</li>`).join('')}</ul></div>`;}
    if(v.reason==='mismatch')return `<div class="feedback needs-work"><strong>Not yet.</strong><p>${code(v.message)}</p></div>`;
    if(v.reason==='changed-line')return `<div class="feedback needs-work"><strong>Not yet.</strong><p>Keep the starting line <code>${esc(v.line)}</code> exactly as it is. The checker changes it to test your code.</p></div>`;
    return `<div class="feedback needs-work"><strong>Your code gives the right answer here, but not when ${d.data==='none'?'the starting values change':'the table changes'}.</strong><p>Did you type in the result yourself? Use ${d.data==='none'?'the variables':'the table and its columns'} instead, so your code works for any ${d.data==='none'?'values':'data'}.</p></div>`;
  }
  // Checker messages are plain text with names in backticks.
  function code(text){return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>');}

  function stop(message){
    clearTimeout(runTimer);worker?.terminate();worker=null;runId++;
    const d=busy&&drills.find(x=>x.id===busy.drill);busy=null;state.status='';
    if(d&&message!==null)setFeedback(d,`<div class="feedback needs-work"><strong>${esc(message||'The run was stopped. Your code is still here.')}</strong></div>`);
  }
  function start(mode){
    const d=current();if(!d||busy)return;
    const editor=document.querySelector('#drill-code'),code=mode==='example'?'':editor.value;
    if(code.length>20000){setFeedback(d,'<div class="feedback error">Keep your code below 20,000 characters.</div>');refresh();return;}
    if(mode!=='example'){getProgress().drafts['drill:'+d.id]={code,updatedAt:new Date().toISOString()};save();}
    const id=++runId;busy={drill:d.id,mode};state.status=worker?'Running…':'Loading Python and pandas. The first run needs a download of about 30 MB.';
    if(mode==='example')delete state.example[d.id];
    try{
      if(!worker)worker=new Worker(new URL('./drill-worker.mjs?v=20261001-sql',import.meta.url),{type:'module'});
      worker.onerror=()=>{if(id===runId){stop('Python could not load. Check your connection and try again.');refresh();}};
      worker.onmessage=({data})=>{
        if(data.id!==runId)return;
        if(data.type==='loading')return;
        if(data.type==='running'){clearTimeout(runTimer);runTimer=setTimeout(()=>{stop('This took too long. Check for a loop that never ends, then try again.');refresh();},15000);state.status=mode==='check'?'Checking your code…':'Running…';if(state.id===d.id)refresh();return;}
        clearTimeout(runTimer);busy=null;state.status='';
        if(data.type==='error')setFeedback(d,`<div class="feedback error"><strong>Something went wrong.</strong><p>${esc(data.message)}</p></div>`);
        else if(mode==='example')state.example[d.id]=data.output;
        else{
          state.output[d.id]=data.output;
          if(mode==='run')setFeedback(d,data.ok?'':'<div class="feedback needs-work"><strong>Your code stopped with an error.</strong><p>Read the last line of the error below first.</p></div>');
          else{
            const v=data.verdict,results=getProgress().drills??={},before=results[d.id];
            track('drill',d.skill,v.passed?'pass':'fail',d.id);
            results[d.id]={passed:!!before?.passed||v.passed,updatedAt:new Date().toISOString()};save();
            setFeedback(d,verdictHTML(d,v));
            announce(v.passed?'Correct. Drill done.':'Not yet. Read the feedback.');
          }
        }
        if(state.id===d.id)refresh();
      };
      runTimer=setTimeout(()=>{stop('Python did not finish loading. Check your connection and try again.');refresh();},120000);
      worker.postMessage({id,mode,drillId:d.id,code});
    }catch{stop('This browser could not start Python. Try a current browser.');}
    refresh();
  }

  function action(name){
    const d=current();if(!d)return name==='drill-filter-all'&&(state.filter='all',true);
    if(name==='drill-check')start('check');
    if(name==='drill-run')start('run');
    if(name==='drill-example')start('example');
    if(name==='drill-stop'){stop();return true;}
    if(name==='drill-hint'){state.hints[d.id]=Math.min((state.hints[d.id]||0)+1,d.hints.length);return true;}
    if(name==='drill-answer'){state.answer[d.id]=true;return true;}
    if(name==='drill-reset'){delete getProgress().drafts['drill:'+d.id];save();delete state.output[d.id];setFeedback(d,'');announce('Back to the starting code.');return true;}
    return false;
  }
  function change(target){if(target.id!=='drill-filter')return false;state.filter=target.value;return true;}
  function input(target){if(target.id!=='drill-code'||!state.id)return;getProgress().drafts['drill:'+state.id]={code:target.value,updatedAt:new Date().toISOString()};save();}
  function keydown(e){
    if(e.target.id!=='drill-code')return;
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();start('check');return;}
    // Keep the current indentation on a new line, and indent after a colon.
    if(e.key==='Enter'&&!e.shiftKey&&!e.altKey){const t=e.target,before=t.value.slice(0,t.selectionStart),line=before.slice(before.lastIndexOf('\n')+1),indent=line.match(/^ */)[0]+(/:\s*$/.test(line)?'    ':'');if(!indent)return;e.preventDefault();t.setRangeText('\n'+indent,t.selectionStart,t.selectionEnd,'end');input(t);}
  }
  function reset(){stop(null);state.hints={};state.answer={};state.output={};state.example={};state.feedback={};}
  return {renderList,renderDrill,route,action,change,input,keydown,skillSection,skillLink,counts,stop,reset,isBusy:()=>!!busy,current:()=>state.id};
}
