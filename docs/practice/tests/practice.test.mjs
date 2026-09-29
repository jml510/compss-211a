import {getCourseWeek,nextWeekRelease,weekReleases} from '../schedule.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {skills} from '../catalog.mjs';
import {skillChecks,checkSkillAnswer} from '../skill-checks.mjs';
import {checkFilter,checkDebug,functions,freshProgress,validateProgress,mergeProgress} from '../exercises.mjs';
import {drills,drillSetup,drillSetupVariant,drillTopics,variantCode} from '../drills.mjs';
import {weekReleases as releases} from '../schedule.mjs';
test('filters handle inclusive/exclusive boundaries, AND, OR and missing values',()=>{
  assert.equal(checkFilter(0,['B','C','E']).passed,true);
  assert.equal(checkFilter(0,['C','E']).passed,false);
  assert.deepEqual(checkFilter(0,['B','C','D','E']).extra,['D']);
  assert.equal(checkFilter(1,['C','E']).passed,true);
  assert.equal(checkFilter(1,['B','C','E']).passed,false);
  assert.equal(checkFilter(2,['A','B','C','D','E','F']).passed,true);
  assert.deepEqual(checkFilter(2,['A','B','C','D','E']).missing,['F']);
});
test('debugging requires both the diagnosis and the question-preserving repair',()=>{
  assert.equal(checkDebug(0,0,0).passed,true);
  assert.equal(checkDebug(0,0,1).passed,false);
  assert.equal(checkDebug(1,1,2).passed,true);
  assert.equal(checkDebug(1,1,0).passed,false);
  assert.equal(checkDebug(2,0,1).passed,true);
});
test('all worked Python solutions pass the real boundary and missing-value cases',()=>{
  const py='import json,sys\nitems=json.load(sys.stdin)\nfor item in items:\n ns={}\n exec(item["solution"],ns)\n for t in item["tests"]:\n  actual=ns[item["name"]](t["input"])\n  assert actual==t["expected"],(t,actual)\nprint("16 Python cases passed")';
  const result=spawnSync('python3',['-c',py],{input:JSON.stringify(functions),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
test('backups keep permanent skill IDs, validate content and ignore unknown keys',()=>{
  const p=freshProgress();p.ratings['writing-functions']={value:'yellow',updatedAt:'2026-09-23T12:00:00Z'};
  p.ratings.unknown={value:'green',updatedAt:'2026-09-23T12:00:00Z'};
  const restored=validateProgress(JSON.parse(JSON.stringify(p)),skills.map(s=>s.id));
  assert.equal(restored.ratings['writing-functions'].value,'yellow');
  assert.equal(restored.ratings.unknown,undefined);
  p.ratings['writing-functions'].value='invented';assert.throws(()=>validateProgress(p,skills.map(s=>s.id)));
  assert.throws(()=>validateProgress({version:9,ratings:{}},[]));
});
test('restore merges attempts and does not overwrite newer local ratings or drafts',()=>{
  const a=freshProgress(),b=freshProgress();a.ratings.x={value:'yellow',updatedAt:'2026-09-24T12:00:00Z'};b.ratings.x={value:'red',updatedAt:'2026-09-23T12:00:00Z'};
  a.attempts.filter={tried:[0,1],passed:[0],updatedAt:'2026-09-24T12:00:00Z'};b.attempts.filter={tried:[0,2],passed:[2],updatedAt:'2026-09-23T12:00:00Z'};
  a.drafts['function:0']={code:'new',updatedAt:'2026-09-24T12:00:00Z'};b.drafts['function:0']={code:'old',updatedAt:'2026-09-23T12:00:00Z'};
  const merged=mergeProgress(a,b);assert.equal(merged.ratings.x.value,'yellow');assert.deepEqual(merged.attempts.filter.passed,[0,2]);assert.equal(merged.drafts['function:0'].code,'new');
});
test('covered-so-far selection excludes later skills while the full catalog retains them',()=>{
  assert.equal(skills.length,57);assert.equal(new Set(skills.map(s=>s.id)).size,57);
  assert.equal(skills.filter(s=>s.releaseWeek<=getCourseWeek(new Date("2026-09-24T12:00:00Z"))).some(s=>s.title==='SQL basics'),false);
  assert.ok(skills.some(s=>s.title==='SQL basics'));
  for(const s of skills){assert.ok(s.releaseWeek>=1);if(s.url)assert.ok(s.url.startsWith('https://github.com/macss-berkeley/compss-211a/blob/main/'));}
});

test('every catalog skill has a working activity and every quick check accepts exactly one answer',()=>{
  assert.equal(Object.keys(skillChecks).length,54);
  for(const s of skills){
    if(s.activity)continue;
    const c=skillChecks[s.id];assert.ok(c,s.id);
    assert.equal(c.answers.length,4,s.id);
    assert.equal(new Set(c.answers).size,4,s.id);
    assert.equal(c.answers.map((_,i)=>checkSkillAnswer(s.id,i).passed).filter(Boolean).length,1,s.id);
    assert.ok(c.explanation.length>50);assert.ok(c.hint.length>20);
  }
});
test('new skill-check results survive backup and older backups remain supported',()=>{
  const p=freshProgress();p.checks['sql-basics']={passed:true,updatedAt:'2026-09-24T12:00:00Z'};
  const restored=validateProgress(JSON.parse(JSON.stringify(p)),skills.map(s=>s.id));
  assert.equal(restored.checks['sql-basics'].passed,true);
  delete p.checks;assert.deepEqual(validateProgress(p,skills.map(s=>s.id)).checks,{});
});

test('weekly release follows Berkeley midnight and the two-week opening week',()=>{
  const week=iso=>getCourseWeek(new Date(iso));
  assert.equal(week('2026-08-31T06:59:59Z'),0);
  assert.equal(week('2026-08-31T07:00:00Z'),1);
  assert.equal(week('2026-09-07T07:00:00Z'),1);
  assert.equal(week('2026-09-14T06:59:59Z'),1);
  assert.equal(week('2026-09-14T07:00:00Z'),2);
  assert.equal(week('2026-09-28T06:59:59Z'),3);
  assert.equal(week('2026-09-28T07:00:00Z'),4);
  // DST has ended by the Week 9 release: midnight is now 08:00 UTC.
  assert.equal(week('2026-11-02T07:59:59Z'),8);
  assert.equal(week('2026-11-02T08:00:00Z'),9);
  assert.equal(week('2027-01-01T00:00:00Z'),13);
  assert.deepEqual(nextWeekRelease(new Date('2026-09-24T12:00:00Z')),{week:4,date:'2026-09-28'});
  assert.equal(nextWeekRelease(new Date('2026-12-01T12:00:00Z')),null);
});
test('every release retains earlier skills and unlocks only its scheduled skills',()=>{
  let previous=[];
  for(const [index,date] of weekReleases.entries()){
    const currentWeek=getCourseWeek(new Date(date+'T12:00:00Z'));
    assert.equal(currentWeek,index+1);
    const current=skills.filter(s=>s.releaseWeek<=currentWeek);
    assert.ok(previous.every(s=>current.includes(s)));
    assert.ok(current.filter(s=>!previous.includes(s)).every(s=>s.releaseWeek===currentWeek));
    previous=current;
  }
  assert.equal(previous.length,57);
});

test('every code drill has a stable ID, a real skill, a released week and a checkable answer',()=>{
  assert.equal(new Set(drills.map(d=>d.id)).size,drills.length);
  for(const d of drills){
    assert.ok(/^[a-z0-9-]+$/.test(d.id),d.id);
    assert.ok(skills.some(s=>s.id===d.skill),d.id);
    assert.ok(d.week>=1&&d.week<=releases.length&&drillTopics[d.week],d.id);
    assert.ok(Object.hasOwn(drillSetup,d.data)&&Object.hasOwn(drillSetupVariant,d.data),d.id);
    assert.ok(d.title&&d.task&&d.starter!==undefined&&d.solution&&d.check.exprs.length&&d.hints.length,d.id);
    if(!d.scratch)assert.ok(d.intro&&d.example,d.id);
    // Starting lines the checker swaps must be in both the starter and the model answer.
    for(const [from] of d.check.variants||[]){assert.ok(d.starter.includes(from),d.id);assert.ok(d.solution.includes(from),d.id);}
    assert.equal(variantCode(d,d.starter).missing,undefined,d.id);
  }
});
test('backups keep drill results and drafts, and a passed drill stays passed after a merge',()=>{
  const a=freshProgress(),b=freshProgress(),ids=skills.map(s=>s.id);
  a.drills.merge={passed:true,updatedAt:'2026-10-06T12:00:00Z'};a.drafts['drill:merge']={code:'joined = 1',updatedAt:'2026-10-06T12:00:00Z'};
  b.drills.merge={passed:false,updatedAt:'2026-10-07T12:00:00Z'};b.drills.unknown={passed:true,updatedAt:'2026-10-07T12:00:00Z'};
  const restored=validateProgress(JSON.parse(JSON.stringify(b)),ids);assert.equal(restored.drills.unknown,undefined);
  const merged=mergeProgress(validateProgress(JSON.parse(JSON.stringify(a)),ids),restored);
  assert.equal(merged.drills.merge.passed,true);assert.equal(merged.drafts['drill:merge'].code,'joined = 1');
  a.drills.merge.passed='yes';assert.throws(()=>validateProgress(a,ids));
});
