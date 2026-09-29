import {availableCards,dueCards,reviewOptions,scheduleReview,setCardSuspended,intervalLabel} from './flashcards.mjs?v=20260929-ux';
export function createFlashcards({getProgress,save,getWeek,skills,esc,title,track=()=>{}}){
  const state={deck:'all',scope:'covered',skill:null,card:null,revealed:false,note:'',draft:'',knownOpen:false};
  const reviews=()=>getProgress().flashcards||{};
  const available=()=>availableCards({week:getWeek(),scope:state.scope,deck:state.deck,skill:state.skill});
  const active=()=>available().filter(c=>!reviews()[c.id]?.suspended);
  function reset(){state.card=null;state.revealed=false;state.draft='';state.note='';state.knownOpen=false;}
  function route(skill){if(state.skill!==(skill||null)){reset();state.skill=skills.some(s=>s.id===skill)?skill:null;if(state.skill){state.deck='all';state.scope='all';}else state.scope='covered';}}
  function render(){
    const cards=available(),reviewCards=active(),known=cards.filter(c=>reviews()[c.id]?.suspended),due=dueCards(cards,reviews());
    if(state.card&&!reviewCards.some(c=>c.id===state.card))reset();
    if(!state.card&&due.length)state.card=due[0].id;
    const card=reviewCards.find(c=>c.id===state.card),skill=skills.find(s=>s.id===card?.skill);
    const pending=reviewCards.filter(c=>reviews()[c.id]).sort((a,b)=>Date.parse(reviews()[a.id].dueAt)-Date.parse(reviews()[b.id].dueAt));
    const next=pending[0]&&reviews()[pending[0].id].dueAt;
    return title('Flashcards','Answer from memory, then reveal the answer.')+`
      ${state.skill?`<p><a href="#flashcards">All flashcards</a> · ${esc(skills.find(s=>s.id===state.skill).title)}</p>`:''}
      <div class="filters flash-filters"><label>Deck<select id="flash-deck"><option value="all">All decks</option>${['Python','pandas','SQL','Analysis'].map(d=>`<option value="${d}" ${state.deck===d?'selected':''}>${d}</option>`).join('')}</select></label><label>Coverage<select id="flash-scope"><option value="covered" ${state.scope==='covered'?'selected':''}>Through Week ${getWeek()}</option><option value="all" ${state.scope==='all'?'selected':''}>Entire course</option></select></label></div>
      <p class="flash-stats">${due.filter(c=>reviews()[c.id]?.reviews>0).length} due · ${due.filter(c=>!reviews()[c.id]?.reviews).length} new · ${known.length} already known · ${cards.length} ${cards.length===1?'card':'cards'}</p>
      ${state.note?`<p class="micro" role="status">${esc(state.note)}</p>`:''}
      ${card?`<article class="flashcard" data-card-id="${card.id}">
        <div class="flash-meta">${card.deck} · ${esc(skill.title)}${skill.releaseWeek>getWeek()?' · Later in the course':''}</div>
        <h2 id="flash-question" tabindex="-1">${esc(card.prompt)}</h2>
        ${card.code?`<pre class="code">${esc(card.code)}</pre>`:''}
        ${!state.revealed?`<label class="editor-label" for="flash-draft">Your answer (optional)</label><textarea id="flash-draft" class="flash-draft" rows="3" spellcheck="false">${esc(state.draft)}</textarea><button class="primary" data-action="flash-reveal">Show answer</button>`:`
          ${state.draft?`<details><summary>Your answer</summary><pre class="flash-written">${esc(state.draft)}</pre></details>`:''}
          <section class="flash-answer" aria-label="Answer"><h3>Answer</h3>${card.answer?`<p>${esc(card.answer)}</p>`:''}${card.answerCode?`<pre class="code">${esc(card.answerCode)}</pre>`:''}${card.explanation?`<p>${esc(card.explanation)}</p>`:''}</section>
          <div class="flash-ratings" aria-label="Choose the next review interval">${reviewOptions(reviews()[card.id]).map(o=>`<button data-action="flash-grade" data-grade="${o.grade}"><strong>${o.label}</strong><span>${intervalLabel(o.days)}</span></button>`).join('')}</div>`}
        <div class="flash-known-action"><button data-action="flash-suspend">Already know this</button><span>Remove from regular review.</span></div>
        <a class="flash-skill" href="#skill/${card.skill}">Practise this skill</a>
      </article>`:`<section class="panel flash-empty"><h2>${cards.length?'No cards due':'No cards in this selection'}</h2>${next?`<p>Next review: ${esc(new Date(next).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))} (your local time).</p><button data-action="flash-ahead">Review ahead</button>`:known.length?'<p>You can bring cards back using “Already known” below.</p>':'<p>Change the deck or coverage filter to see more cards.</p>'}<a class="flash-skill" href="#skills">Skills checklist</a></section>`}
      ${known.length?`<details class="flash-known" ${state.knownOpen?'open':''}><summary>Already known (${known.length})</summary><ul>${known.map(c=>`<li><span>${esc(c.prompt)}</span><button data-action="flash-restore" data-card="${c.id}" aria-label="Add to review: ${esc(c.prompt)}">Add to review</button></li>`).join('')}</ul></details>`:''}`;
  }
  function action(name,button){
    if(name==='flash-reveal'&&state.card){state.revealed=true;return true;}
    if(name==='flash-grade'&&state.card&&state.revealed){
      const grade=button.dataset.grade;if(!['again','hard','good','easy'].includes(grade))return false;
      const card=available().find(c=>c.id===state.card);if(card)track('flashcard',card.skill,grade,'flashcard');
      const p=getProgress(),next=scheduleReview(reviews()[state.card],grade);
      p.flashcards??={};p.flashcards[state.card]=next;
      save();reset();state.note=`Saved. Next review: ${new Date(next.dueAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}.`;return true;
    }
    if(name==='flash-suspend'&&state.card){
      const p=getProgress();p.flashcards??={};p.flashcards[state.card]=setCardSuspended(reviews()[state.card],true);
      save();reset();state.note='Removed from review. Find it under “Already known” to bring it back.';return true;
    }
    if(name==='flash-restore'){
      const id=button.dataset.card;if(!available().some(c=>c.id===id)||!reviews()[id]?.suspended)return false;
      getProgress().flashcards[id]=setCardSuspended(reviews()[id],false);save();reset();state.knownOpen=true;state.card=id;state.note='Added back to review.';return true;
    }
    if(name==='flash-ahead'){
      const card=active().filter(c=>reviews()[c.id]).sort((a,b)=>Date.parse(reviews()[a.id].dueAt)-Date.parse(reviews()[b.id].dueAt))[0];
      if(card){reset();state.card=card.id;state.note='Reviewing before the scheduled date.';}return true;
    }
    return false;
  }
  function change(target){if(target.id==='flash-deck'){state.deck=target.value;reset();return true;}if(target.id==='flash-scope'){state.scope=target.value;reset();return true;}return false;}
  function input(target){if(target.id==='flash-draft')state.draft=target.value;}
  return {render,action,change,input,route,reset};
}
